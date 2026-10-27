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
