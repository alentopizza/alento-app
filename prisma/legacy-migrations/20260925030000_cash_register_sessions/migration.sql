CREATE TABLE "CashRegisterSession" (
  "id" SERIAL NOT NULL,
  "businessDate" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "openingBalance" DECIMAL(14,2) NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openedByName" TEXT NOT NULL,
  "netMovement" DECIMAL(14,2),
  "expectedClosingBalance" DECIMAL(14,2),
  "closingCash" DECIMAL(14,2),
  "closingNequi" DECIMAL(14,2),
  "closingDaviplata" DECIMAL(14,2),
  "closingCard" DECIMAL(14,2),
  "closingDavivienda" DECIMAL(14,2),
  "closingDenominations" JSONB,
  "actualClosingBalance" DECIMAL(14,2),
  "difference" DECIMAL(14,2),
  "closeNote" TEXT,
  "closedAt" TIMESTAMP(3),
  "closedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CashRegisterSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CashRegisterSession_businessDate_key"
ON "CashRegisterSession"("businessDate");

CREATE INDEX "CashRegisterSession_status_businessDate_idx"
ON "CashRegisterSession"("status", "businessDate");
