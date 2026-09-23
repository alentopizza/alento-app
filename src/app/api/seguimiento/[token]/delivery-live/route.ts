import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readOrderTrackingToken } from "@/lib/orderTracking";
import { computeDrivingRoute } from "@/lib/googleMapsServer";

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const orderId = readOrderTrackingToken(token);

  if (!orderId) {
    return NextResponse.json(
      { error: "Seguimiento inválido." },
      { status: 401 },
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      fulfillmentType: true,
      driverLatitude: true,
      driverLongitude: true,
      driverLocationAccuracy: true,
      driverLocationUpdatedAt: true,
      driver: {
        select: {
          name: true,
        },
      },
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

  if (!order || order.fulfillmentType !== "DELIVERY") {
    return NextResponse.json(
      { error: "Este pedido no tiene seguimiento de domicilio." },
      { status: 404 },
    );
  }

  const driverLatitude = finite(order.driverLatitude);
  const driverLongitude = finite(order.driverLongitude);
  const destinationLatitude = finite(order.address?.latitude);
  const destinationLongitude = finite(order.address?.longitude);

  const updatedAt = order.driverLocationUpdatedAt;
  const ageMs = updatedAt ? Date.now() - updatedAt.getTime() : null;
  const locationAvailable =
    driverLatitude != null &&
    driverLongitude != null &&
    destinationLatitude != null &&
    destinationLongitude != null;

  const wantsRoute =
    request.nextUrl.searchParams.get("route") === "1" &&
    order.status === "OUT_FOR_DELIVERY" &&
    locationAvailable;

  let route: {
    distanceMeters: number;
    durationSeconds: number | null;
    encodedPolyline: string;
  } | null = null;

  if (wantsRoute) {
    try {
      route = await computeDrivingRoute({
        origin: {
          latitude: driverLatitude!,
          longitude: driverLongitude!,
        },
        destination: {
          latitude: destinationLatitude!,
          longitude: destinationLongitude!,
        },
      });
    } catch {
      route = null;
    }
  }

  return NextResponse.json({
    status: order.status,
    driver: order.driver
      ? {
          name: order.driver.name,
        }
      : null,
    location: locationAvailable
      ? {
          latitude: driverLatitude,
          longitude: driverLongitude,
          accuracy:
            order.driverLocationAccuracy != null
              ? Number(order.driverLocationAccuracy)
              : null,
          updatedAt: updatedAt?.toISOString() ?? null,
          stale: ageMs == null || ageMs > 90_000,
        }
      : null,
    destination:
      destinationLatitude != null && destinationLongitude != null
        ? {
            formattedAddress:
              order.address?.formattedAddress ||
              order.address?.address ||
              "Punto de entrega",
            latitude: destinationLatitude,
            longitude: destinationLongitude,
          }
        : null,
    route,
  });
}
