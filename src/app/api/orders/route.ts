import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SETTINGS_KEY = "pos_settings";

type FulfillmentType = "DELIVERY" | "PICKUP" | "STORE";
type DiscountMode = "NONE" | "COUPON" | "MANUAL";

type CartLine = {
  productId: number;
  quantity: number;
  name?: string;
  detail?: string;
  unitPrice?: number;
  configuration?: unknown;
};

type DeliveryBand = { id: string; name?: string; fee: number; active?: boolean };
type PaymentMethod = { id: string; name: string; active?: boolean };
type PosSettings = { deliveryBands?: DeliveryBand[]; paymentMethods?: PaymentMethod[] };

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

async function normalizeLine(line: CartLine) {
  const product = await prisma.product.findUnique({ where: { id: Number(line.productId) } });
  if (!product || !product.active || !product.visibleInPos) throw new Error("Uno de los productos ya no está disponible.");

  const quantity = Math.max(1, Math.floor(Number(line.quantity || 1)));
  let unitPrice: number;

  if (product.type === "STANDARD" && product.basePrice != null) {
    unitPrice = money(Number(product.basePrice));
  } else {
    unitPrice = money(Number(line.unitPrice ?? 0));
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`El precio de ${product.name} no es válido.`);
  }

  const configuration = line.configuration && typeof line.configuration === "object"
    ? line.configuration as Prisma.InputJsonValue
    : {
        kind: "POS_SNAPSHOT",
        detail: typeof line.detail === "string" ? line.detail : "",
        capturedName: typeof line.name === "string" ? line.name : product.name,
      } as Prisma.InputJsonValue;

  return {
    product,
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
    eligible: product.type !== "COMBO" && product.couponEligible,
    configuration,
  };
}

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { customer: true, address: true, items: true, payments: true },
    });
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Orders list error", error);
    return NextResponse.json({ error: "No fue posible cargar los pedidos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fulfillmentType = body.fulfillmentType as FulfillmentType;
    if (!(["DELIVERY", "PICKUP", "STORE"] as string[]).includes(fulfillmentType)) {
      return NextResponse.json({ error: "Tipo de pedido inválido." }, { status: 400 });
    }

    const lines = Array.isArray(body.items) ? body.items as CartLine[] : [];
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
    const paymentMethod = settings.paymentMethods?.find((method) => method.id === String(body.paymentMethodId) && method.active !== false);
    if (!paymentMethod) return NextResponse.json({ error: "El medio de pago seleccionado ya no está activo." }, { status: 400 });

    let deliveryFee = 0;
    let deliveryZoneId: string | null = null;
    let deliveryZoneName: string | null = null;
    if (fulfillmentType === "DELIVERY") {
      const zone = settings.deliveryBands?.find((item) => item.id === String(body.deliveryZoneId) && item.active !== false);
      if (!zone) return NextResponse.json({ error: "La tarifa de domicilio seleccionada ya no está activa." }, { status: 400 });
      deliveryFee = money(Number(zone.fee ?? 0));
      deliveryZoneId = zone.id;
      deliveryZoneName = zone.name?.trim() || "Domicilio";
    }

    const normalizedLines = await Promise.all(lines.map(normalizeLine));
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
      const coupon = await prisma.coupon.findFirst({ where: { id: couponId, active: true } });
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

    const order = await prisma.$transaction((tx) => tx.order.create({
      data: {
        customerId: customer?.id ?? null,
        addressId: fulfillmentType === "DELIVERY" ? address?.id ?? null : null,
        couponId,
        couponName,
        deliveryZoneId,
        deliveryZoneName,
        discountSource: discountMode,
        status: "CONFIRMED",
        fulfillmentType,
        source: "POS",
        subtotal,
        deliveryFee,
        discount,
        total,
        notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
        items: {
          create: normalizedLines.map((line) => ({
            productId: line.product.id,
            productName: line.product.name,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
            configuration: line.configuration,
          })),
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
      include: { customer: true, address: true, items: true, payments: true },
    }));

    return NextResponse.json({
      order: {
        id: order.id,
        code: `ALT-${String(order.id).padStart(6, "0")}`,
        status: order.status,
        fulfillmentType: order.fulfillmentType,
        subtotal: Number(order.subtotal),
        deliveryFee: Number(order.deliveryFee),
        discount: Number(order.discount),
        total: Number(order.total),
        createdAt: order.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Order creation error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible crear el pedido." }, { status: 500 });
  }
}
