import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendRappiOrderCreatedPush } from "@/lib/kitchenPush";
import { orderCode } from "@/lib/orderCode";
import {
  rappiConfig,
  rappiTakeOrder,
  type RappiConfig,
} from "@/lib/rappi";

type JsonObject = Record<string, unknown>;

type ParsedRappiSubitem = {
  sku: string | null;
  name: string;
  quantity: number;
  price: number;
};

type ParsedRappiItem = {
  sku: string | null;
  externalItemId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  comments: string | null;
  subitems: ParsedRappiSubitem[];
};

export type ParsedRappiOrder = {
  externalOrderId: string;
  externalStoreId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  deliveryNeighborhood: string | null;
  deliveryCity: string | null;
  deliveryNotes: string | null;
  deliveryMethod: string | null;
  paymentMethod: string | null;
  cookingTime: number | null;
  total: number;
  subtotal: number;
  discount: number;
  fulfillmentType: "DELIVERY" | "PICKUP";
  items: ParsedRappiItem[];
};

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveInteger(value: unknown, fallback = 1) {
  const parsed = Math.floor(number(value, fallback));
  return parsed > 0 ? parsed : fallback;
}

function optionalInteger(value: unknown) {
  const parsed = Math.floor(number(value, Number.NaN));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const parsed = text(value);
    if (parsed) return parsed;
  }
  return "";
}

