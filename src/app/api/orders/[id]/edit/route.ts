import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { directDistanceMeters } from "@/lib/deliveryDistance";
import { normalizeOrderLine } from "@/lib/orderLineNormalizer";
import {
  isInKitchenWindow,
  parseScheduledFor,
  validateFutureSchedule,
  validateScheduledServiceHours,
} from "@/lib/orderScheduling";

const SETTINGS_KEY = "pos_settings";

type FulfillmentType = "DELIVERY" | "PICKUP" | "STORE";
type DeliveryBand = {
  id: string;
  name?: string;
  minMeters: number;
  maxMeters: number;
  fee: number;
  active?: boolean;
};
type PosSettings = {
  store?: {
    latitude?: number | null;
    longitude?: number | null;
    serviceHours?: unknown;
  };
  deliveryBands?: DeliveryBand[];
};
type ExistingLinePatch = {
  id: number;
  quantity: number;
  configuration?: unknown;
  notes?: unknown;
};
type Addition = {
  productId: number;
  quantity: number;
  configuration?: unknown;
  notes?: unknown;
};

function parseSettings(value: Prisma.JsonValue | null): PosSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as unknown as PosSettings;
}

function money(value: number) {
  return Math.round(value);
}

function loadOrder(id: number) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      customer: { include: { addresses: true } },
      address: true,
      items: { include: { product: true }, orderBy: { id: "asc" } },
      payments: { orderBy: { id: "asc" } },
    },
  });
}

