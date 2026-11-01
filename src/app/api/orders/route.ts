import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";
import { staffAuditActor, writeAuditLog } from "@/lib/auditLog";
import {
  assertSameIdempotentRequest,
  idempotencyErrorResponse,
  idempotencyRequestHash,
  lockIdempotencyKey,
  requireIdempotencyKey,
} from "@/lib/idempotency";
import { normalizeOrderLine, type OrderLineInput } from "@/lib/orderLineNormalizer";
import { dispatchOrderCreatedNotification } from "@/lib/notifier";
import { sendKitchenOrderCreatedPush } from "@/lib/kitchenPush";
import { sendCustomerOrderCreatedPush } from "@/lib/customerOrderPush";
import {
  deliveryPricingHttpStatus,
  resolveDeliveryPricing,
  type DeliveryPricingSettings,
} from "@/lib/deliveryPricing";
import {
  isInKitchenWindow,
  ORDER_KITCHEN_LEAD_MINUTES,
  kitchenLeadMilliseconds,
  parseScheduledFor,
  scheduleStatusForKitchen,
  validateFutureSchedule,
  validateScheduledServiceHours,
} from "@/lib/orderScheduling";

const SETTINGS_KEY = "pos_settings";

type FulfillmentType = "DELIVERY" | "PICKUP" | "STORE";
type DiscountMode = "NONE" | "COUPON" | "MANUAL";
type PaymentMethod = { id: string; name: string; active?: boolean };
type PosSettings = DeliveryPricingSettings & {
  paymentMethods?: PaymentMethod[];
  store?: {
    serviceHours?: unknown;
  };
};

function money(value: number) {
  return Math.round(value);
}

function parseSettings(value: Prisma.JsonValue | null): PosSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as unknown as PosSettings;
}

function isCash(method: PaymentMethod) {
  return method.id.toLowerCase() === "cash" || method.name.trim().toLowerCase() === "efectivo";
}

