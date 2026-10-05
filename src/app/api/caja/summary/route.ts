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

function expensePlanningType(
  category: string,
  source: string,
  stored: string,
) {
  if (source === "PAYROLL" || category === "Nomina") return "RECURRING";
  if (stored && stored !== "AUTO") return stored;
  if (["Arriendo", "Servicios Públicos", "Plataformas"].includes(category)) {
    return "RECURRING";
  }
  if (category === "Maquinaria") return "ONE_TIME";
  return "VARIABLE";
}

function payrollMonthContext(startDate: string, endDate: string) {
  const month = startDate.slice(0, 7);
  const sameMonth = month === endDate.slice(0, 7);
  const startsAtMonthBeginning = startDate.endsWith("-01");
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0))
    .getUTCDate()
    .toString()
    .padStart(2, "0");
  const fullMonth = endDate === `${month}-${lastDay}`;
  const currentMonthToDate =
    month === todayBogota().slice(0, 7) && endDate === todayBogota();
  const active =
    sameMonth &&
    startsAtMonthBeginning &&
    (fullMonth || currentMonthToDate);

  return {
    active,
    month: active ? month : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const legacyDate = request.nextUrl.searchParams.get("date");
    const requestedStart =
      request.nextUrl.searchParams.get("startDate") ?? legacyDate;
    const requestedEnd =
      request.nextUrl.searchParams.get("endDate") ?? legacyDate;

    const { startDate, endDate, start, endExclusive } =
      colombiaRangeBounds(requestedStart, requestedEnd);
    const payrollMonth = payrollMonthContext(startDate, endDate);

    let queryStart = start;
    let queryEndExclusive = endExclusive;
    let sessionScope: {
      id: number;
      businessDate: string;
      status: string;
      openedAt: string;
      closedAt: string | null;
      inheritedFromPreviousDay: boolean;
    } | null = null;

    if (startDate === endDate) {
      const [exactSession, openSession] = await Promise.all([
        prisma.cashRegisterSession.findUnique({
          where: { businessDate: startDate },
          select: {
            id: true,
            businessDate: true,
            status: true,
            openedAt: true,
            closedAt: true,
          },
        }),
        prisma.cashRegisterSession.findFirst({
          where: { status: "OPEN" },
          orderBy: { openedAt: "desc" },
          select: {
            id: true,
            businessDate: true,
            status: true,
            openedAt: true,
            closedAt: true,
          },
        }),
      ]);

      const inherited =
        !exactSession &&
        startDate === todayBogota() &&
        openSession != null;
      const session =
        exactSession ?? (inherited ? openSession : null);

      if (session) {
        queryStart = session.openedAt;
        queryEndExclusive =
          session.closedAt ?? new Date(Date.now() + 1000);
        sessionScope = {
          id: session.id,
          businessDate: session.businessDate,
          status: session.status,
          openedAt: session.openedAt.toISOString(),
          closedAt: session.closedAt?.toISOString() ?? null,
          inheritedFromPreviousDay: inherited,
        };
      } else {
        // A single operational day without its own cash session must not
        // re-display movements that belong to a session opened the day before.
        // Multi-day ranges remain calendar-based reporting.
        queryStart = endExclusive;
        queryEndExclusive = endExclusive;
      }
    }

    const [
      sales,
      salesOrders,
      payments,
      otherIncomes,
      expenses,
      loans,
      loanRepayments,
      payrollShifts,
      loanPortfolio,
    ] = await prisma.$transaction([
      prisma.order.aggregate({
        where: {
          createdAt: { gte: queryStart, lt: queryEndExclusive },
          status: { notIn: ["DRAFT", "CANCELED"] },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.order.findMany({
        where: {
          createdAt: { gte: queryStart, lt: queryEndExclusive },
          status: { notIn: ["DRAFT", "CANCELED"] },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          sequenceNumber: true,
          source: true,
          fulfillmentType: true,
          status: true,
          subtotal: true,
          deliveryFee: true,
          discount: true,
          total: true,
          createdAt: true,
          customer: {
            select: { name: true },
          },
          payments: {
            where: { status: { not: "CANCELED" } },
            orderBy: [{ paidAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              method: true,
              status: true,
              amount: true,
              paidAt: true,
            },
          },
        },
      }),
      prisma.payment.findMany({
        where: {
          status: "PAID",
          paidAt: { gte: queryStart, lt: queryEndExclusive },
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
          occurredAt: { gte: queryStart, lt: queryEndExclusive },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      }),
      prisma.cashExpense.findMany({
        where: {
          occurredAt: { gte: queryStart, lt: queryEndExclusive },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        include: {
          payrollPayment: {
            select: { id: true },
          },
        },
      }),
      prisma.cashLoan.findMany({
        where: {
          issuedAt: { gte: queryStart, lt: queryEndExclusive },
          historicalPaidWithoutRepayment: false,
        },
        select: {
          id: true,
          workerName: true,
          principal: true,
          issuedAt: true,
          repayments: {
            select: {
              amount: true,
              paidAt: true,
              method: true,
            },
            orderBy: { paidAt: "asc" },
          },
        },
      }),
      prisma.cashLoanRepayment.findMany({
        where: {
          paidAt: { gte: queryStart, lt: queryEndExclusive },
        },
        select: {
          id: true,
          loanId: true,
          amount: true,
          paidAt: true,
          method: true,
          loan: {
            select: {
              workerName: true,
            },
          },
        },
      }),
      // Nómina is calendar-based, not cash-session based. This keeps the
      // operational projection aligned with the dates selected in the header.
      prisma.workShift.findMany({
        where: {
          startsAt: { gte: start, lt: endExclusive },
        },
        select: {
          userId: true,
          amount: true,
          status: true,
        },
      }),
      // Para nómina solo interesa la cartera asignada a ese mes.
      // Los préstamos históricos sin payrollMonth se asignan por su fecha de
      // entrega. El saldo es ACTUAL: si ya fue descontado/pagado después, deja
      // de aparecer al volver a consultar ese mes.
      prisma.cashLoan.findMany({
        where: payrollMonth.active && payrollMonth.month
          ? {
              historicalPaidWithoutRepayment: false,
              OR: [
                { payrollMonth: payrollMonth.month },
                {
                  payrollMonth: null,
                  issuedAt: { gte: start, lt: endExclusive },
                },
              ],
            }
          : {
              id: { lt: 0 },
            },
        select: {
          principal: true,
          repayments: {
            select: {
              amount: true,
            },
          },
        },
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
    const loanDisbursedTotal = loans.reduce(
      (sum, loan) => sum + Number(loan.principal),
      0,
    );
    const loanOutstandingTotal = loans.reduce((sum, loan) => {
      const principal = Number(loan.principal);
      const recovered = loan.repayments.reduce(
        (recoverySum, repayment) =>
          recoverySum + Number(repayment.amount),
        0,
      );
      return sum + Math.max(0, principal - recovered);
    }, 0);
    const loanRecoveredFromIssuedTotal = Math.max(
      0,
      loanDisbursedTotal - loanOutstandingTotal,
    );
    const loanRecoveryAdjustmentTotal = loans.reduce((sum, loan) => {
      return (
        sum +
        loan.repayments.reduce((repaymentSum, repayment) => {
          const alreadyCountedAsPeriodCashInflow =
            repayment.method !== "DESCUENTO_NOMINA" &&
            repayment.paidAt >= queryStart &&
            repayment.paidAt < queryEndExclusive;

          return (
            repaymentSum +
            (alreadyCountedAsPeriodCashInflow
              ? 0
              : Number(repayment.amount))
          );
        }, 0)
      );
    }, 0);
    const loanRecoveredTotal = loanRepayments.reduce(
      (sum, repayment) => sum + Number(repayment.amount),
      0,
    );
    const loanRecoveredPayrollTotal = loanRepayments
      .filter(
        (repayment) =>
          repayment.method === "DESCUENTO_NOMINA",
      )
      .reduce(
        (sum, repayment) => sum + Number(repayment.amount),
        0,
      );
    const loanRecoveredCashTotal =
      loanRecoveredTotal - loanRecoveredPayrollTotal;
    const payrollTotal = payrollShifts.reduce(
      (sum, shift) => sum + Number(shift.amount),
      0,
    );
    const payrollPaidTotal = payrollShifts
      .filter((shift) => shift.status === "PAID")
      .reduce((sum, shift) => sum + Number(shift.amount), 0);
    const payrollPendingTotal = payrollShifts
      .filter((shift) => shift.status !== "PAID")
      .reduce((sum, shift) => sum + Number(shift.amount), 0);
    const payrollWorkerCount = new Set(
      payrollShifts.map((shift) => shift.userId),
    ).size;
    const loanReceivableBalance = loanPortfolio.reduce((sum, loan) => {
      const principal = Number(loan.principal);
      const recovered = loan.repayments.reduce(
        (repaymentSum, repayment) =>
          repaymentSum + Number(repayment.amount),
        0,
      );
      return sum + Math.max(0, principal - recovered);
    }, 0);

    return NextResponse.json({
      startDate,
      endDate,
      scope:
        sessionScope
          ? "SESSION"
          : startDate === endDate
            ? "NO_SESSION"
            : "CALENDAR",
      sessionScope,
      salesTotal,
      orderCount: sales._count._all,
      receivedTotal,
      paymentCount: payments.length,
      otherIncomeTotal,
      otherIncomeCount: otherIncomes.length,
      totalInflow:
        receivedTotal +
        otherIncomeTotal +
        loanRecoveredCashTotal,
      loanDisbursedTotal,
      loanOutstandingTotal,
      loanRecoveredFromIssuedTotal,
      loanRecoveryAdjustmentTotal,
      loanRecoveredTotal,
      loanRecoveredCashTotal,
      loanRecoveredPayrollTotal,
      expensesTotal,
      expenseCount: expenses.length,
      netTotal:
        receivedTotal +
        otherIncomeTotal +
        loanRecoveredCashTotal -
        expensesTotal -
        loanDisbursedTotal +
        loanRecoveryAdjustmentTotal,
      payrollTotal,
      payrollPaidTotal,
      payrollPendingTotal,
      payrollShiftCount: payrollShifts.length,
      payrollWorkerCount,
      payrollMonthActive: payrollMonth.active,
      payrollMonth: payrollMonth.month,
      loanReceivableBalance,
      methods: [...methods.values()].sort((a, b) => b.amount - a.amount),
      orders: salesOrders.map((order) => {
        const paidAmount = order.payments
          .filter((payment) => payment.status === "PAID")
          .reduce((sum, payment) => sum + Number(payment.amount), 0);
        const total = Number(order.total);

        return {
          id: order.id,
          sequenceNumber: order.sequenceNumber,
          source: order.source,
          fulfillmentType: order.fulfillmentType,
          status: order.status,
          subtotal: Number(order.subtotal),
          deliveryFee: Number(order.deliveryFee),
          discount: Number(order.discount),
          total,
          createdAt: order.createdAt.toISOString(),
          customerName: order.customer?.name ?? "Cliente ocasional",
          paidAmount,
          pendingAmount: Math.max(0, total - paidAmount),
          payments: order.payments.map((payment) => ({
            id: payment.id,
            method: payment.method,
            status: payment.status,
            amount: Number(payment.amount),
            paidAt: payment.paidAt?.toISOString() ?? null,
          })),
        };
      }),
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
      loans: loans.map((loan) => {
        const amount = Number(loan.principal);
        const recoveredAmount = loan.repayments.reduce(
          (sum, repayment) => sum + Number(repayment.amount),
          0,
        );

        return {
          id: loan.id,
          workerName: loan.workerName,
          amount,
          issuedAt: loan.issuedAt,
          recoveredAmount,
          outstandingAmount: Math.max(0, amount - recoveredAmount),
        };
      }),
      loanRepayments: loanRepayments.map((repayment) => ({
        id: repayment.id,
        loanId: repayment.loanId,
        workerName: repayment.loan.workerName,
        amount: Number(repayment.amount),
        paidAt: repayment.paidAt,
        method: repayment.method,
      })),
      expenses: expenses.map((expense) => ({
        id: expense.id,
        category: expense.category,
        subcategory: expense.subcategory,
        note: expense.note,
        amount: Number(expense.amount),
        occurredAt: expense.occurredAt,
        source: expense.source,
        planningType: expensePlanningType(
          expense.category,
          expense.source,
          expense.planningType,
        ),
        createdByName: expense.createdByName,
        payrollPaymentId: expense.payrollPayment?.id ?? null,
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
