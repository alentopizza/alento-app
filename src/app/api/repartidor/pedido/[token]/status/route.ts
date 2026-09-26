import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readDriverOrderToken } from "@/lib/driverTracking";
import { dispatchOrderStatusNotification } from "@/lib/notifier";
import { normalizeDeliveryTravelMode } from "@/lib/deliveryTravelMode";
import { calculateDriverEarning } from "@/lib/driverCompensation";
import {
  DRIVER_LOCATION_MAX_AGE_MS,
  distanceMetersBetween,
} from "@/lib/driverAcceptanceZone";

const ARRIVAL_RADIUS_METERS = 150;

type LocationCandidate = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  updatedAt: Date;
};

function finiteNumber(value: unknown) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function locationCandidate(input: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  accuracy?: number | null;
  updatedAt: Date | null | undefined;
}): LocationCandidate | null {
  const latitude = finiteNumber(input.latitude);
  const longitude = finiteNumber(input.longitude);
  const updatedAt = input.updatedAt;

  if (
    latitude == null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude == null ||
    longitude < -180 ||
    longitude > 180 ||
    !updatedAt
  ) {
    return null;
  }

  const accuracy = finiteNumber(input.accuracy);

  return {
    latitude,
    longitude,
    accuracy: accuracy != null && accuracy >= 0 ? accuracy : null,
    updatedAt,
  };
}

