import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readDriverOrderToken } from "@/lib/driverTracking";

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
      status: {
        in: ["READY", "OUT_FOR_DELIVERY", "ARRIVED"],
      },
    },
    select: { id: true },
  });

  if (!order) {
    return NextResponse.json(
      { error: "La orden ya no permite compartir ubicación." },
      { status: 409 },
    );
  }

  const updatedAt = new Date();

  await prisma.order.update({
    where: { id: order.id },
    data: {
      driverLatitude: latitude,
      driverLongitude: longitude,
      driverLocationAccuracy:
        accuracy != null && accuracy >= 0 ? accuracy : null,
      driverLocationUpdatedAt: updatedAt,
    },
  });

  return NextResponse.json({
    location: {
      latitude,
      longitude,
      accuracy:
        accuracy != null && accuracy >= 0 ? accuracy : null,
      updatedAt: updatedAt.toISOString(),
    },
  });
}
