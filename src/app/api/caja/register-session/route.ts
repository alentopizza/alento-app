import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

const DENOMINATIONS = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000] as const;

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dayBounds(date: string) {
  const start = new Date(`${date}T00:00:00-05:00`);
  if (Number.isNaN(start.getTime())) throw new Error("INVALID_DATE");
  return {
    start,
    endExclusive: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
}

function nonNegativeMoney(value: unknown, label: string) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`INVALID_MONEY:${label}`);
  }
  return Math.round(amount);
}

function serializeSession(session: {
  id: number;
  businessDate: string;
  status: string;
  openingBalance: unknown;
  openedAt: Date;
  openedByName: string;
  netMovement: unknown | null;
  expectedClosingBalance: unknown | null;
  closingCash: unknown | null;
  closingNequi: unknown | null;
  closingDaviplata: unknown | null;
  closingCard: unknown | null;
  closingDavivienda: unknown | null;
  closingDenominations: unknown | null;
  closingLoanReceivable: unknown | null;
  actualClosingBalance: unknown | null;
  difference: unknown | null;
  closeNote: string | null;
  closedAt: Date | null;
  closedByName: string | null;
}) {
  return {
    ...session,
    openingBalance: Number(session.openingBalance),
    netMovement: session.netMovement == null ? null : Number(session.netMovement),
    expectedClosingBalance:
      session.expectedClosingBalance == null
        ? null
        : Number(session.expectedClosingBalance),
    closingCash: session.closingCash == null ? null : Number(session.closingCash),
    closingNequi:
      session.closingNequi == null ? null : Number(session.closingNequi),
    closingDaviplata:
      session.closingDaviplata == null ? null : Number(session.closingDaviplata),
    closingCard: session.closingCard == null ? null : Number(session.closingCard),
    closingDavivienda:
      session.closingDavivienda == null ? null : Number(session.closingDavivienda),
    closingLoanReceivable:
      session.closingLoanReceivable == null
        ? null
        : Number(session.closingLoanReceivable),
    actualClosingBalance:
      session.actualClosingBalance == null
        ? null
        : Number(session.actualClosingBalance),
    difference: session.difference == null ? null : Number(session.difference),
    openedAt: session.openedAt.toISOString(),
    closedAt: session.closedAt?.toISOString() ?? null,
  };
}

async function dayNetMovement(date: string) {
  const { start, endExclusive } = dayBounds(date);

  const [payments, incomes, expenses, loans, repayments, loanPortfolio] =
    await prisma.$transaction([
      prisma.payment.aggregate({
        where: {
          status: "PAID",
          paidAt: { gte: start, lt: endExclusive },
          order: { status: { not: "CANCELED" } },
        },
        _sum: { amount: true },
      }),
      prisma.cashIncome.aggregate({
        where: { occurredAt: { gte: start, lt: endExclusive } },
        _sum: { amount: true },
      }),
      prisma.cashExpense.aggregate({
        where: { occurredAt: { gte: start, lt: endExclusive } },
        _sum: { amount: true },
      }),
      prisma.cashLoan.aggregate({
        where: {
          issuedAt: { gte: start, lt: endExclusive },
          historicalPaidWithoutRepayment: false,
        },
        _sum: { principal: true },
      }),
      prisma.cashLoanRepayment.aggregate({
        where: { paidAt: { gte: start, lt: endExclusive } },
        _sum: { amount: true },
      }),
      prisma.cashLoan.findMany({
        where: {
          issuedAt: { lt: endExclusive },
          historicalPaidWithoutRepayment: false,
        },
        select: {
          principal: true,
          repayments: {
            where: { paidAt: { lt: endExclusive } },
            select: { amount: true },
          },
        },
      }),
    ]);

  const received = Number(payments._sum.amount ?? 0);
  const otherIncome = Number(incomes._sum.amount ?? 0);
  const expensesTotal = Number(expenses._sum.amount ?? 0);
  const loansTotal = Number(loans._sum.principal ?? 0);
  const recovered = Number(repayments._sum.amount ?? 0);
  const loansReceivable = loanPortfolio.reduce((sum, loan) => {
    const principal = Number(loan.principal);
    const repaid = loan.repayments.reduce(
      (repaymentSum, repayment) =>
        repaymentSum + Number(repayment.amount),
      0,
    );
    return sum + Math.max(0, principal - repaid);
  }, 0);

  return {
    received,
    otherIncome,
    expensesTotal,
    loansTotal,
    recovered,
    loansReceivable,
    netMovement:
      received + otherIncome + recovered - expensesTotal - loansTotal,
  };
}

