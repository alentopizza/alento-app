-- Central append-only business audit log.

CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "source" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_occurredAt_idx"
ON "AuditLog"("occurredAt");

CREATE INDEX "AuditLog_entityType_entityId_occurredAt_idx"
ON "AuditLog"("entityType", "entityId", "occurredAt");

CREATE INDEX "AuditLog_actorUserId_occurredAt_idx"
ON "AuditLog"("actorUserId", "occurredAt");

CREATE INDEX "AuditLog_action_occurredAt_idx"
ON "AuditLog"("action", "occurredAt");


CREATE OR REPLACE FUNCTION "prevent_audit_log_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$;

CREATE TRIGGER "AuditLog_append_only"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION "prevent_audit_log_mutation"();
