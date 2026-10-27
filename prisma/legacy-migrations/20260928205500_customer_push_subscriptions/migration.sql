CREATE TABLE "CustomerPushSubscription" (
    "id" TEXT NOT NULL,
    "customerId" INTEGER,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerPushSubscription_endpoint_key"
ON "CustomerPushSubscription"("endpoint");

CREATE INDEX "CustomerPushSubscription_customerId_idx"
ON "CustomerPushSubscription"("customerId");

CREATE INDEX "CustomerPushSubscription_updatedAt_idx"
ON "CustomerPushSubscription"("updatedAt");

ALTER TABLE "CustomerPushSubscription"
ADD CONSTRAINT "CustomerPushSubscription_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
