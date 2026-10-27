-- El acceso a la audiencia interna debe ser opt-in explícito.
ALTER TABLE "DriverPushSubscription"
ALTER COLUMN "staffOptIn" SET DEFAULT false;

-- Las filas sin usuario interno no pueden recibir Push de Staff.
UPDATE "DriverPushSubscription"
SET "staffOptIn" = false
WHERE "userId" IS NULL
  AND "staffOptIn" = true;
