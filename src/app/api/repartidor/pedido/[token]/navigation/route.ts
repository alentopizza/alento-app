import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readDriverOrderToken } from "@/lib/driverTracking";
import { computeDrivingRoute } from "@/lib/googleMapsServer";

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

  await prisma.order.update({
    where: { id: order.id },
    data: {
      driverLatitude: latitude,
      driverLongitude: longitude,
      driverLocationAccuracy:
        accuracy != null && accuracy >= 0 ? accuracy : null,
      driverLocationUpdatedAt: new Date(),
    },
  });

  const route = await computeDrivingRoute({
    origin: { latitude, longitude },
    destination: {
      latitude: destinationLatitude,
      longitude: destinationLongitude,
    },
  });

  return NextResponse.json({
    driver: {
      latitude,
      longitude,
      accuracy:
        accuracy != null && accuracy >= 0 ? accuracy : null,
      updatedAt: new Date().toISOString(),
    },
    destination: {
      formattedAddress:
        order.address?.formattedAddress ||
        order.address?.address ||
        "Destino",
      latitude: destinationLatitude,
      longitude: destinationLongitude,
    },
    route,
  });
}
