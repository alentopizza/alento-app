import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeOrderLine } from "@/lib/orderLineNormalizer";
import { orderItemDetailText } from "@/lib/orderPresentation";
import { computeDrivingRoute } from "@/lib/googleMapsServer";
import { dispatchOrderCreatedNotification } from "@/lib/notifier";

const SETTINGS_KEY = "pos_settings";

type DeliveryBand = {
  id: string;
  name?: string;
  minMeters: number;
  maxMeters: number;
  fee: number;
  active?: boolean;
};

type PaymentMethod = {
  id: string;
  name: string;
  active?: boolean;
};

type PosSettings = {
  store?: {
    latitude?: number | null;
    longitude?: number | null;
  };
  deliveryBands?: DeliveryBand[];
  paymentMethods?: PaymentMethod[];
};

function secureEqual(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function money(value: number) {
  return Math.round(value);
}

function activeBands(settings: PosSettings) {
  return (settings.deliveryBands ?? [])
    .filter((item) => item.active !== false)
    .map((item) => ({
      ...item,
      minMeters: Number(item.minMeters),
      maxMeters: Number(item.maxMeters),
      fee: Number(item.fee),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.minMeters) &&
        Number.isFinite(item.maxMeters) &&
        Number.isFinite(item.fee),
    );
}

function repeatPaymentName(
  sourceMethod: string | null,
  settings: PosSettings,
) {
  const normalized = sourceMethod?.trim() || "";
  const sourceIsHistorical = ["histórico", "historico"].includes(
    normalized.toLocaleLowerCase("es"),
  );

  const activeMatch = (settings.paymentMethods ?? []).find(
    (method) =>
      method.active !== false &&
      method.name.trim().toLocaleLowerCase("es") ===
        normalized.toLocaleLowerCase("es"),
  );

  if (activeMatch) return activeMatch.name;
  if (normalized && !sourceIsHistorical) return normalized;
  return "Por confirmar";
}

async function repeatContext(orderId: number) {
  const sourceOrder = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      sequenceNumber: true,
      source: true,
      status: true,
      fulfillmentType: true,
      notes: true,
      discount: true,
      customer: {
        select: {
          id: true,
          name: true,
          countryCode: true,
          phone: true,
        },
      },
      address: {
        select: {
          id: true,
          address: true,
          formattedAddress: true,
          neighborhood: true,
          latitude: true,
          longitude: true,
        },
      },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productId: true,
          productName: true,
          quantity: true,
          configuration: true,
          notes: true,
        },
      },
      payments: {
        orderBy: { id: "asc" },
        select: {
          method: true,
        },
      },
    },
  });

  if (!sourceOrder) {
    throw new Error("El pedido original ya no existe.");
  }

  if (!sourceOrder.customer) {
    throw new Error("El pedido original no tiene un cliente asociado.");
  }

  if (!sourceOrder.items.length) {
    throw new Error("El pedido original no tiene productos.");
  }

  if (sourceOrder.items.some((item) => item.productId == null)) {
    throw new Error(
      "Este pedido histórico no conserva todos los productos vinculados al catálogo y no se puede repetir automáticamente.",
    );
  }

  const settingsRow = await prisma.appSetting.findUnique({
    where: { key: SETTINGS_KEY },
    select: { value: true },
  });
  const settings = (settingsRow?.value ?? {}) as unknown as PosSettings;

  const normalizedLines = await Promise.all(
    sourceOrder.items.map((item) =>
      normalizeOrderLine({
        productId: Number(item.productId),
        quantity: item.quantity,
        configuration: item.configuration,
      }),
    ),
  );

  let deliveryFee = 0;
  let deliveryZoneId: string | null = null;
  let deliveryZoneName: string | null = null;

  if (sourceOrder.fulfillmentType === "DELIVERY") {
    const destinationLatitude = Number(sourceOrder.address?.latitude);
    const destinationLongitude = Number(sourceOrder.address?.longitude);
    const storeLatitude = Number(settings.store?.latitude);
    const storeLongitude = Number(settings.store?.longitude);

    if (
      !sourceOrder.address ||
      !Number.isFinite(destinationLatitude) ||
      !Number.isFinite(destinationLongitude)
    ) {
      throw new Error(
        "La dirección actual del pedido no tiene ubicación válida para repetir el domicilio.",
      );
    }

    if (
      !Number.isFinite(storeLatitude) ||
      !Number.isFinite(storeLongitude)
    ) {
      throw new Error(
        "La sede de Alentó no tiene una ubicación oficial válida.",
      );
    }

    const route = await computeDrivingRoute({
      origin: {
        latitude: storeLatitude,
        longitude: storeLongitude,
      },
      destination: {
        latitude: destinationLatitude,
        longitude: destinationLongitude,
      },
    });

    const zone = activeBands(settings).find(
      (item) =>
        route.distanceMeters >= item.minMeters &&
        route.distanceMeters <= item.maxMeters,
    );

    if (!zone) {
      throw new Error(
        "La dirección actual está fuera de la cobertura configurada para domicilios.",
      );
    }

    deliveryFee = money(zone.fee);
    deliveryZoneId = zone.id;
    deliveryZoneName = zone.name?.trim() || "Domicilio";
  }

  const subtotal = normalizedLines.reduce(
    (sum, line) => sum + line.lineTotal,
    0,
  );
  const discount = 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);

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

  const sourcePayment = sourceOrder.payments[0]?.method ?? null;
  const paymentMethod = repeatPaymentName(sourcePayment, settings);

  return {
    sourceOrder,
    normalizedLines,
    subtotal,
    discount,
    total,
    deliveryFee,
    deliveryZoneId,
    deliveryZoneName,
    paymentMethod,
    requiresKitchen,
    hasKitchenPreparation,
  };
}

