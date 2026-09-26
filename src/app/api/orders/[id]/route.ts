import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeOrderLine } from "@/lib/orderLineNormalizer";
import { getStaffSession } from "@/lib/auth";
import {
  deliveryPricingHttpStatus,
  resolveDeliveryPricing,
  type DeliveryPricingSettings,
} from "@/lib/deliveryPricing";

const SETTINGS_KEY = "pos_settings";

type FulfillmentType = "DELIVERY" | "PICKUP" | "STORE";
type PaymentMethod = { id: string; name: string; active?: boolean };
type PosSettings = DeliveryPricingSettings & {
  paymentMethods?: PaymentMethod[];
};
type ExistingLinePatch = { id: number; quantity: number; notes?: unknown };
type Addition = { productId: number; quantity: number; configuration?: unknown; notes?: unknown };

function parseSettings(value: Prisma.JsonValue | null): PosSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as unknown as PosSettings;
}
function money(value: number) { return Math.round(value); }
function serializeOrder(order: Awaited<ReturnType<typeof loadOrder>>) {
  if (!order) return null;
  return {
    ...order,
    subtotal: Number(order.subtotal), deliveryFee: Number(order.deliveryFee), discount: Number(order.discount), total: Number(order.total),
    items: order.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice), lineTotal: Number(item.lineTotal) })),
    payments: order.payments.map((payment) => ({ ...payment, amount: Number(payment.amount), cashReceived: payment.cashReceived == null ? null : Number(payment.cashReceived), changeDue: payment.changeDue == null ? null : Number(payment.changeDue) })),
  };
}
async function currentStaffAccess() {
  const session = await getStaffSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { active: true, roles: true, permissions: true },
  });

  if (!user?.active) return null;

  return {
    isAdmin: user.roles.includes("ADMIN"),
    roles: user.roles,
    permissions: user.permissions,
  };
}

