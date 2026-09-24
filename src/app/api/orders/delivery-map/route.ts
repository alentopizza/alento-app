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

    const routes = new Map<
      number,
      {
        distanceMeters: number;
        durationSeconds: number | null;
        encodedPolyline: string;
      }
    >();

    if (includeRoutes) {
      const routeJobs = orders
        .filter(
          (order) =>
            order.status === "OUT_FOR_DELIVERY" &&
            order.driverId != null &&
            order.address?.latitude != null &&
            order.address?.longitude != null,
        )
        .map(async (order) => {
          const driverLatitude =
            coordinate(order.driverLatitude) ??
            coordinate(order.driver?.driverLatitude);
          const driverLongitude =
            coordinate(order.driverLongitude) ??
            coordinate(order.driver?.driverLongitude);
          const destinationLatitude = coordinate(order.address?.latitude);
          const destinationLongitude = coordinate(order.address?.longitude);

          if (
            driverLatitude == null ||
            driverLongitude == null ||
            destinationLatitude == null ||
            destinationLongitude == null
          ) {
            return;
          }

          try {
            const route = await computeDrivingRoute({
              origin: {
                latitude: driverLatitude,
                longitude: driverLongitude,
              },
              destination: {
                latitude: destinationLatitude,
                longitude: destinationLongitude,
              },
            });
            routes.set(order.id, route);
          } catch (error) {
            console.error(
              `Delivery map route error for order ${order.id}`,
              error,
            );
          }
        });

      await Promise.all(routeJobs);
    }

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
          coordinate(order.driverLatitude) ??
          coordinate(order.driver?.driverLatitude);
        const driverLongitude =
          coordinate(order.driverLongitude) ??
          coordinate(order.driver?.driverLongitude);

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
                  order.driverLocationAccuracy ??
                  order.driver.driverLocationAccuracy ??
                  null,
                updatedAt:
                  order.driverLocationUpdatedAt?.toISOString() ??
                  order.driver.driverLocationUpdatedAt?.toISOString() ??
                  null,
              }
            : null,
          route: routes.get(order.id) ?? null,
        };
      }),
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
