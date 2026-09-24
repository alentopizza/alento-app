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
          whatsappCountryCode: true,
          whatsappPhone: true,
          driverLatitude: true,
          driverLongitude: true,
          driverLocationAccuracy: true,
          driverLocationUpdatedAt: true,
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

  const trackingActive = ["OUT_FOR_DELIVERY", "ARRIVED"].includes(
    order.status,
  );

  const orderDriverLatitude = finite(order.driverLatitude);
  const orderDriverLongitude = finite(order.driverLongitude);
  const liveDriverLatitude = finite(order.driver?.driverLatitude);
  const liveDriverLongitude = finite(order.driver?.driverLongitude);

  const orderLocationUpdatedAt = order.driverLocationUpdatedAt;
  const liveLocationUpdatedAt = order.driver?.driverLocationUpdatedAt ?? null;
  const liveLocationIsNewer =
    liveDriverLatitude != null &&
    liveDriverLongitude != null &&
    liveLocationUpdatedAt != null &&
    (orderLocationUpdatedAt == null ||
      liveLocationUpdatedAt.getTime() > orderLocationUpdatedAt.getTime());

  const driverLatitude = liveLocationIsNewer
    ? liveDriverLatitude
    : orderDriverLatitude;
  const driverLongitude = liveLocationIsNewer
    ? liveDriverLongitude
    : orderDriverLongitude;
  const driverAccuracy = liveLocationIsNewer
    ? order.driver?.driverLocationAccuracy ?? null
    : order.driverLocationAccuracy;
  const updatedAt = liveLocationIsNewer
    ? liveLocationUpdatedAt
    : orderLocationUpdatedAt;

  const destinationLatitude = finite(order.address?.latitude);
  const destinationLongitude = finite(order.address?.longitude);

  const ageMs = updatedAt ? Date.now() - updatedAt.getTime() : null;
  const locationAvailable =
    trackingActive &&
    driverLatitude != null &&
    driverLongitude != null &&
    destinationLatitude != null &&
    destinationLongitude != null;

  const wantsRoute =
    request.nextUrl.searchParams.get("route") === "1" &&
    trackingActive &&
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
    driver:
      order.driver && trackingActive
        ? {
            name: order.driver.name,
            phone: order.driver.whatsappPhone
              ? `${order.driver.whatsappCountryCode || "+57"}${order.driver.whatsappPhone}`
              : null,
          }
        : null,
    location: locationAvailable
      ? {
          latitude: driverLatitude,
          longitude: driverLongitude,
          accuracy:
            driverAccuracy != null
              ? Number(driverAccuracy)
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