function authError(request: NextRequest) {
  const configuredKey = process.env.CHATWOOT_DASHBOARD_KEY?.trim() ?? "";
  const receivedKey =
    request.headers.get("x-alento-chatwoot-key")?.trim() ?? "";

  if (!configuredKey) {
    return NextResponse.json(
      { error: "La integración de Chatwoot no tiene una clave configurada." },
      { status: 503 },
    );
  }

  if (!receivedKey || !secureEqual(receivedKey, configuredKey)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = authError(request);
  if (auth) return auth;

  const { id } = await context.params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  try {
    const repeat = await repeatContext(orderId);
    const { sourceOrder } = repeat;

    return NextResponse.json({
      preview: {
        sourceOrderId: sourceOrder.id,
        sourceOrderNumber:
          sourceOrder.sequenceNumber ?? sourceOrder.id,
        customer: sourceOrder.customer,
        fulfillmentType: sourceOrder.fulfillmentType,
        address: sourceOrder.address,
        paymentMethod: repeat.paymentMethod,
        subtotal: repeat.subtotal,
        deliveryFee: repeat.deliveryFee,
        discount: repeat.discount,
        total: repeat.total,
        previousDiscount: Number(sourceOrder.discount),
        notes: sourceOrder.notes,
        items: repeat.normalizedLines.map((line, index) => ({
          productId: line.product.id,
          productName: line.product.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          detail: orderItemDetailText(line.configuration),
          notes: sourceOrder.items[index]?.notes ?? null,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible preparar la repetición del pedido.",
      },
      { status: 409 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = authError(request);
  if (auth) return auth;

  const { id } = await context.params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  try {
    const repeat = await repeatContext(orderId);
    const { sourceOrder } = repeat;

    const order = await prisma.$transaction(async (tx) => {
      const sequence = await tx.orderSequence.upsert({
        where: { id: 1 },
        create: { id: 1, current: 1 },
        update: { current: { increment: 1 } },
      });

      return tx.order.create({
        data: {
          sequenceNumber: sequence.current,
          customerId: sourceOrder.customer!.id,
          addressId:
            sourceOrder.fulfillmentType === "DELIVERY"
              ? sourceOrder.address?.id ?? null
              : null,
          couponId: null,
          couponName: null,
          deliveryZoneId: repeat.deliveryZoneId,
          deliveryZoneName: repeat.deliveryZoneName,
          discountSource: "NONE",
          status: repeat.hasKitchenPreparation ? "PREPARING" : "READY",
          fulfillmentType: sourceOrder.fulfillmentType,
          source: "POS",
          subtotal: repeat.subtotal,
          deliveryFee: repeat.deliveryFee,
          discount: 0,
          total: repeat.total,
          notes: sourceOrder.notes,
          items: {
            create: repeat.normalizedLines.map((line, index) => {
              const note = sourceOrder.items[index]?.notes?.trim() || "";
              return {
                productId: line.product.id,
                productName: line.product.name,
                unitPrice: line.unitPrice,
                quantity: line.quantity,
                preparedQuantity: repeat.requiresKitchen(
                  line.product.categoryId,
                )
                  ? 0
                  : line.quantity,
                lineTotal: line.lineTotal,
                configuration: line.configuration,
                notes: note ? note.slice(0, 120) : null,
              };
            }),
          },
          payments: {
            create: {
              method: repeat.paymentMethod,
              amount: repeat.total,
              cashReceived: null,
              changeDue: null,
              status: "PENDING",
            },
          },
        },
        include: {
          customer: true,
          payments: true,
        },
      });
    });

    const code = `POS-${String(order.sequenceNumber).padStart(4, "0")}`;

    let notification:
      | Awaited<ReturnType<typeof dispatchOrderCreatedNotification>>
      | { ok: false; status: "skipped"; reason: string } = {
      ok: false,
      status: "skipped",
      reason: "El cliente no tiene teléfono.",
    };

    if (sourceOrder.customer?.phone) {
      notification = await dispatchOrderCreatedNotification({
        orderId: order.id,
        customerId: sourceOrder.customer.id,
        customerName: sourceOrder.customer.name,
        phone: `${sourceOrder.customer.countryCode ?? "+57"}${sourceOrder.customer.phone}`,
        orderCode: code,
        total: Number(order.total),
        fulfillmentType: order.fulfillmentType,
      });
    }

    return NextResponse.json(
      {
        order: {
          id: order.id,
          sequenceNumber: order.sequenceNumber,
          code,
          status: order.status,
          fulfillmentType: order.fulfillmentType,
          subtotal: Number(order.subtotal),
          deliveryFee: Number(order.deliveryFee),
          discount: Number(order.discount),
          total: Number(order.total),
        },
        notification,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible repetir el pedido.",
      },
      { status: 409 },
    );
  }
}
