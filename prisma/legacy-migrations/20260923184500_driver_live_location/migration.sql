ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "driverLatitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "driverLongitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "driverLocationAccuracy" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "driverLocationUpdatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_driverLocationUpdatedAt_idx"
ON "Order" ("driverLocationUpdatedAt");
