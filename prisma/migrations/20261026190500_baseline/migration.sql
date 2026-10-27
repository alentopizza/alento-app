-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PREPARING', 'PREPARED', 'READY', 'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."FulfillmentType" AS ENUM ('DELIVERY', 'PICKUP', 'STORE');

-- CreateEnum
CREATE TYPE "public"."OrderSource" AS ENUM ('POS', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'WEB', 'RAPPI', 'DIDI', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'REFUNDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."ProductType" AS ENUM ('STANDARD', 'PIZZA_SINGLE', 'PIZZA_TWO_FLAVORS', 'PIZZA_CUSTOM', 'COMBO', 'MODIFIER', 'INTERNAL');

-- CreateEnum
CREATE TYPE "public"."CouponType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'POS', 'KITCHEN', 'CASHIER', 'DRIVER', 'DISPATCH');

-- CreateEnum
CREATE TYPE "public"."UserPermission" AS ENUM ('CANCEL_ORDERS', 'DELETE_ORDERS');

-- CreateTable
CREATE TABLE "public"."Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT '+57',
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "contactWebhookPending" BOOLEAN NOT NULL DEFAULT false,
    "contactWebhookSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "whatsappCountryCode" TEXT NOT NULL DEFAULT '+57',
    "whatsappPhone" TEXT,
    "roles" "public"."UserRole"[] DEFAULT ARRAY[]::"public"."UserRole"[],
    "permissions" "public"."UserPermission"[] DEFAULT ARRAY[]::"public"."UserPermission"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "driverAvailable" BOOLEAN NOT NULL DEFAULT false,
    "driverLatitude" DOUBLE PRECISION,
    "driverLongitude" DOUBLE PRECISION,
    "driverLocationAccuracy" DOUBLE PRECISION,
    "driverLocationUpdatedAt" TIMESTAMP(3),
    "driverLocationSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "customerId" INTEGER,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "staffOptIn" BOOLEAN NOT NULL DEFAULT false,
    "customerOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerPushSubscription" (
    "id" TEXT NOT NULL,
    "customerId" INTEGER,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NativePushDevice" (
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

-- CreateTable
CREATE TABLE "public"."PushCampaign" (
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

-- CreateTable
CREATE TABLE "public"."PushCampaignOpen" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" INTEGER,
    "channel" TEXT NOT NULL,
    "recipientKey" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushCampaignOpen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerAccount" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "phoneVerifiedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerAppInstallation" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "deviceKey" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAppInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerAuthCode" (
    "id" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerAddress" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "label" TEXT,
    "address" TEXT NOT NULL,
    "formattedAddress" TEXT,
    "placeId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "neighborhood" TEXT,
    "city" TEXT DEFAULT 'Bogotá',
    "notes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "visibleInPos" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "imageUrl2" TEXT,
    "type" "public"."ProductType" NOT NULL DEFAULT 'STANDARD',
    "basePrice" DECIMAL(12,2),
    "comboDiscount" DECIMAL(12,2),
    "couponEligible" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "visibleInPos" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ingredientGroupId" INTEGER,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IngredientGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductVariant" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PizzaSize" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "diameterCm" INTEGER NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PizzaSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PizzaCrust" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PizzaCrust_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PizzaCrustPrice" (
    "id" SERIAL NOT NULL,
    "crustId" INTEGER NOT NULL,
    "sizeId" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PizzaCrustPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ComboPizzaRule" (
    "id" SERIAL NOT NULL,
    "comboProductId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ComboPizzaRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ComboPizzaSizeOption" (
    "id" SERIAL NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "sizeId" INTEGER NOT NULL,

    CONSTRAINT "ComboPizzaSizeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ComboPizzaFlavorOption" (
    "id" SERIAL NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "ComboPizzaFlavorOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ComboGroup" (
    "id" SERIAL NOT NULL,
    "comboProductId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CUSTOM',
    "name" TEXT NOT NULL,
    "minSelections" INTEGER NOT NULL DEFAULT 1,
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ComboGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ComboOption" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceDelta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ComboOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Coupon" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."CouponType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "visibleInPos" BOOLEAN NOT NULL DEFAULT true,
    "visibleInCart" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderSequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "current" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" SERIAL NOT NULL,
    "sequenceNumber" INTEGER,
    "customerId" INTEGER,
    "addressId" INTEGER,
    "couponId" INTEGER,
    "driverId" INTEGER,
    "couponName" TEXT,
    "deliveryZoneId" TEXT,
    "deliveryZoneName" TEXT,
    "deliveryDistanceMeters" INTEGER,
    "deliveryTravelMode" TEXT,
    "discountSource" TEXT NOT NULL DEFAULT 'NONE',
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "fulfillmentType" "public"."FulfillmentType" NOT NULL DEFAULT 'DELIVERY',
    "source" "public"."OrderSource" NOT NULL DEFAULT 'POS',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "driverAssignedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "driverEarningAmount" DECIMAL(12,2),
    "driverEarningBase" DECIMAL(12,2),
    "driverEarningRatePercent" DECIMAL(5,2),
    "driverEarningKind" TEXT,
    "driverEarningCreditedAt" TIMESTAMP(3),
    "driverLatitude" DOUBLE PRECISION,
    "driverLongitude" DOUBLE PRECISION,
    "driverLocationAccuracy" DOUBLE PRECISION,
    "driverLocationUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER,
    "variantId" INTEGER,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "preparedQuantity" INTEGER NOT NULL DEFAULT 0,
    "driverVerifiedAt" TIMESTAMP(3),
    "driverVerifiedDriverId" INTEGER,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "configuration" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "cashReceived" DECIMAL(12,2),
    "changeDue" DECIMAL(12,2),
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CashExpense" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "note" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "planningType" TEXT NOT NULL DEFAULT 'AUTO',
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CashExpenseCustomType" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashExpenseCustomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CashIncome" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashIncome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CashRegisterSession" (
    "id" SERIAL NOT NULL,
    "businessDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openingBalance" DECIMAL(14,2) NOT NULL,
    "openingControlledBalance" DECIMAL(14,2),
    "openingLoanReceivable" DECIMAL(14,2),
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
    "closingDraft" JSONB,
    "closingDraftUpdatedAt" TIMESTAMP(3),
    "closingLoanReceivable" DECIMAL(14,2),
    "actualClosingBalance" DECIMAL(14,2),
    "difference" DECIMAL(14,2),
    "closeNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashRegisterSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CashLoan" (
    "id" SERIAL NOT NULL,
    "workerId" INTEGER,
    "workerName" TEXT NOT NULL,
    "note" TEXT,
    "principal" DECIMAL(12,2) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "payrollMonth" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdByName" TEXT NOT NULL,
    "historicalPaidWithoutRepayment" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CashLoanRepayment" (
    "id" SERIAL NOT NULL,
    "loanId" INTEGER NOT NULL,
    "payrollPaymentId" INTEGER,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'PAGO',
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashLoanRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClubPointTransaction" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "points" INTEGER NOT NULL,
    "ratePerThousand" INTEGER,
    "amountBase" DECIMAL(12,2),
    "reason" TEXT NOT NULL DEFAULT 'PURCHASE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubPointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationJob" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationImage" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductImage" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "slot" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CatalogAnalyticsEvent" (
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

-- CreateTable
CREATE TABLE "public"."AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."DoughPreparation" (
    "id" SERIAL NOT NULL,
    "createdById" INTEGER,
    "createdByName" TEXT NOT NULL,
    "personalCount" INTEGER NOT NULL DEFAULT 0,
    "mediumCount" INTEGER NOT NULL DEFAULT 0,
    "largeCount" INTEGER NOT NULL DEFAULT 0,
    "extraLargeCount" INTEGER NOT NULL DEFAULT 0,
    "totalBalls" INTEGER NOT NULL,
    "totalWeightGrams" INTEGER NOT NULL,
    "hydrationPct" DECIMAL(5,2) NOT NULL,
    "adnPct" DECIMAL(5,2) NOT NULL,
    "sugarPct" DECIMAL(5,2) NOT NULL,
    "saltPct" DECIMAL(5,2) NOT NULL,
    "yeastPct" DECIMAL(5,2) NOT NULL,
    "flourGrams" DECIMAL(14,3) NOT NULL,
    "waterGrams" DECIMAL(14,3) NOT NULL,
    "adnGrams" DECIMAL(14,3) NOT NULL,
    "sugarGrams" DECIMAL(14,3) NOT NULL,
    "saltGrams" DECIMAL(14,3) NOT NULL,
    "yeastGrams" DECIMAL(14,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoughPreparation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkShift" (
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

-- CreateTable
CREATE TABLE "public"."PayrollPayment" (
    "id" SERIAL NOT NULL,
    "workerId" INTEGER NOT NULL,
    "workerName" TEXT NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "loanDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'CASH',
    "createdById" INTEGER,
    "createdByName" TEXT NOT NULL,
    "cashExpenseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollPaymentShift" (
    "id" SERIAL NOT NULL,
    "payrollPaymentId" INTEGER NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollPaymentShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "public"."Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "public"."Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_active_idx" ON "public"."User"("active");

-- CreateIndex
CREATE INDEX "User_whatsappPhone_idx" ON "public"."User"("whatsappPhone");

-- CreateIndex
CREATE INDEX "User_driverAvailable_idx" ON "public"."User"("driverAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "DriverPushSubscription_endpoint_key" ON "public"."DriverPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "DriverPushSubscription_userId_idx" ON "public"."DriverPushSubscription"("userId");

-- CreateIndex
CREATE INDEX "DriverPushSubscription_customerId_idx" ON "public"."DriverPushSubscription"("customerId");

-- CreateIndex
CREATE INDEX "DriverPushSubscription_updatedAt_idx" ON "public"."DriverPushSubscription"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPushSubscription_endpoint_key" ON "public"."CustomerPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "CustomerPushSubscription_customerId_idx" ON "public"."CustomerPushSubscription"("customerId");

-- CreateIndex
CREATE INDEX "CustomerPushSubscription_updatedAt_idx" ON "public"."CustomerPushSubscription"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NativePushDevice_deviceKey_key" ON "public"."NativePushDevice"("deviceKey");

-- CreateIndex
CREATE UNIQUE INDEX "NativePushDevice_fcmToken_key" ON "public"."NativePushDevice"("fcmToken");

-- CreateIndex
CREATE INDEX "NativePushDevice_userId_active_idx" ON "public"."NativePushDevice"("userId", "active");

-- CreateIndex
CREATE INDEX "NativePushDevice_lastSeenAt_idx" ON "public"."NativePushDevice"("lastSeenAt");

-- CreateIndex
CREATE INDEX "PushCampaign_createdAt_idx" ON "public"."PushCampaign"("createdAt");

-- CreateIndex
CREATE INDEX "PushCampaign_status_createdAt_idx" ON "public"."PushCampaign"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PushCampaignOpen_campaignId_openedAt_idx" ON "public"."PushCampaignOpen"("campaignId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushCampaignOpen_campaignId_channel_recipientKey_key" ON "public"."PushCampaignOpen"("campaignId", "channel", "recipientKey");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_customerId_key" ON "public"."CustomerAccount"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_phoneE164_key" ON "public"."CustomerAccount"("phoneE164");

-- CreateIndex
CREATE INDEX "CustomerAppInstallation_customerId_lastSeenAt_idx" ON "public"."CustomerAppInstallation"("customerId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAppInstallation_customerId_deviceKey_key" ON "public"."CustomerAppInstallation"("customerId", "deviceKey");

-- CreateIndex
CREATE INDEX "CustomerAuthCode_phoneE164_createdAt_idx" ON "public"."CustomerAuthCode"("phoneE164", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerAuthCode_expiresAt_idx" ON "public"."CustomerAuthCode"("expiresAt");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_idx" ON "public"."CustomerAddress"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "public"."Category"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "public"."Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_ingredientGroupId_idx" ON "public"."Product"("ingredientGroupId");

-- CreateIndex
CREATE INDEX "Product_type_idx" ON "public"."Product"("type");

-- CreateIndex
CREATE INDEX "Product_visibleInPos_active_idx" ON "public"."Product"("visibleInPos", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Product_categoryId_name_key" ON "public"."Product"("categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientGroup_slug_key" ON "public"."IngredientGroup"("slug");

-- CreateIndex
CREATE INDEX "IngredientGroup_active_sortOrder_idx" ON "public"."IngredientGroup"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "public"."ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "public"."ProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PizzaSize_name_key" ON "public"."PizzaSize"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PizzaCrust_name_key" ON "public"."PizzaCrust"("name");

-- CreateIndex
CREATE INDEX "PizzaCrustPrice_sizeId_idx" ON "public"."PizzaCrustPrice"("sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "PizzaCrustPrice_crustId_sizeId_key" ON "public"."PizzaCrustPrice"("crustId", "sizeId");

-- CreateIndex
CREATE INDEX "ComboPizzaRule_comboProductId_idx" ON "public"."ComboPizzaRule"("comboProductId");

-- CreateIndex
CREATE INDEX "ComboPizzaSizeOption_sizeId_idx" ON "public"."ComboPizzaSizeOption"("sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "ComboPizzaSizeOption_ruleId_sizeId_key" ON "public"."ComboPizzaSizeOption"("ruleId", "sizeId");

-- CreateIndex
CREATE INDEX "ComboPizzaFlavorOption_productId_idx" ON "public"."ComboPizzaFlavorOption"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ComboPizzaFlavorOption_ruleId_productId_key" ON "public"."ComboPizzaFlavorOption"("ruleId", "productId");

-- CreateIndex
CREATE INDEX "ComboGroup_comboProductId_idx" ON "public"."ComboGroup"("comboProductId");

-- CreateIndex
CREATE INDEX "ComboOption_productId_idx" ON "public"."ComboOption"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ComboOption_groupId_productId_key" ON "public"."ComboOption"("groupId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_name_key" ON "public"."Coupon"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Order_sequenceNumber_key" ON "public"."Order"("sequenceNumber");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "public"."Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_addressId_idx" ON "public"."Order"("addressId");

-- CreateIndex
CREATE INDEX "Order_couponId_idx" ON "public"."Order"("couponId");

-- CreateIndex
CREATE INDEX "Order_driverId_idx" ON "public"."Order"("driverId");

-- CreateIndex
CREATE INDEX "Order_driverId_driverEarningCreditedAt_idx" ON "public"."Order"("driverId", "driverEarningCreditedAt");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "public"."Order"("status");

-- CreateIndex
CREATE INDEX "Order_scheduledFor_idx" ON "public"."Order"("scheduledFor");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "public"."Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_fulfillmentType_createdAt_idx" ON "public"."Order"("fulfillmentType", "createdAt");

-- CreateIndex
CREATE INDEX "Order_deliveryZoneId_createdAt_idx" ON "public"."Order"("deliveryZoneId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "public"."OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "public"."OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItem_variantId_idx" ON "public"."OrderItem"("variantId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "public"."Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_status_paidAt_idx" ON "public"."Payment"("status", "paidAt");

-- CreateIndex
CREATE INDEX "CashExpense_driverId_occurredAt_idx" ON "public"."CashExpense"("driverId", "occurredAt");

-- CreateIndex
CREATE INDEX "CashExpense_occurredAt_idx" ON "public"."CashExpense"("occurredAt");

-- CreateIndex
CREATE INDEX "CashExpense_category_occurredAt_idx" ON "public"."CashExpense"("category", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashExpenseCustomType_key_key" ON "public"."CashExpenseCustomType"("key");

-- CreateIndex
CREATE INDEX "CashExpenseCustomType_category_active_idx" ON "public"."CashExpenseCustomType"("category", "active");

-- CreateIndex
CREATE INDEX "CashIncome_occurredAt_idx" ON "public"."CashIncome"("occurredAt");

-- CreateIndex
CREATE INDEX "CashIncome_category_occurredAt_idx" ON "public"."CashIncome"("category", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashRegisterSession_businessDate_key" ON "public"."CashRegisterSession"("businessDate");

-- CreateIndex
CREATE INDEX "CashRegisterSession_status_businessDate_idx" ON "public"."CashRegisterSession"("status", "businessDate");

-- CreateIndex
CREATE INDEX "CashLoan_workerId_issuedAt_idx" ON "public"."CashLoan"("workerId", "issuedAt");

-- CreateIndex
CREATE INDEX "CashLoan_payrollMonth_idx" ON "public"."CashLoan"("payrollMonth");

-- CreateIndex
CREATE INDEX "CashLoan_issuedAt_idx" ON "public"."CashLoan"("issuedAt");

-- CreateIndex
CREATE INDEX "CashLoan_status_issuedAt_idx" ON "public"."CashLoan"("status", "issuedAt");

-- CreateIndex
CREATE INDEX "CashLoan_workerName_issuedAt_idx" ON "public"."CashLoan"("workerName", "issuedAt");

-- CreateIndex
CREATE INDEX "CashLoanRepayment_loanId_paidAt_idx" ON "public"."CashLoanRepayment"("loanId", "paidAt");

-- CreateIndex
CREATE INDEX "CashLoanRepayment_paidAt_idx" ON "public"."CashLoanRepayment"("paidAt");

-- CreateIndex
CREATE INDEX "CashLoanRepayment_payrollPaymentId_idx" ON "public"."CashLoanRepayment"("payrollPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubPointTransaction_orderId_key" ON "public"."ClubPointTransaction"("orderId");

-- CreateIndex
CREATE INDEX "ClubPointTransaction_customerId_createdAt_idx" ON "public"."ClubPointTransaction"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationJob_status_runAt_idx" ON "public"."NotificationJob"("status", "runAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationJob_kind_orderId_key" ON "public"."NotificationJob"("kind", "orderId");

-- CreateIndex
CREATE INDEX "NotificationImage_createdAt_idx" ON "public"."NotificationImage"("createdAt");

-- CreateIndex
CREATE INDEX "ProductImage_productId_slot_idx" ON "public"."ProductImage"("productId", "slot");

-- CreateIndex
CREATE INDEX "ProductImage_createdAt_idx" ON "public"."ProductImage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogAnalyticsEvent_eventId_key" ON "public"."CatalogAnalyticsEvent"("eventId");

-- CreateIndex
CREATE INDEX "CatalogAnalyticsEvent_createdAt_idx" ON "public"."CatalogAnalyticsEvent"("createdAt");

-- CreateIndex
CREATE INDEX "CatalogAnalyticsEvent_eventType_createdAt_idx" ON "public"."CatalogAnalyticsEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "CatalogAnalyticsEvent_visitorId_createdAt_idx" ON "public"."CatalogAnalyticsEvent"("visitorId", "createdAt");

-- CreateIndex
CREATE INDEX "CatalogAnalyticsEvent_sessionId_createdAt_idx" ON "public"."CatalogAnalyticsEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "CatalogAnalyticsEvent_cartId_createdAt_idx" ON "public"."CatalogAnalyticsEvent"("cartId", "createdAt");

-- CreateIndex
CREATE INDEX "CatalogAnalyticsEvent_productId_eventType_createdAt_idx" ON "public"."CatalogAnalyticsEvent"("productId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "DoughPreparation_createdAt_idx" ON "public"."DoughPreparation"("createdAt");

-- CreateIndex
CREATE INDEX "DoughPreparation_createdById_idx" ON "public"."DoughPreparation"("createdById");

-- CreateIndex
CREATE INDEX "WorkShift_userId_startsAt_idx" ON "public"."WorkShift"("userId", "startsAt");

-- CreateIndex
CREATE INDEX "WorkShift_status_startsAt_idx" ON "public"."WorkShift"("status", "startsAt");

-- CreateIndex
CREATE INDEX "WorkShift_startsAt_idx" ON "public"."WorkShift"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayment_cashExpenseId_key" ON "public"."PayrollPayment"("cashExpenseId");

-- CreateIndex
CREATE INDEX "PayrollPayment_workerId_occurredAt_idx" ON "public"."PayrollPayment"("workerId", "occurredAt");

-- CreateIndex
CREATE INDEX "PayrollPayment_occurredAt_idx" ON "public"."PayrollPayment"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPaymentShift_shiftId_key" ON "public"."PayrollPaymentShift"("shiftId");

-- CreateIndex
CREATE INDEX "PayrollPaymentShift_payrollPaymentId_idx" ON "public"."PayrollPaymentShift"("payrollPaymentId");

-- AddForeignKey
ALTER TABLE "public"."DriverPushSubscription" ADD CONSTRAINT "DriverPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverPushSubscription" ADD CONSTRAINT "DriverPushSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerPushSubscription" ADD CONSTRAINT "CustomerPushSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NativePushDevice" ADD CONSTRAINT "NativePushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PushCampaignOpen" ADD CONSTRAINT "PushCampaignOpen_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."PushCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerAccount" ADD CONSTRAINT "CustomerAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerAppInstallation" ADD CONSTRAINT "CustomerAppInstallation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_ingredientGroupId_fkey" FOREIGN KEY ("ingredientGroupId") REFERENCES "public"."IngredientGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PizzaCrustPrice" ADD CONSTRAINT "PizzaCrustPrice_crustId_fkey" FOREIGN KEY ("crustId") REFERENCES "public"."PizzaCrust"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PizzaCrustPrice" ADD CONSTRAINT "PizzaCrustPrice_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."PizzaSize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComboPizzaRule" ADD CONSTRAINT "ComboPizzaRule_comboProductId_fkey" FOREIGN KEY ("comboProductId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComboPizzaSizeOption" ADD CONSTRAINT "ComboPizzaSizeOption_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "public"."ComboPizzaRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComboPizzaSizeOption" ADD CONSTRAINT "ComboPizzaSizeOption_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."PizzaSize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComboPizzaFlavorOption" ADD CONSTRAINT "ComboPizzaFlavorOption_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "public"."ComboPizzaRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComboPizzaFlavorOption" ADD CONSTRAINT "ComboPizzaFlavorOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComboGroup" ADD CONSTRAINT "ComboGroup_comboProductId_fkey" FOREIGN KEY ("comboProductId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComboOption" ADD CONSTRAINT "ComboOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."ComboGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComboOption" ADD CONSTRAINT "ComboOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "public"."CustomerAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "public"."Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CashExpense" ADD CONSTRAINT "CashExpense_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CashLoan" ADD CONSTRAINT "CashLoan_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CashLoanRepayment" ADD CONSTRAINT "CashLoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "public"."CashLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CashLoanRepayment" ADD CONSTRAINT "CashLoanRepayment_payrollPaymentId_fkey" FOREIGN KEY ("payrollPaymentId") REFERENCES "public"."PayrollPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClubPointTransaction" ADD CONSTRAINT "ClubPointTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClubPointTransaction" ADD CONSTRAINT "ClubPointTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationJob" ADD CONSTRAINT "NotificationJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DoughPreparation" ADD CONSTRAINT "DoughPreparation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkShift" ADD CONSTRAINT "WorkShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollPayment" ADD CONSTRAINT "PayrollPayment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollPayment" ADD CONSTRAINT "PayrollPayment_cashExpenseId_fkey" FOREIGN KEY ("cashExpenseId") REFERENCES "public"."CashExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollPaymentShift" ADD CONSTRAINT "PayrollPaymentShift_payrollPaymentId_fkey" FOREIGN KEY ("payrollPaymentId") REFERENCES "public"."PayrollPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollPaymentShift" ADD CONSTRAINT "PayrollPaymentShift_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "public"."WorkShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

