import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { createDriverOrderToken } from "@/lib/driverTracking";
import { driverMaxConcurrentFromSettings } from "@/lib/driverCapacity";
import { driverAcceptanceZoneFromSettings } from "@/lib/driverAcceptanceZone";

const SETTINGS_KEY = "pos_settings";

const PROCESS_STATUSES = [
  "CONFIRMED",
  "PREPARING",
  "PREPARED",
  "READY",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
] as const;

const CLAIMABLE_STATUSES = new Set<string>([
  "CONFIRMED",
  "PREPARING",
  "PREPARED",
  "READY",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function storeLocation(value: unknown) {
  if (!isRecord(value) || !isRecord(value.store)) return null;

  const latitude = Number(value.store.latitude);
  const longitude = Number(value.store.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

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

export async function GET() {
  try {
    const session = await requireStaffSession(["DRIVER", "DISPATCH"]);

    const [orders, savedSettings, driverLocation] = await Promise.all([
      prisma.order.findMany({
        where: {
          fulfillmentType: "DELIVERY",
          status: { in: [...PROCESS_STATUSES] },
          OR: [
            { driverId: null },
            { driverId: session.userId },
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          source: true,
          sequenceNumber: true,
          status: true,
          subtotal: true,
          deliveryFee: true,
          discount: true,
          total: true,
          createdAt: true,
          driverId: true,
          driver: {
            select: { id: true, name: true },
          },
          customer: {
            select: {
              name: true,
              countryCode: true,
              phone: true,
            },
          },
          address: {
            select: {
              address: true,
              formattedAddress: true,
              placeId: true,
              neighborhood: true,
              notes: true,
              latitude: true,
              longitude: true,
            },
          },
          items: {
            orderBy: { id: "asc" },
            select: {
              id: true,
              productName: true,
              variantName: true,
              unitPrice: true,
              quantity: true,
              lineTotal: true,
              configuration: true,
              notes: true,
            },
          },
          payments: {
            where: { status: { not: "CANCELED" } },
            orderBy: { id: "desc" },
            select: {
              method: true,
              status: true,
              amount: true,
            },
          },
        },
      }),
      prisma.appSetting.findUnique({
        where: { key: SETTINGS_KEY },
        select: { value: true },
      }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          driverLatitude: true,
          driverLongitude: true,
          driverLocationUpdatedAt: true,
        },
      }),
    ]);

    const maxConcurrentDeliveries =
      driverMaxConcurrentFromSettings(savedSettings?.value);
    const assignedDeliveries = orders.filter(
      (order) => order.driverId === session.userId,
    ).length;
    const capacityReached = assignedDeliveries >= maxConcurrentDeliveries;
    const acceptanceZone = driverAcceptanceZoneFromSettings(
      savedSettings?.value,
      driverLocation?.driverLatitude != null &&
        driverLocation?.driverLongitude != null
        ? {
            latitude: Number(driverLocation.driverLatitude),
            longitude: Number(driverLocation.driverLongitude),
            updatedAt: driverLocation.driverLocationUpdatedAt,
          }
        : null,
    );

    return NextResponse.json({
      store: storeLocation(savedSettings?.value),
      acceptanceZone,
      capacity: {
        assignedDeliveries,
        maxConcurrentDeliveries,
        remaining: Math.max(0, maxConcurrentDeliveries - assignedDeliveries),
        reached: capacityReached,
      },
      orders: orders.map((order) => {
        const own = order.driverId === session.userId;
        const previewable =
          order.driverId == null &&
          CLAIMABLE_STATUSES.has(order.status);
        const claimable =
          !capacityReached &&
          acceptanceZone.inside &&
          previewable;
        return {
          id: order.id,
          code: `${order.source}-${String(
            order.sequenceNumber ?? order.id,
          ).padStart(4, "0")}`,
          status: order.status,
          subtotal: Number(order.subtotal),
          deliveryFee: Number(order.deliveryFee),
          discount: Number(order.discount),
          total: Number(order.total),
          createdAt: order.createdAt.toISOString(),
          customerName: order.customer?.name ?? "Cliente",
          customerPhone: order.customer?.phone
            ? `${order.customer.countryCode || ""}${order.customer.phone}`
            : null,
          payment: (() => {
            const paidAmount = order.payments
              .filter((payment) => payment.status === "PAID")
              .reduce((sum, payment) => sum + Number(payment.amount), 0);
            const total = Number(order.total);
            const balance = Math.max(0, total - paidAmount);
            const paid = balance <= 0;
            const partial = paidAmount > 0 && !paid;

            return {
              method:
                order.payments.find(
                  (payment) => payment.status === "PAID",
                )?.method ??
                order.payments[0]?.method ??
                "Sin información",
              paidAmount,
              balance,
              paid,
              partial,
            };
          })(),
          address: order.address
            ? {
                address:
                  order.address.formattedAddress ||
                  order.address.address,
                placeId: order.address.placeId,
                neighborhood: order.address.neighborhood,
                notes: order.address.notes,
                latitude: order.address.latitude,
                longitude: order.address.longitude,
              }
            : null,
          items: order.items.map((item) => ({
            id: item.id,
            productName: item.productName,
            variantName: item.variantName,
            unitPrice: Number(item.unitPrice),
            quantity: item.quantity,
            lineTotal: Number(item.lineTotal),
            configuration: item.configuration,
            notes: item.notes,
          })),
          assignment: order.driver
            ? {
                driverId: order.driver.id,
                driverName: order.driver.name,
                own,
              }
            : null,
          claimable,
          href: own || previewable
            ? `/repartidor/pedido/${createDriverOrderToken(
                order.id,
                session.userId,
              )}`
            : null,
        };
      }),
    });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }
}
