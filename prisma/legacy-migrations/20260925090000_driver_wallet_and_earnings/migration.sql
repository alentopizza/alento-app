ALTER TABLE "Order"
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "driverEarningAmount" DECIMAL(12,2),
ADD COLUMN "driverEarningBase" DECIMAL(12,2),
ADD COLUMN "driverEarningRatePercent" DECIMAL(5,2),
ADD COLUMN "driverEarningKind" TEXT,
ADD COLUMN "driverEarningCreditedAt" TIMESTAMP(3);

UPDATE "Order"
SET "deliveredAt" = "updatedAt"
WHERE "fulfillmentType" = 'DELIVERY'
  AND "status" IN ('DELIVERED', 'COMPLETED')
  AND "deliveredAt" IS NULL;

CREATE INDEX "Order_driverId_driverEarningCreditedAt_idx"
ON "Order"("driverId", "driverEarningCreditedAt");

ALTER TABLE "CashExpense"
ADD COLUMN "driverId" INTEGER;

CREATE INDEX "CashExpense_driverId_occurredAt_idx"
ON "CashExpense"("driverId", "occurredAt");

ALTER TABLE "CashExpense"
ADD CONSTRAINT "CashExpense_driverId_fkey"
FOREIGN KEY ("driverId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
