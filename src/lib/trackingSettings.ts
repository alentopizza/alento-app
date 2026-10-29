import type { Prisma } from "@prisma/client";

export const TRACKING_SETTINGS_KEY = "marketing_tracking_settings";

export type TrackingSettings = {
  enabled: boolean;
  requireConsent: boolean;
  googleTagManagerId: string;
  googleAnalyticsId: string;
  googleAdsId: string;
  googleAdsPurchaseLabel: string;
  metaPixelId: string;
  tiktokPixelId: string;
  clarityId: string;
};

export const DEFAULT_TRACKING_SETTINGS: TrackingSettings = {
  enabled: true,
  requireConsent: true,
  googleTagManagerId: "",
  googleAnalyticsId: "",
  googleAdsId: "",
  googleAdsPurchaseLabel: "",
  metaPixelId: "",
  tiktokPixelId: "",
  clarityId: "",
};

function clean(value: unknown, max = 80) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function valid(value: string, pattern: RegExp) {
  return !value || pattern.test(value);
}

export function normalizeTrackingSettings(value: unknown): TrackingSettings {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const settings: TrackingSettings = {
    enabled: raw.enabled !== false,
    requireConsent: raw.requireConsent !== false,
    googleTagManagerId: clean(raw.googleTagManagerId).toUpperCase(),
    googleAnalyticsId: clean(raw.googleAnalyticsId).toUpperCase(),
    googleAdsId: clean(raw.googleAdsId).toUpperCase(),
    googleAdsPurchaseLabel: clean(raw.googleAdsPurchaseLabel),
    metaPixelId: clean(raw.metaPixelId),
    tiktokPixelId: clean(raw.tiktokPixelId),
    clarityId: clean(raw.clarityId).toLowerCase(),
  };

  if (!valid(settings.googleTagManagerId, /^GTM-[A-Z0-9]+$/)) {
    settings.googleTagManagerId = "";
  }
  if (!valid(settings.googleAnalyticsId, /^G-[A-Z0-9]+$/)) {
    settings.googleAnalyticsId = "";
  }
  if (!valid(settings.googleAdsId, /^AW-[0-9]+$/)) {
    settings.googleAdsId = "";
  }
  if (!valid(settings.metaPixelId, /^[0-9]{5,30}$/)) {
    settings.metaPixelId = "";
  }
  if (!valid(settings.tiktokPixelId, /^[A-Z0-9]{8,40}$/i)) {
    settings.tiktokPixelId = "";
  }
  if (!valid(settings.clarityId, /^[a-z0-9]{5,30}$/i)) {
    settings.clarityId = "";
  }

  return settings;
}

export function trackingSettingsAsJson(
  settings: TrackingSettings,
): Prisma.InputJsonValue {
  return settings as unknown as Prisma.InputJsonValue;
}

export function hasExternalTracking(settings: TrackingSettings) {
  return Boolean(
    settings.googleTagManagerId ||
      settings.googleAnalyticsId ||
      settings.googleAdsId ||
      settings.metaPixelId ||
      settings.tiktokPixelId ||
      settings.clarityId,
  );
}
