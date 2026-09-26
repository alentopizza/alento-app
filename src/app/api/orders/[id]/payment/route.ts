import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertCashDateEditable,
  CASH_DATE_CLOSED_ERROR,
  CASH_SESSION_REQUIRED_ERROR,
  CASH_MOVEMENT_BEFORE_OPEN_ERROR,
  cashDateClosedResponseMessage,
  cashSessionRequiredResponseMessage,
  cashMovementBeforeOpenResponseMessage,
} from "@/lib/cashRegisterLock";

const SETTINGS_KEY = "pos_settings";

type PaymentMethod = { id: string; name: string; active?: boolean };
type PosSettings = { paymentMethods?: PaymentMethod[] };

function parseSettings(value: unknown): PosSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as PosSettings;
}

function money(value: number) {
  return Math.round(value);
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

    const paidAmount = order.payments
      .filter((payment) => payment.status === "PAID")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const outstanding = Math.max(0, Number(order.total) - paidAmount);
    if (outstanding <= 0) return NextResponse.json({ error: "Este pedido ya está pagado completamente." }, { status: 409 });

    const body = await request.json();
    const settingsRow = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    const settings = parseSettings(settingsRow?.value ?? null);
    const methodId = String(body.paymentMethodId ?? "");
    const method = settings.paymentMethods?.find((item) => item.id === methodId && item.active !== false);
    if (!method) return NextResponse.json({ error: "Selecciona un medio de pago activo." }, { status: 400 });

    const amount = money(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Ingresa un monto de pago válido." }, { status: 400 });
    }
    if (amount > outstanding) {
      return NextResponse.json({ error: `El pago no puede superar el saldo pendiente de $${outstanding.toLocaleString("es-CO")}.` }, { status: 400 });
    }

    const isCash = method.name.trim().toLowerCase() === "efectivo";
    let cashReceived: number | null = null;
    let changeDue: number | null = null;

    if (isCash && body.cashReceived != null && String(body.cashReceived).trim() !== "") {
      const received = money(Number(body.cashReceived));
      if (!Number.isFinite(received) || received < amount) {
        return NextResponse.json({ error: `Si registras el efectivo entregado, debe ser mínimo ${amount.toLocaleString("es-CO")}.` }, { status: 400 });
      }
      cashReceived = received;
      changeDue = received - amount;
    }

    const reference = typeof body.reference === "string" && body.reference.trim() ? body.reference.trim() : null;
    const paidAt = new Date();
    await assertCashDateEditable(paidAt);

    const remaining = Math.max(0, outstanding - amount);
    const pending = order.payments.find((payment) => payment.status === "PENDING" || payment.status === "PARTIAL") ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          method: method.name,
          amount,
          cashReceived,
          changeDue,
          reference,
          status: "PAID",
          paidAt,
        },
      });

      if (pending) {
        if (remaining > 0) {
          await tx.payment.update({
            where: { id: pending.id },
            data: {
              amount: remaining,
              status: "PENDING",
              cashReceived: null,
              changeDue: null,
            },
          });
        } else {
          await tx.payment.update({
            where: { id: pending.id },
            data: {
              amount: 0,
              status: "CANCELED",
              cashReceived: null,
              changeDue: null,
            },
          });
        }
      }

      return payment;
    });

    return NextResponse.json({
      payment: {
        ...result,
        amount: Number(result.amount),
        cashReceived: result.cashReceived == null ? null : Number(result.cashReceived),
        changeDue: result.changeDue == null ? null : Number(result.changeDue),
      },
      paidTotal: paidAmount + amount,
      balance: remaining,
      partial: remaining > 0,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === CASH_DATE_CLOSED_ERROR) {
        return NextResponse.json(
          { error: cashDateClosedResponseMessage() },
          { status: 409 },
        );
      }
      if (error.message === CASH_SESSION_REQUIRED_ERROR) {
        return NextResponse.json(
          { error: cashSessionRequiredResponseMessage() },
          { status: 409 },
        );
      }
      if (error.message === CASH_MOVEMENT_BEFORE_OPEN_ERROR) {
        return NextResponse.json(
          { error: cashMovementBeforeOpenResponseMessage() },
          { status: 409 },
        );
      }
    }

    console.error("Order payment registration error", error);
    return NextResponse.json({ error: "No fue posible registrar el pago." }, { status: 500 });
  }
}
