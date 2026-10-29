import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDrivingRoute, reverseGeocode } from "@/lib/googleMapsServer";
import {
  consumeRateLimit,
  rateLimitExceededResponse,
  requestClientIp,
} from "@/lib/rateLimit";
import {
  deliveryPricingHttpStatus,
  finiteCoordinate,
  normalizeDeliveryBands,
  resolveDeliveryPricing,
  type DeliveryPricingSettings,
} from "@/lib/deliveryPricing";

const SETTINGS_KEY = "pos_settings";

type StoreSettings = {
  address?: string;
  formattedAddress?: string;
  placeId?: string;
  latitude?: number | null;
  longitude?: number | null;
};

type SettingsValue = DeliveryPricingSettings & {
  store?: StoreSettings;
};

export async function POST(request: NextRequest) {
  try {
    const limit = await consumeRateLimit({
      scope: "public-delivery-quote-ip",
      key: requestClientIp(request),
      limit: 60,
      windowMs: 10 * 60_000,
      blockMs: 10 * 60_000,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(
        limit,
        "Se realizaron demasiadas consultas de domicilio. Intenta nuevamente en unos minutos.",
      );
    }

    const body = await request.json();

    const saved = await prisma.appSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });
    const value = (saved?.value ?? null) as SettingsValue | null;
    const activeBands = normalizeDeliveryBands(value);

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
        commercialDistanceMeters: Math.round(legacyDistance),
        routeDistanceMeters: null,
        durationSeconds: null,
        encodedPolyline: "",
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

    const pricing = resolveDeliveryPricing({
      settings: value,
      destination: {
        latitude: latitude ?? Number.NaN,
        longitude: longitude ?? Number.NaN,
      },
    });

    let route:
      | {
          distanceMeters: number;
          durationSeconds: number | null;
          encodedPolyline: string;
        }
      | null = null;

    try {
      route = await computeDrivingRoute({
        origin: pricing.origin,
        destination: pricing.destination,
      });
    } catch (routeError) {
      console.warn(
        "Delivery quote route unavailable; using direct commercial distance",
        routeError,
      );
    }

    let destination = {
      formattedAddress:
        typeof body?.formattedAddress === "string"
          ? body.formattedAddress.trim()
          : "",
      placeId:
        typeof body?.placeId === "string" ? body.placeId.trim() : "",
      latitude: pricing.destination.latitude,
      longitude: pricing.destination.longitude,
    };

    if (!destination.formattedAddress || !destination.placeId) {
      const geocoded = await reverseGeocode(
        pricing.destination.latitude,
        pricing.destination.longitude,
      );
      destination = geocoded;
    }

    return NextResponse.json({
      covered: pricing.covered,
      distanceMeters: Math.round(pricing.commercialDistanceMeters),
      commercialDistanceMeters: Math.round(
        pricing.commercialDistanceMeters,
      ),
      routeDistanceMeters: route?.distanceMeters ?? null,
      durationSeconds: route?.durationSeconds ?? null,
      encodedPolyline: route?.encodedPolyline ?? "",
      deliveryFee: pricing.deliveryFee,
      band: pricing.band,
      maxCoverageMeters: pricing.maxCoverageMeters,
      origin: {
        formattedAddress:
          value?.store?.formattedAddress ||
          value?.store?.address ||
          "Alentó Pizza",
        latitude: pricing.origin.latitude,
        longitude: pricing.origin.longitude,
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
      { status: deliveryPricingHttpStatus(error) },
    );
  }
}
