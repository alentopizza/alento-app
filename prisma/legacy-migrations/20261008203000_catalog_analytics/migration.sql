CREATE TABLE "CatalogAnalyticsEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "cartId" TEXT,
  "productId" INTEGER,
  "productName" TEXT,
  "path" TEXT,
  "referrer" TEXT,
  "source" TEXT,
  "medium" TEXT,
  "campaign" TEXT,
  "value" DECIMAL(14,2),
  "quantity" INTEGER,
  "itemCount" INTEGER,
  "orderId" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogAnalyticsEvent_eventId_key"
ON "CatalogAnalyticsEvent"("eventId");

CREATE INDEX "CatalogAnalyticsEvent_createdAt_idx"
ON "CatalogAnalyticsEvent"("createdAt");

CREATE INDEX "CatalogAnalyticsEvent_eventType_createdAt_idx"
ON "CatalogAnalyticsEvent"("eventType", "createdAt");

CREATE INDEX "CatalogAnalyticsEvent_visitorId_createdAt_idx"
ON "CatalogAnalyticsEvent"("visitorId", "createdAt");

CREATE INDEX "CatalogAnalyticsEvent_sessionId_createdAt_idx"
ON "CatalogAnalyticsEvent"("sessionId", "createdAt");

CREATE INDEX "CatalogAnalyticsEvent_cartId_createdAt_idx"
ON "CatalogAnalyticsEvent"("cartId", "createdAt");

CREATE INDEX "CatalogAnalyticsEvent_productId_eventType_createdAt_idx"
ON "CatalogAnalyticsEvent"("productId", "eventType", "createdAt");
