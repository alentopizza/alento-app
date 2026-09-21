export const CLUB_ALENTO_SETTING_KEY = "club_alento_settings";

export type ClubAlentoSettings = {
  pointsPerThousand: number;
};

export const DEFAULT_CLUB_ALENTO_SETTINGS: ClubAlentoSettings = {
  pointsPerThousand: 10,
};

export function normalizeClubAlentoSettings(value: unknown): ClubAlentoSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_CLUB_ALENTO_SETTINGS;
  }

  const raw = value as Partial<ClubAlentoSettings>;
  const pointsPerThousand = Math.max(
    0,
    Math.min(10000, Math.floor(Number(raw.pointsPerThousand ?? DEFAULT_CLUB_ALENTO_SETTINGS.pointsPerThousand))),
  );

  return {
    pointsPerThousand: Number.isFinite(pointsPerThousand)
      ? pointsPerThousand
      : DEFAULT_CLUB_ALENTO_SETTINGS.pointsPerThousand,
  };
}

export function clubPointsForAmount(amount: number, pointsPerThousand: number) {
  const eligibleThousands = Math.floor(Math.max(0, amount) / 1000);
  return eligibleThousands * Math.max(0, Math.floor(pointsPerThousand));
}
