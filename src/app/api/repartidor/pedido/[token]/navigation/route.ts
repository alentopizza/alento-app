import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readDriverOrderToken } from "@/lib/driverTracking";
import { computeDeliveryRoute } from "@/lib/deliveryRoute";
import { GoogleRouteUnavailableError } from "@/lib/googleMapsServer";
import {
  normalizeDeliveryTravelMode,
  type DeliveryTravelMode,
} from "@/lib/deliveryTravelMode";

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
  const latitude = finite(body?.latitude);
  const longitude = finite(body?.longitude);
  const accuracy = finite(body?.accuracy);
  const previewTravelMode = normalizeDeliveryTravelMode(
    body?.deliveryTravelMode,
  );

  if (
    latitude == null ||
    longitude == null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json(
      { error: "La ubicación del repartidor no es válida." },
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
      status: true,
      deliveryTravelMode: true,
      address: {
        select: {
          formattedAddress: true,
          address: true,
          latitude: true,
          longitude: true,
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

  if (
    ["CANCELED", "COMPLETED"].includes(order.status)
  ) {
    return NextResponse.json(
      { error: "Este pedido ya no permite navegación activa." },
      { status: 409 },
    );
  }

  const destinationLatitude = finite(order.address?.latitude);
  const destinationLongitude = finite(order.address?.longitude);

  if (destinationLatitude == null || destinationLongitude == null) {
    return NextResponse.json(
      {
        error:
          "La dirección del cliente no tiene coordenadas validadas para navegar.",
      },
      { status: 409 },
    );
  }

  const updatedAt = new Date();
  const normalizedAccuracy =
    accuracy != null && accuracy >= 0 ? accuracy : null;

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        driverLatitude: latitude,
        driverLongitude: longitude,
        driverLocationAccuracy: normalizedAccuracy,
        driverLocationUpdatedAt: updatedAt,
      },
    }),
    prisma.user.update({
      where: { id: parsed.driverId },
      data: {
        driverLatitude: latitude,
        driverLongitude: longitude,
        driverLocationAccuracy: normalizedAccuracy,
        driverLocationUpdatedAt: updatedAt,
        driverLocationSource: "WEB",
      },
    }),
  ]);

  const persistedTravelMode = normalizeDeliveryTravelMode(
    order.deliveryTravelMode,
  );
  const travelMode: DeliveryTravelMode | null =
    previewTravelMode ??
    persistedTravelMode ??
    (order.status === "OUT_FOR_DELIVERY" || order.status === "ARRIVED"
      ? "VEHICLE"
      : null);

  if (!travelMode) {
    return NextResponse.json(
      {
        error:
          "Elige si realizarás la entrega a pie, en moto o en vehículo para calcular la ruta.",
      },
      { status: 409 },
    );
  }

  let route: Awaited<ReturnType<typeof computeDeliveryRoute>>;
  try {
    route = await computeDeliveryRoute(
      {
        origin: { latitude, longitude },
        destination: {
          latitude: destinationLatitude,
          longitude: destinationLongitude,
        },
      },
      travelMode,
    );
  } catch (error) {
    if (error instanceof GoogleRouteUnavailableError) {
      return NextResponse.json(
        {
          code: "ROUTE_NOT_FOUND",
          error:
            "Google Maps no encontró una ruta válida para este trayecto. Verifica el punto de entrega o abre Google Maps para continuar.",
        },
        { status: 422 },
      );
    }

    throw error;
  }

  return NextResponse.json({
    driver: {
      latitude,
      longitude,
      accuracy: normalizedAccuracy,
      updatedAt: updatedAt.toISOString(),
    },
    destination: {
      formattedAddress:
        order.address?.formattedAddress ||
        order.address?.address ||
        "Destino",
      latitude: destinationLatitude,
      longitude: destinationLongitude,
    },
    travelMode,
    route,
  });
}
