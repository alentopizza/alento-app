import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SETTINGS_KEY = "pos_settings";

type FulfillmentType = "DELIVERY" | "PICKUP" | "STORE";
type DeliveryBand = { id: string; name?: string; fee: number; active?: boolean };
type PaymentMethod = { id: string; name: string; active?: boolean };
type PosSettings = { deliveryBands?: DeliveryBand[]; paymentMethods?: PaymentMethod[] };
type ExistingLinePatch = { id: number; quantity: number };
type Addition = { productId: number; quantity: number };

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
function loadOrder(id: number) {
  return prisma.order.findUnique({
    where: { id },
    include: { customer: { include: { addresses: true } }, address: true, items: { include: { product: true }, orderBy: { id: "asc" } }, payments: { orderBy: { id: "asc" } } },
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

    if (body?.action === "cancel") {
      if (["COMPLETED", "CANCELED"].includes(current.status)) return NextResponse.json({ error: "Este pedido ya no puede cancelarse." }, { status: 409 });
      if (current.payments.some((payment) => payment.status === "PAID")) return NextResponse.json({ error: "El pedido tiene dinero recibido. Registra una devolución antes de cancelarlo." }, { status: 409 });
      const updated = await prisma.$transaction(async (tx) => {
        await tx.payment.updateMany({ where: { orderId: current.id, status: { not: "REFUNDED" } }, data: { status: "CANCELED" } });
        return tx.order.update({ where: { id: current.id }, data: { status: "CANCELED" } });
      });
      return NextResponse.json({ order: { ...serializeOrder(current), status: updated.status } });
    }

    if (["COMPLETED", "CANCELED", "DELIVERED"].includes(current.status)) return NextResponse.json({ error: "Este pedido ya está cerrado y no puede editarse." }, { status: 409 });

    const fulfillmentType = String(body.fulfillmentType ?? current.fulfillmentType) as FulfillmentType;
    if (!(["DELIVERY", "PICKUP", "STORE"] as string[]).includes(fulfillmentType)) return NextResponse.json({ error: "Tipo de pedido inválido." }, { status: 400 });
    if ((fulfillmentType === "DELIVERY" || fulfillmentType === "PICKUP") && !current.customerId) return NextResponse.json({ error: "Este pedido necesita un cliente antes de cambiar a esa modalidad." }, { status: 400 });

    const settingsRow = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    const settings = parseSettings(settingsRow?.value ?? null);

    let addressId: number | null = null;
    let deliveryFee = 0;
    let deliveryZoneId: string | null = null;
    let deliveryZoneName: string | null = null;
    if (fulfillmentType === "DELIVERY") {
      const customer = current.customer;
      if (!customer) return NextResponse.json({ error: "El domicilio necesita un cliente." }, { status: 400 });
      const requestedAddressId = Number(body.addressId ?? current.addressId ?? customer.addresses[0]?.id);
      const address = customer.addresses.find((item) => item.id === requestedAddressId) ?? customer.addresses[0];
      if (!address) return NextResponse.json({ error: "El cliente no tiene una dirección para domicilio." }, { status: 400 });
      addressId = address.id;
      const requestedZoneId = String(body.deliveryZoneId ?? current.deliveryZoneId ?? "");
      const zone = settings.deliveryBands?.find((item) => item.id === requestedZoneId && item.active !== false);
      if (!zone) return NextResponse.json({ error: "Selecciona una tarifa de domicilio activa." }, { status: 400 });
      deliveryFee = money(Number(zone.fee ?? 0)); deliveryZoneId = zone.id; deliveryZoneName = zone.name?.trim() || "Domicilio";
    }

    const patches = Array.isArray(body.items) ? body.items as ExistingLinePatch[] : [];
    const quantityById = new Map<number, number>();
    for (const patch of patches) { const itemId = Number(patch.id); const quantity = Math.max(0, Math.floor(Number(patch.quantity ?? 0))); if (Number.isInteger(itemId)) quantityById.set(itemId, quantity); }

    const additions = Array.isArray(body.additions) ? body.additions as Addition[] : [];
    const addedProducts = additions.length ? await prisma.product.findMany({ where: { id: { in: additions.map((item) => Number(item.productId)) }, active: true, visibleInPos: true } }) : [];
    for (const addition of additions) {
      const product = addedProducts.find((item) => item.id === Number(addition.productId));
      if (!product) return NextResponse.json({ error: "Uno de los productos adicionales ya no está disponible." }, { status: 400 });
      if (["PIZZA_SINGLE", "PIZZA_TWO_FLAVORS", "COMBO", "MODIFIER", "INTERNAL"].includes(product.type)) return NextResponse.json({ error: `Para agregar ${product.name} debes configurarlo desde el POS.` }, { status: 400 });
      if (product.basePrice == null) return NextResponse.json({ error: `${product.name} no tiene precio.` }, { status: 400 });
    }

    const updatedExisting = current.items.map((item) => ({ item, quantity: quantityById.has(item.id) ? quantityById.get(item.id)! : item.quantity })).filter((entry) => entry.quantity > 0);
    if (!updatedExisting.length && !additions.some((item) => Number(item.quantity) > 0)) return NextResponse.json({ error: "El pedido debe conservar al menos un producto." }, { status: 400 });

    const existingSubtotal = updatedExisting.reduce((sum, entry) => sum + Number(entry.item.unitPrice) * entry.quantity, 0);
    const additionsSubtotal = additions.reduce((sum, addition) => { const product = addedProducts.find((item) => item.id === Number(addition.productId)); const quantity = Math.max(0, Math.floor(Number(addition.quantity ?? 0))); return sum + (product ? Number(product.basePrice ?? 0) * quantity : 0); }, 0);
    const subtotal = money(existingSubtotal + additionsSubtotal);
    const existingEligible = updatedExisting.reduce((sum, entry) => { const product = entry.item.product; const eligible = product && product.type !== "COMBO" && product.couponEligible; return sum + (eligible ? Number(entry.item.unitPrice) * entry.quantity : 0); }, 0);
    const additionsEligible = additions.reduce((sum, addition) => { const product = addedProducts.find((item) => item.id === Number(addition.productId)); const quantity = Math.max(0, Math.floor(Number(addition.quantity ?? 0))); const eligible = product && product.type !== "COMBO" && product.couponEligible; return sum + (eligible ? Number(product.basePrice ?? 0) * quantity : 0); }, 0);
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
    const cashReceivedInput = body.cashReceived == null ? pendingPayment?.cashReceived == null ? null : Number(pendingPayment.cashReceived) : Number(body.cashReceived);
    if (alreadyPaid === 0 && isCash && cashReceivedInput != null && cashReceivedInput < total) return NextResponse.json({ error: `"Paga con" debe ser mínimo $${total.toLocaleString("es-CO")}.` }, { status: 400 });
    const changeDue = alreadyPaid === 0 && isCash && cashReceivedInput != null ? cashReceivedInput - total : null;

    const productChanges = current.items.some((item) => { const nextQuantity = quantityById.has(item.id) ? quantityById.get(item.id)! : item.quantity; return nextQuantity !== item.quantity; }) || additions.some((addition) => Number(addition.quantity) > 0);

    await prisma.$transaction(async (tx) => {
      for (const entry of current.items) {
        const quantity = quantityById.has(entry.id) ? quantityById.get(entry.id)! : entry.quantity;
        if (quantity <= 0) await tx.orderItem.delete({ where: { id: entry.id } });
        else if (quantity !== entry.quantity) await tx.orderItem.update({ where: { id: entry.id }, data: { quantity, lineTotal: Number(entry.unitPrice) * quantity, preparedQuantity: Math.min(entry.preparedQuantity, quantity) } });
      }
      for (const addition of additions) {
        const quantity = Math.max(0, Math.floor(Number(addition.quantity ?? 0))); if (!quantity) continue;
        const product = addedProducts.find((item) => item.id === Number(addition.productId))!; const unitPrice = money(Number(product.basePrice));
        await tx.orderItem.create({ data: { orderId: current.id, productId: product.id, productName: product.name, unitPrice, quantity, preparedQuantity: 0, lineTotal: unitPrice * quantity, configuration: { schemaVersion: 1, kind: "STANDARD", productId: product.id, productName: product.name } } });
      }
      await tx.order.update({ where: { id: current.id }, data: { fulfillmentType, addressId, deliveryZoneId, deliveryZoneName, deliveryFee, subtotal, discount, total, status: productChanges && current.status !== "PREPARING" ? "PREPARING" : current.status } });

      if (outstanding > 0) {
        if (pendingPayment) {
          await tx.payment.update({ where: { id: pendingPayment.id }, data: { method: paymentMethod, amount: outstanding, cashReceived: alreadyPaid === 0 && isCash ? cashReceivedInput : null, changeDue: alreadyPaid === 0 && isCash ? changeDue : null } });
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
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

    const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

    // OrderItem y Payment tienen onDelete: Cascade. El borrado es definitivo y
    // no deja líneas ni pagos huérfanos. Cancelar es una operación distinta.
    await prisma.order.delete({ where: { id } });

    return NextResponse.json({ ok: true, deletedOrderId: id });
  } catch (error) {
    console.error("Order delete error", error);
    return NextResponse.json({ error: "No fue posible eliminar el pedido." }, { status: 500 });
  }
}
