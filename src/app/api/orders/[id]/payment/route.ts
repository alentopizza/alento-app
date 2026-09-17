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

    const order = await prisma.order.findUnique({ where: { id }, include: { payments: { orderBy: { id: "asc" } } } });
    if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    if (order.status === "CANCELED") return NextResponse.json({ error: "No se puede registrar pago en un pedido cancelado." }, { status: 409 });

    const paidAmount = order.payments.filter((payment) => payment.status === "PAID").reduce((sum, payment) => sum + Number(payment.amount), 0);
    const outstanding = Math.max(0, Number(order.total) - paidAmount);
    if (outstanding <= 0) return NextResponse.json({ error: "Este pedido ya está pagado completamente." }, { status: 409 });

    const body = await request.json();
    const settingsRow = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    const settings = parseSettings(settingsRow?.value ?? null);
    const methodId = String(body.paymentMethodId ?? "");
    const method = settings.paymentMethods?.find((item) => item.id === methodId && item.active !== false);
    if (!method) return NextResponse.json({ error: "Selecciona un medio de pago activo." }, { status: 400 });

    const isCash = method.name.trim().toLowerCase() === "efectivo";
    let cashReceived: number | null = null;

    if (isCash) {
      const received = Number(body.cashReceived ?? 0);
      if (!Number.isFinite(received) || received < outstanding) {
        return NextResponse.json({ error: `El efectivo recibido debe ser mínimo $${outstanding.toLocaleString("es-CO")}.` }, { status: 400 });
      }
      cashReceived = received;
    }

    const changeDue = cashReceived == null ? null : cashReceived - outstanding;
    const reference = typeof body.reference === "string" && body.reference.trim() ? body.reference.trim() : null;
    const pending = order.payments.find((payment) => payment.status === "PENDING" || payment.status === "PARTIAL");

    const updated = pending
      ? await prisma.payment.update({ where: { id: pending.id }, data: { method: method.name, amount: outstanding, cashReceived, changeDue, reference, status: "PAID", paidAt: new Date() } })
      : await prisma.payment.create({ data: { orderId: order.id, method: method.name, amount: outstanding, cashReceived, changeDue, reference, status: "PAID", paidAt: new Date() } });

    return NextResponse.json({
      payment: {
        ...updated,
        amount: Number(updated.amount),
        cashReceived: updated.cashReceived == null ? null : Number(updated.cashReceived),
        changeDue: updated.changeDue == null ? null : Number(updated.changeDue),
      },
      paidTotal: paidAmount + outstanding,
      balance: 0,
    });
  } catch (error) {
    console.error("Order payment registration error", error);
    return NextResponse.json({ error: "No fue posible registrar el pago." }, { status: 500 });
  }
}
