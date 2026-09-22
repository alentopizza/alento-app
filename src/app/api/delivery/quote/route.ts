import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDrivingRoute, reverseGeocode } from "@/lib/googleMapsServer";

const SETTINGS_KEY = "pos_settings";

const DEFAULT_BANDS = [
  { id: "band-1", name: "Zona cercana", minMeters: 0, maxMeters: 200, fee: 0, active: true },
  { id: "band-2", name: "Zona intermedia", minMeters: 201, maxMeters: 500, fee: 5000, active: true },
];

type Band = {
  id: string;
  name?: string;
  minMeters: number;
  maxMeters: number;
  fee: number;
  active: boolean;
};

type StoreSettings = {
  address?: string;
  formattedAddress?: string;
  placeId?: string;
  latitude?: number | null;
  longitude?: number | null;
};

type SettingsValue = {
  store?: StoreSettings;
  deliveryBands?: Band[];
};

function normalizedBands(value: SettingsValue | null) {
  const bands = Array.isArray(value?.deliveryBands)
    ? value!.deliveryBands!
    : DEFAULT_BANDS;

  return bands
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
        Number.isFinite(band.fee),
    )
    .sort((a, b) => a.minMeters - b.minMeters);
}

function finiteCoordinate(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const saved = await prisma.appSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });
    const value = (saved?.value ?? null) as SettingsValue | null;
    const activeBands = normalizedBands(value);

    if (!activeBands.length) {
      return NextResponse.json(
        { error: "No hay tarifas de domicilio activas." },
        { status: 400 },
      );
    }

    // Compatibilidad temporal con herramientas internas antiguas.
    const legacyDistance = finiteCoordinate(body?.distanceMeters);
    if (
      legacyDistance != null &&
      body?.latitude == null &&
      body?.longitude == null
    ) {
      if (legacyDistance < 0) {
        return NextResponse.json(
          { error: "La distancia debe ser un número válido en metros." },
          { status: 400 },
        );
      }

      const band = activeBands.find(
        (item) =>
          legacyDistance >= item.minMeters &&
          legacyDistance <= item.maxMeters,
      );

      return NextResponse.json({
        covered: Boolean(band),
        distanceMeters: Math.round(legacyDistance),
        deliveryFee: band ? band.fee : null,
        band: band ?? null,
        maxCoverageMeters: Math.max(
          0,
          ...activeBands.map((item) => item.maxMeters),
        ),
      });
    }

    const latitude = finiteCoordinate(body?.latitude);
    const longitude = finiteCoordinate(body?.longitude);

    if (
      latitude == null ||
      longitude == null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { error: "Selecciona una ubicación válida para cotizar el domicilio." },
        { status: 400 },
      );
    }

    const storeLatitude = finiteCoordinate(value?.store?.latitude);
    const storeLongitude = finiteCoordinate(value?.store?.longitude);

    if (storeLatitude == null || storeLongitude == null) {
      return NextResponse.json(
        {
          error:
            "La sede de Alentó todavía no tiene coordenadas oficiales guardadas.",
        },
        { status: 503 },
      );
    }

    const route = await computeDrivingRoute({
      origin: {
        latitude: storeLatitude,
        longitude: storeLongitude,
      },
      destination: {
        latitude,
        longitude,
      },
    });

    const band = activeBands.find(
      (item) =>
        route.distanceMeters >= item.minMeters &&
        route.distanceMeters <= item.maxMeters,
    );

    let destination = {
      formattedAddress:
        typeof body?.formattedAddress === "string"
          ? body.formattedAddress.trim()
          : "",
      placeId:
        typeof body?.placeId === "string" ? body.placeId.trim() : "",
      latitude,
      longitude,
    };

    if (!destination.formattedAddress || !destination.placeId) {
      const geocoded = await reverseGeocode(latitude, longitude);
      destination = geocoded;
    }

    return NextResponse.json({
      covered: Boolean(band),
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      deliveryFee: band ? band.fee : null,
      band: band ?? null,
      maxCoverageMeters: Math.max(
        0,
        ...activeBands.map((item) => item.maxMeters),
      ),
      origin: {
        formattedAddress:
          value?.store?.formattedAddress ||
          value?.store?.address ||
          "Alentó Pizza",
        latitude: storeLatitude,
        longitude: storeLongitude,
      },
      destination,
    });
  } catch (error) {
    console.error("Delivery quote error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible calcular el domicilio.",
      },
      { status: 500 },
    );
  }
}
