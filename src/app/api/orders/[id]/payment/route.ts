import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SETTINGS_KEY = "pos_settings";

type PaymentMethod = { id: string; name: string; active?: boolean };
type PosSettings = { paymentMethods?: PaymentMethod[] };

function parseSettings(value: unknown): PosSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as PosSettings;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: { orderBy: { id: "asc" } } },
    });
    if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    if (order.status === "CANCELED") return NextResponse.json({ error: "No se puede registrar pago en un pedido cancelado." }, { status: 409 });

    const payment = order.payments[0];
    if (!payment) return NextResponse.json({ error: "El pedido no tiene un registro de pago." }, { status: 409 });
    if (payment.status === "PAID") return NextResponse.json({ error: "Este pedido ya tiene el pago registrado." }, { status: 409 });

    const body = await request.json();
    const settingsRow = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    const settings = parseSettings(settingsRow?.value ?? null);
    const methodId = String(body.paymentMethodId ?? "");
    const method = settings.paymentMethods?.find((item) => item.id === methodId && item.active !== false);
    if (!method) return NextResponse.json({ error: "Selecciona un medio de pago activo." }, { status: 400 });

    const amount = Number(order.total);
    const isCash = method.name.trim().toLowerCase() === "efectivo";
    const cashReceived = isCash ? Number(body.cashReceived ?? 0) : null;
    if (isCash && (!Number.isFinite(cashReceived) || cashReceived < amount)) {
      return NextResponse.json({ error: `El efectivo recibido debe ser mínimo $${amount.toLocaleString("es-CO")}.` }, { status: 400 });
    }
    const changeDue = isCash && cashReceived != null ? cashReceived - amount : null;
    const reference = typeof body.reference === "string" && body.reference.trim() ? body.reference.trim() : null;

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        method: method.name,
        amount,
        cashReceived,
        changeDue,
        reference,
        status: "PAID",
        paidAt: new Date(),
      },
    });

    return NextResponse.json({
      payment: {
        ...updated,
        amount: Number(updated.amount),
        cashReceived: updated.cashReceived == null ? null : Number(updated.cashReceived),
        changeDue: updated.changeDue == null ? null : Number(updated.changeDue),
      },
    });
  } catch (error) {
    console.error("Order payment registration error", error);
    return NextResponse.json({ error: "No fue posible registrar el pago." }, { status: 500 });
  }
}