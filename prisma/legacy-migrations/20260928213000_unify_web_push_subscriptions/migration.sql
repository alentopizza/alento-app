ALTER TABLE "DriverPushSubscription"
ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "DriverPushSubscription"
ADD COLUMN IF NOT EXISTS "customerId" INTEGER;

CREATE INDEX IF NOT EXISTS "DriverPushSubscription_customerId_idx"
ON "DriverPushSubscription"("customerId");

CREATE INDEX IF NOT EXISTS "DriverPushSubscription_updatedAt_idx"
ON "DriverPushSubscription"("updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DriverPushSubscription_customerId_fkey'
  ) THEN
    ALTER TABLE "DriverPushSubscription"
    ADD CONSTRAINT "DriverPushSubscription_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"CustomerPushSubscription"') IS NOT NULL THEN
    EXECUTE '
      INSERT INTO "DriverPushSubscription"
        ("id","userId","customerId","endpoint","p256dh","auth","userAgent","lastSuccessAt","createdAt","updatedAt")
      SELECT
        "id", NULL, "customerId", "endpoint", "p256dh", "auth", "userAgent", "lastSuccessAt", "createdAt", "updatedAt"
      FROM "CustomerPushSubscription"
      ON CONFLICT ("endpoint") DO UPDATE SET
        "customerId" = EXCLUDED."customerId",
        "userId" = NULL,
        "p256dh" = EXCLUDED."p256dh",
        "auth" = EXCLUDED."auth",
        "userAgent" = EXCLUDED."userAgent",
        "lastSuccessAt" = COALESCE(EXCLUDED."lastSuccessAt", "DriverPushSubscription"."lastSuccessAt"),
        "updatedAt" = EXCLUDED."updatedAt"
    ';
  END IF;
END $$;
