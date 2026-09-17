ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PREPARED';

ALTER TABLE "OrderItem"
ADD COLUMN IF NOT EXISTS "preparedQuantity" INTEGER NOT NULL DEFAULT 0;

UPDATE "OrderItem"
SET "preparedQuantity" = LEAST("preparedQuantity", "quantity");
