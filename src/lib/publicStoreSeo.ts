import { prisma } from "@/lib/prisma";
import {
  formatServiceRange,
  normalizeServiceHours,
  SERVICE_DAY_LABELS,
} from "@/lib/storeServiceHours";
import { SEO_ADDRESS } from "@/lib/seo";

const SETTINGS_KEY = "pos_settings";

type RawSettings = {
  store?: {
    address?: unknown;
    formattedAddress?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    serviceHours?: unknown;
  };
  deliveryBands?: unknown;
};

export type PublicDeliveryBand = {
  id: string;
  name: string;
  minMeters: number;
  maxMeters: number;
  fee: number;
};

export async function getPublicStoreSeoData() {
  const saved = await prisma.appSetting.findUnique({
    where: { key: SETTINGS_KEY },
  });

  const raw =
    saved?.value &&
    typeof saved.value === "object" &&
    !Array.isArray(saved.value)
      ? (saved.value as RawSettings)
      : {};

  const store =
    raw.store && typeof raw.store === "object"
      ? raw.store
      : {};

  const address =
    typeof store.formattedAddress === "string" &&
    store.formattedAddress.trim()
      ? store.formattedAddress.trim()
      : typeof store.address === "string" && store.address.trim()
        ? store.address.trim()
        : SEO_ADDRESS;

  const latitude = Number.isFinite(Number(store.latitude))
    ? Number(store.latitude)
    : null;
  const longitude = Number.isFinite(Number(store.longitude))
    ? Number(store.longitude)
    : null;

  const hours = normalizeServiceHours(store.serviceHours).map((schedule) => ({
    ...schedule,
    dayLabel: SERVICE_DAY_LABELS[schedule.day],
    rangeLabel: formatServiceRange(schedule),
  }));

  const deliveryBands = Array.isArray(raw.deliveryBands)
    ? raw.deliveryBands
        .map((item, index): PublicDeliveryBand | null => {
          if (!item || typeof item !== "object") return null;
          const band = item as Record<string, unknown>;
          if (band.active === false) return null;

          const minMeters = Math.max(0, Number(band.minMeters ?? 0));
          const maxMeters = Math.max(0, Number(band.maxMeters ?? 0));
          const fee = Math.max(0, Number(band.fee ?? 0));

          if (
            !Number.isFinite(minMeters) ||
            !Number.isFinite(maxMeters) ||
            !Number.isFinite(fee)
          ) {
            return null;
          }

          return {
            id:
              typeof band.id === "string" && band.id
                ? band.id
                : `band-${index + 1}`,
            name:
              typeof band.name === "string" && band.name.trim()
                ? band.name.trim()
                : fee === 0
                  ? "Domicilio sin costo"
                  : `Zona ${index + 1}`,
            minMeters,
            maxMeters,
            fee,
          };
        })
        .filter((item): item is PublicDeliveryBand => Boolean(item))
        .sort((a, b) => a.minMeters - b.minMeters)
    : [];

  return {
    address,
    latitude,
    longitude,
    hours,
    deliveryBands,
  };
}