function readableComments(value: unknown): string {
  const direct = text(value);
  if (direct) return direct;
  if (!Array.isArray(value)) return "";

  return value
    .flatMap((entry) => {
      const entryText = text(entry);
      if (entryText) return [entryText];

      const object = asObject(entry);
      if (!object) return [];
      const candidate = firstText(
        object.comment,
        object.text,
        object.value,
        object.name,
        object.description,
      );
      return candidate ? [candidate] : [];
    })
    .filter(Boolean)
    .join(" · ");
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.NaN;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function nested(
  object: JsonObject | null,
  key: string,
): JsonObject | null {
  return asObject(object?.[key]);
}

function parseSubitem(value: unknown): ParsedRappiSubitem | null {
  const item = asObject(value);
  if (!item) return null;

  const name = firstText(item.name, item.title);
  if (!name) return null;

  return {
    sku: firstText(item.sku, item.external_id) || null,
    name,
    quantity: positiveInteger(item.quantity),
    price: Math.max(
      0,
      firstNumber(
        item.unit_price_with_discount,
        item.unit_price,
        item.price,
        0,
      ),
    ),
  };
}

function parseItem(value: unknown): ParsedRappiItem | null {
  const item = asObject(value);
  if (!item) return null;

  const name = firstText(item.name, item.title, item.product_name);
  if (!name) return null;

  const quantity = positiveInteger(item.quantity);
  const unitPrice = Math.max(
    0,
    firstNumber(
      item.unit_price_with_discount,
      item.unit_price,
      item.price,
      0,
    ),
  );
  const explicitLineTotal = firstNumber(
    item.total_price_with_discount,
    item.total_price,
    item.line_total,
  );

  const subitems = asArray(item.subitems ?? item.toppings)
    .map(parseSubitem)
    .filter((subitem): subitem is ParsedRappiSubitem => Boolean(subitem));

  const lineTotal = Number.isFinite(explicitLineTotal)
    ? Math.max(0, explicitLineTotal)
    : Math.max(0, unitPrice * quantity);

  return {
    sku: firstText(item.sku, item.external_id) || null,
    externalItemId:
      firstText(item.id, item.item_id, item.product_id) || null,
    name,
    quantity,
    unitPrice,
    lineTotal,
    comments:
      firstText(
        readableComments(item.comments),
        readableComments(item.comment),
        readableComments(item.notes),
      ) || null,
    subitems,
  };
}

export function parseRappiOrder(value: unknown): ParsedRappiOrder {
  const root = asObject(value);
  if (!root) throw new Error("El payload de Rappi no es un objeto válido.");

  const detail =
    nested(root, "order_detail") ??
    nested(root, "orderDetail") ??
    root;
  const store = nested(root, "store") ?? nested(detail, "store");
  const customer =
    nested(root, "customer") ?? nested(detail, "customer");
  const delivery =
    nested(root, "delivery_information") ??
    nested(detail, "delivery_information") ??
    nested(root, "deliveryInformation") ??
    nested(detail, "deliveryInformation");
  const totals =
    nested(root, "totals") ??
    nested(detail, "totals") ??
    nested(root, "total") ??
    nested(detail, "total");

  const externalOrderId = firstText(
    detail.order_id,
    root.order_id,
    detail.orderId,
    root.orderId,
    detail.id,
  );
  if (!externalOrderId) {
    throw new Error("El pedido recibido de Rappi no contiene order_id.");
  }

  const itemsValue =
    root.items ??
    detail.items ??
    root.products ??
    detail.products;
  const items = asArray(itemsValue)
    .map(parseItem)
    .filter((item): item is ParsedRappiItem => Boolean(item));

  if (!items.length) {
    throw new Error(
      `El pedido Rappi ${externalOrderId} no contiene productos.`,
    );
  }

  const computedProducts = items.reduce(
    (sum, item) => sum + item.lineTotal,
    0,
  );

  const totalOrder = firstNumber(
    totals?.total_order,
    totals?.totalOrder,
    root.total_order,
    detail.total_order,
    root.total,
    detail.total,
    computedProducts,
  );
  const totalProducts = firstNumber(
    totals?.total_products,
    totals?.total_products_with_discount,
    totals?.products,
    computedProducts,
  );
  const totalDiscounts = Math.max(
    0,
    firstNumber(totals?.total_discounts, totals?.discounts, 0),
  );

  const deliveryMethod =
    firstText(
      detail.delivery_method,
      root.delivery_method,
      detail.deliveryMethod,
      root.deliveryMethod,
    ) || null;

  return {
    externalOrderId,
    externalStoreId:
      firstText(
        root.store_id,
        detail.store_id,
        store?.internal_id,
        store?.id,
        store?.external_id,
      ) || null,
    customerName:
      firstText(
        customer?.name,
        customer?.full_name,
        [firstText(customer?.first_name), firstText(customer?.last_name)]
          .filter(Boolean)
          .join(" "),
        root.customer_name,
      ) || null,
    customerPhone:
      firstText(
        customer?.phone,
        customer?.phone_number,
        root.customer_phone,
      ) || null,
    deliveryAddress:
      firstText(
        delivery?.complete_address,
        delivery?.completeAddress,
        delivery?.address,
      ) || null,
    deliveryNeighborhood:
      firstText(delivery?.neighborhood, delivery?.district) || null,
    deliveryCity: firstText(delivery?.city) || null,
    deliveryNotes:
      firstText(
        delivery?.complement,
        delivery?.instructions,
        delivery?.notes,
        root.delivery_notes,
      ) || null,
    deliveryMethod,
    paymentMethod:
      firstText(
        detail.payment_method,
        root.payment_method,
        detail.paymentMethod,
        root.paymentMethod,
      ) || null,
    cookingTime:
      optionalInteger(
        detail.cooking_time ??
          root.cooking_time ??
          detail.cookingTime ??
          root.cookingTime,
      ),
    total: Math.max(0, totalOrder),
    subtotal: Math.max(0, totalProducts),
    discount: totalDiscounts,
    fulfillmentType:
      deliveryMethod?.toLowerCase() === "pickup"
        ? "PICKUP"
        : "DELIVERY",
    items,
  };
}

function externalItemDetail(item: ParsedRappiItem) {
  const details = item.subitems.map((subitem) => {
    const quantity =
      subitem.quantity > 1 ? `${subitem.quantity} × ` : "";
    return `+ ${quantity}${subitem.name}`;
  });

  return details.join(" · ");
}

function orderFromIntegration(externalOrderId: string) {
  return prisma.orderIntegration.findUnique({
    where: {
      provider_externalOrderId: {
        provider: "RAPPI",
        externalOrderId,
      },
    },
    include: {
      order: {
        include: {
          items: true,
          payments: true,
          integration: true,
        },
      },
    },
  });
}

async function sendImportedOrderAlert(order: {
  id: number;
  sequenceNumber: number | null;
  source: string;
  fulfillmentType: "DELIVERY" | "PICKUP" | "STORE";
}) {
  try {
    const result = await sendRappiOrderCreatedPush({
      orderId: order.id,
      orderCode: orderCode(
        order.sequenceNumber ?? order.id,
        order.source,
      ),
      fulfillmentType: order.fulfillmentType,
    });

    if (!result.ok) {
      console.warn("Rappi order operations push", {
        orderId: order.id,
        reason: result.reason,
      });
    }
  } catch (error) {
    console.warn("Rappi order operations push failed", {
      orderId: order.id,
      error:
        error instanceof Error ? error.message : "Unknown push error",
    });
  }
}

async function autoAcceptIfEnabled(input: {
  orderId: number;
  parsed: ParsedRappiOrder;
  config: RappiConfig;
}) {
  if (!input.config.autoAccept) return false;

  await rappiTakeOrder({
    storeId: input.parsed.externalStoreId,
    orderId: input.parsed.externalOrderId,
    cookingTime: input.parsed.cookingTime,
  });

  const acceptedAt = new Date();
  await prisma.$transaction([
    prisma.order.update({
      where: { id: input.orderId },
      data: { status: "PREPARING" },
    }),
    prisma.orderIntegration.update({
      where: { orderId: input.orderId },
      data: {
        acceptedAt,
        remoteStatus: "TAKEN",
      },
    }),
  ]);

  return true;
}

export async function importRappiOrder(
  value: unknown,
  options?: { eventName?: string | null },
) {
  const parsed = parseRappiOrder(value);
  const existing = await orderFromIntegration(parsed.externalOrderId);

  if (existing) {
    const incomingEvent = options?.eventName?.trim() || "";
    const preserveProgress =
      Boolean(existing.acceptedAt) ||
      Boolean(existing.readyAt) ||
      Boolean(existing.canceledAt);

    await prisma.orderIntegration.update({
      where: { id: existing.id },
      data: {
        rawPayload: jsonValue(value),
        lastEvent: incomingEvent
          ? jsonValue({
              event: incomingEvent,
              payload: value,
            })
          : undefined,
        remoteStatus:
          preserveProgress && ["NEW_ORDER", "MANUAL_SYNC"].includes(incomingEvent)
            ? existing.remoteStatus
            : incomingEvent || existing.remoteStatus,
      },
    });

    return {
      created: false,
      autoAccepted: Boolean(existing.acceptedAt),
      order: existing.order,
      parsed,
    };
  }

  const skus = [
    ...new Set(
      parsed.items
        .map((item) => item.sku)
        .filter((sku): sku is string => Boolean(sku)),
    ),
  ];

  const variants = skus.length
    ? await prisma.productVariant.findMany({
        where: { sku: { in: skus } },
        select: {
          id: true,
          sku: true,
          productId: true,
          product: {
            select: {
              id: true,
              name: true,
              categoryId: true,
            },
          },
        },
      })
    : [];
  const variantBySku = new Map(
    variants
      .filter((variant) => variant.sku)
      .map((variant) => [variant.sku!, variant]),
  );

  const config = rappiConfig();
  const createImportedOrder = () =>
    prisma.$transaction(async (tx) => {
      const sequence = await tx.orderSequence.upsert({
        where: { id: 1 },
        create: { id: 1, current: 1 },
        update: { current: { increment: 1 } },
      });

      return tx.order.create({
      data: {
        sequenceNumber: sequence.current,
        status: "CONFIRMED",
        fulfillmentType: parsed.fulfillmentType,
        source: "RAPPI",
        subtotal: parsed.subtotal || parsed.total,
        deliveryFee: 0,
        discount: parsed.discount,
        discountSource: parsed.discount > 0 ? "RAPPI" : "NONE",
        total: parsed.total,
        notes: parsed.deliveryNotes,
        items: {
          create: parsed.items.map((item) => {
            const variant = item.sku
              ? variantBySku.get(item.sku)
              : undefined;
            const detail = externalItemDetail(item);

            return {
              productId: variant?.productId ?? null,
              variantId: variant?.id ?? null,
              productName: item.name,
              variantName: null,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              preparedQuantity: 0,
              lineTotal: item.lineTotal,
              configuration: jsonValue({
                schemaVersion: 1,
                kind: "POS_SNAPSHOT",
                source: "RAPPI",
                externalSku: item.sku,
                externalItemId: item.externalItemId,
                detail,
                subitems: item.subitems,
              }),
              notes: item.comments
                ? item.comments.slice(0, 120)
                : null,
            };
          }),
        },
        payments: {
          create: {
            method: parsed.paymentMethod
              ? `Rappi · ${parsed.paymentMethod}`
              : "Rappi",
            amount: parsed.total,
            status: "PENDING",
            reference: parsed.externalOrderId,
          },
        },
        integration: {
          create: {
            provider: "RAPPI",
            externalOrderId: parsed.externalOrderId,
            externalStoreId:
              parsed.externalStoreId || config.storeId || null,
            customerName: parsed.customerName,
            customerPhone: parsed.customerPhone,
            deliveryAddress: parsed.deliveryAddress,
            deliveryNeighborhood: parsed.deliveryNeighborhood,
            deliveryCity: parsed.deliveryCity,
            paymentMethod: parsed.paymentMethod,
            cookingTime: parsed.cookingTime,
            remoteStatus:
              options?.eventName?.trim() || "NEW_ORDER",
            rawPayload: jsonValue(value),
            lastEvent: options?.eventName
              ? jsonValue({
                  event: options.eventName,
                  payload: value,
                })
              : undefined,
          },
        },
      },
        include: {
          items: true,
          payments: true,
          integration: true,
        },
      });
    });

  let result: Awaited<ReturnType<typeof createImportedOrder>>;
  try {
    result = await createImportedOrder();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await orderFromIntegration(parsed.externalOrderId);
      if (raced) {
        return {
          created: false,
          autoAccepted: Boolean(raced.acceptedAt),
          order: raced.order,
          parsed,
        };
      }
    }
    throw error;
  }

  let autoAccepted = false;
  try {
    autoAccepted = await autoAcceptIfEnabled({
      orderId: result.id,
      parsed,
      config,
    });
  } catch (error) {
    console.error("Rappi auto-accept failed", {
      externalOrderId: parsed.externalOrderId,
      orderId: result.id,
      error:
        error instanceof Error ? error.message : "Unknown Rappi error",
    });
  }

  await sendImportedOrderAlert({
    id: result.id,
    sequenceNumber: result.sequenceNumber,
    source: result.source,
    fulfillmentType: result.fulfillmentType,
  });

  const order = autoAccepted
    ? await prisma.order.findUnique({
        where: { id: result.id },
        include: {
          items: true,
          payments: true,
          integration: true,
        },
      })
    : result;

  return {
    created: true,
    autoAccepted,
    order,
    parsed,
  };
}

