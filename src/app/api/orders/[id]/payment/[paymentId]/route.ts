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

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.orderId !== orderId) {
      return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });
    }

    if (payment.status === "CANCELED") {
      return NextResponse.json({ error: "Este pago ya fue eliminado." }, { status: 409 });
    }

    if (payment.status === "REFUNDED") {
      return NextResponse.json({ error: "Un pago devuelto conserva su registro y no puede eliminarse." }, { status: 409 });
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "CANCELED",
        reference: payment.reference
          ? `ANULADO · ${payment.reference}`
          : "ANULADO POR ERROR DE REGISTRO",
      },
    });

    return NextResponse.json({
      ok: true,
      payment: {
        id: updated.id,
        status: updated.status,
        method: updated.method,
        amount: Number(updated.amount),
        paidAt: updated.paidAt,
      },
    });
  } catch (error) {
    console.error("Payment void error", error);
    return NextResponse.json({ error: "No fue posible eliminar el pago." }, { status: 500 });
  }
}
