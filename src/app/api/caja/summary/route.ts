import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function colombiaDayBounds(dateText: string) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? dateText : new Date().toISOString().slice(0, 10);
  const start = new Date(`${valid}T00:00:00-05:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { date: valid, start, end };
}

export async function GET(request: NextRequest) {
  try {
    const requestedDate = request.nextUrl.searchParams.get("date") ?? "";
    const { date, start, end } = colombiaDayBounds(requestedDate);

    const payments = await prisma.payment.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: start, lt: end },
        order: { status: { not: "CANCELED" } },
      },
      orderBy: { paidAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            fulfillmentType: true,
            total: true,
            customer: { select: { name: true } },
          },
        },
      },
    });

    const methods = new Map<string, { method: string; amount: number; count: number }>();
    let total = 0;
    for (const payment of payments) {
      const amount = Number(payment.amount);
      total += amount;
      const current = methods.get(payment.method) ?? { method: payment.method, amount: 0, count: 0 };
      current.amount += amount;
      current.count += 1;
      methods.set(payment.method, current);
    }

    return NextResponse.json({
      date,
      total,
      paymentCount: payments.length,
      methods: [...methods.values()].sort((a, b) => b.amount - a.amount),
      payments: payments.map((payment) => ({
        id: payment.id,
        orderId: payment.orderId,
        method: payment.method,
        amount: Number(payment.amount),
        reference: payment.reference,
        paidAt: payment.paidAt,
        order: {
          id: payment.order.id,
          fulfillmentType: payment.order.fulfillmentType,
          total: Number(payment.order.total),
          customerName: payment.order.customer?.name ?? "Cliente ocasional",
        },
      })),
    });
  } catch (error) {
    console.error("Cash summary error", error);
    return NextResponse.json({ error: "No fue posible cargar el resumen de caja." }, { status: 500 });
  }
}
