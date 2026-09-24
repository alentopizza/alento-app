import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function todayBogota() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function validDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function colombiaRangeBounds(startText: string | null, endText: string | null) {
  const fallback = todayBogota();
  const startDate = validDate(startText) ? startText! : fallback;
  const endDate = validDate(endText) ? endText! : startDate;
  const start = new Date(`${startDate}T00:00:00-05:00`);
  const endDay = new Date(`${endDate}T00:00:00-05:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(endDay.getTime()) || endDay < start) {
    throw new Error("INVALID_DATE_RANGE");
  }

  const endExclusive = new Date(endDay.getTime() + 24 * 60 * 60 * 1000);
  return { startDate, endDate, start, endExclusive };
}

export async function GET(request: NextRequest) {
  try {
    const legacyDate = request.nextUrl.searchParams.get("date");
    const requestedStart =
      request.nextUrl.searchParams.get("startDate") ?? legacyDate;
    const requestedEnd =
      request.nextUrl.searchParams.get("endDate") ?? legacyDate;

    const { startDate, endDate, start, endExclusive } = colombiaRangeBounds(
      requestedStart,
      requestedEnd,
    );

    const [sales, payments, otherIncomes, expenses] = await prisma.$transaction([
      prisma.order.aggregate({
        where: {
          createdAt: { gte: start, lt: endExclusive },
          status: { notIn: ["DRAFT", "CANCELED"] },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.payment.findMany({
        where: {
          status: "PAID",
          paidAt: { gte: start, lt: endExclusive },
          order: { status: { not: "CANCELED" } },
        },
        orderBy: [{ paidAt: "desc" }, { id: "desc" }],
        include: {
          order: {
            select: {
              id: true,
              sequenceNumber: true,
              source: true,
              fulfillmentType: true,
              total: true,
              customer: { select: { name: true } },
            },
          },
        },
      }),
      prisma.cashIncome.findMany({
        where: {
          occurredAt: { gte: start, lt: endExclusive },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      }),
      prisma.cashExpense.findMany({
        where: {
          occurredAt: { gte: start, lt: endExclusive },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      }),
    ]);

    const methods = new Map<
      string,
      { method: string; amount: number; count: number }
    >();
    let receivedTotal = 0;

    for (const payment of payments) {
      const amount = Number(payment.amount);
      receivedTotal += amount;
      const current = methods.get(payment.method) ?? {
        method: payment.method,
        amount: 0,
        count: 0,
      };
      current.amount += amount;
      current.count += 1;
      methods.set(payment.method, current);
    }

    const incomeCategories = new Map<
      string,
      { category: string; amount: number; count: number }
    >();
    let otherIncomeTotal = 0;

    for (const income of otherIncomes) {
      const amount = Number(income.amount);
      otherIncomeTotal += amount;
      const current = incomeCategories.get(income.category) ?? {
        category: income.category,
        amount: 0,
        count: 0,
      };
      current.amount += amount;
      current.count += 1;
      incomeCategories.set(income.category, current);
    }

    const expenseCategories = new Map<
      string,
      { category: string; amount: number; count: number }
    >();
    let expensesTotal = 0;

    for (const expense of expenses) {
      const amount = Number(expense.amount);
      expensesTotal += amount;
      const current = expenseCategories.get(expense.category) ?? {
        category: expense.category,
        amount: 0,
        count: 0,
      };
      current.amount += amount;
      current.count += 1;
      expenseCategories.set(expense.category, current);
    }

    const salesTotal = Number(sales._sum.total ?? 0);

    return NextResponse.json({
      startDate,
      endDate,
      salesTotal,
      orderCount: sales._count._all,
      receivedTotal,
      paymentCount: payments.length,
      otherIncomeTotal,
      otherIncomeCount: otherIncomes.length,
      totalInflow: receivedTotal + otherIncomeTotal,
      expensesTotal,
      expenseCount: expenses.length,
      netTotal: receivedTotal + otherIncomeTotal - expensesTotal,
      methods: [...methods.values()].sort((a, b) => b.amount - a.amount),
      incomeCategories: [...incomeCategories.values()].sort(
        (a, b) => b.amount - a.amount,
      ),
      expenseCategories: [...expenseCategories.values()].sort(
        (a, b) => b.amount - a.amount,
      ),
      payments: payments.map((payment) => ({
        id: payment.id,
        orderId: payment.orderId,
        method: payment.method,
        amount: Number(payment.amount),
        reference: payment.reference,
        paidAt: payment.paidAt,
        order: {
          id: payment.order.id,
          sequenceNumber: payment.order.sequenceNumber,
          source: payment.order.source,
          fulfillmentType: payment.order.fulfillmentType,
          total: Number(payment.order.total),
          customerName: payment.order.customer?.name ?? "Cliente ocasional",
        },
      })),
      otherIncomes: otherIncomes.map((income) => ({
        id: income.id,
        category: income.category,
        note: income.note,
        amount: Number(income.amount),
        occurredAt: income.occurredAt,
        source: income.source,
        createdByName: income.createdByName,
      })),
      expenses: expenses.map((expense) => ({
        id: expense.id,
        category: expense.category,
        subcategory: expense.subcategory,
        note: expense.note,
        amount: Number(expense.amount),
        occurredAt: expense.occurredAt,
        source: expense.source,
        createdByName: expense.createdByName,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_DATE_RANGE") {
      return NextResponse.json(
        { error: "El rango de fechas no es válido." },
        { status: 400 },
      );
    }

    console.error("Cash summary error", error);
    return NextResponse.json(
      { error: "No fue posible cargar el resumen de caja." },
      { status: 500 },
    );
  }
}
