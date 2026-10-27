import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertSameIdempotentRequest,
  idempotencyErrorResponse,
  idempotencyRequestHash,
  requireIdempotencyKey,
} from "@/lib/idempotency";
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

function serializePayment(payment: {
  id: number;
  orderId: number;
  method: string;
  amount: unknown;
  cashReceived: unknown;
  changeDue: unknown;
  status: string;
  reference: string | null;
  paidAt: Date | null;
  createdAt: Date;
}) {
  return {
    ...payment,
    amount: Number(payment.amount),
    cashReceived:
      payment.cashReceived == null ? null : Number(payment.cashReceived),
    changeDue: payment.changeDue == null ? null : Number(payment.changeDue),
  };
}

async function replayedPaymentResponse(
  orderId: number,
  payment: {
    id: number;
    orderId: number;
    method: string;
    amount: unknown;
    cashReceived: unknown;
    changeDue: unknown;
    status: string;
    reference: string | null;
    paidAt: Date | null;
    createdAt: Date;
  },
) {
  const [order, paid] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      select: { total: true },
    }),
    prisma.payment.aggregate({
      where: { orderId, status: "PAID" },
      _sum: { amount: true },
    }),
  ]);

  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  }

  const paidTotal = Number(paid._sum.amount ?? 0);
  const balance = Math.max(0, Number(order.total) - paidTotal);

  return NextResponse.json(
    {
      payment: serializePayment(payment),
      paidTotal,
      balance,
      partial: balance > 0,
      replayed: true,
    },
    {
      status: 200,
      headers: { "Idempotency-Replayed": "true" },
    },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    }

    const body = await request.json();
    const idempotencyKey = requireIdempotencyKey(request);
    const idempotencyHash = idempotencyRequestHash({
      operation: "ORDER_PAYMENT_CREATE",
      orderId: id,
      body,
    });

    const existingPayment = await prisma.payment.findUnique({
      where: { idempotencyKey },
    });
    if (existingPayment) {
      assertSameIdempotentRequest(
        existingPayment.idempotencyHash,
        idempotencyHash,
      );
      if (existingPayment.orderId !== id) {
        return NextResponse.json(
          { error: "La clave de intento pertenece a otro pedido." },
          { status: 409 },
        );
      }
      return replayedPaymentResponse(id, existingPayment);
    }

    const settingsRow = await prisma.appSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });
    const settings = parseSettings(settingsRow?.value ?? null);
    const methodId = String(body.paymentMethodId ?? "");
    const method = settings.paymentMethods?.find(
      (item) => item.id === methodId && item.active !== false,
    );
    if (!method) {
      return NextResponse.json(
        { error: "Selecciona un medio de pago activo." },
        { status: 400 },
      );
    }

    const amount = money(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Ingresa un monto de pago válido." },
        { status: 400 },
      );
    }

    const isCash = method.name.trim().toLowerCase() === "efectivo";
    let cashReceived: number | null = null;
    let changeDue: number | null = null;

    if (
      isCash &&
      body.cashReceived != null &&
      String(body.cashReceived).trim() !== ""
    ) {
      const received = money(Number(body.cashReceived));
      if (!Number.isFinite(received) || received < amount) {
        return NextResponse.json(
          {
            error: `Si registras el efectivo entregado, debe ser mínimo ${amount.toLocaleString("es-CO")}.`,
          },
          { status: 400 },
        );
      }
      cashReceived = received;
      changeDue = received - amount;
    }

    const reference =
      typeof body.reference === "string" && body.reference.trim()
        ? body.reference.trim()
        : null;
    const paidAt = new Date();
    await assertCashDateEditable(paidAt);

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ id: number }>>(
        'SELECT "id" FROM "Order" WHERE "id" = $1 FOR UPDATE',
        id,
      );
      if (!locked.length) {
        return {
          kind: "error" as const,
          status: 404,
          error: "Pedido no encontrado.",
        };
      }

      const replayedPayment = await tx.payment.findUnique({
        where: { idempotencyKey },
      });
      if (replayedPayment) {
        assertSameIdempotentRequest(
          replayedPayment.idempotencyHash,
          idempotencyHash,
        );
        if (replayedPayment.orderId !== id) {
          return {
            kind: "error" as const,
            status: 409,
            error: "La clave de intento pertenece a otro pedido.",
          };
        }

        const lockedOrder = await tx.order.findUnique({
          where: { id },
          include: { payments: { orderBy: { id: "asc" } } },
        });
        const paidTotal =
          lockedOrder?.payments
            .filter((payment) => payment.status === "PAID")
            .reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0;
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
        where: { id },
        include: { payments: { orderBy: { id: "asc" } } },
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

      const paidAmount = order.payments
        .filter((payment) => payment.status === "PAID")
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const outstanding = Math.max(0, Number(order.total) - paidAmount);

      if (outstanding <= 0) {
        return {
          kind: "error" as const,
          status: 409,
          error: "Este pedido ya está pagado completamente.",
        };
      }
      if (amount > outstanding) {
        return {
          kind: "error" as const,
          status: 400,
          error: `El pago no puede superar el saldo pendiente de $${outstanding.toLocaleString("es-CO")}.`,
        };
      }

      const remaining = Math.max(0, outstanding - amount);
      const pending =
        order.payments.find(
          (payment) =>
            payment.status === "PENDING" || payment.status === "PARTIAL",
        ) ?? null;

      const payment = await tx.payment.create({
        data: {
          idempotencyKey,
          idempotencyHash,
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

      return {
        kind: "created" as const,
        payment,
        paidTotal: paidAmount + amount,
        balance: remaining,
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
        payment: serializePayment(result.payment),
        paidTotal: result.paidTotal,
        balance: result.balance,
        partial: result.balance > 0,
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

    console.error("Order payment registration error", error);
    return NextResponse.json(
      { error: "No fue posible registrar el pago." },
      { status: 500 },
    );
  }
}