function loadOrder(id: number) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      customer: { include: { addresses: true } },
      address: true,
      driver: {
        select: {
          name: true,
          whatsappCountryCode: true,
          whatsappPhone: true,
        },
      },
      items: { include: { product: true }, orderBy: { id: "asc" } },
      payments: { orderBy: { id: "asc" } },
    },
  });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const order = await loadOrder(id);
  if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  return NextResponse.json({ order: serializeOrder(order) });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    const current = await loadOrder(id);
    if (!current) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    const body = await request.json();

    if (body?.action !== "cancel") {
      const access = await currentStaffAccess();
      if (!access) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
      if (
        !access.isAdmin &&
        !access.roles.some((role) => ["POS", "CASHIER"].includes(role))
      ) {
        return NextResponse.json({ error: "No tienes permiso para editar pedidos." }, { status: 403 });
      }
    }

    if (body?.action === "cancel") {
      const access = await currentStaffAccess();
      if (!access) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
      if (!access.isAdmin && !access.permissions.includes("CANCEL_ORDERS")) {
        return NextResponse.json({ error: "No tienes permiso para cancelar pedidos." }, { status: 403 });
      }
      if (["COMPLETED", "CANCELED"].includes(current.status)) return NextResponse.json({ error: "Este pedido ya no puede cancelarse." }, { status: 409 });

      const receivedAmount = current.payments
        .filter((payment) => payment.status === "PAID")
        .reduce((sum, payment) => sum + Number(payment.amount), 0);

      if (receivedAmount > 0) {
        return NextResponse.json(
          {
            error:
              `Este pedido tiene ${receivedAmount.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })} recibido. Antes de cancelarlo debe existir un flujo de devolución para conservar la trazabilidad del dinero.`,
          },
          { status: 409 },
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.payment.updateMany({
          where: { orderId: current.id, status: { not: "REFUNDED" } },
          data: { status: "CANCELED" },
        });

        // Regla Club Alentó:
        // un pedido cancelado nunca puede conservar puntos de compra.
        // En el flujo normal los puntos solo nacen al llegar a COMPLETED,
        // pero esta limpieza protege datos históricos o inconsistencias previas.
        await tx.clubPointTransaction.deleteMany({
          where: { orderId: current.id },
        });

        return tx.order.update({
          where: { id: current.id },
          data: { status: "CANCELED" },
        });
      });
      return NextResponse.json({ order: { ...serializeOrder(current), status: updated.status } });
    }

    if (["COMPLETED", "CANCELED", "DELIVERED"].includes(current.status)) return NextResponse.json({ error: "Este pedido ya está cerrado y no puede editarse." }, { status: 409 });

    if (body?.action === "change-customer") {
      const customerId = Number(body.customerId);
      if (!Number.isInteger(customerId) || customerId <= 0) {
        return NextResponse.json(
          { error: "Selecciona un cliente válido." },
          { status: 400 },
        );
      }

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          addresses: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          },
        },
      });

      if (!customer) {
        return NextResponse.json(
          { error: "El cliente seleccionado ya no existe." },
          { status: 404 },
        );
      }

      let addressId: number | null = null;
      let deliveryFee = current.fulfillmentType === "DELIVERY"
        ? money(Number(current.deliveryFee))
        : 0;
      let deliveryZoneId = current.deliveryZoneId;
      let deliveryZoneName = current.deliveryZoneName;
      let total = money(Number(current.total));

      if (current.fulfillmentType === "DELIVERY") {
        const requestedAddressId = Number(body.addressId);
        const address =
          customer.addresses.find(
            (item) => item.id === requestedAddressId,
          ) ??
          customer.addresses[0] ??
          null;

        if (!address) {
          return NextResponse.json(
            {
              error:
                "El cliente seleccionado necesita una dirección para este domicilio.",
            },
            { status: 400 },
          );
        }

        const settingsRow = await prisma.appSetting.findUnique({
          where: { key: SETTINGS_KEY },
        });
        const settings = parseSettings(settingsRow?.value ?? null);

        let pricing;
        try {
          pricing = resolveDeliveryPricing({
            settings,
            destination: {
              latitude: Number(address.latitude),
              longitude: Number(address.longitude),
            },
          });
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

        if (!pricing.covered || !pricing.band) {
          return NextResponse.json(
            {
              error:
                "La dirección del nuevo cliente está fuera de cobertura para domicilio.",
            },
            { status: 409 },
          );
        }

        addressId = address.id;
        deliveryFee = pricing.deliveryFee ?? 0;
        deliveryZoneId = pricing.deliveryZoneId;
        deliveryZoneName = pricing.deliveryZoneName;
        total = Math.max(
          0,
          money(
            Number(current.subtotal) +
              deliveryFee -
              Number(current.discount),
          ),
        );
      }

      const paidAmount = current.payments
        .filter((payment) => payment.status === "PAID")
        .reduce(
          (sum, payment) => sum + Number(payment.amount),
          0,
        );

      if (total < paidAmount) {
        return NextResponse.json(
          {
            error:
              `El nuevo total (${total.toLocaleString("es-CO")}) es menor al dinero ya recibido (${paidAmount.toLocaleString("es-CO")}). Registra una devolución antes de cambiar el cliente.`,
          },
          { status: 409 },
        );
      }

      const outstanding = Math.max(0, total - paidAmount);
      const pendingPayment =
        current.payments.find(
          (payment) =>
            payment.status === "PENDING" ||
            payment.status === "PARTIAL",
        ) ?? null;
      const fallbackMethod =
        pendingPayment?.method ||
        current.payments.find(
          (payment) => payment.status === "PAID",
        )?.method ||
        "Pago";

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: current.id },
          data: {
            customerId: customer.id,
            addressId,
            deliveryFee,
            deliveryZoneId,
            deliveryZoneName,
            total,
          },
        });

        if (outstanding > 0) {
          if (pendingPayment) {
            await tx.payment.update({
              where: { id: pendingPayment.id },
              data: {
                amount: outstanding,
                status: "PENDING",
                cashReceived: null,
                changeDue: null,
              },
            });
          } else {
            await tx.payment.create({
              data: {
                orderId: current.id,
                method: fallbackMethod,
                amount: outstanding,
                status: "PENDING",
              },
            });
          }
        } else if (pendingPayment) {
          await tx.payment.update({
            where: { id: pendingPayment.id },
            data: {
              amount: 0,
              status: "CANCELED",
              cashReceived: null,
              changeDue: null,
            },
          });
        }
      });

      const updated = await loadOrder(current.id);
      return NextResponse.json({
        order: serializeOrder(updated),
      });
    }

    const fulfillmentType = String(body.fulfillmentType ?? current.fulfillmentType) as FulfillmentType;
    if (!(["DELIVERY", "PICKUP", "STORE"] as string[]).includes(fulfillmentType)) return NextResponse.json({ error: "Tipo de pedido inválido." }, { status: 400 });
    if ((fulfillmentType === "DELIVERY" || fulfillmentType === "PICKUP") && !current.customerId) return NextResponse.json({ error: "Este pedido necesita un cliente antes de cambiar a esa modalidad." }, { status: 400 });

    const settingsRow = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    const settings = parseSettings(settingsRow?.value ?? null);
    const beveragesCategory = await prisma.category.findUnique({
      where: { slug: "bebidas" },
      select: { id: true },
    });
    const beverageCategoryId = beveragesCategory?.id ?? null;
    const requiresKitchen = (categoryId: number | null | undefined) => beverageCategoryId == null || categoryId !== beverageCategoryId;

    let addressId: number | null = null;
    let deliveryFee = 0;
    let deliveryZoneId: string | null = null;
    let deliveryZoneName: string | null = null;
    if (fulfillmentType === "DELIVERY") {
      const customer = current.customer;
      if (!customer) {
        return NextResponse.json(
          { error: "El domicilio necesita un cliente." },
          { status: 400 },
        );
      }

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

      let pricing;
      try {
        pricing = resolveDeliveryPricing({
          settings,
          destination: {
            latitude: Number(address.latitude),
            longitude: Number(address.longitude),
          },
        });
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

      if (!pricing.covered || !pricing.band) {
        return NextResponse.json(
          { error: "La dirección quedó fuera de cobertura para domicilio." },
          { status: 409 },
        );
      }

      addressId = address.id;
      const sameDeliveryAddress =
        current.fulfillmentType === "DELIVERY" &&
        current.addressId === address.id;
      deliveryFee = sameDeliveryAddress
        ? money(Number(current.deliveryFee))
        : pricing.deliveryFee ?? 0;

      if (body.deliveryFeeOverride != null) {
        const requestedDeliveryFee = Number(body.deliveryFeeOverride);
        if (!Number.isFinite(requestedDeliveryFee) || requestedDeliveryFee < 0) {
          return NextResponse.json(
            { error: "El valor manual del domicilio no es válido." },
            { status: 400 },
          );
        }
        deliveryFee = money(requestedDeliveryFee);
      }

      deliveryZoneId = pricing.deliveryZoneId;
      deliveryZoneName = pricing.deliveryZoneName;
    }

    const patches = Array.isArray(body.items) ? body.items as ExistingLinePatch[] : [];
    const quantityById = new Map<number, number>();
    const notesById = new Map<number, string | null>();
    for (const patch of patches) {
      const itemId = Number(patch.id);
      const quantity = Math.max(0, Math.floor(Number(patch.quantity ?? 0)));
      if (!Number.isInteger(itemId)) continue;
      quantityById.set(itemId, quantity);
      if (typeof patch.notes === "string") {
        const note = patch.notes.trim().slice(0, 120);
        notesById.set(itemId, note || null);
      } else if (patch.notes === null) {
        notesById.set(itemId, null);
      }
    }

    const additions = Array.isArray(body.additions) ? body.additions as Addition[] : [];
    const activeAdditions = additions
      .map((addition) => ({ ...addition, productId: Number(addition.productId), quantity: Math.max(0, Math.floor(Number(addition.quantity ?? 0))) }))
      .filter((addition) => Number.isInteger(addition.productId) && addition.productId > 0 && addition.quantity > 0);
    const normalizedAdditions = await Promise.all(activeAdditions.map((addition) => normalizeOrderLine({
      productId: addition.productId,
      quantity: addition.quantity,
      configuration: addition.configuration,
    })));

    const updatedExisting = current.items.map((item) => ({ item, quantity: quantityById.has(item.id) ? quantityById.get(item.id)! : item.quantity })).filter((entry) => entry.quantity > 0);
    if (!updatedExisting.length && !normalizedAdditions.length) return NextResponse.json({ error: "El pedido debe conservar al menos un producto." }, { status: 400 });

    const existingSubtotal = updatedExisting.reduce((sum, entry) => sum + Number(entry.item.unitPrice) * entry.quantity, 0);
    const additionsSubtotal = normalizedAdditions.reduce((sum, addition) => sum + addition.lineTotal, 0);
    const subtotal = money(existingSubtotal + additionsSubtotal);
    const existingEligible = updatedExisting.reduce((sum, entry) => { const product = entry.item.product; const eligible = product && product.type !== "COMBO" && product.couponEligible; return sum + (eligible ? Number(entry.item.unitPrice) * entry.quantity : 0); }, 0);
    const additionsEligible = normalizedAdditions.filter((addition) => addition.eligible).reduce((sum, addition) => sum + addition.lineTotal, 0);
    const eligibleSubtotal = money(existingEligible + additionsEligible);
    const discount = Math.min(Number(current.discount), eligibleSubtotal);
    const total = Math.max(0, subtotal + deliveryFee - discount);

    const paidPayments = current.payments.filter((payment) => payment.status === "PAID");
    const alreadyPaid = paidPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    if (total < alreadyPaid) return NextResponse.json({ error: `El nuevo total (${total.toLocaleString("es-CO")}) es menor al dinero ya recibido (${alreadyPaid.toLocaleString("es-CO")}). Registra una devolución antes de reducir el pedido.` }, { status: 409 });
    const outstanding = Math.max(0, total - alreadyPaid);
    const pendingPayment = current.payments.find((payment) => payment.status === "PENDING" || payment.status === "PARTIAL") ?? null;
    const paymentMethodId = typeof body.paymentMethodId === "string" ? body.paymentMethodId : null;
    const requestedMethod = paymentMethodId ? settings.paymentMethods?.find((method) => method.id === paymentMethodId && method.active !== false) : null;
    const fallbackMethod = pendingPayment?.method ?? current.payments[0]?.method ?? "Pendiente";
    const paymentMethod = requestedMethod?.name ?? fallbackMethod;
    const isCash = paymentMethod.trim().toLowerCase() === "efectivo";
    const cashReceivedCandidate = body.cashReceived == null
      ? pendingPayment?.cashReceived == null ? null : Number(pendingPayment.cashReceived)
      : Number(body.cashReceived);
    const canPreserveCashTender = alreadyPaid === 0
      && isCash
      && cashReceivedCandidate != null
      && Number.isFinite(cashReceivedCandidate)
      && cashReceivedCandidate >= total;
    const nextCashReceived = canPreserveCashTender ? cashReceivedCandidate : null;
    const nextChangeDue = canPreserveCashTender ? cashReceivedCandidate - total : null;

    const kitchenProductChanges = current.items.some((item) => {
      const nextQuantity = quantityById.has(item.id) ? quantityById.get(item.id)! : item.quantity;
      const nextNotes = notesById.has(item.id) ? notesById.get(item.id)! : item.notes;
      const notesChanged = (nextNotes ?? null) !== (item.notes ?? null);
      return (nextQuantity !== item.quantity || notesChanged) && requiresKitchen(item.product?.categoryId);
    }) || normalizedAdditions.some((addition) => requiresKitchen(addition.product.categoryId));

    await prisma.$transaction(async (tx) => {
      for (const entry of current.items) {
        const quantity = quantityById.has(entry.id) ? quantityById.get(entry.id)! : entry.quantity;
        const notes = notesById.has(entry.id) ? notesById.get(entry.id)! : entry.notes;
        const quantityChanged = quantity !== entry.quantity;
        const notesChanged = (notes ?? null) !== (entry.notes ?? null);
        if (quantity <= 0) {
          await tx.orderItem.delete({ where: { id: entry.id } });
        } else if (quantityChanged || notesChanged) {
          await tx.orderItem.update({
            where: { id: entry.id },
            data: {
              quantity,
              lineTotal: Number(entry.unitPrice) * quantity,
              notes,
              preparedQuantity: notesChanged && requiresKitchen(entry.product?.categoryId)
                ? 0
                : Math.min(entry.preparedQuantity, quantity),
            },
          });
        }
      }
      for (let index = 0; index < normalizedAdditions.length; index += 1) {
        const addition = normalizedAdditions[index];
        const noteValue = activeAdditions[index]?.notes;
        const rawNote = typeof noteValue === "string" ? noteValue.trim() : "";
        await tx.orderItem.create({ data: {
          orderId: current.id,
          productId: addition.product.id,
          productName: addition.product.name,
          unitPrice: addition.unitPrice,
          quantity: addition.quantity,
          preparedQuantity: requiresKitchen(addition.product.categoryId) ? 0 : addition.quantity,
          lineTotal: addition.lineTotal,
          configuration: addition.configuration,
          notes: rawNote ? rawNote.slice(0, 120) : null,
        } });
      }
      await tx.order.update({ where: { id: current.id }, data: { fulfillmentType, addressId, deliveryZoneId, deliveryZoneName, deliveryFee, subtotal, discount, total, status: kitchenProductChanges && current.status !== "PREPARING" ? "PREPARING" : current.status } });

      if (outstanding > 0) {
        if (pendingPayment) {
          await tx.payment.update({ where: { id: pendingPayment.id }, data: { method: paymentMethod, amount: outstanding, cashReceived: nextCashReceived, changeDue: nextChangeDue } });
        } else {
          await tx.payment.create({ data: { orderId: current.id, method: paymentMethod, amount: outstanding, status: "PENDING" } });
        }
      } else if (pendingPayment) {
        await tx.payment.update({ where: { id: pendingPayment.id }, data: { amount: 0, status: "CANCELED", cashReceived: null, changeDue: null } });
      }
    });

    const updated = await loadOrder(current.id);
    return NextResponse.json({ order: serializeOrder(updated) });
  } catch (error) {
    console.error("Order update error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible actualizar el pedido." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await currentStaffAccess();
    if (!access) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    if (!access.isAdmin && !access.permissions.includes("DELETE_ORDERS")) {
      return NextResponse.json({ error: "No tienes permiso para eliminar pedidos." }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

    const order = await prisma.order.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    if (!["CANCELED", "COMPLETED"].includes(order.status)) {
      return NextResponse.json(
        { error: "Solo puedes eliminar pedidos cancelados o finalizados." },
        { status: 409 },
      );
    }

    const deleted = await prisma.$transaction(async (tx) => {
      // ClubPointTransaction usa onDelete: SetNull para preservar historial.
      // En una eliminación definitiva solicitada desde Pedidos sí debemos retirar
      // cualquier punto generado por esta orden para que no sobreviva sin pedido.
      const clubPoints = await tx.clubPointTransaction.deleteMany({
        where: { orderId: id },
      });

      // Se eliminan explícitamente para poder devolver un resumen de la limpieza.
      // NotificationJob se elimina por cascada al borrar Order.
      const payments = await tx.payment.deleteMany({ where: { orderId: id } });
      const items = await tx.orderItem.deleteMany({ where: { orderId: id } });

      await tx.order.delete({ where: { id } });

      return {
        clubPoints: clubPoints.count,
        payments: payments.count,
        items: items.count,
      };
    });

    return NextResponse.json({
      ok: true,
      deletedOrderId: id,
      deletedClubPointTransactions: deleted.clubPoints,
      deletedPayments: deleted.payments,
      deletedItems: deleted.items,
    });
  } catch (error) {
    console.error("Order delete error", error);
    return NextResponse.json({ error: "No fue posible eliminar el pedido definitivamente." }, { status: 500 });
  }
}
