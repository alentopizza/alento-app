import type { Prisma } from "@prisma/client";

export function cashReceivedPaymentWhere(
  start: Date,
  endExclusive: Date,
): Prisma.PaymentWhereInput {
  return {
    status: { in: ["PAID", "REFUNDED"] },
    paidAt: { gte: start, lt: endExclusive },
  };
}

export function cashRefundWhere(
  start: Date,
  endExclusive: Date,
): Prisma.PaymentRefundWhereInput {
  return {
    refundedAt: { gte: start, lt: endExclusive },
  };
}