function webhookExternalOrderId(value: unknown) {
  const root = asObject(value);
  if (!root) return "";
  const detail =
    nested(root, "order_detail") ??
    nested(root, "orderDetail");

  return firstText(
    root.order_id,
    root.orderId,
    detail?.order_id,
    detail?.orderId,
    root.id,
  );
}

export async function applyRappiCancellation(
  value: unknown,
  eventName = "ORDER_EVENT_CANCEL",
) {
  const externalOrderId = webhookExternalOrderId(value);
  if (!externalOrderId) return { found: false };

  const integration = await orderFromIntegration(externalOrderId);
  if (!integration) return { found: false };

  const canceledAt = new Date();
  await prisma.$transaction([
    prisma.payment.updateMany({
      where: {
        orderId: integration.orderId,
        status: { not: "REFUNDED" },
      },
      data: { status: "CANCELED" },
    }),
    prisma.clubPointTransaction.deleteMany({
      where: { orderId: integration.orderId },
    }),
    prisma.order.update({
      where: { id: integration.orderId },
      data: { status: "CANCELED" },
    }),
    prisma.orderIntegration.update({
      where: { id: integration.id },
      data: {
        canceledAt,
        remoteStatus: integration.canceledAt
          ? integration.remoteStatus
          : eventName,
        lastEvent: jsonValue({
          event: eventName,
          payload: value,
        }),
      },
    }),
  ]);

  return { found: true, orderId: integration.orderId };
}