async function requireCashSession() {
  try {
    return await requireStaffSession(["ADMIN", "CASHIER"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    throw new Response(
      JSON.stringify({ error: forbidden ? "Sin permisos." : "No autorizado." }),
      {
        status: forbidden ? 403 : 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireCashSession();

    const date = request.nextUrl.searchParams.get("date");
    if (!validDate(date)) {
      return NextResponse.json(
        { error: "La fecha de caja no es válida." },
        { status: 400 },
      );
    }

    const [session, previousClosed, movement] = await Promise.all([
      prisma.cashRegisterSession.findUnique({
        where: { businessDate: date },
      }),
      prisma.cashRegisterSession.findFirst({
        where: {
          businessDate: { lt: date },
          status: "CLOSED",
          actualClosingBalance: { not: null },
        },
        orderBy: { businessDate: "desc" },
        select: {
          businessDate: true,
          actualClosingBalance: true,
        },
      }),
      dayNetMovement(date),
    ]);

    return NextResponse.json({
      session: session ? serializeSession(session) : null,
      movement,
      suggestedOpeningBalance:
        previousClosed?.actualClosingBalance != null
          ? Number(previousClosed.actualClosingBalance)
          : null,
      previousCloseDate: previousClosed?.businessDate ?? null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Cash register session read error", error);
    return NextResponse.json(
      { error: "No fue posible cargar la apertura de caja." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const staff = await requireCashSession();
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim().toUpperCase();
    const businessDate = body?.businessDate;

    if (!validDate(businessDate)) {
      return NextResponse.json(
        { error: "La fecha de caja no es válida." },
        { status: 400 },
      );
    }

    if (action === "OPEN") {
      const openingBalance = nonNegativeMoney(
        body?.openingBalance,
        "saldo inicial",
      );

      const existing = await prisma.cashRegisterSession.findUnique({
        where: { businessDate },
        select: { id: true, status: true },
      });

      if (existing) {
        return NextResponse.json(
          {
            error:
              existing.status === "CLOSED"
                ? "La caja de esta fecha ya fue cerrada."
                : "La caja de esta fecha ya está abierta.",
          },
          { status: 409 },
        );
      }

      const session = await prisma.cashRegisterSession.create({
        data: {
          businessDate,
          openingBalance,
          openedByName: staff.name,
          status: "OPEN",
        },
      });

      const movement = await dayNetMovement(businessDate);

      return NextResponse.json({
        session: serializeSession(session),
        movement,
      });
    }

    if (action === "CLOSE") {
      const session = await prisma.cashRegisterSession.findUnique({
        where: { businessDate },
      });

      if (!session) {
        return NextResponse.json(
          { error: "Primero debes abrir la caja de este día." },
          { status: 409 },
        );
      }

      if (session.status === "CLOSED") {
        return NextResponse.json(
          { error: "La caja de este día ya está cerrada." },
          { status: 409 },
        );
      }

      const rawCounts =
        body?.denominations &&
        typeof body.denominations === "object" &&
        !Array.isArray(body.denominations)
          ? (body.denominations as Record<string, unknown>)
          : {};

      const denominationCounts: Record<string, number> = {};
      let cashTotal = 0;

      for (const denomination of DENOMINATIONS) {
        const raw = Number(rawCounts[String(denomination)] ?? 0);
        if (!Number.isFinite(raw) || raw < 0 || !Number.isInteger(raw)) {
          return NextResponse.json(
            {
              error: `La cantidad para $${denomination.toLocaleString("es-CO")} debe ser un número entero válido.`,
            },
            { status: 400 },
          );
        }

        denominationCounts[String(denomination)] = raw;
        cashTotal += denomination * raw;
      }

      const nequi = nonNegativeMoney(body?.nequi, "Nequi");
      const daviplata = nonNegativeMoney(body?.daviplata, "DaviPlata");
      const card = nonNegativeMoney(body?.card, "Tarjeta");
      const davivienda = nonNegativeMoney(body?.davivienda, "Davivienda");
      const note =
        typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";

      const movement = await dayNetMovement(businessDate);
      const openingBalance = Number(session.openingBalance);
      const expectedClosingBalance = openingBalance + movement.netMovement;
      const actualClosingBalance =
        cashTotal + nequi + daviplata + card + davivienda;
      const difference = actualClosingBalance - expectedClosingBalance;

      const closed = await prisma.cashRegisterSession.update({
        where: { businessDate },
        data: {
          status: "CLOSED",
          netMovement: Math.round(movement.netMovement),
          expectedClosingBalance: Math.round(expectedClosingBalance),
          closingCash: cashTotal,
          closingNequi: nequi,
          closingDaviplata: daviplata,
          closingCard: card,
          closingDavivienda: davivienda,
          closingDenominations: denominationCounts,
          closingLoanReceivable: Math.round(movement.loansReceivable),
          actualClosingBalance,
          difference: Math.round(difference),
          closeNote: note || null,
          closedAt: new Date(),
          closedByName: staff.name,
        },
      });

      return NextResponse.json({
        session: serializeSession(closed),
        movement,
      });
    }

    return NextResponse.json(
      { error: "Acción de caja no válida." },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof Response) return error;

    if (
      error instanceof Error &&
      error.message.startsWith("INVALID_MONEY:")
    ) {
      return NextResponse.json(
        {
          error: `El valor de ${error.message.split(":")[1]} no es válido.`,
        },
        { status: 400 },
      );
    }

    console.error("Cash register session action error", error);
    return NextResponse.json(
      { error: "No fue posible actualizar la apertura o cierre de caja." },
      { status: 500 },
    );
  }
}
