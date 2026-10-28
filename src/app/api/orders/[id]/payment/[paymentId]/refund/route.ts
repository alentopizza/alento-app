import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { staffAuditActor, writeAuditLog } from "@/lib/auditLog";
import {
  assertSameIdempotentRequest,
  idempotencyErrorResponse,
  idempotencyRequestHash,
  requireIdempotencyKey,
} from "@/lib/idempotency";
import { refundableAmount, orderNetReceived } from "@/lib/orderPaymentFinancials";
import {
  assertCashDateEditable,
  CASH_DATE_CLOSED_ERROR,
  CASH_SESSION_REQUIRED_ERROR,
  CASH_MOVEMENT_BEFORE_OPEN_ERROR,
  cashDateClosedResponseMessage,
  cashSessionRequiredResponseMessage,
  cashMovementBeforeOpenResponseMessage,
} from "@/lib/cashRegisterLock";

function serializeRefund(refund: {
  id: number;
  paymentId: number;
  amount: unknown;
  method: string;
  reason: string;
  reference: string | null;
  refundedAt: Date;
  createdByName: string;
  createdAt: Date;
}) {
  return {
    ...refund,
    amount: Number(refund.amount),
  };
}

export async function POST(
  request: NextRequest,
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
      return NextResponse.json(
        { error: "Pedido o pago inválido." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const idempotencyKey = requireIdempotencyKey(request);
    const idempotencyHash = idempotencyRequestHash({
      operation: "ORDER_PAYMENT_REFUND",
      orderId,
      paymentId,
      body,
    });

    const existing = await prisma.paymentRefund.findUnique({
      where: { idempotencyKey },
      include: { payment: true },
    });
    if (existing) {
      assertSameIdempotentRequest(
        existing.idempotencyHash,
        idempotencyHash,
      );
      if (
        existing.paymentId !== paymentId ||
        existing.payment.orderId !== orderId
      ) {
        return NextResponse.json(
          { error: "La clave de intento pertenece a otra devolución." },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { refund: serializeRefund(existing), replayed: true },
        {
          status: 200,
          headers: { "Idempotency-Replayed": "true" },
        },
      );
    }

    const reason =
      typeof body.reason === "string" ? body.reason.trim().slice(0, 240) : "";
    if (reason.length < 3) {
      return NextResponse.json(
        { error: "Indica el motivo de la devolución." },
        { status: 400 },
      );
    }

    const reference =
      typeof body.reference === "string" && body.reference.trim()
        ? body.reference.trim().slice(0, 160)
        : null;

    const refundedAt = new Date();
    await assertCashDateEditable(refundedAt);

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe<Array<{ id: number }>>(
        'SELECT "id" FROM "Order" WHERE "id" = $1 FOR UPDATE',
        orderId,
      );

      const replayed = await tx.paymentRefund.findUnique({
        where: { idempotencyKey },
        include: { payment: true },
      });
      if (replayed) {
        assertSameIdempotentRequest(
          replayed.idempotencyHash,
          idempotencyHash,
        );
        if (
          replayed.paymentId !== paymentId ||
          replayed.payment.orderId !== orderId
        ) {
          return {
            kind: "error" as const,
            status: 409,
            error: "La clave de intento pertenece a otra devolución.",
          };
        }
        return {
          kind: "replay" as const,
          refund: replayed,
          netReceived: null,
          refundableAfter: null,
        };
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          payments: {
            include: {
              refunds: { orderBy: { refundedAt: "asc" } },
            },
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

      const payment = order.payments.find((item) => item.id === paymentId);
      if (!payment) {
        return {
          kind: "error" as const,
          status: 404,
          error: "Pago no encontrado.",
        };
      }

      const refundable = refundableAmount(payment);
      if (refundable <= 0) {
        return {
          kind: "error" as const,
          status: 409,
          error: "Este pago no tiene saldo disponible para devolver.",
        };
      }

      const requestedAmount =
        body.amount == null || String(body.amount).trim() === ""
          ? refundable
          : Math.round(Number(body.amount));

      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        return {
          kind: "error" as const,
          status: 400,
          error: "Ingresa un valor de devolución válido.",
        };
      }

      if (requestedAmount > refundable) {
        return {
          kind: "error" as const,
          status: 400,
          error: `La devolución no puede superar ${Math.round(refundable).toLocaleString("es-CO")}.`,
        };
      }

      const method =
        typeof body.method === "string" && body.method.trim()
          ? body.method.trim().slice(0, 80)
          : payment.method;

      const refund = await tx.paymentRefund.create({
        data: {
          idempotencyKey,
          idempotencyHash,
          paymentId: payment.id,
          amount: requestedAmount,
          method,
          reason,
          reference,
          refundedAt,
          createdByName: session.name,
        },
      });

      const refundableAfter = Math.max(0, refundable - requestedAmount);
      if (refundableAfter <= 0) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "REFUNDED" },
        });
      }

      const netReceivedBefore = orderNetReceived(order.payments);
      const netReceivedAfter = Math.max(
        0,
        netReceivedBefore - requestedAmount,
      );

      await writeAuditLog(tx, {
        actor: staffAuditActor(session),
        action: "PAYMENT_REFUNDED",
        entityType: "PAYMENT_REFUND",
        entityId: refund.id,
        summary: `Devolución de ${Math.round(requestedAmount).toLocaleString("es-CO")} registrada en pedido #${order.sequenceNumber ?? order.id}.`,
        after: {
          id: refund.id,
          orderId: order.id,
          paymentId: payment.id,
          method,
          amount: requestedAmount,
          reason,
          reference,
          refundedAt,
        },
        metadata: {
          orderId: order.id,
          orderSequenceNumber: order.sequenceNumber,
          originalPaymentAmount: Number(payment.amount),
          refundableBefore: refundable,
          refundableAfter,
          netReceivedBefore,
          netReceivedAfter,
        },
        source: "api/orders/[id]/payment/[paymentId]/refund",
      });

      return {
        kind: "created" as const,
        refund,
        netReceived: netReceivedAfter,
        refundableAfter,
      };
    });

    if (result.kind === "error") {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(
      {
        refund: serializeRefund(result.refund),
        netReceived: result.netReceived,
        refundableAfter: result.refundableAfter,
        replayed: result.kind === "replay",
      },
      result.kind === "replay"
        ? {
            status: 200,
            headers: { "Idempotency-Replayed": "true" },
          }
        : { status: 201 },
    );
  } catch (error) {
    const idempotencyError = idempotencyErrorResponse(error);
    if (idempotencyError) {
      return NextResponse.json(idempotencyError.body, {
        status: idempotencyError.status,
      });
    }

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

    console.error("Payment refund error", error);
    return NextResponse.json(
      { error: "No fue posible registrar la devolución." },
      { status: 500 },
    );
  }
}
