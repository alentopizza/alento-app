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

    await prisma.payment.delete({ where: { id: payment.id } });

    return NextResponse.json({ ok: true, deletedPaymentId: payment.id });
  } catch (error) {
    console.error("Payment delete error", error);
    return NextResponse.json({ error: "No fue posible eliminar el pago." }, { status: 500 });
  }
}
