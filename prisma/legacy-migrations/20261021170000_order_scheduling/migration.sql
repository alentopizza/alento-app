ALTER TABLE "Order"
ADD COLUMN "scheduledFor" TIMESTAMP(3);

CREATE INDEX "Order_scheduledFor_idx"
ON "Order"("scheduledFor");
