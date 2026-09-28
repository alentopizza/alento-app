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

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    const { id: rawOrderId, paymentId: rawPaymentId } = await context.params;
    const orderId = Number(rawOrderId);
    const paymentId = Number(rawPaymentId);

    if (!Number.isInteger(orderId) || !Number.isInteger(paymentId)) {
      return NextResponse.json({ error: "Pago inválido." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: { orderBy: { id: "asc" } } },
    });
    if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    if (order.source === "RAPPI") {
      return NextResponse.json(
        { error: "Los movimientos de cobro Rappi no se eliminan manualmente." },
        { status: 409 },
      );
    }

    const payment = order.payments.find((item) => item.id === paymentId);
    if (!payment) return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });

    if (payment.status === "PAID" && payment.paidAt) {
      await assertCashDateEditable(payment.paidAt);
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: payment.id } });

      if (payment.status === "PAID") {
        const remainingPaid = order.payments
          .filter((item) => item.id !== payment.id && item.status === "PAID")
          .reduce((sum, item) => sum + Number(item.amount), 0);
        const pendingBalance = Math.max(0, Number(order.total) - remainingPaid);
        const pending = order.payments.find(
          (item) => item.id !== payment.id && (item.status === "PENDING" || item.status === "PARTIAL"),
        );

        if (pending) {
          await tx.payment.update({
            where: { id: pending.id },
            data: {
              amount: pendingBalance,
              status: pendingBalance > 0 ? "PENDING" : "CANCELED",
              cashReceived: null,
              changeDue: null,
            },
          });
        }
      }
    });

    return NextResponse.json({ ok: true, deletedPaymentId: payment.id });
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

    console.error("Payment delete error", error);
    return NextResponse.json({ error: "No fue posible eliminar el pago." }, { status: 500 });
  }
}
