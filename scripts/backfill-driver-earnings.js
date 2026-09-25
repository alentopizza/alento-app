const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const CUTOFF = new Date("2026-09-24T05:00:00.000Z");
const SETTINGS_KEY = "pos_settings";
const DEFAULT_PERCENT = 100;
const DEFAULT_FREE_EARNING = 2000;

function finiteBetween(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function compensationSettings(value) {
  const driver =
    value &&
    typeof value === "object" &&
    value.driverManagement &&
    typeof value.driverManagement === "object"
      ? value.driverManagement
      : {};

  return {
    earningPercent: finiteBetween(
      driver.earningPercent,
      0,
      100,
      DEFAULT_PERCENT,
    ),
    freeDeliveryEarning: Math.round(
      finiteBetween(
        driver.freeDeliveryEarning,
        0,
        100000,
        DEFAULT_FREE_EARNING,
      ),
    ),
  };
}

async function main() {
  const savedSettings = await prisma.appSetting.findUnique({
    where: { key: SETTINGS_KEY },
    select: { value: true },
  });
  const config = compensationSettings(savedSettings?.value);

  const orders = await prisma.order.findMany({
    where: {
      fulfillmentType: "DELIVERY",
      driverId: { not: null },
      status: { in: ["DELIVERED", "COMPLETED"] },
      driverEarningCreditedAt: null,
      updatedAt: { gte: CUTOFF },
    },
    select: {
      id: true,
      deliveryFee: true,
      deliveredAt: true,
      updatedAt: true,
    },
  });

  let credited = 0;
  let totalAmount = 0;

  for (const order of orders) {
    const deliveryFee = Math.max(0, Number(order.deliveryFee) || 0);
    const freeDelivery = deliveryFee <= 0;
    const amount = freeDelivery
      ? config.freeDeliveryEarning
      : Math.round((deliveryFee * config.earningPercent) / 100);
    const creditedAt = order.deliveredAt ?? order.updatedAt;

    await prisma.order.updateMany({
      where: {
        id: order.id,
        driverEarningCreditedAt: null,
      },
      data: {
        deliveredAt: order.deliveredAt ?? creditedAt,
        driverEarningAmount: amount,
        driverEarningBase: freeDelivery ? 0 : Math.round(deliveryFee),
        driverEarningRatePercent: freeDelivery
          ? null
          : config.earningPercent,
        driverEarningKind: freeDelivery
          ? "FREE_DELIVERY"
          : "PERCENTAGE",
        driverEarningCreditedAt: creditedAt,
      },
    });

    credited += 1;
    totalAmount += amount;
  }

  console.log(
    `Driver earnings backfill: ${credited} order(s), $${Math.round(
      totalAmount,
    ).toLocaleString("es-CO")} credited from 2026-09-24.`,
  );
}

main()
  .catch((error) => {
    console.error("Driver earnings backfill failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
