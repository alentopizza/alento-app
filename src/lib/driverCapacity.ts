import { prisma } from "@/lib/prisma";

export const DEFAULT_DRIVER_MAX_CONCURRENT_DELIVERIES = 2;
export const MIN_DRIVER_MAX_CONCURRENT_DELIVERIES = 1;
export const MAX_DRIVER_MAX_CONCURRENT_DELIVERIES = 10;

const SETTINGS_KEY = "pos_settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeDriverMaxConcurrentDeliveries(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_DRIVER_MAX_CONCURRENT_DELIVERIES;
  }

  return Math.min(
    MAX_DRIVER_MAX_CONCURRENT_DELIVERIES,
    Math.max(MIN_DRIVER_MAX_CONCURRENT_DELIVERIES, Math.round(parsed)),
  );
}

export function driverMaxConcurrentFromSettings(value: unknown) {
  if (!isRecord(value) || !isRecord(value.driverManagement)) {
    return DEFAULT_DRIVER_MAX_CONCURRENT_DELIVERIES;
  }

  return normalizeDriverMaxConcurrentDeliveries(
    value.driverManagement.maxConcurrentDeliveries,
  );
}

export async function getDriverMaxConcurrentDeliveries() {
  const saved = await prisma.appSetting.findUnique({
    where: { key: SETTINGS_KEY },
    select: { value: true },
  });

  return driverMaxConcurrentFromSettings(saved?.value);
}

export async function getDriverAssignedDeliveryCount(
  driverId: number,
  excludeOrderId?: number,
) {
  return prisma.order.count({
    where: {
      driverId,
      fulfillmentType: "DELIVERY",
      status: {
        notIn: ["DELIVERED", "COMPLETED", "CANCELED"],
      },
      ...(excludeOrderId
        ? {
            id: { not: excludeOrderId },
          }
        : {}),
    },
  });
}

export async function getDriverDeliveryCapacity(
  driverId: number,
  excludeOrderId?: number,
) {
  const [maxConcurrentDeliveries, assignedDeliveries] = await Promise.all([
    getDriverMaxConcurrentDeliveries(),
    getDriverAssignedDeliveryCount(driverId, excludeOrderId),
  ]);

  return {
    maxConcurrentDeliveries,
    assignedDeliveries,
    remaining: Math.max(
      0,
      maxConcurrentDeliveries - assignedDeliveries,
    ),
    reached: assignedDeliveries >= maxConcurrentDeliveries,
  };
}
