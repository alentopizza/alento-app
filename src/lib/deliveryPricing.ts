import { directDistanceMeters } from "@/lib/deliveryDistance";

export type DeliveryBand = {
  id: string;
  name?: string;
  minMeters: number;
  maxMeters: number;
  fee: number;
  active?: boolean;
};

export type DeliveryPricingSettings = {
  store?: {
    latitude?: number | null;
    longitude?: number | null;
  };
  deliveryBands?: DeliveryBand[];
};

export type DeliveryPoint = {
  latitude: number;
  longitude: number;
};

export const DEFAULT_DELIVERY_BANDS: DeliveryBand[] = [
  {
    id: "band-1",
    name: "Zona cercana",
    minMeters: 0,
    maxMeters: 200,
    fee: 0,
    active: true,
  },
  {
    id: "band-2",
    name: "Zona intermedia",
    minMeters: 201,
    maxMeters: 500,
    fee: 5000,
    active: true,
  },
];

export type DeliveryPricingErrorCode =
  | "INVALID_DESTINATION"
  | "STORE_LOCATION_MISSING"
  | "NO_ACTIVE_BANDS";

export class DeliveryPricingError extends Error {
  code: DeliveryPricingErrorCode;

  constructor(code: DeliveryPricingErrorCode, message: string) {
    super(message);
    this.name = "DeliveryPricingError";
    this.code = code;
  }
}

export function finiteCoordinate(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeDeliveryBands(
  settings: DeliveryPricingSettings | null | undefined,
) {
  const source = Array.isArray(settings?.deliveryBands)
    ? settings.deliveryBands
    : DEFAULT_DELIVERY_BANDS;

  return source
    .filter((band) => band.active !== false)
    .map((band) => ({
      ...band,
      minMeters: Number(band.minMeters),
      maxMeters: Number(band.maxMeters),
      fee: Number(band.fee),
    }))
    .filter(
      (band) =>
        Number.isFinite(band.minMeters) &&
        Number.isFinite(band.maxMeters) &&
        Number.isFinite(band.fee) &&
        band.minMeters >= 0 &&
        band.maxMeters >= band.minMeters &&
        band.fee >= 0,
    )
    .sort((a, b) => a.minMeters - b.minMeters);
}

export function resolveDeliveryPricing(input: {
  settings: DeliveryPricingSettings | null | undefined;
  destination: DeliveryPoint;
}) {
  const latitude = finiteCoordinate(input.destination.latitude);
  const longitude = finiteCoordinate(input.destination.longitude);

  if (
    latitude == null ||
    longitude == null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new DeliveryPricingError(
      "INVALID_DESTINATION",
      "Selecciona una ubicación válida para calcular el domicilio.",
    );
  }

  const storeLatitude = finiteCoordinate(input.settings?.store?.latitude);
  const storeLongitude = finiteCoordinate(input.settings?.store?.longitude);

  if (storeLatitude == null || storeLongitude == null) {
    throw new DeliveryPricingError(
      "STORE_LOCATION_MISSING",
      "La ubicación de Alentó no está configurada.",
    );
  }

  const bands = normalizeDeliveryBands(input.settings);
  if (!bands.length) {
    throw new DeliveryPricingError(
      "NO_ACTIVE_BANDS",
      "No hay tarifas de domicilio activas.",
    );
  }

  const origin = {
    latitude: storeLatitude,
    longitude: storeLongitude,
  };
  const destination = { latitude, longitude };
  const commercialDistanceMeters = directDistanceMeters({
    origin,
    destination,
  });
  const band =
    bands.find(
      (item) =>
        commercialDistanceMeters >= item.minMeters &&
        commercialDistanceMeters <= item.maxMeters,
    ) ?? null;

  return {
    origin,
    destination,
    commercialDistanceMeters,
    covered: Boolean(band),
    band,
    deliveryFee: band ? Math.round(band.fee) : null,
    deliveryZoneId: band?.id ?? null,
    deliveryZoneName: band?.name?.trim() || (band ? "Domicilio" : null),
    maxCoverageMeters: Math.max(0, ...bands.map((item) => item.maxMeters)),
  };
}


export function deliveryPricingHttpStatus(error: unknown) {
  if (!(error instanceof DeliveryPricingError)) return 500;
  if (error.code === "STORE_LOCATION_MISSING") return 503;
  return 400;
}
