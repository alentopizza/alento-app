import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { computeDrivingRoute } from "@/lib/googleMapsServer";
import { orderCode } from "@/lib/orderCode";

const SETTINGS_KEY = "pos_settings";

const ACTIVE_DELIVERY_STATUSES = [
  "CONFIRMED",
  "PREPARING",
  "PREPARED",
  "READY",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
] as const;

type RoutePoint = {
  latitude: number;
  longitude: number;
};

function coordinate(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function storeLocation(value: unknown) {
  if (!isRecord(value) || !isRecord(value.store)) return null;

  const latitude = coordinate(value.store.latitude);
  const longitude = coordinate(value.store.longitude);
  if (latitude == null || longitude == null) return null;

  return {
    name: "Alentó Pizza",
    address:
      typeof value.store.formattedAddress === "string" &&
      value.store.formattedAddress.trim()
        ? value.store.formattedAddress
        : typeof value.store.address === "string"
          ? value.store.address
          : "Alentó Pizza",
    latitude,
    longitude,
  };
}

function haversineMeters(a: RoutePoint, b: RoutePoint) {
  const radius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export async function GET(request: NextRequest) {
  try {
    await requireStaffSession(["ADMIN", "POS", "CASHIER", "DISPATCH"]);

    const includeRoutes =
      request.nextUrl.searchParams.get("routes") === "1";

    const [orders, drivers, settings] = await Promise.all([
      prisma.order.findMany({
        where: {
          fulfillmentType: "DELIVERY",
          status: { in: [...ACTIVE_DELIVERY_STATUSES] },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          sequenceNumber: true,
          source: true,
          status: true,
          createdAt: true,
          driverId: true,
          driverLatitude: true,
          driverLongitude: true,
          driverLocationAccuracy: true,
          driverLocationUpdatedAt: true,
          customer: {
            select: {
              name: true,
            },
          },
          address: {
            select: {
              address: true,
              formattedAddress: true,
              latitude: true,
              longitude: true,
            },
          },
          driver: {
            select: {
              id: true,
              name: true,
              driverAvailable: true,
              driverLatitude: true,
              driverLongitude: true,
              driverLocationAccuracy: true,
              driverLocationUpdatedAt: true,
            },
          },
        },
      }),
      prisma.user.findMany({
        where: {
          active: true,
          driverAvailable: true,
          roles: { hasSome: ["DRIVER", "DISPATCH"] },
          driverLatitude: { not: null },
          driverLongitude: { not: null },
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          driverAvailable: true,
          driverLatitude: true,
          driverLongitude: true,
          driverLocationAccuracy: true,
          driverLocationUpdatedAt: true,
        },
      }),
      prisma.appSetting.findUnique({
        where: { key: SETTINGS_KEY },
        select: { value: true },
      }),
    ]);

    const enRouteByDriver = new Map<
      number,
      Array<(typeof orders)[number]>
    >();

    orders.forEach((order) => {
      if (
        order.status !== "OUT_FOR_DELIVERY" ||
        order.driverId == null ||
        order.address?.latitude == null ||
        order.address?.longitude == null
      ) {
        return;
      }

      const current = enRouteByDriver.get(order.driverId) ?? [];
      current.push(order);
      enRouteByDriver.set(order.driverId, current);
    });

    const trips = await Promise.all(
      [...enRouteByDriver.entries()].map(async ([driverId, assignedOrders]) => {
        const first = assignedOrders[0];
        const originLatitude =
          coordinate(first.driver?.driverLatitude) ??
          coordinate(first.driverLatitude);
        const originLongitude =
          coordinate(first.driver?.driverLongitude) ??
          coordinate(first.driverLongitude);

        if (originLatitude == null || originLongitude == null) {
          return null;
        }

        let currentPoint: RoutePoint = {
          latitude: originLatitude,
          longitude: originLongitude,
        };
        const pending = [...assignedOrders];
        const ordered: Array<(typeof orders)[number]> = [];

        while (pending.length > 0) {
          let nearestIndex = 0;
          let nearestDistance = Number.POSITIVE_INFINITY;

          pending.forEach((order, index) => {
            const latitude = coordinate(order.address?.latitude);
            const longitude = coordinate(order.address?.longitude);
            if (latitude == null || longitude == null) return;

            const distance = haversineMeters(currentPoint, {
              latitude,
              longitude,
            });

            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestIndex = index;
            }
          });

          const [nearest] = pending.splice(nearestIndex, 1);
          ordered.push(nearest);

          const latitude = coordinate(nearest.address?.latitude);
          const longitude = coordinate(nearest.address?.longitude);
          if (latitude != null && longitude != null) {
            currentPoint = { latitude, longitude };
          }
        }

        const stops = ordered.map((order, index) => ({
          orderId: order.id,
          code: orderCode(order.sequenceNumber ?? order.id, order.source),
          customerName: order.customer?.name ?? "Cliente",
          stopNumber: index + 1,
          destination: {
            address:
              order.address?.formattedAddress ||
              order.address?.address ||
              "Destino",
            latitude: Number(order.address?.latitude),
            longitude: Number(order.address?.longitude),
          },
        }));

        const legs: Array<{
          stopNumber: number;
          orderId: number;
          code: string;
          distanceMeters: number;
          durationSeconds: number | null;
          encodedPolyline: string;
        }> = [];

        if (includeRoutes) {
          let legOrigin: RoutePoint = {
            latitude: originLatitude,
            longitude: originLongitude,
          };

          for (const stop of stops) {
            try {
              const route = await computeDrivingRoute({
                origin: legOrigin,
                destination: {
                  latitude: stop.destination.latitude,
                  longitude: stop.destination.longitude,
                },
              });

              legs.push({
                stopNumber: stop.stopNumber,
                orderId: stop.orderId,
                code: stop.code,
                distanceMeters: route.distanceMeters,
                durationSeconds: route.durationSeconds,
                encodedPolyline: route.encodedPolyline,
              });
            } catch (error) {
              console.error(
                `Delivery trip route error for driver ${driverId}, stop ${stop.orderId}`,
                error,
              );
            }

            legOrigin = {
              latitude: stop.destination.latitude,
              longitude: stop.destination.longitude,
            };
          }
        }

        return {
          driverId,
          driverName: first.driver?.name ?? "Repartidor",
          origin: {
            latitude: originLatitude,
            longitude: originLongitude,
          },
          stops,
          legs,
          totalDistanceMeters: legs.reduce(
            (sum, leg) => sum + leg.distanceMeters,
            0,
          ),
          totalDurationSeconds: legs.reduce(
            (sum, leg) => sum + (leg.durationSeconds ?? 0),
            0,
          ),
        };
      }),
    );

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      store: storeLocation(settings?.value),
      drivers: drivers.map((driver) => ({
        id: driver.id,
        name: driver.name,
        available: driver.driverAvailable,
        latitude: Number(driver.driverLatitude),
        longitude: Number(driver.driverLongitude),
        accuracy:
          driver.driverLocationAccuracy == null
            ? null
            : Number(driver.driverLocationAccuracy),
        updatedAt: driver.driverLocationUpdatedAt?.toISOString() ?? null,
      })),
      orders: orders.map((order) => {
        const latitude = coordinate(order.address?.latitude);
        const longitude = coordinate(order.address?.longitude);
        const driverLatitude =
          coordinate(order.driver?.driverLatitude) ??
          coordinate(order.driverLatitude);
        const driverLongitude =
          coordinate(order.driver?.driverLongitude) ??
          coordinate(order.driverLongitude);

        return {
          id: order.id,
          code: orderCode(order.sequenceNumber ?? order.id, order.source),
          status: order.status,
          createdAt: order.createdAt.toISOString(),
          customerName: order.customer?.name ?? "Cliente",
          destination:
            latitude != null && longitude != null
              ? {
                  address:
                    order.address?.formattedAddress ||
                    order.address?.address ||
                    "Destino",
                  latitude,
                  longitude,
                }
              : null,
          driver: order.driver
            ? {
                id: order.driver.id,
                name: order.driver.name,
                available: order.driver.driverAvailable,
                latitude: driverLatitude,
                longitude: driverLongitude,
                accuracy:
                  order.driver.driverLocationAccuracy ??
                  order.driverLocationAccuracy ??
                  null,
                updatedAt:
                  order.driver.driverLocationUpdatedAt?.toISOString() ??
                  order.driverLocationUpdatedAt?.toISOString() ??
                  null,
              }
            : null,
        };
      }),
      trips: trips.filter(
        (trip): trip is NonNullable<typeof trip> => trip != null,
      ),
    });
  } catch (error) {
    const forbidden =
      error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }
}
