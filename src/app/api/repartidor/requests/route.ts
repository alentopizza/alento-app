import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { createDriverOrderToken } from "@/lib/driverTracking";

const PROCESS_STATUSES = [
  "CONFIRMED",
  "PREPARING",
  "PREPARED",
  "READY",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
] as const;

const CLAIMABLE_STATUSES = new Set([
  "CONFIRMED",
  "PREPARING",
  "PREPARED",
  "READY",
]);

export async function GET() {
  try {
    const session = await requireStaffSession(["DRIVER", "DISPATCH"]);

    const orders = await prisma.order.findMany({
      where: {
        fulfillmentType: "DELIVERY",
        status: { in: [...PROCESS_STATUSES] },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        source: true,
        sequenceNumber: true,
        status: true,
        subtotal: true,
        deliveryFee: true,
        total: true,
        createdAt: true,
        driverId: true,
        driver: {
          select: { id: true, name: true },
        },
        customer: {
          select: { name: true },
        },
        address: {
          select: {
            address: true,
            formattedAddress: true,
            neighborhood: true,
            latitude: true,
            longitude: true,
          },
        },
        items: {
          select: { quantity: true },
        },
      },
    });

    return NextResponse.json({
      orders: orders.map((order) => {
        const own = order.driverId === session.userId;
        return {
          id: order.id,
          code: `${order.source}-${String(
            order.sequenceNumber ?? order.id,
          ).padStart(4, "0")}`,
          status: order.status,
          subtotal: Number(order.subtotal),
          deliveryFee: Number(order.deliveryFee),
          total: Number(order.total),
          createdAt: order.createdAt.toISOString(),
          customerName: order.customer?.name ?? "Cliente",
          address: order.address
            ? {
                address:
                  order.address.formattedAddress ||
                  order.address.address,
                neighborhood: order.address.neighborhood,
                latitude: order.address.latitude,
                longitude: order.address.longitude,
              }
            : null,
          itemCount: order.items.reduce(
            (total, item) => total + item.quantity,
            0,
          ),
          assignment: order.driver
            ? {
                driverId: order.driver.id,
                driverName: order.driver.name,
                own,
              }
            : null,
          claimable:
            order.driverId == null &&
            CLAIMABLE_STATUSES.has(order.status),
          href: own
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
