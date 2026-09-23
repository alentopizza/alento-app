import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readDriverOrderToken } from "@/lib/driverTracking";
import { dispatchOrderStatusNotification } from "@/lib/notifier";

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const parsed = readDriverOrderToken(token);
  if (!parsed) return NextResponse.json({ error: "Enlace de reparto inválido." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const requested = String(body?.status || "").toUpperCase();
  if (!["OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED"].includes(requested)) {
    return NextResponse.json({ error: "Estado de reparto inválido." }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: parsed.orderId, driverId: parsed.driverId, fulfillmentType: "DELIVERY" },
    select: {
      id: true,
      sequenceNumber: true,
      status: true,
      fulfillmentType: true,
      total: true,
      customerId: true,
      customer: { select: { name: true, countryCode: true, phone: true } },
      driver: {
        select: {
          driverAvailable: true,
          driverLatitude: true,
          driverLongitude: true,
          driverLocationAccuracy: true,
          driverLocationUpdatedAt: true,
        },
      },
      items: {
        select: {
          id: true,
          driverVerifiedAt: true,
          driverVerifiedDriverId: true,
        },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "La orden ya no está asignada a este repartidor." }, { status: 404 });

  if (requested === "OUT_FOR_DELIVERY") {
    const complete =
      order.items.length > 0 &&
      order.items.every(
        (item) =>
          item.driverVerifiedAt != null &&
          item.driverVerifiedDriverId === parsed.driverId,
      );

    if (!complete) {
      return NextResponse.json(
        {
          error:
            "Debes verificar todos los productos del pedido antes de iniciar el domicilio.",
        },
        { status: 409 },
      );
    }

    if (!order.driver?.driverAvailable) {
      return NextResponse.json(
        {
          error:
            "Debes estar Activo para iniciar el domicilio.",
        },
        { status: 409 },
      );
    }
  }

  const allowed =
    (requested === "OUT_FOR_DELIVERY" && order.status === "READY") ||
    (requested === "ARRIVED" && order.status === "OUT_FOR_DELIVERY") ||
    (requested === "DELIVERED" && order.status === "ARRIVED");

  if (!allowed) {
    return NextResponse.json({ error: "El pedido aún no está listo para esta acción o ya fue actualizado." }, { status: 409 });
  }

  const driverLatitude = Number(order.driver?.driverLatitude);
  const driverLongitude = Number(order.driver?.driverLongitude);
  const hasDriverLocation =
    Number.isFinite(driverLatitude) &&
    driverLatitude >= -90 &&
    driverLatitude <= 90 &&
    Number.isFinite(driverLongitude) &&
    driverLongitude >= -180 &&
    driverLongitude <= 180;

  const updated = await prisma.order.update({
    where: { id: order.id },
    data:
      requested === "DELIVERED"
        ? {
            status: "DELIVERED",
            driverLatitude: null,
            driverLongitude: null,
            driverLocationAccuracy: null,
            driverLocationUpdatedAt: null,
          }
        : requested === "OUT_FOR_DELIVERY" && hasDriverLocation
          ? {
              status: "OUT_FOR_DELIVERY",
              driverLatitude,
              driverLongitude,
              driverLocationAccuracy: order.driver?.driverLocationAccuracy ?? null,
              driverLocationUpdatedAt:
                order.driver?.driverLocationUpdatedAt ?? new Date(),
            }
          : {
              status: requested as "OUT_FOR_DELIVERY" | "ARRIVED",
            },
    select: { id: true, status: true, updatedAt: true },
  });

  if (order.customerId && order.customer?.phone) {
    const result = await dispatchOrderStatusNotification({
      orderId: order.id,
      customerId: order.customerId,
      customerName: order.customer.name,
      phone: `${order.customer.countryCode || "+57"}${order.customer.phone}`,
      orderCode: `POS-${String(order.sequenceNumber ?? order.id).padStart(4, "0")}`,
      total: Number(order.total),
      fulfillmentType: order.fulfillmentType,
      previousStatus: order.status,
      status: requested,
    });
    if (!result.ok) console.warn("Driver status notification", { orderId: order.id, reason: result.reason });
  }

  return NextResponse.json({ order: updated });
}
