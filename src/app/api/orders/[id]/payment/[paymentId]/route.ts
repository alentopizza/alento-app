import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { staffAuditActor, writeAuditLog } from "@/lib/auditLog";
import { orderNetReceived } from "@/lib/orderPaymentFinancials";
import {
  isScheduledForFutureDay,
  scheduledTimeLabel,
} from "@/lib/orderScheduling";
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
  let session;
  try {
    session = await requireStaffSession(["ADMIN", "POS", "CASHIER"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  try {
    const { id: rawOrderId, paymentId: rawPaymentId } = await context.params;
    const orderId = Number(rawOrderId);
    const paymentId = Number(rawPaymentId);

    if (!Number.isInteger(orderId) || !Number.isInteger(paymentId)) {
      return NextResponse.json({ error: "Pago inválido." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          include: { refunds: true },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    if (isScheduledForFutureDay(order.scheduledFor)) {
      return NextResponse.json(
        {
          error: order.scheduledFor
            ? `Este pedido está programado para ${scheduledTimeLabel(order.scheduledFor)}. Los movimientos de pago se habilitan en la fecha programada.`
            : "Los movimientos de pago todavía no están disponibles.",
        },
        { status: 409 },
      );
    }

    const payment = order.payments.find((item) => item.id === paymentId);
    if (!payment) return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });
    if (payment.refunds.length > 0) {
      return NextResponse.json(
        {
          error:
            "Este pago ya tiene devoluciones registradas y no puede eliminarse. Conserva el historial financiero.",
        },
        { status: 409 },
      );
    }

    if (payment.status === "PAID" && payment.paidAt) {
      await assertCashDateEditable(payment.paidAt);
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: payment.id } });

      let pendingBalance: number | null = null;
      if (payment.status === "PAID") {
        const remainingPaid = orderNetReceived(
          order.payments.filter((item) => item.id !== payment.id),
        );
        pendingBalance = Math.max(0, Number(order.total) - remainingPaid);
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

      await writeAuditLog(tx, {
        actor: staffAuditActor(session),
        action: "PAYMENT_DELETED",
        entityType: "PAYMENT",
        entityId: payment.id,
        summary: `Pago de ${Math.round(Number(payment.amount)).toLocaleString("es-CO")} eliminado del pedido #${order.sequenceNumber ?? order.id}.`,
        before: {
          id: payment.id,
          orderId: payment.orderId,
          method: payment.method,
          amount: Number(payment.amount),
          cashReceived:
            payment.cashReceived == null ? null : Number(payment.cashReceived),
          changeDue:
            payment.changeDue == null ? null : Number(payment.changeDue),
          status: payment.status,
          paidAt: payment.paidAt,
        },
        metadata: {
          orderId: order.id,
          orderSequenceNumber: order.sequenceNumber,
          balanceAfter: pendingBalance,
        },
        source: "api/orders/[id]/payment/[paymentId]",
      });
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
