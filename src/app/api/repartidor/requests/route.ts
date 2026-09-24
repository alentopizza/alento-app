import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { createDriverOrderToken } from "@/lib/driverTracking";

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

    const [orders, savedSettings] = await Promise.all([
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
            orderBy: { id: "desc" },
            take: 1,
            select: {
              method: true,
              status: true,
            },
          },
        },
      }),
      prisma.appSetting.findUnique({
        where: { key: SETTINGS_KEY },
        select: { value: true },
      }),
    ]);

    return NextResponse.json({
      store: storeLocation(savedSettings?.value),
      orders: orders.map((order) => {
        const own = order.driverId === session.userId;
        const claimable =
          order.driverId == null &&
          CLAIMABLE_STATUSES.has(order.status);
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
          payment: order.payments[0]
            ? {
                method: order.payments[0].method,
                status: order.payments[0].status,
              }
            : null,
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
          href: own || claimable
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