const POS_ORDER_INCLUDE = {
  customer: true,
  address: true,
  items: {
    include: {
      product: {
        select: {
          id: true,
          type: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
  },
  payments: {
    include: { refunds: { orderBy: { refundedAt: "asc" } } },
  },
} satisfies Prisma.OrderInclude;

type PosCreatedOrder = Prisma.OrderGetPayload<{
  include: typeof POS_ORDER_INCLUDE;
}>;

function posOrderPayload(order: PosCreatedOrder) {
  return {
    id: order.id,
    sequenceNumber: order.sequenceNumber,
    code: `POS-${String(order.sequenceNumber).padStart(4, "0")}`,
    status: order.status,
    fulfillmentType: order.fulfillmentType,
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.deliveryFee),
    discount: Number(order.discount),
    total: Number(order.total),
    scheduledFor: order.scheduledFor,
    createdAt: order.createdAt,
  };
}

function replayedPosOrderResponse(order: PosCreatedOrder) {
  return NextResponse.json(
    {
      order: posOrderPayload(order),
      notification: {
        ok: false,
        status: "skipped",
        reason: "La solicitud ya había sido procesada.",
      },
      replayed: true,
    },
    {
      status: 200,
      headers: { "Idempotency-Replayed": "true" },
    },
  );
}

export async function GET(request: NextRequest) {
  try {
    const kitchenScope =
      request.nextUrl.searchParams.get("scope") === "kitchen";
    const kitchenLeadSetting = await prisma.appSetting.findUnique({
      where: { key: "kitchen_preparation_settings" },
      select: { value: true },
    });
    const rawKitchenLead = kitchenLeadSetting?.value && typeof kitchenLeadSetting.value === "object"
      ? Number((kitchenLeadSetting.value as { leadMinutes?: unknown }).leadMinutes)
      : ORDER_KITCHEN_LEAD_MINUTES;
    const kitchenLeadMinutes = [15, 20, 25, 30, 35, 40, 45, 50, 60].includes(rawKitchenLead)
      ? rawKitchenLead
      : ORDER_KITCHEN_LEAD_MINUTES;
    const kitchenScheduleCutoff = new Date(
      Date.now() + kitchenLeadMilliseconds(kitchenLeadMinutes),
    );

    const kitchenWhere: Prisma.OrderWhereInput | undefined =
      kitchenScope
        ? {
            status: { in: ["CONFIRMED", "PREPARING"] },
            OR: [
              { scheduledFor: null },
              { scheduledFor: { lte: kitchenScheduleCutoff } },
            ],
          }
        : undefined;

    const orders = await prisma.order.findMany({
      where: kitchenWhere,
      orderBy: { createdAt: "desc" },
      take: kitchenScope ? undefined : 100,
      include: {
        customer: true,
        address: true,
        driver: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                type: true,
                category: { select: { name: true, slug: true } },
              },
            },
          },
        },
        payments: {
          include: { refunds: { orderBy: { refundedAt: "asc" } } },
        },
      },
    });
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Orders list error", error);
    return NextResponse.json({ error: "No fue posible cargar los pedidos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const idempotencyKey = requireIdempotencyKey(request);
    const idempotencyHash = idempotencyRequestHash({
      operation: "POS_ORDER_CREATE",
      body,
    });

    const existingOrder = await prisma.order.findUnique({
      where: { idempotencyKey },
      include: POS_ORDER_INCLUDE,
    });
    if (existingOrder) {
      assertSameIdempotentRequest(existingOrder.idempotencyHash, idempotencyHash);
      return replayedPosOrderResponse(existingOrder);
    }
    let scheduledFor: Date | null = null;
    try {
      scheduledFor = validateFutureSchedule(
        parseScheduledFor(body.scheduledFor),
      );
    } catch (scheduleError) {
      return NextResponse.json(
        {
          error:
            scheduleError instanceof Error
              ? scheduleError.message
              : "La fecha programada no es válida.",
        },
        { status: 400 },
      );
    }

    const fulfillmentType = body.fulfillmentType as FulfillmentType;
    if (!(["DELIVERY", "PICKUP", "STORE"] as string[]).includes(fulfillmentType)) {
      return NextResponse.json({ error: "Tipo de pedido inválido." }, { status: 400 });
    }

    const lines = Array.isArray(body.items) ? body.items as (OrderLineInput & { notes?: unknown })[] : [];
    if (!lines.length) return NextResponse.json({ error: "El pedido no tiene productos." }, { status: 400 });
    if (lines.some((line) => !Number.isInteger(Number(line.productId)) || Number(line.quantity) < 1)) {
      return NextResponse.json({ error: "Hay líneas de pedido inválidas." }, { status: 400 });
    }

    const customerId = body.customerId == null ? null : Number(body.customerId);
    if ((fulfillmentType === "DELIVERY" || fulfillmentType === "PICKUP") && !customerId) {
      return NextResponse.json({ error: "Este tipo de pedido requiere cliente." }, { status: 400 });
    }

    let customer = null;
    let address = null;
    if (customerId) {
      customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { addresses: true } });
      if (!customer) return NextResponse.json({ error: "El cliente ya no existe." }, { status: 400 });
      if (fulfillmentType === "DELIVERY") {
        address = customer.addresses.find((item) => item.id === Number(body.addressId)) ?? customer.addresses[0] ?? null;
        if (!address) return NextResponse.json({ error: "El domicilio requiere una dirección registrada." }, { status: 400 });
      }
    }

    const settingsRow = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    const settings = parseSettings(settingsRow?.value ?? null);
    const kitchenLeadSetting = await prisma.appSetting.findUnique({
      where: { key: "kitchen_preparation_settings" },
      select: { value: true },
    });
    const rawKitchenLead = kitchenLeadSetting?.value && typeof kitchenLeadSetting.value === "object"
      ? Number((kitchenLeadSetting.value as { leadMinutes?: unknown }).leadMinutes)
      : ORDER_KITCHEN_LEAD_MINUTES;
    const kitchenLeadMinutes = [15, 20, 25, 30, 35, 40, 45, 50, 60].includes(rawKitchenLead)
      ? rawKitchenLead
      : ORDER_KITCHEN_LEAD_MINUTES;

    try {
      validateScheduledServiceHours(
        scheduledFor,
        settings.store?.serviceHours,
      );
    } catch (scheduleError) {
      return NextResponse.json(
        {
          error:
            scheduleError instanceof Error
              ? scheduleError.message
              : "La hora programada está fuera del horario de servicio.",
        },
        { status: 400 },
      );
    }

    const paymentMethod = settings.paymentMethods?.find((method) => method.id === String(body.paymentMethodId) && method.active !== false);
    if (!paymentMethod) return NextResponse.json({ error: "El medio de pago seleccionado ya no está activo." }, { status: 400 });

    let deliveryFee = 0;
    let deliveryZoneId: string | null = null;
    let deliveryZoneName: string | null = null;
    let deliveryDistanceMeters: number | null = null;

    if (fulfillmentType === "DELIVERY") {
      try {
        const pricing = resolveDeliveryPricing({
          settings,
          destination: {
            latitude: Number(address?.latitude),
            longitude: Number(address?.longitude),
          },
        });

        if (!pricing.covered || !pricing.band) {
          return NextResponse.json(
            {
              error:
                "La dirección está fuera de la cobertura configurada para domicilios.",
            },
            { status: 400 },
          );
        }

        deliveryFee = pricing.deliveryFee ?? 0;
        deliveryZoneId = pricing.deliveryZoneId;
        deliveryZoneName = pricing.deliveryZoneName;
        deliveryDistanceMeters = Math.round(
          pricing.commercialDistanceMeters,
        );

        if (body.deliveryFeeOverride != null) {
          const requestedDeliveryFee = Number(body.deliveryFeeOverride);
          if (
            !Number.isFinite(requestedDeliveryFee) ||
            requestedDeliveryFee < 0
          ) {
            return NextResponse.json(
              { error: "El valor manual del domicilio no es válido." },
              { status: 400 },
            );
          }
          deliveryFee = money(requestedDeliveryFee);
        }
      } catch (pricingError) {
        return NextResponse.json(
          {
            error:
              pricingError instanceof Error
                ? pricingError.message
                : "No fue posible calcular el domicilio.",
          },
          { status: deliveryPricingHttpStatus(pricingError) },
        );
      }
    }

    const normalizedLines = await Promise.all(lines.map(normalizeOrderLine));
    const beveragesCategory = await prisma.category.findUnique({
      where: { slug: "bebidas" },
      select: { id: true },
    });
    const beverageCategoryId = beveragesCategory?.id ?? null;
    const requiresKitchen = (categoryId: number) => beverageCategoryId == null || categoryId !== beverageCategoryId;
    const hasKitchenPreparation = normalizedLines.some((line) => requiresKitchen(line.product.categoryId));

    const subtotal = normalizedLines.reduce((sum, line) => sum + line.lineTotal, 0);
    const eligibleSubtotal = normalizedLines.filter((line) => line.eligible).reduce((sum, line) => sum + line.lineTotal, 0);

    const discountMode = (["NONE", "COUPON", "MANUAL"] as string[]).includes(String(body.discountMode))
      ? String(body.discountMode) as DiscountMode
      : "NONE";

    let discount = 0;
    let couponId: number | null = null;
    let couponName: string | null = null;

    if (discountMode === "COUPON") {
      couponId = Number(body.couponId);
      if (!couponId) return NextResponse.json({ error: "Selecciona un cupón válido." }, { status: 400 });
      const coupon = await prisma.coupon.findFirst({
        where: { id: couponId, active: true, visibleInPos: true },
      });
      if (!coupon) return NextResponse.json({ error: "El cupón seleccionado ya no está activo." }, { status: 400 });
      couponName = coupon.name;
      discount = coupon.type === "PERCENTAGE"
        ? money(eligibleSubtotal * (Number(coupon.value) / 100))
        : Math.min(money(Number(coupon.value)), eligibleSubtotal);
    } else if (discountMode === "MANUAL") {
      const requested = money(Math.max(0, Number(body.manualDiscount ?? 0)));
      if (requested > eligibleSubtotal) return NextResponse.json({ error: "El descuento manual supera la base elegible." }, { status: 400 });
      discount = requested;
    }

    const total = Math.max(0, subtotal + deliveryFee - discount);
    const cashPayment = isCash(paymentMethod);
    const cashReceivedValue = money(Number(body.cashReceived ?? 0));
    if (cashPayment && (!Number.isFinite(cashReceivedValue) || cashReceivedValue < total)) {
      return NextResponse.json({ error: "El efectivo recibido debe ser igual o mayor al total." }, { status: 400 });
    }
    const cashReceived = cashPayment ? cashReceivedValue : null;
    const changeDue = cashPayment ? cashReceivedValue - total : null;

    const creation = await prisma.$transaction(async (tx) => {
      await lockIdempotencyKey(tx, idempotencyKey);

      const replayedOrder = await tx.order.findUnique({
        where: { idempotencyKey },
        include: POS_ORDER_INCLUDE,
      });
      if (replayedOrder) {
        assertSameIdempotentRequest(
          replayedOrder.idempotencyHash,
          idempotencyHash,
        );
        return { order: replayedOrder, replayed: true as const };
      }

      const sequence = await tx.orderSequence.upsert({
        where: { id: 1 },
        create: { id: 1, current: 1 },
        update: { current: { increment: 1 } },
      });

      const createdOrder = await tx.order.create({
        data: {
          sequenceNumber: sequence.current,
          idempotencyKey,
          idempotencyHash,
          customerId: customer?.id ?? null,
          addressId: fulfillmentType === "DELIVERY" ? address?.id ?? null : null,
          couponId,
          couponName,
          deliveryZoneId,
          deliveryZoneName,
          deliveryDistanceMeters,
          discountSource: discountMode,
          status: scheduleStatusForKitchen(
            hasKitchenPreparation,
            scheduledFor,
            new Date(),
            kitchenLeadMinutes,
          ),
          fulfillmentType,
          source: "POS",
          subtotal,
          deliveryFee,
          discount,
          total,
          notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
          scheduledFor,
          items: {
            create: normalizedLines.map((line, index) => {
              const rawNote = typeof lines[index]?.notes === "string" ? lines[index].notes.trim() : "";
              return {
                productId: line.product.id,
                productName: line.product.name,
                unitPrice: line.unitPrice,
                quantity: line.quantity,
                preparedQuantity: requiresKitchen(line.product.categoryId) ? 0 : line.quantity,
                lineTotal: line.lineTotal,
                configuration: line.configuration,
                notes: rawNote ? rawNote.slice(0, 120) : null,
              };
            }),
          },
          payments: {
            create: {
              method: paymentMethod.name,
              amount: total,
              cashReceived,
              changeDue,
              status: "PENDING",
            },
          },
        },
        include: POS_ORDER_INCLUDE,
      });

      if (discount > 0) {
        await writeAuditLog(tx, {
          actor: staffAuditActor(session),
          action: "ORDER_DISCOUNT_APPLIED",
          entityType: "ORDER",
          entityId: createdOrder.id,
          summary: `Descuento de ${Math.round(discount).toLocaleString("es-CO")} aplicado al pedido #${createdOrder.sequenceNumber ?? createdOrder.id}.`,
          after: {
            discount,
            discountSource: discountMode,
            couponId,
            couponName,
            subtotal,
            total,
          },
          metadata: {
            sequenceNumber: createdOrder.sequenceNumber,
            source: "POS",
            eligibleSubtotal,
          },
          source: "api/orders",
        });
      }

      return { order: createdOrder, replayed: false as const };
    });

    const { order, replayed } = creation;
    if (replayed) {
      return replayedPosOrderResponse(order);
    }

    const code = `POS-${String(order.sequenceNumber).padStart(4, "0")}`;
    let notification:
      | Awaited<ReturnType<typeof dispatchOrderCreatedNotification>>
      | { ok: false; status: "skipped"; reason: string } = {
      ok: false,
      status: "skipped",
      reason: "El pedido no tiene un cliente con teléfono.",
    };

    if (customer?.id && customer.phone) {
      notification = await dispatchOrderCreatedNotification({
        orderId: order.id,
        customerId: customer.id,
        customerName: customer.name,
        phone: `${customer.countryCode ?? "+57"}${customer.phone}`,
        orderCode: code,
        total: Number(order.total),
        fulfillmentType: order.fulfillmentType,
      });

      if (!notification.ok) {
        console.warn("Chatwoot order notification", {
          orderId: order.id,
          reason: notification.reason,
        });
      }
    }

    if (
      hasKitchenPreparation &&
      isInKitchenWindow(order.scheduledFor)
    ) {
      try {
        const kitchenPush = await sendKitchenOrderCreatedPush({
          orderId: order.id,
          orderCode: code,
          fulfillmentType: order.fulfillmentType,
        });

        if (!kitchenPush.ok) {
          console.warn("Kitchen new-order push", {
            orderId: order.id,
            reason: kitchenPush.reason,
          });
        }
      } catch (pushError) {
        console.warn("Kitchen new-order push failed", {
          orderId: order.id,
          error:
            pushError instanceof Error
              ? pushError.message
              : "Unknown push error",
        });
      }
    }

    if (customer?.id) {
      try {
        const customerPush = await sendCustomerOrderCreatedPush({
          customerId: customer.id,
          orderId: order.id,
          orderCode: code,
          status: order.status,
          fulfillmentType: order.fulfillmentType,
        });

        if (!customerPush.ok && customerPush.targeted > 0) {
          console.warn("Customer order created push", {
            orderId: order.id,
            customerId: customer.id,
            reason: customerPush.reason,
          });
        }
      } catch (pushError) {
        console.warn("Customer order created push failed", {
          orderId: order.id,
          customerId: customer.id,
          error:
            pushError instanceof Error
              ? pushError.message
              : "Unknown push error",
        });
      }
    }

    return NextResponse.json(
      {
        order: posOrderPayload(order),
        notification,
        replayed: false,
      },
      { status: 201 },
    );
  } catch (error) {
    const idempotencyError = idempotencyErrorResponse(error);
    if (idempotencyError) {
      return NextResponse.json(idempotencyError.body, {
        status: idempotencyError.status,
      });
    }

    console.error("Order creation error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible crear el pedido." }, { status: 500 });
  }
}
