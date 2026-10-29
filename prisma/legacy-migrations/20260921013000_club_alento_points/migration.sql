CREATE TABLE "ClubPointTransaction" (
  "id" SERIAL NOT NULL,
  "customerId" INTEGER NOT NULL,
  "orderId" INTEGER,
  "points" INTEGER NOT NULL,
  "ratePerThousand" INTEGER,
  "amountBase" DECIMAL(12,2),
  "reason" TEXT NOT NULL DEFAULT 'PURCHASE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClubPointTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubPointTransaction_orderId_key"
ON "ClubPointTransaction"("orderId");

CREATE INDEX "ClubPointTransaction_customerId_createdAt_idx"
ON "ClubPointTransaction"("customerId", "createdAt");

ALTER TABLE "ClubPointTransaction"
ADD CONSTRAINT "ClubPointTransaction_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClubPointTransaction"
ADD CONSTRAINT "ClubPointTransaction_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ClubPointTransaction"
  ("customerId", "orderId", "points", "ratePerThousand", "amountBase", "reason", "createdAt")
SELECT
  o."customerId",
  o."id",
  FLOOR(o."total" / 1000)::INTEGER * 10,
  10,
  o."total",
  'PURCHASE',
  o."updatedAt"
FROM "Order" o
WHERE
  o."status" = 'COMPLETED'
  AND o."customerId" IS NOT NULL
ON CONFLICT ("orderId") DO NOTHING;
