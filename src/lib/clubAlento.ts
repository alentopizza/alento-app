export const CLUB_ALENTO_SETTING_KEY = "club_alento_settings";

export type ClubAlentoSettings = {
  earnRatePercent: number;
  minimumRedemptionPurchase: number;
  pointValueCop: number;
};

export const DEFAULT_CLUB_ALENTO_SETTINGS: ClubAlentoSettings = {
  earnRatePercent: 5,
  minimumRedemptionPurchase: 14900,
  pointValueCop: 1,
};

export function normalizeClubAlentoSettings(value: unknown): ClubAlentoSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_CLUB_ALENTO_SETTINGS;
  }

  const raw = value as Partial<ClubAlentoSettings> & { pointsPerThousand?: number };

  const earnRatePercent = Number(raw.earnRatePercent ?? DEFAULT_CLUB_ALENTO_SETTINGS.earnRatePercent);
  const minimumRedemptionPurchase = Number(
    raw.minimumRedemptionPurchase ?? DEFAULT_CLUB_ALENTO_SETTINGS.minimumRedemptionPurchase,
  );
  const pointValueCop = Number(raw.pointValueCop ?? DEFAULT_CLUB_ALENTO_SETTINGS.pointValueCop);

  return {
    earnRatePercent: Number.isFinite(earnRatePercent)
      ? Math.max(0, Math.min(100, earnRatePercent))
      : DEFAULT_CLUB_ALENTO_SETTINGS.earnRatePercent,
    minimumRedemptionPurchase: Number.isFinite(minimumRedemptionPurchase)
      ? Math.max(0, Math.round(minimumRedemptionPurchase))
      : DEFAULT_CLUB_ALENTO_SETTINGS.minimumRedemptionPurchase,
    pointValueCop: Number.isFinite(pointValueCop)
      ? Math.max(0.01, pointValueCop)
      : DEFAULT_CLUB_ALENTO_SETTINGS.pointValueCop,
  };
}

export function clubPointsForAmount(amount: number, earnRatePercent: number) {
  return Math.floor(Math.max(0, amount) * (Math.max(0, earnRatePercent) / 100));
}

export function pointsPerThousandFromPercent(earnRatePercent: number) {
  return Math.round(Math.max(0, earnRatePercent) * 10);
}
