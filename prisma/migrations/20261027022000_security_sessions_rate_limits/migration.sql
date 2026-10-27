-- Security hardening: revocable staff sessions and persistent rate-limit buckets.

ALTER TABLE "User"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "SecurityRateLimit" (
    "scope" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityRateLimit_pkey" PRIMARY KEY ("scope", "keyHash")
);

CREATE INDEX "SecurityRateLimit_updatedAt_idx"
ON "SecurityRateLimit"("updatedAt");

CREATE INDEX "SecurityRateLimit_blockedUntil_idx"
ON "SecurityRateLimit"("blockedUntil");