export async function applyRappiOperationalEvent(
  value: unknown,
  eventName: string,
) {
  const externalOrderId = webhookExternalOrderId(value);
  if (!externalOrderId) return { found: false };

  const integration = await orderFromIntegration(externalOrderId);
  if (!integration) return { found: false };

  const root = asObject(value);
  const additional =
    nested(root, "additional_information") ??
    nested(root, "additionalInformation");
  const courier =
    nested(root, "courier_data") ??
    nested(root, "courier") ??
    nested(additional, "courier_data") ??
    nested(additional, "courier");

  const courierName =
    firstText(courier?.full_name, courier?.name) || undefined;
  const courierPhone =
    firstText(courier?.phone, courier?.phone_number) || undefined;
  const courierId =
    firstText(courier?.id, root?.courier_id) || undefined;

  const etaMillis = firstNumber(
    root?.eta_in_millis,
    root?.etaInMillis,
  );
  const etaSeconds = firstNumber(
    root?.eta_to_store,
    root?.eta_seconds,
    additional?.eta_to_store,
  );
  const courierEtaSeconds = Number.isFinite(etaMillis)
    ? Math.max(0, Math.round(etaMillis / 1000))
    : Number.isFinite(etaSeconds)
      ? Math.max(0, Math.round(etaSeconds))
      : undefined;

  const latitude = firstNumber(
    root?.latitude,
    root?.lat,
    courier?.latitude,
  );
  const longitude = firstNumber(
    root?.longitude,
    root?.lng,
    root?.lon,
    courier?.longitude,
  );

  const normalizedEvent = eventName.trim().toLowerCase();
  const taken =
    normalizedEvent === "taken_visible_order" ||
    normalizedEvent === "order_taken";

  await prisma.$transaction(async (tx) => {
    await tx.orderIntegration.update({
      where: { id: integration.id },
      data: {
        remoteStatus: eventName,
        lastEvent: jsonValue({
          event: eventName,
          payload: value,
        }),
        ...(courierId ? { courierId } : {}),
        ...(courierName ? { courierName } : {}),
        ...(courierPhone ? { courierPhone } : {}),
        ...(courierEtaSeconds != null
          ? { courierEtaSeconds }
          : {}),
        ...(Number.isFinite(latitude)
          ? { courierLatitude: latitude }
          : {}),
        ...(Number.isFinite(longitude)
          ? { courierLongitude: longitude }
          : {}),
        ...(taken && !integration.acceptedAt
          ? { acceptedAt: new Date() }
          : {}),
      },
    });

    if (taken && integration.order.status === "CONFIRMED") {
      await tx.order.update({
        where: { id: integration.orderId },
        data: { status: "PREPARING" },
      });
    }
  });

  return { found: true, orderId: integration.orderId };
}
