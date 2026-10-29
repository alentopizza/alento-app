CREATE TABLE "NativePushDevice" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "deviceKey" TEXT NOT NULL,
  "fcmToken" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'ANDROID',
  "appVersion" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSuccessAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NativePushDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushCampaign" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "body" TEXT NOT NULL,
  "imageUrl" TEXT,
  "audience" TEXT NOT NULL,
  "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "actionType" TEXT NOT NULL DEFAULT 'APP',
  "actionValue" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdById" INTEGER,
  "createdByName" TEXT NOT NULL,
  "webTargetCount" INTEGER NOT NULL DEFAULT 0,
  "nativeTargetCount" INTEGER NOT NULL DEFAULT 0,
  "webDeliveredCount" INTEGER NOT NULL DEFAULT 0,
  "nativeDeliveredCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "openedCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushCampaignOpen" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" INTEGER,
  "channel" TEXT NOT NULL,
  "recipientKey" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushCampaignOpen_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NativePushDevice_deviceKey_key" ON "NativePushDevice"("deviceKey");
CREATE UNIQUE INDEX "NativePushDevice_fcmToken_key" ON "NativePushDevice"("fcmToken");
CREATE INDEX "NativePushDevice_userId_active_idx" ON "NativePushDevice"("userId", "active");
CREATE INDEX "NativePushDevice_lastSeenAt_idx" ON "NativePushDevice"("lastSeenAt");
CREATE INDEX "PushCampaign_createdAt_idx" ON "PushCampaign"("createdAt");
CREATE INDEX "PushCampaign_status_createdAt_idx" ON "PushCampaign"("status", "createdAt");
CREATE UNIQUE INDEX "PushCampaignOpen_campaignId_channel_recipientKey_key" ON "PushCampaignOpen"("campaignId", "channel", "recipientKey");
CREATE INDEX "PushCampaignOpen_campaignId_openedAt_idx" ON "PushCampaignOpen"("campaignId", "openedAt");

ALTER TABLE "NativePushDevice"
ADD CONSTRAINT "NativePushDevice_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushCampaignOpen"
ADD CONSTRAINT "PushCampaignOpen_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "PushCampaign"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