function serializeOrder(order: Awaited<ReturnType<typeof loadOrder>>) {
  if (!order) return null;
  return {
    ...order,
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.deliveryFee),
    discount: Number(order.discount),
    total: Number(order.total),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
    payments: order.payments.map((payment) => ({
      ...payment,
      amount: Number(payment.amount),
      cashReceived: payment.cashReceived == null ? null : Number(payment.cashReceived),
      changeDue: payment.changeDue == null ? null : Number(payment.changeDue),
    })),
  };
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

    const current = await loadOrder(id);
    if (!current) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

    if (!["CONFIRMED", "PREPARING"].includes(current.status)) {
      return NextResponse.json({ error: "Solo se puede editar un pedido antes de marcarlo como Listo." }, { status: 409 });
    }

    const body = await request.json();
    let scheduledFor: Date | null = current.scheduledFor;
    if (Object.prototype.hasOwnProperty.call(body, "scheduledFor")) {
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
    }

    const settingsRow = await prisma.appSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });
    const settings = parseSettings(settingsRow?.value ?? null);

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

    const beverageCategory = await prisma.category.findUnique({
      where: { slug: "bebidas" },
      select: { id: true },
    });
    const beverageCategoryId = beverageCategory?.id ?? null;
    const requiresKitchen = (categoryId: number | null | undefined) =>
      beverageCategoryId == null || categoryId !== beverageCategoryId;

    if (
      scheduledFor &&
      !isInKitchenWindow(scheduledFor) &&
      current.items.some(
        (item) =>
          requiresKitchen(item.product?.categoryId) &&
          Number(item.preparedQuantity ?? 0) > 0,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Este pedido ya comenzó preparación en Cocina. No puede reprogramarse para más adelante.",
        },
        { status: 409 },
      );
    }

    const fulfillmentType = String(body.fulfillmentType ?? current.fulfillmentType) as FulfillmentType;
    if (!(["DELIVERY", "PICKUP", "STORE"] as string[]).includes(fulfillmentType)) {
      return NextResponse.json({ error: "Tipo de pedido inválido." }, { status: 400 });
    }

    if ((fulfillmentType === "DELIVERY" || fulfillmentType === "PICKUP") && !current.customerId) {
      return NextResponse.json({ error: "Este pedido necesita un cliente antes de cambiar a esa modalidad." }, { status: 400 });
    }

    let addressId: number | null = null;
    let deliveryFee = 0;
    let deliveryZoneId: string | null = null;
    let deliveryZoneName: string | null = null;
    let deliveryDistanceMeters: number | null = null;

    if (fulfillmentType === "DELIVERY") {
      const customer = current.customer;
      if (!customer) return NextResponse.json({ error: "El domicilio necesita un cliente." }, { status: 400 });

      const requestedAddressId = Number(
        body.addressId ?? current.addressId ?? customer.addresses[0]?.id,
      );
      const address =
        customer.addresses.find((item) => item.id === requestedAddressId) ??
        customer.addresses[0];

      if (!address) {
        return NextResponse.json(
          { error: "El cliente no tiene una dirección para domicilio." },
          { status: 400 },
        );
      }

      const latitude = Number(address.latitude);
      const longitude = Number(address.longitude);
      const storeLatitude = Number(settings.store?.latitude);
      const storeLongitude = Number(settings.store?.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return NextResponse.json(
          { error: "La dirección debe validarse con Google Maps antes de editar el domicilio." },
          { status: 409 },
        );
      }

      if (!Number.isFinite(storeLatitude) || !Number.isFinite(storeLongitude)) {
        return NextResponse.json(
          { error: "La ubicación de Alentó no está configurada." },
          { status: 503 },
        );
      }

      const commercialDistanceMeters = directDistanceMeters({
        origin: { latitude: storeLatitude, longitude: storeLongitude },
        destination: { latitude, longitude },
      });
      const zone = settings.deliveryBands
        ?.filter((item) => item.active !== false)
        .find(
          (item) =>
            commercialDistanceMeters >= Number(item.minMeters) &&
            commercialDistanceMeters <= Number(item.maxMeters),
        );

      if (!zone) {
        return NextResponse.json(
          { error: "La dirección quedó fuera de cobertura para domicilio." },
          { status: 409 },
        );
      }

      addressId = address.id;
      deliveryFee = money(Number(zone.fee ?? 0));
      deliveryZoneId = zone.id;
      deliveryZoneName = zone.name?.trim() || "Domicilio";
      deliveryDistanceMeters = Math.round(commercialDistanceMeters);
    }

    const patches = Array.isArray(body.items)
      ? (body.items as ExistingLinePatch[])
      : [];
    const patchById = new Map<number, ExistingLinePatch>();

    for (const patch of patches) {
      const itemId = Number(patch.id);
      if (Number.isInteger(itemId)) {
        patchById.set(itemId, patch);
      }
    }

    const updatedExisting: Array<{
      itemId: number;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      configuration: unknown;
      notes: string | null;
      eligible: boolean;
      changed: boolean;
    }> = [];

    for (const item of current.items) {
      const patch = patchById.get(item.id);
      const quantity = Math.max(
        0,
        Math.floor(Number(patch?.quantity ?? item.quantity)),
      );
      if (quantity <= 0) continue;

      const nextNotes =
        typeof patch?.notes === "string"
          ? patch.notes.trim().slice(0, 120) || null
          : patch?.notes === null
            ? null
            : item.notes;

      if (patch && Object.prototype.hasOwnProperty.call(patch, "configuration")) {
        const normalized = await normalizeOrderLine({
          productId: item.productId,
          quantity,
          configuration: patch.configuration,
        });

        updatedExisting.push({
          itemId: item.id,
          quantity,
          unitPrice: normalized.unitPrice,
          lineTotal: normalized.lineTotal,
          configuration: normalized.configuration,
          notes: nextNotes,
          eligible: normalized.eligible,
          changed: true,
        });
        continue;
      }

      const unitPrice = Number(item.unitPrice);
      updatedExisting.push({
        itemId: item.id,
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
        configuration: item.configuration,
        notes: nextNotes,
        eligible: Boolean(
          item.product &&
            item.product.type !== "COMBO" &&
            item.product.couponEligible,
        ),
        changed:
          quantity !== item.quantity ||
          nextNotes !== item.notes,
      });
    }

    const additions = Array.isArray(body.additions)
      ? (body.additions as Addition[])
      : [];

    const normalizedAdditions = [];
    for (const addition of additions) {
      const quantity = Math.max(
        0,
        Math.floor(Number(addition.quantity ?? 0)),
      );
      if (!quantity) continue;

      const normalized = await normalizeOrderLine({
        productId: Number(addition.productId),
        quantity,
        configuration: addition.configuration,
      });

      normalizedAdditions.push({
        ...normalized,
        notes:
          typeof addition.notes === "string"
            ? addition.notes.trim().slice(0, 120) || null
            : null,
      });
    }

    if (!updatedExisting.length && !normalizedAdditions.length) {
      return NextResponse.json(
        { error: "El pedido debe conservar al menos un producto." },
        { status: 400 },
      );
    }

    const existingSubtotal = updatedExisting.reduce(
      (sum, entry) => sum + entry.lineTotal,
      0,
    );
    const additionsSubtotal = normalizedAdditions.reduce(
      (sum, entry) => sum + entry.lineTotal,
      0,
    );
    const subtotal = money(existingSubtotal + additionsSubtotal);

    const existingEligible = updatedExisting.reduce(
      (sum, entry) =>
        sum + (entry.eligible ? entry.lineTotal : 0),
      0,
    );
    const additionsEligible = normalizedAdditions.reduce(
      (sum, entry) =>
        sum + (entry.eligible ? entry.lineTotal : 0),
      0,
    );
    const eligibleSubtotal = money(
      existingEligible + additionsEligible,
    );
    const discount = Math.min(
      Number(current.discount),
      eligibleSubtotal,
    );
    const total = Math.max(
      0,
      subtotal + deliveryFee - discount,
    );

    const payment = current.payments[0];
    const cashReceivedInput = body.cashReceived == null
      ? payment?.cashReceived == null ? null : Number(payment.cashReceived)
      : Number(body.cashReceived);
    const isCash = payment?.method?.trim().toLowerCase() === "efectivo";
    if (isCash && (cashReceivedInput == null || cashReceivedInput < total)) {
      return NextResponse.json({ error: `El nuevo total es mayor al efectivo registrado. Actualiza "Paga con" a un valor mínimo de $${total.toLocaleString("es-CO")}.` }, { status: 400 });
    }
    const changeDue = isCash && cashReceivedInput != null ? cashReceivedInput - total : null;

    await prisma.$transaction(async (tx) => {
      const existingIds = new Set(
        updatedExisting.map((entry) => entry.itemId),
      );

      for (const item of current.items) {
        if (!existingIds.has(item.id)) {
          await tx.orderItem.delete({ where: { id: item.id } });
        }
      }

      for (const entry of updatedExisting) {
        if (!entry.changed) continue;

        await tx.orderItem.update({
          where: { id: entry.itemId },
          data: {
            quantity: entry.quantity,
            unitPrice: entry.unitPrice,
            lineTotal: entry.lineTotal,
            configuration: entry.configuration as Prisma.InputJsonValue,
            notes: entry.notes,
          },
        });
      }

      for (const addition of normalizedAdditions) {
        await tx.orderItem.create({
          data: {
            orderId: current.id,
            productId: addition.product.id,
            productName: addition.product.name,
            unitPrice: addition.unitPrice,
            quantity: addition.quantity,
            preparedQuantity: requiresKitchen(
              addition.product.categoryId,
            )
              ? 0
              : addition.quantity,
            lineTotal: addition.lineTotal,
            configuration:
              addition.configuration as Prisma.InputJsonValue,
            notes: addition.notes,
          },
        });
      }

      const nextStatus =
        scheduledFor && !isInKitchenWindow(scheduledFor)
          ? "CONFIRMED"
          : "PREPARING";

      await tx.order.update({
        where: { id: current.id },
        data: {
          fulfillmentType,
          addressId,
          deliveryZoneId,
          deliveryZoneName,
          deliveryDistanceMeters,
          deliveryFee,
          subtotal,
          discount,
          total,
          scheduledFor,
          status: nextStatus,
        },
      });

      if (payment) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            amount: total,
            cashReceived: isCash ? cashReceivedInput : payment.cashReceived,
            changeDue: isCash ? changeDue : payment.changeDue,
          },
        });
      }
    });

    const updated = await loadOrder(current.id);
    return NextResponse.json({ order: serializeOrder(updated) });
  } catch (error) {
    console.error("Order edit error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible actualizar el pedido." }, { status: 500 });
  }
}
