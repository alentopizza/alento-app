export const DEFAULT_DRIVER_EARNING_PERCENT = 100;
export const DEFAULT_FREE_DELIVERY_EARNING = 2000;

export type DriverCompensationSettings = {
  earningPercent: number;
  freeDeliveryEarning: number;
};

function numberBetween(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeDriverCompensationSettings(
  settingsValue: unknown,
): DriverCompensationSettings {
  if (!settingsValue || typeof settingsValue !== "object") {
    return {
      earningPercent: DEFAULT_DRIVER_EARNING_PERCENT,
      freeDeliveryEarning: DEFAULT_FREE_DELIVERY_EARNING,
    };
  }

  const root = settingsValue as {
    driverManagement?: {
      earningPercent?: unknown;
      freeDeliveryEarning?: unknown;
    };
  };

  return {
    earningPercent: numberBetween(
      root.driverManagement?.earningPercent,
      0,
      100,
      DEFAULT_DRIVER_EARNING_PERCENT,
    ),
    freeDeliveryEarning: Math.round(
      numberBetween(
        root.driverManagement?.freeDeliveryEarning,
        0,
        100000,
        DEFAULT_FREE_DELIVERY_EARNING,
      ),
    ),
  };
}

export function calculateDriverEarning(
  deliveryFee: number,
  settingsValue: unknown,
) {
  const config = normalizeDriverCompensationSettings(settingsValue);
  const fee = Math.max(0, Number(deliveryFee) || 0);

  if (fee <= 0) {
    return {
      amount: Math.round(config.freeDeliveryEarning),
      base: 0,
      ratePercent: null,
      kind: "FREE_DELIVERY" as const,
      config,
    };
  }

  return {
    amount: Math.round((fee * config.earningPercent) / 100),
    base: Math.round(fee),
    ratePercent: config.earningPercent,
    kind: "PERCENTAGE" as const,
    config,
  };
}
