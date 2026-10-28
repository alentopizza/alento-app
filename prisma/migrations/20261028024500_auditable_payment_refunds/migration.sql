CREATE TABLE "PaymentRefund" (
    "id" SERIAL NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyHash" TEXT NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "refundedAt" TIMESTAMP(3) NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRefund_idempotencyKey_key" ON "PaymentRefund"("idempotencyKey");
CREATE INDEX "PaymentRefund_paymentId_refundedAt_idx" ON "PaymentRefund"("paymentId", "refundedAt");
CREATE INDEX "PaymentRefund_refundedAt_idx" ON "PaymentRefund"("refundedAt");

ALTER TABLE "PaymentRefund"
ADD CONSTRAINT "PaymentRefund_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
