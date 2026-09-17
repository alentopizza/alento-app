import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const payment = order.payments.find((item) => item.id === paymentId);
    if (!payment) return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });

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
    console.error("Payment delete error", error);
    return NextResponse.json({ error: "No fue posible eliminar el pago." }, { status: 500 });
  }
}
