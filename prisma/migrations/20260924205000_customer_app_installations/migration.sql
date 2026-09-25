CREATE TABLE "CustomerAppInstallation" (
  "id" SERIAL NOT NULL,
  "customerId" INTEGER NOT NULL,
  "deviceKey" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerAppInstallation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAppInstallation_customerId_deviceKey_key"
ON "CustomerAppInstallation"("customerId", "deviceKey");

CREATE INDEX "CustomerAppInstallation_customerId_lastSeenAt_idx"
ON "CustomerAppInstallation"("customerId", "lastSeenAt");

ALTER TABLE "CustomerAppInstallation"
ADD CONSTRAINT "CustomerAppInstallation_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
