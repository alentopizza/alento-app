export type RefundAmountLike = {
  amount: number | string | { toString(): string };
};

export type PaymentFinancialLike = {
  status: string;
  amount: number | string | { toString(): string };
  refunds?: RefundAmountLike[] | null;
};

export function refundedAmount(payment: PaymentFinancialLike) {
  return (payment.refunds ?? []).reduce(
    (sum, refund) => sum + Number(refund.amount),
    0,
  );
}

export function netReceivedForPayment(payment: PaymentFinancialLike) {
  if (payment.status === "REFUNDED") {
    return 0;
  }
  if (payment.status !== "PAID") {
    return 0;
  }
  return Math.max(0, Number(payment.amount) - refundedAmount(payment));
}

export function orderNetReceived(payments: PaymentFinancialLike[]) {
  return payments.reduce(
    (sum, payment) => sum + netReceivedForPayment(payment),
    0,
  );
}

export function refundableAmount(payment: PaymentFinancialLike) {
  if (payment.status !== "PAID") {
    return 0;
  }
  return Math.max(0, Number(payment.amount) - refundedAmount(payment));
}
