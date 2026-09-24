import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/auth";
import { createOrderTrackingToken } from "@/lib/orderTracking";

const ACTIVE_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PREPARING",
  "PREPARED",
  "READY",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
] as const;

export async function GET() {
  const session = await getCustomerSession();

  if (!session) {
    return NextResponse.json({ authenticated: false, order: null });
  }

  const account = await prisma.customerAccount.findUnique({
    where: { id: session.accountId },
    select: { active: true, customerId: true },
  });

  if (!account?.active) {
    return NextResponse.json({ authenticated: false, order: null });
  }

  const recentWindow = new Date(Date.now() - 15 * 60 * 1000);

  const [orders, recentDelivered] = await Promise.all([
    prisma.order.findMany({
      where: {
        customerId: account.customerId,
        status: { in: [...ACTIVE_STATUSES] },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 5,
      select: {
        id: true,
        sequenceNumber: true,
        source: true,
        status: true,
        fulfillmentType: true,
        total: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.order.findFirst({
      where: {
        customerId: account.customerId,
        fulfillmentType: "DELIVERY",
        status: { in: ["DELIVERED", "COMPLETED"] },
        updatedAt: { gte: recentWindow },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        sequenceNumber: true,
        source: true,
        updatedAt: true,
      },
    }),
  ]);

  const serializedOrders = orders.map((order) => {
    let trackingPath: string | null = null;
    try {
      trackingPath = `/seguimiento/${createOrderTrackingToken(order.id)}`;
    } catch {
      trackingPath = null;
    }

    return {
      id: order.id,
      code: `${order.source}-${String(order.sequenceNumber ?? order.id).padStart(4, "0")}`,
      status: order.status,
      fulfillmentType: order.fulfillmentType,
      total: Number(order.total),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      trackingPath,
    };
  });

  return NextResponse.json({
    authenticated: true,
    orders: serializedOrders,
    order: serializedOrders[0] ?? null,
    recentDelivered: recentDelivered
      ? {
          id: recentDelivered.id,
          code: `${recentDelivered.source}-${String(
            recentDelivered.sequenceNumber ?? recentDelivered.id,
          ).padStart(4, "0")}`,
          updatedAt: recentDelivered.updatedAt,
        }
      : null,
  });
}
