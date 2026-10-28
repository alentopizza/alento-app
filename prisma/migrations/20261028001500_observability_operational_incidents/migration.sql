CREATE TABLE "OperationalIncident" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "lastRequestId" TEXT,
    "metadata" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" INTEGER,
    "resolvedByName" TEXT,

    CONSTRAINT "OperationalIncident_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationalIncident_fingerprint_key"
ON "OperationalIncident"("fingerprint");

CREATE INDEX "OperationalIncident_level_lastSeenAt_idx"
ON "OperationalIncident"("level", "lastSeenAt");

CREATE INDEX "OperationalIncident_category_lastSeenAt_idx"
ON "OperationalIncident"("category", "lastSeenAt");

CREATE INDEX "OperationalIncident_resolvedAt_lastSeenAt_idx"
ON "OperationalIncident"("resolvedAt", "lastSeenAt");

CREATE INDEX "OperationalIncident_lastRequestId_idx"
ON "OperationalIncident"("lastRequestId");
