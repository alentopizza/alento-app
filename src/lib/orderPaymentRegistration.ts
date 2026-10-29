import type { Payment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSameIdempotentRequest } from "@/lib/idempotency";
import { type AuditActor, writeAuditLog } from "@/lib/auditLog";
import { orderNetReceived } from "@/lib/orderPaymentFinancials";

export type RegisterOrderPaymentInput = {
  orderId: number;
  idempotencyKey: string;
  idempotencyHash: string;
  method: string;
  amount: number;
  cashReceived: number | null;
  changeDue: number | null;
  reference: string | null;
  paidAt: Date;
  auditActor?: AuditActor;
};

export type RegisterOrderPaymentResult =
  | {
      kind: "created" | "replay";
      payment: Payment;
      paidTotal: number;
      balance: number;
    }
  | {
      kind: "error";
      status: number;
      error: string;
    };

export async function registerOrderPayment(
  input: RegisterOrderPaymentInput,
): Promise<RegisterOrderPaymentResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRawUnsafe<Array<{ id: number }>>(
      'SELECT "id" FROM "Order" WHERE "id" = $1 FOR UPDATE',
      input.orderId,
    );

    if (!locked.length) {
      return {
        kind: "error" as const,
        status: 404,
        error: "Pedido no encontrado.",
      };
    }

    const replayedPayment = await tx.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (replayedPayment) {
      assertSameIdempotentRequest(
        replayedPayment.idempotencyHash,
        input.idempotencyHash,
      );

      if (replayedPayment.orderId !== input.orderId) {
        return {
          kind: "error" as const,
          status: 409,
          error: "La clave de intento pertenece a otro pedido.",
        };
      }

      const lockedOrder = await tx.order.findUnique({
        where: { id: input.orderId },
        include: {
          payments: {
            include: { refunds: true },
            orderBy: { id: "asc" },
          },
        },
      });

      const paidTotal = lockedOrder
        ? orderNetReceived(lockedOrder.payments)
        : 0;
      const balance = lockedOrder
        ? Math.max(0, Number(lockedOrder.total) - paidTotal)
        : 0;

      return {
        kind: "replay" as const,
        payment: replayedPayment,
        paidTotal,
        balance,
      };
    }

    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        payments: {
          include: { refunds: true },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!order) {
      return {
        kind: "error" as const,
        status: 404,
        error: "Pedido no encontrado.",
      };
    }

    if (order.status === "CANCELED") {
      return {
        kind: "error" as const,
        status: 409,
        error: "No se puede registrar pago en un pedido cancelado.",
      };
    }

    const paidAmount = orderNetReceived(order.payments);
    const outstanding = Math.max(0, Number(order.total) - paidAmount);

    if (outstanding <= 0) {
      return {
        kind: "error" as const,
        status: 409,
        error: "Este pedido ya está pagado completamente.",
      };
    }

    if (input.amount > outstanding) {
      return {
        kind: "error" as const,
        status: 400,
        error: `El pago no puede superar el saldo pendiente de $${outstanding.toLocaleString("es-CO")}.`,
      };
    }

    const remaining = Math.max(0, outstanding - input.amount);
    const pending =
      order.payments.find(
        (payment) =>
          payment.status === "PENDING" || payment.status === "PARTIAL",
      ) ?? null;

    const payment = await tx.payment.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        idempotencyHash: input.idempotencyHash,
        orderId: order.id,
        method: input.method,
        amount: input.amount,
        cashReceived: input.cashReceived,
        changeDue: input.changeDue,
        reference: input.reference,
        status: "PAID",
        paidAt: input.paidAt,
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

    if (input.auditActor) {
      await writeAuditLog(tx, {
        actor: input.auditActor,
        action: "PAYMENT_CREATED",
        entityType: "PAYMENT",
        entityId: payment.id,
        summary: `Pago de ${Math.round(input.amount).toLocaleString("es-CO")} registrado por ${input.method} en pedido #${order.sequenceNumber ?? order.id}.`,
        after: {
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
          paidTotalBefore: paidAmount,
          paidTotalAfter: paidAmount + input.amount,
          balanceAfter: remaining,
        },
        source: "api/orders/[id]/payment",
      });
    }

    return {
      kind: "created" as const,
      payment,
      paidTotal: paidAmount + input.amount,
      balance: remaining,
    };
  });
}
