CREATE TABLE "DriverPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DriverPushSubscription_endpoint_key"
ON "DriverPushSubscription"("endpoint");

CREATE INDEX "DriverPushSubscription_userId_idx"
ON "DriverPushSubscription"("userId");

ALTER TABLE "DriverPushSubscription"
ADD CONSTRAINT "DriverPushSubscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
