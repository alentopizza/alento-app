import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { computeDrivingRoute } from "@/lib/googleMapsServer";
import { computeDeliveryRoute } from "@/lib/deliveryRoute";
import { normalizeDeliveryTravelMode } from "@/lib/deliveryTravelMode";
import { orderCode } from "@/lib/orderCode";
import { orderDeliveryStopsByProximity } from "@/lib/deliveryStopOrder";
import { driverMaxConcurrentFromSettings } from "@/lib/driverCapacity";

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

    const [orders, driverUsers, settings] = await Promise.all([
      prisma.order.findMany({
        where: {
          fulfillmentType: "DELIVERY",
          status: { in: [...ACTIVE_DELIVERY_STATUSES] },
          OR: [
            { scheduledFor: null },
            { scheduledFor: { lte: new Date(Date.now() + 30 * 60 * 1000) } },
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          sequenceNumber: true,
          source: true,
          status: true,
          createdAt: true,
          scheduledFor: true,
          total: true,
          deliveryFee: true,
          deliveryZoneName: true,
          deliveryDistanceMeters: true,
          deliveryTravelMode: true,
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
          items: {
            select: {
              quantity: true,
            },
          },
          payments: {
            where: { status: "PAID" },
            select: {
              amount: true,
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
              driverLocationSource: true,
            },
          },
        },
      }),
      prisma.user.findMany({
        where: {
          active: true,
          roles: { hasSome: ["DRIVER", "DISPATCH"] },
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
          driverLocationSource: true,
          whatsappPhone: true,
        },
      }),
      prisma.appSetting.findUnique({
        where: { key: SETTINGS_KEY },
        select: { value: true },
      }),
    ]);

    const store = storeLocation(settings?.value);
    const maxConcurrentDeliveries =
      driverMaxConcurrentFromSettings(settings?.value);

    const assignedCountByDriver = new Map<number, number>();
    orders.forEach((order) => {
      if (order.driverId == null) return;
      assignedCountByDriver.set(
        order.driverId,
        (assignedCountByDriver.get(order.driverId) ?? 0) + 1,
      );
    });

    const latestOrderLocationByDriver = new Map<
      number,
      {
        latitude: number;
        longitude: number;
        accuracy: number | null;
        updatedAt: Date;
      }
    >();

    orders.forEach((order) => {
      if (order.driverId == null || !order.driverLocationUpdatedAt) return;

      const latitude = coordinate(order.driverLatitude);
      const longitude = coordinate(order.driverLongitude);
      if (latitude == null || longitude == null) return;

      const current = latestOrderLocationByDriver.get(order.driverId);
      if (
        !current ||
        order.driverLocationUpdatedAt.getTime() > current.updatedAt.getTime()
      ) {
        latestOrderLocationByDriver.set(order.driverId, {
          latitude,
          longitude,
          accuracy:
            order.driverLocationAccuracy == null
              ? null
              : Number(order.driverLocationAccuracy),
          updatedAt: order.driverLocationUpdatedAt,
        });
      }
    });

    const driverLocations = driverUsers.map((driver) => {
      const userLatitude = coordinate(driver.driverLatitude);
      const userLongitude = coordinate(driver.driverLongitude);
      const userUpdatedAt = driver.driverLocationUpdatedAt;
      const orderLocation = latestOrderLocationByDriver.get(driver.id) ?? null;
      const useOrderLocation =
        orderLocation != null &&
        (!userUpdatedAt ||
          orderLocation.updatedAt.getTime() > userUpdatedAt.getTime());

      return {
        ...driver,
        mapLatitude: useOrderLocation
          ? orderLocation.latitude
          : userLatitude,
        mapLongitude: useOrderLocation
          ? orderLocation.longitude
          : userLongitude,
        mapAccuracy: useOrderLocation
          ? orderLocation.accuracy
          : driver.driverLocationAccuracy == null
            ? null
            : Number(driver.driverLocationAccuracy),
        mapUpdatedAt: useOrderLocation
          ? orderLocation.updatedAt
          : userUpdatedAt,
        mapSource: useOrderLocation
          ? "WEB"
          : driver.driverLocationSource,
      };
    });

    const driverLocationById = new Map(
      driverLocations.map((driver) => [driver.id, driver]),
    );

    const drivers = driverLocations.filter(
      (driver) =>
        driver.driverAvailable &&
        driver.mapLatitude != null &&
        driver.mapLongitude != null,
    );

    const driverRouteEntries =
      includeRoutes && store
        ? await Promise.all(
            drivers.map(async (driver) => {
              try {
                const route = await computeDrivingRoute({
                  origin: {
                    latitude: Number(driver.mapLatitude),
                    longitude: Number(driver.mapLongitude),
                  },
                  destination: {
                    latitude: store.latitude,
                    longitude: store.longitude,
                  },
                });

                return [
                  driver.id,
                  {
                    distanceMeters: route.distanceMeters,
                    durationSeconds: route.durationSeconds,
                  },
                ] as const;
              } catch (error) {
                console.error(
                  `Driver-to-store route error for driver ${driver.id}`,
                  error,
                );
                return [driver.id, null] as const;
              }
            }),
          )
        : [];

    const driverRouteById = new Map(driverRouteEntries);

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
        const currentDriverLocation = driverLocationById.get(driverId);
        const originLatitude =
          currentDriverLocation?.mapLatitude ??
          coordinate(first.driver?.driverLatitude) ??
          coordinate(first.driverLatitude);
        const originLongitude =
          currentDriverLocation?.mapLongitude ??
          coordinate(first.driver?.driverLongitude) ??
          coordinate(first.driverLongitude);

        if (originLatitude == null || originLongitude == null) {
          return null;
        }

        const ordered = orderDeliveryStopsByProximity(
          {
            latitude: originLatitude,
            longitude: originLongitude,
          },
          assignedOrders,
          (order) => ({
            latitude: Number(order.address!.latitude),
            longitude: Number(order.address!.longitude),
          }),
        );

        const stops = ordered.map((order, index) => ({
          orderId: order.id,
          code: orderCode(order.sequenceNumber ?? order.id, order.source),
          customerName: order.customer?.name ?? "Cliente",
          stopNumber: index + 1,
          travelMode:
            normalizeDeliveryTravelMode(order.deliveryTravelMode) ??
            "VEHICLE",
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
          travelMode: string;
          routeTravelMode: string;
          fallbackToVehicle: boolean;
        }> = [];

        if (includeRoutes) {
          let legOrigin = {
            latitude: originLatitude,
            longitude: originLongitude,
          };

          for (const stop of stops) {
            try {
              const route = await computeDeliveryRoute(
                {
                  origin: legOrigin,
                  destination: {
                    latitude: stop.destination.latitude,
                    longitude: stop.destination.longitude,
                  },
                },
                stop.travelMode,
              );

              legs.push({
                stopNumber: stop.stopNumber,
                orderId: stop.orderId,
                code: stop.code,
                distanceMeters: route.distanceMeters,
                durationSeconds: route.durationSeconds,
                encodedPolyline: route.encodedPolyline,
                travelMode: stop.travelMode,
                routeTravelMode: route.routeTravelMode,
                fallbackToVehicle: route.fallbackToVehicle,
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
      store,
      drivers: drivers.map((driver) => {
        const routeFromStore = driverRouteById.get(driver.id) ?? null;

        return {
          id: driver.id,
          name: driver.name,
          available: driver.driverAvailable,
          latitude: Number(driver.mapLatitude),
          longitude: Number(driver.mapLongitude),
          accuracy: driver.mapAccuracy,
          updatedAt: driver.mapUpdatedAt?.toISOString() ?? null,
          source: driver.mapSource,
          distanceFromStoreMeters: routeFromStore?.distanceMeters ?? null,
          durationFromStoreSeconds: routeFromStore?.durationSeconds ?? null,
        };
      }),
      assignableDrivers: driverUsers.map((driver) => {
        const assignedDeliveries = assignedCountByDriver.get(driver.id) ?? 0;

        return {
          id: driver.id,
          name: driver.name,
          available: driver.driverAvailable,
          ready: Boolean(driver.whatsappPhone),
          assignedDeliveries,
          maxConcurrentDeliveries,
          capacityReached:
            assignedDeliveries >= maxConcurrentDeliveries,
        };
      }),
      orders: orders.map((order) => {
        const latitude = coordinate(order.address?.latitude);
        const longitude = coordinate(order.address?.longitude);
        const effectiveDriver = order.driver
          ? driverLocationById.get(order.driver.id)
          : null;
        const driverLatitude =
          effectiveDriver?.mapLatitude ??
          coordinate(order.driver?.driverLatitude) ??
          coordinate(order.driverLatitude);
        const driverLongitude =
          effectiveDriver?.mapLongitude ??
          coordinate(order.driver?.driverLongitude) ??
          coordinate(order.driverLongitude);

        const paidAmount = order.payments.reduce(
          (sum, payment) => sum + Number(payment.amount),
          0,
        );
        const total = Number(order.total);

        return {
          id: order.id,
          code: orderCode(order.sequenceNumber ?? order.id, order.source),
          status: order.status,
          createdAt: order.createdAt.toISOString(),
          scheduledFor: order.scheduledFor?.toISOString() ?? null,
          customerName: order.customer?.name ?? "Cliente",
          total,
          deliveryFee: Number(order.deliveryFee),
          deliveryZoneName: order.deliveryZoneName,
          deliveryDistanceMeters: order.deliveryDistanceMeters,
          deliveryTravelMode:
            normalizeDeliveryTravelMode(order.deliveryTravelMode) ??
            (order.status === "OUT_FOR_DELIVERY" ? "VEHICLE" : null),
          paidAmount,
          balance: Math.max(0, total - paidAmount),
          itemCount: order.items.reduce(
            (sum, item) => sum + item.quantity,
            0,
          ),
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
                  effectiveDriver?.mapAccuracy ??
                  order.driver.driverLocationAccuracy ??
                  order.driverLocationAccuracy ??
                  null,
                updatedAt:
                  effectiveDriver?.mapUpdatedAt?.toISOString() ??
                  order.driver.driverLocationUpdatedAt?.toISOString() ??
                  order.driverLocationUpdatedAt?.toISOString() ??
                  null,
                source:
                  effectiveDriver?.mapSource ??
                  order.driver.driverLocationSource,
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
