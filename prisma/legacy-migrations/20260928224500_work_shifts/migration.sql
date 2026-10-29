CREATE TABLE "WorkShift" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" INTEGER,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkShift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkShift_userId_startsAt_idx" ON "WorkShift"("userId", "startsAt");
CREATE INDEX "WorkShift_status_startsAt_idx" ON "WorkShift"("status", "startsAt");
CREATE INDEX "WorkShift_startsAt_idx" ON "WorkShift"("startsAt");

ALTER TABLE "WorkShift"
ADD CONSTRAINT "WorkShift_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
