export const DEFAULT_DRIVER_ACCEPTANCE_RADIUS_METERS = 1500;
export const MIN_DRIVER_ACCEPTANCE_RADIUS_METERS = 100;
export const MAX_DRIVER_ACCEPTANCE_RADIUS_METERS = 10000;
export const DRIVER_LOCATION_MAX_AGE_MS = 120_000;

type Point = {
  latitude: number;
  longitude: number;
};

type DriverLocation = Point & {
  updatedAt?: Date | string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeDriverAcceptanceRadiusMeters(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_DRIVER_ACCEPTANCE_RADIUS_METERS;
  }

  return Math.min(
    MAX_DRIVER_ACCEPTANCE_RADIUS_METERS,
    Math.max(MIN_DRIVER_ACCEPTANCE_RADIUS_METERS, Math.round(parsed)),
  );
}

export function driverAcceptanceRadiusFromSettings(value: unknown) {
  if (!isRecord(value) || !isRecord(value.driverManagement)) {
    return DEFAULT_DRIVER_ACCEPTANCE_RADIUS_METERS;
  }

  return normalizeDriverAcceptanceRadiusMeters(
    value.driverManagement.acceptanceRadiusMeters,
  );
}

export function storePointFromSettings(value: unknown): Point | null {
  if (!isRecord(value) || !isRecord(value.store)) return null;

  const latitude = Number(value.store.latitude);
  const longitude = Number(value.store.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

export function distanceMetersBetween(a: Point, b: Point) {
  const radius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function driverAcceptanceZoneFromSettings(
  settings: unknown,
  driverLocation: DriverLocation | null,
) {
  const radiusMeters = driverAcceptanceRadiusFromSettings(settings);
  const store = storePointFromSettings(settings);

  if (!store) {
    return {
      radiusMeters,
      distanceMeters: null,
      inside: false,
      hasLocation: Boolean(driverLocation),
      locationFresh: false,
      storeConfigured: false,
      reason: "STORE_UNCONFIGURED" as const,
    };
  }

  if (!driverLocation) {
    return {
      radiusMeters,
      distanceMeters: null,
      inside: false,
      hasLocation: false,
      locationFresh: false,
      storeConfigured: true,
      reason: "NO_LOCATION" as const,
    };
  }

  const updatedAt = driverLocation.updatedAt
    ? new Date(driverLocation.updatedAt).getTime()
    : Number.NaN;
  const locationFresh =
    Number.isFinite(updatedAt) &&
    Date.now() - updatedAt <= DRIVER_LOCATION_MAX_AGE_MS;

  const distanceMeters = Math.round(
    distanceMetersBetween(store, driverLocation),
  );
  const inside = locationFresh && distanceMeters <= radiusMeters;

  return {
    radiusMeters,
    distanceMeters,
    inside,
    hasLocation: true,
    locationFresh,
    storeConfigured: true,
    reason: inside
      ? ("INSIDE" as const)
      : !locationFresh
        ? ("STALE_LOCATION" as const)
        : ("OUTSIDE" as const),
  };
}
