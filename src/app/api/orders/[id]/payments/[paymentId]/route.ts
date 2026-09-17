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

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, orderId },
    });

    if (!payment) {
      return NextResponse.json({ error: "El pago no existe o no pertenece a este pedido." }, { status: 404 });
    }

    if (payment.status === "CANCELED") {
      return NextResponse.json({ error: "Este pago ya fue anulado." }, { status: 409 });
    }

    if (payment.status === "REFUNDED") {
      return NextResponse.json({ error: "Un pago devuelto no puede anularse." }, { status: 409 });
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "CANCELED",
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
    console.error("Payment void error", error);
    return NextResponse.json({ error: "No fue posible anular el pago." }, { status: 500 });
  }
}