function newestLocation(
  ...locations: Array<LocationCandidate | null>
): LocationCandidate | null {
  return (
    locations
      .filter((location): location is LocationCandidate => Boolean(location))
      .sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      )[0] ?? null
  );
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const parsed = readDriverOrderToken(token);

  if (!parsed) {
    return NextResponse.json(
      { error: "Enlace de reparto inválido." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const requested = String(body?.status || "").toUpperCase();
  const requestedTravelMode = normalizeDeliveryTravelMode(
    body?.deliveryTravelMode,
  );

  if (!["OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED"].includes(requested)) {
    return NextResponse.json(
      { error: "Estado de reparto inválido." },
      { status: 400 },
    );
  }

  const order = await prisma.order.findFirst({
    where: {
      id: parsed.orderId,
      driverId: parsed.driverId,
      fulfillmentType: "DELIVERY",
    },
    select: {
      id: true,
      sequenceNumber: true,
      status: true,
      fulfillmentType: true,
      total: true,
      deliveryFee: true,
      customerId: true,
      deliveryTravelMode: true,
      driverLatitude: true,
      driverLongitude: true,
      driverLocationAccuracy: true,
      driverLocationUpdatedAt: true,
      address: {
        select: {
          latitude: true,
          longitude: true,
        },
      },
      customer: {
        select: {
          name: true,
          countryCode: true,
          phone: true,
        },
      },
      driver: {
        select: {
          driverAvailable: true,
          driverLatitude: true,
          driverLongitude: true,
          driverLocationAccuracy: true,
          driverLocationUpdatedAt: true,
        },
      },
      items: {
        select: {
          id: true,
          driverVerifiedAt: true,
          driverVerifiedDriverId: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json(
      { error: "La orden ya no está asignada a este repartidor." },
      { status: 404 },
    );
  }

  if (requested === "OUT_FOR_DELIVERY") {
    if (!requestedTravelMode) {
      return NextResponse.json(
        {
          error:
            "Elige cómo vas a realizar la entrega: a pie, en moto o en vehículo.",
        },
        { status: 400 },
      );
    }

    const complete =
      order.items.length > 0 &&
      order.items.every(
        (item) =>
          item.driverVerifiedAt != null &&
          item.driverVerifiedDriverId === parsed.driverId,
      );

    if (!complete) {
      return NextResponse.json(
        {
          error:
            "Debes verificar todos los productos del pedido antes de iniciar el domicilio.",
        },
        { status: 409 },
      );
    }

    if (!order.driver?.driverAvailable) {
      return NextResponse.json(
        {
          error: "Debes estar Activo para iniciar el domicilio.",
        },
        { status: 409 },
      );
    }
  }

  const allowed =
    (requested === "OUT_FOR_DELIVERY" && order.status === "READY") ||
    (requested === "ARRIVED" && order.status === "OUT_FOR_DELIVERY") ||
    (requested === "DELIVERED" && order.status === "ARRIVED");

  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "El pedido aún no está listo para esta acción o ya fue actualizado.",
      },
      { status: 409 },
    );
  }

  const orderLocation = locationCandidate({
    latitude: order.driverLatitude,
    longitude: order.driverLongitude,
    accuracy: order.driverLocationAccuracy,
    updatedAt: order.driverLocationUpdatedAt,
  });
  const nativeLocation = locationCandidate({
    latitude: order.driver?.driverLatitude,
    longitude: order.driver?.driverLongitude,
    accuracy: order.driver?.driverLocationAccuracy,
    updatedAt: order.driver?.driverLocationUpdatedAt,
  });
  const currentDriverLocation = newestLocation(orderLocation, nativeLocation);

  if (requested === "ARRIVED") {
    const destinationLatitude = finiteNumber(order.address?.latitude);
    const destinationLongitude = finiteNumber(order.address?.longitude);

    if (
      destinationLatitude == null ||
      destinationLatitude < -90 ||
      destinationLatitude > 90 ||
      destinationLongitude == null ||
      destinationLongitude < -180 ||
      destinationLongitude > 180
    ) {
      return NextResponse.json(
        {
          error:
            "No se puede validar la llegada porque el punto de entrega no tiene coordenadas válidas.",
        },
        { status: 409 },
      );
    }

    if (!currentDriverLocation) {
      return NextResponse.json(
        {
          error:
            "No tenemos una ubicación GPS reciente. Espera unos segundos con la ubicación activa e intenta marcar Llegué nuevamente.",
        },
        { status: 409 },
      );
    }

    const locationAgeMs =
      Date.now() - currentDriverLocation.updatedAt.getTime();

    if (
      !Number.isFinite(locationAgeMs) ||
      locationAgeMs < 0 ||
      locationAgeMs > DRIVER_LOCATION_MAX_AGE_MS
    ) {
      return NextResponse.json(
        {
          error:
            "Tu ubicación GPS está desactualizada. Espera unos segundos a que se actualice antes de marcar Llegué.",
        },
        { status: 409 },
      );
    }

    const distanceMeters = Math.round(
      distanceMetersBetween(
        {
          latitude: currentDriverLocation.latitude,
          longitude: currentDriverLocation.longitude,
        },
        {
          latitude: destinationLatitude,
          longitude: destinationLongitude,
        },
      ),
    );

    if (distanceMeters > ARRIVAL_RADIUS_METERS) {
      return NextResponse.json(
        {
          error: `Aún estás a ${formatDistance(distanceMeters)} del punto de entrega. Solo puedes marcar Llegué cuando estés a ${ARRIVAL_RADIUS_METERS} m o menos del cliente.`,
          arrivalValidation: {
            allowed: false,
            distanceMeters,
            radiusMeters: ARRIVAL_RADIUS_METERS,
          },
        },
        { status: 409 },
      );
    }
  }

  const driverLatitude = finiteNumber(order.driver?.driverLatitude);
  const driverLongitude = finiteNumber(order.driver?.driverLongitude);
  const hasDriverLocation =
    driverLatitude != null &&
    driverLatitude >= -90 &&
    driverLatitude <= 90 &&
    driverLongitude != null &&
    driverLongitude >= -180 &&
    driverLongitude <= 180;

  const deliveredAt = requested === "DELIVERED" ? new Date() : null;
  const compensationSetting =
    requested === "DELIVERED"
      ? await prisma.appSetting.findUnique({
          where: { key: "pos_settings" },
          select: { value: true },
        })
      : null;
  const earning =
    requested === "DELIVERED"
      ? calculateDriverEarning(
          Number(order.deliveryFee),
          compensationSetting?.value,
        )
      : null;

  const updated = await prisma.order.update({
    where: { id: order.id },
    data:
      requested === "DELIVERED" && earning && deliveredAt
        ? {
            status: "DELIVERED",
            deliveredAt,
            driverEarningAmount: earning.amount,
            driverEarningBase: earning.base,
            driverEarningRatePercent: earning.ratePercent,
            driverEarningKind: earning.kind,
            driverEarningCreditedAt: deliveredAt,
            driverLatitude: null,
            driverLongitude: null,
            driverLocationAccuracy: null,
            driverLocationUpdatedAt: null,
          }
        : requested === "OUT_FOR_DELIVERY" && hasDriverLocation
          ? {
              status: "OUT_FOR_DELIVERY",
              deliveryTravelMode: requestedTravelMode,
              driverLatitude,
              driverLongitude,
              driverLocationAccuracy:
                order.driver?.driverLocationAccuracy ?? null,
              driverLocationUpdatedAt:
                order.driver?.driverLocationUpdatedAt ?? new Date(),
            }
          : requested === "OUT_FOR_DELIVERY"
            ? {
                status: "OUT_FOR_DELIVERY",
                deliveryTravelMode: requestedTravelMode,
              }
            : {
                status: requested as "ARRIVED",
              },
    select: {
      id: true,
      status: true,
      deliveryTravelMode: true,
      deliveredAt: true,
      driverEarningAmount: true,
      updatedAt: true,
    },
  });

  if (order.customerId && order.customer?.phone) {
    const result = await dispatchOrderStatusNotification({
      orderId: order.id,
      customerId: order.customerId,
      customerName: order.customer.name,
      phone: `${order.customer.countryCode || "+57"}${order.customer.phone}`,
      orderCode: `POS-${String(order.sequenceNumber ?? order.id).padStart(4, "0")}`,
      total: Number(order.total),
      fulfillmentType: order.fulfillmentType,
      previousStatus: order.status,
      status: requested,
    });

    if (!result.ok) {
      console.warn("Driver status notification", {
        orderId: order.id,
        reason: result.reason,
      });
    }
  }

  return NextResponse.json({ order: updated });
}
