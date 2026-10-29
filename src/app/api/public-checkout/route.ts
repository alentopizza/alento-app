import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertSameIdempotentRequest,
  idempotencyErrorResponse,
  idempotencyRequestHash,
  lockIdempotencyKey,
  requireIdempotencyKey,
} from "@/lib/idempotency";
import { getCustomerSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/auditLog";
import {
  consumeRateLimit,
  rateLimitExceededResponse,
  requestClientIp,
} from "@/lib/rateLimit";
import { reverseGeocode } from "@/lib/googleMapsServer";
import {
  deliveryPricingHttpStatus,
  resolveDeliveryPricing,
  type DeliveryPricingSettings,
} from "@/lib/deliveryPricing";
import { normalizeOrderLine, type OrderLineInput } from "@/lib/orderLineNormalizer";
import { dispatchOrderCreatedNotification } from "@/lib/notifier";
import { sendKitchenOrderCreatedPush } from "@/lib/kitchenPush";
import { createOrderTrackingToken } from "@/lib/orderTracking";
import { sendCustomerContactWebhook } from "@/lib/customerContactWebhook";
import {
  formatServiceTime,
  getStoreServiceStatus,
} from "@/lib/storeServiceHours";

const SETTINGS_KEY = "pos_settings";

type PaymentMethod = {
  id: string;
  name: string;
  active?: boolean;
};

type SettingsValue = DeliveryPricingSettings & {
  paymentMethods?: PaymentMethod[];
  store?: {
    serviceHours?: unknown;
  };
};

function digits(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function money(value: number) {
  return Math.round(value);
}

function isCash(method: PaymentMethod) {
  return (
    method.id.toLowerCase() === "cash" ||
    method.name.trim().toLowerCase() === "efectivo"
  );
}

function activePayments(value: SettingsValue | null) {
  return (Array.isArray(value?.paymentMethods) ? value.paymentMethods : [])
    .filter((method) => method.active !== false)
    .map((method) => ({
      id: String(method.id || "").trim(),
      name: String(method.name || "").trim(),
      active: true,
    }))
    .filter((method) => method.id && method.name);
}

const PUBLIC_ORDER_INCLUDE = {
  customer: true,
  address: true,
  payments: true,
} satisfies Prisma.OrderInclude;

type PublicCreatedOrder = Prisma.OrderGetPayload<{
  include: typeof PUBLIC_ORDER_INCLUDE;
}>;

function trackingPathForOrder(orderId: number) {
  try {
    return `/seguimiento/${createOrderTrackingToken(orderId)}`;
  } catch {
    return null;
  }
}

function publicOrderPayload(
  order: PublicCreatedOrder,
  authenticatedCustomer: boolean,
) {
  const paymentMethod = order.payments[0]?.method ?? "";
  return {
    id: order.id,
    sequenceNumber: order.sequenceNumber,
    code: `WEB-${String(order.sequenceNumber).padStart(4, "0")}`,
    status: order.status,
    fulfillmentType: order.fulfillmentType,
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.deliveryFee),
    discount: Number(order.discount),
    couponName: order.couponName,
    total: Number(order.total),
    paymentMethod,
    trackingPath: trackingPathForOrder(order.id),
    authenticatedCustomer,
  };
}

async function replayedPublicOrderResponse(order: PublicCreatedOrder) {
  const session = await getCustomerSession();
  return NextResponse.json(
    {
      order: publicOrderPayload(order, Boolean(session)),
      notification: {
        ok: false,
        status: "skipped",
        reason: "La solicitud ya había sido procesada.",
      },
      contactWebhook: null,
      replayed: true,
    },
    {
      status: 200,
      headers: { "Idempotency-Replayed": "true" },
    },
  );
}

export async function GET() {
  try {
    const [saved, coupons] = await Promise.all([
      prisma.appSetting.findUnique({
        where: { key: SETTINGS_KEY },
      }),
      prisma.coupon.findMany({
        where: { active: true, visibleInCart: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, type: true, value: true },
      }),
    ]);
    const value = (saved?.value ?? null) as SettingsValue | null;

    const storeStatus = getStoreServiceStatus(
      value?.store?.serviceHours,
    );

    return NextResponse.json({
      paymentMethods: activePayments(value),
      coupons: coupons.map((coupon) => ({
        ...coupon,
        value: Number(coupon.value),
      })),
      storeStatus: {
        open: storeStatus.open,
        nextOpening: storeStatus.nextOpening
          ? {
              relativeLabel: storeStatus.nextOpening.relativeLabel,
              timeLabel: formatServiceTime(storeStatus.nextOpening.time),
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Public checkout settings error", error);
    return NextResponse.json(
      { error: "No fue posible cargar las formas de pago." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idempotencyKey = requireIdempotencyKey(request);
    const idempotencyHash = idempotencyRequestHash({
      operation: "WEB_ORDER_CREATE",
      body,
    });

    const existingOrder = await prisma.order.findUnique({
      where: { idempotencyKey },
      include: PUBLIC_ORDER_INCLUDE,
    });
    if (existingOrder) {
      assertSameIdempotentRequest(existingOrder.idempotencyHash, idempotencyHash);
      return replayedPublicOrderResponse(existingOrder);
    }

    const limit = await consumeRateLimit({
      scope: "public-checkout-create-ip",
      key: requestClientIp(request),
      limit: 12,
      windowMs: 10 * 60_000,
      blockMs: 10 * 60_000,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(
        limit,
        "Se realizaron demasiados intentos de compra. Intenta nuevamente en unos minutos.",
      );
    }
    const fulfillmentType =
      body?.fulfillmentType === "DELIVERY" ? "DELIVERY" : "PICKUP";

    const customerInput = body?.customer ?? {};
    const countryCode = text(customerInput.countryCode) || "+57";
    const phone = digits(customerInput.phone);
    const name = text(customerInput.name);
    const email = text(customerInput.email).toLowerCase();

    if (!name || name.toUpperCase() === "NUEVO") {
      return NextResponse.json(
        { error: "Escribe tu nombre para continuar." },
        { status: 400 },
      );
    }

    if (phone.length < 7) {
      return NextResponse.json(
        { error: "Ingresa un número de teléfono válido." },
        { status: 400 },
      );
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json(
        { error: "Revisa el correo electrónico." },
        { status: 400 },
      );
    }

    const rawLines = Array.isArray(body?.items)
      ? (body.items as (OrderLineInput & { notes?: unknown })[])
      : [];

    if (!rawLines.length) {
      return NextResponse.json(
        { error: "El pedido no tiene productos." },
        { status: 400 },
      );
    }

    const saved = await prisma.appSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });
    const settings = (saved?.value ?? null) as SettingsValue | null;
    const storeStatus = getStoreServiceStatus(
      settings?.store?.serviceHours,
    );

    if (!storeStatus.open) {
      return NextResponse.json(
        {
          error: storeStatus.nextOpening
            ? `El local está cerrado. Volvemos a recibir pedidos ${storeStatus.nextOpening.relativeLabel.toLowerCase()} a las ${formatServiceTime(storeStatus.nextOpening.time)}.`
            : "El local está cerrado en este momento.",
          code: "STORE_CLOSED",
          storeStatus: {
            open: false,
            nextOpening: storeStatus.nextOpening
              ? {
                  relativeLabel: storeStatus.nextOpening.relativeLabel,
                  timeLabel: formatServiceTime(storeStatus.nextOpening.time),
                }
              : null,
          },
        },
        { status: 409 },
      );
    }

    const paymentMethods = activePayments(settings);
    const paymentMethod = paymentMethods.find(
      (method) => method.id === text(body?.paymentMethodId),
    );

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Selecciona una forma de pago disponible." },
        { status: 400 },
      );
    }

    const normalizedLines = await Promise.all(
      rawLines.map((line) => normalizeOrderLine(line)),
    );

    const subtotal = normalizedLines.reduce(
      (sum, line) => sum + line.lineTotal,
      0,
    );
    const eligibleSubtotal = normalizedLines
      .filter((line) => line.eligible)
      .reduce((sum, line) => sum + line.lineTotal, 0);

    const requestedCouponId = Number(body?.couponId);
    const couponId =
      Number.isInteger(requestedCouponId) && requestedCouponId > 0
        ? requestedCouponId
        : null;
    const coupon = couponId
      ? await prisma.coupon.findFirst({
          where: { id: couponId, active: true, visibleInCart: true },
        })
      : null;

    if (couponId && !coupon) {
      return NextResponse.json(
        { error: "El cupón seleccionado ya no está disponible." },
        { status: 409 },
      );
    }

    const discount = coupon
      ? coupon.type === "PERCENTAGE"
        ? Math.round(eligibleSubtotal * (Number(coupon.value) / 100))
        : Math.min(Math.round(Number(coupon.value)), eligibleSubtotal)
      : 0;

    let deliveryFee = 0;
    let deliveryZoneId: string | null = null;
    let deliveryZoneName: string | null = null;
    let deliveryDistanceMeters: number | null = null;
    let resolvedDeliveryAddress: string | null = null;
    let resolvedDeliveryPlaceId: string | null = null;
    let resolvedDeliveryLatitude: number | null = null;
    let resolvedDeliveryLongitude: number | null = null;

    if (fulfillmentType === "DELIVERY") {
      const destination = body?.destination ?? {};
      const latitude = Number(destination.latitude);
      const longitude = Number(destination.longitude);

      try {
        const pricing = resolveDeliveryPricing({
          settings,
          destination: { latitude, longitude },
        });

        if (!pricing.covered || !pricing.band) {
          return NextResponse.json(
            { error: "La dirección quedó fuera de nuestra cobertura." },
            { status: 409 },
          );
        }

        deliveryFee = pricing.deliveryFee ?? 0;
        deliveryZoneId = pricing.deliveryZoneId;
        deliveryZoneName = pricing.deliveryZoneName;
        deliveryDistanceMeters = Math.round(
          pricing.commercialDistanceMeters,
        );
        resolvedDeliveryLatitude = pricing.destination.latitude;
        resolvedDeliveryLongitude = pricing.destination.longitude;
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

      resolvedDeliveryAddress = text(destination.formattedAddress);
      resolvedDeliveryPlaceId = text(destination.placeId) || null;

      if (!resolvedDeliveryAddress) {
        const geocoded = await reverseGeocode(
          resolvedDeliveryLatitude!,
          resolvedDeliveryLongitude!,
        );
        resolvedDeliveryAddress = geocoded.formattedAddress;
        resolvedDeliveryPlaceId =
          resolvedDeliveryPlaceId || geocoded.placeId || null;
      }
    }

    const total = Math.max(0, subtotal + deliveryFee - discount);
    const cashPayment = isCash(paymentMethod);
    const hasCashAmount =
      body?.cashReceived !== null &&
      body?.cashReceived !== undefined &&
      String(body.cashReceived).trim() !== "";
    const cashReceivedRaw = hasCashAmount ? Number(body.cashReceived) : null;
    const cashReceived =
      cashPayment && cashReceivedRaw != null ? money(cashReceivedRaw) : null;

    if (
      cashPayment &&
      cashReceivedRaw != null &&
      (!Number.isFinite(cashReceivedRaw) || (cashReceived ?? 0) < total)
    ) {
      return NextResponse.json(
        { error: `Si indicas "Paga con", el valor debe ser igual o mayor a ${total.toLocaleString("es-CO")}.` },
        { status: 400 },
      );
    }

    const changeDue =
      cashPayment && cashReceived != null ? cashReceived - total : null;

    const session = await getCustomerSession();
    const existingCustomer = session
      ? await prisma.customer.findUnique({
          where: { id: session.customerId },
          include: {
            addresses: {
              orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            },
          },
        })
      : await prisma.customer.findFirst({
          where: {
            OR: [
              { phone },
              { phone: `${digits(countryCode)}${phone}` },
            ],
          },
          include: {
            addresses: {
              orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            },
          },
        });

    const sessionOwnsCustomer =
      Boolean(session) && session?.customerId === existingCustomer?.id;

    const beveragesCategory = await prisma.category.findUnique({
      where: { slug: "bebidas" },
      select: { id: true },
    });
    const beverageCategoryId = beveragesCategory?.id ?? null;
    const requiresKitchen = (categoryId: number) =>
      beverageCategoryId == null || categoryId !== beverageCategoryId;
    const hasKitchenPreparation = normalizedLines.some((line) =>
      requiresKitchen(line.product.categoryId),
    );

    const creation = await prisma.$transaction(async (tx) => {
      await lockIdempotencyKey(tx, idempotencyKey);

      const replayedOrder = await tx.order.findUnique({
        where: { idempotencyKey },
        include: PUBLIC_ORDER_INCLUDE,
      });
      if (replayedOrder) {
        assertSameIdempotentRequest(
          replayedOrder.idempotencyHash,
          idempotencyHash,
        );
        return { order: replayedOrder, replayed: true as const };
      }

      let customer = existingCustomer;

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            name,
            countryCode,
            phone,
            email: email || null,
            contactWebhookPending: true,
          },
          include: {
            addresses: {
              orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            },
          },
        });
      } else if (sessionOwnsCustomer) {
        const becameNamedCustomer =
          customer.name.trim().toLocaleUpperCase("es") === "NUEVO" &&
          name.trim().toLocaleUpperCase("es") !== "NUEVO";

        customer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            name,
            countryCode,
            email: email || null,
            ...(becameNamedCustomer && !customer.contactWebhookSentAt
              ? { contactWebhookPending: true }
              : {}),
          },
          include: {
            addresses: {
              orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            },
          },
        });
      }

      let addressId: number | null = null;
      if (
        fulfillmentType === "DELIVERY" &&
        resolvedDeliveryAddress &&
        resolvedDeliveryLatitude != null &&
        resolvedDeliveryLongitude != null
      ) {
        const existingAddress = customer.addresses[0] ?? null;
        const mayReplaceSavedAddress =
          sessionOwnsCustomer || existingCustomer == null;

        if (existingAddress && mayReplaceSavedAddress) {
          const updatedAddress = await tx.customerAddress.update({
            where: { id: existingAddress.id },
            data: {
              address: resolvedDeliveryAddress,
              formattedAddress: resolvedDeliveryAddress,
              placeId: resolvedDeliveryPlaceId,
              latitude: resolvedDeliveryLatitude,
              longitude: resolvedDeliveryLongitude,
              city: existingAddress.city || "Bogotá",
              isDefault: true,
            },
          });
          addressId = updatedAddress.id;

          await tx.customerAddress.deleteMany({
            where: {
              customerId: customer.id,
              id: { not: existingAddress.id },
            },
          });
        } else if (
          existingAddress &&
          !mayReplaceSavedAddress &&
          ((resolvedDeliveryPlaceId &&
            existingAddress.placeId === resolvedDeliveryPlaceId) ||
            (Number(existingAddress.latitude) === resolvedDeliveryLatitude &&
              Number(existingAddress.longitude) === resolvedDeliveryLongitude))
        ) {
          addressId = existingAddress.id;
        } else {
          const createdAddress = await tx.customerAddress.create({
            data: {
              customerId: customer.id,
              label: "Entrega",
              address: resolvedDeliveryAddress,
              formattedAddress: resolvedDeliveryAddress,
              placeId: resolvedDeliveryPlaceId,
              latitude: resolvedDeliveryLatitude,
              longitude: resolvedDeliveryLongitude,
              city: existingAddress?.city || "Bogotá",
              // Un invitado que solo conoce el teléfono no puede sustituir
              // ni convertir en principal la dirección privada ya guardada.
              isDefault: existingAddress ? false : true,
            },
          });
          addressId = createdAddress.id;
        }
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
          customerId: customer.id,
          addressId,
          deliveryZoneId,
          deliveryZoneName,
          deliveryDistanceMeters,
          couponId: coupon?.id ?? null,
          couponName: coupon?.name ?? null,
          discountSource: coupon ? "COUPON" : "NONE",
          status: hasKitchenPreparation ? "PREPARING" : "READY",
          fulfillmentType,
          source: "WEB",
          subtotal,
          deliveryFee,
          discount,
          total,
          items: {
            create: normalizedLines.map((line, index) => {
              const note =
                typeof rawLines[index]?.notes === "string"
                  ? rawLines[index].notes.trim().slice(0, 120)
                  : "";
              return {
                productId: line.product.id,
                productName: line.product.name,
                unitPrice: line.unitPrice,
                quantity: line.quantity,
                preparedQuantity: requiresKitchen(line.product.categoryId)
                  ? 0
                  : line.quantity,
                lineTotal: line.lineTotal,
                configuration: line.configuration,
                notes: note || null,
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
        include: PUBLIC_ORDER_INCLUDE,
      });

      if (discount > 0) {
        await writeAuditLog(tx, {
          actor: {
            type: session ? "CUSTOMER" : "GUEST",
            name: customer.name,
            email: customer.email,
          },
          action: "ORDER_DISCOUNT_APPLIED",
          entityType: "ORDER",
          entityId: createdOrder.id,
          summary: `Cupón ${coupon?.name ?? "WEB"} aplicado al pedido #${createdOrder.sequenceNumber ?? createdOrder.id}.`,
          after: {
            discount,
            discountSource: coupon ? "COUPON" : "NONE",
            couponId: coupon?.id ?? null,
            couponName: coupon?.name ?? null,
            subtotal,
            total,
          },
          metadata: {
            customerId: customer.id,
            sequenceNumber: createdOrder.sequenceNumber,
            source: "WEB",
            authenticatedCustomer: Boolean(session),
          },
          source: "api/public-checkout",
        });
      }

      return { order: createdOrder, replayed: false as const };
    });

    const { order, replayed } = creation;
    if (replayed) {
      return replayedPublicOrderResponse(order);
    }

    const contactWebhook =
      order.customer?.id != null
        ? await sendCustomerContactWebhook({
            customerId: order.customer.id,
            source: "WEB_CHECKOUT",
          })
        : null;

    const code = `WEB-${String(order.sequenceNumber).padStart(4, "0")}`;
    let notification:
      | Awaited<ReturnType<typeof dispatchOrderCreatedNotification>>
      | { ok: false; status: "failed"; reason: string };

    try {
      notification = await dispatchOrderCreatedNotification({
        orderId: order.id,
        customerId: order.customer!.id,
        customerName: order.customer!.name,
        phone: `${order.customer!.countryCode || "+57"}${order.customer!.phone || ""}`,
        orderCode: code,
        total: Number(order.total),
        fulfillmentType: order.fulfillmentType,
      });
    } catch (error) {
      notification = {
        ok: false,
        status: "failed",
        reason:
          error instanceof Error
            ? error.message
            : "No fue posible enviar la notificación.",
      };
    }

    if (hasKitchenPreparation) {
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

    return NextResponse.json(
      {
        order: publicOrderPayload(order, Boolean(session)),
        notification,
        contactWebhook,
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

    console.error("Public checkout order error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible crear el pedido.",
      },
      { status: 500 },
    );
  }
}
