ALTER TABLE "CashLoan"
ADD COLUMN IF NOT EXISTS "workerId" INTEGER;

CREATE INDEX IF NOT EXISTS "CashLoan_workerId_issuedAt_idx"
ON "CashLoan"("workerId", "issuedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CashLoan_workerId_fkey'
  ) THEN
    ALTER TABLE "CashLoan"
    ADD CONSTRAINT "CashLoan_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
