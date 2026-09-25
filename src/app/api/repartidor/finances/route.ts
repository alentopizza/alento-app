import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { orderCode } from "@/lib/orderCode";

function bogotaDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function localStart(dateString: string) {
  return new Date(`${dateString}T00:00:00-05:00`);
}

function periodStarts() {
  const todayString = bogotaDateString();
  const today = localStart(todayString);
  const dayOfWeek = today.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const week = new Date(today.getTime() - daysFromMonday * 86_400_000);
  const month = localStart(`${todayString.slice(0, 8)}01`);

  return { today, week, month };
}

function money(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  try {
    const session = await requireStaffSession(["DRIVER", "DISPATCH"]);
    const { today, week, month } = periodStarts();

    const [
      periodOrders,
      recentOrders,
      earningAggregate,
      payoutAggregate,
      recentPayouts,
    ] = await Promise.all([
      prisma.order.findMany({
        where: {
          driverId: session.userId,
          fulfillmentType: "DELIVERY",
          deliveredAt: { gte: month },
          status: { in: ["DELIVERED", "COMPLETED"] },
        },
        orderBy: { deliveredAt: "desc" },
        select: {
          id: true,
          sequenceNumber: true,
          source: true,
          deliveryFee: true,
          driverEarningAmount: true,
          driverEarningKind: true,
          deliveredAt: true,
        },
      }),
      prisma.order.findMany({
        where: {
          driverId: session.userId,
          fulfillmentType: "DELIVERY",
          deliveredAt: { not: null },
          status: { in: ["DELIVERED", "COMPLETED"] },
        },
        orderBy: { deliveredAt: "desc" },
        take: 20,
        select: {
          id: true,
          sequenceNumber: true,
          source: true,
          deliveryFee: true,
          driverEarningAmount: true,
          driverEarningKind: true,
          driverEarningRatePercent: true,
          driverEarningCreditedAt: true,
          deliveredAt: true,
          customer: { select: { name: true } },
          address: {
            select: {
              neighborhood: true,
              formattedAddress: true,
              address: true,
            },
          },
        },
      }),
      prisma.order.aggregate({
        where: {
          driverId: session.userId,
          fulfillmentType: "DELIVERY",
          driverEarningCreditedAt: { not: null },
        },
        _sum: { driverEarningAmount: true },
      }),
      prisma.cashExpense.aggregate({
        where: { driverId: session.userId },
        _sum: { amount: true },
      }),
      prisma.cashExpense.findMany({
        where: { driverId: session.userId },
        orderBy: { occurredAt: "desc" },
        take: 20,
        select: {
          id: true,
          amount: true,
          occurredAt: true,
          note: true,
          createdByName: true,
        },
      }),
    ]);

    function period(start: Date) {
      const orders = periodOrders.filter(
        (order) => order.deliveredAt && order.deliveredAt >= start,
      );

      return {
        deliveries: orders.length,
        earnings: orders.reduce(
          (sum, order) => sum + money(order.driverEarningAmount),
          0,
        ),
      };
    }

    const earnedTotal = money(earningAggregate._sum.driverEarningAmount);
    const paidTotal = money(payoutAggregate._sum.amount);

    const earningMovements = recentOrders
      .filter(
        (order) =>
          order.driverEarningCreditedAt != null &&
          order.driverEarningAmount != null,
      )
      .map((order) => ({
        id: `earning-${order.id}`,
        kind: "EARNING" as const,
        amount: money(order.driverEarningAmount),
        occurredAt: order.driverEarningCreditedAt!.toISOString(),
        title: orderCode(
          order.sequenceNumber ?? order.id,
          order.source,
        ),
        detail:
          order.driverEarningKind === "FREE_DELIVERY"
            ? "Incentivo por entrega sin costo"
            : "Ganancia por domicilio",
      }));

    const payoutMovements = recentPayouts.map((payout) => ({
      id: `payout-${payout.id}`,
      kind: "PAYOUT" as const,
      amount: money(payout.amount),
      occurredAt: payout.occurredAt.toISOString(),
      title: "Pago recibido",
      detail:
        payout.note?.trim() ||
        `Registrado por ${payout.createdByName}`,
    }));

    const movements = [...earningMovements, ...payoutMovements]
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() -
          new Date(a.occurredAt).getTime(),
      )
      .slice(0, 30);

    return NextResponse.json({
      performance: {
        today: period(today),
        week: period(week),
        month: period(month),
      },
      wallet: {
        available: Math.max(0, earnedTotal - paidTotal),
        earnedTotal,
        paidTotal,
      },
      recentDeliveries: recentOrders.slice(0, 12).map((order) => ({
        id: order.id,
        code: orderCode(
          order.sequenceNumber ?? order.id,
          order.source,
        ),
        customerName: order.customer?.name ?? "Cliente",
        neighborhood:
          order.address?.neighborhood ||
          order.address?.formattedAddress ||
          order.address?.address ||
          "Entrega",
        deliveryFee: money(order.deliveryFee),
        earning:
          order.driverEarningAmount == null
            ? null
            : money(order.driverEarningAmount),
        earningKind: order.driverEarningKind,
        deliveredAt: order.deliveredAt?.toISOString() ?? null,
      })),
      movements,
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
