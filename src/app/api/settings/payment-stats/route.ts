import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CANONICAL_PAYMENT_METHODS,
  resolveCanonicalPaymentMethod,
} from "@/lib/paymentMethods";

function todayBogota() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${map.year}-${map.month}-${map.day}`;
}

function monthStartBogota() {
  const today = todayBogota();
  return `${today.slice(0, 7)}-01`;
}

function validDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function rangeBounds(
  startText: string | null,
  endText: string | null,
) {
  const fallbackEnd = todayBogota();
  const fallbackStart = monthStartBogota();
  const startDate = validDate(startText) ? startText! : fallbackStart;
  const endDate = validDate(endText) ? endText! : fallbackEnd;
  const start = new Date(`${startDate}T00:00:00-05:00`);
  const endDay = new Date(`${endDate}T00:00:00-05:00`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(endDay.getTime()) ||
    endDay < start
  ) {
    throw new Error("INVALID_PAYMENT_DATE_RANGE");
  }

  return {
    startDate,
    endDate,
    start,
    endExclusive: new Date(endDay.getTime() + 24 * 60 * 60 * 1000),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { startDate, endDate, start, endExclusive } = rangeBounds(
      request.nextUrl.searchParams.get("startDate"),
      request.nextUrl.searchParams.get("endDate"),
    );

    const rows = await prisma.payment.groupBy({
      by: ["method"],
      where: {
        status: { in: ["PAID", "REFUNDED"] },
        paidAt: { gte: start, lt: endExclusive },
      },
      _count: { id: true },
      _sum: { amount: true },
      _max: { paidAt: true },
    });

    const usageById = new Map<
      string,
      {
        transactionCount: number;
        amount: number;
        lastUsedAt: Date | null;
      }
    >();

    let unclassifiedTransactions = 0;
    let unclassifiedAmount = 0;

    for (const row of rows) {
      const canonical = resolveCanonicalPaymentMethod(row.method);
      const transactionCount = row._count.id;
      const amount = Number(row._sum.amount ?? 0);
      const lastUsedAt = row._max.paidAt ?? null;

      if (!canonical) {
        unclassifiedTransactions += transactionCount;
        unclassifiedAmount += amount;
        continue;
      }

      const current = usageById.get(canonical.id) ?? {
        transactionCount: 0,
        amount: 0,
        lastUsedAt: null,
      };

      current.transactionCount += transactionCount;
      current.amount += amount;

      if (
        lastUsedAt &&
        (!current.lastUsedAt || lastUsedAt > current.lastUsedAt)
      ) {
        current.lastUsedAt = lastUsedAt;
      }

      usageById.set(canonical.id, current);
    }

    const totalTransactions = [...usageById.values()].reduce(
      (sum, item) => sum + item.transactionCount,
      0,
    );
    const totalAmount = [...usageById.values()].reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    const paymentStats = CANONICAL_PAYMENT_METHODS.map((method) => {
      const usage = usageById.get(method.id) ?? {
        transactionCount: 0,
        amount: 0,
        lastUsedAt: null,
      };

      return {
        id: method.id,
        name: method.name,
        transactionCount: usage.transactionCount,
        amount: usage.amount,
        usagePercent:
          totalTransactions > 0
            ? Math.round(
                (usage.transactionCount / totalTransactions) * 1000,
              ) / 10
            : 0,
        amountPercent:
          totalAmount > 0
            ? Math.round((usage.amount / totalAmount) * 1000) / 10
            : 0,
        lastUsedAt: usage.lastUsedAt,
      };
    });

    return NextResponse.json({
      paymentStats,
      paymentSummary: {
        startDate,
        endDate,
        totalTransactions,
        totalAmount,
        unclassifiedTransactions,
        unclassifiedAmount,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INVALID_PAYMENT_DATE_RANGE"
    ) {
      return NextResponse.json(
        { error: "El rango de fechas de pagos no es válido." },
        { status: 400 },
      );
    }

    console.error("Payment analytics error", error);
    return NextResponse.json(
      { error: "No fue posible cargar las estadísticas de pagos." },
      { status: 500 },
    );
  }
}
