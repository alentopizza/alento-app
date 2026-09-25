import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import {
  assertCashDateEditable,
  CASH_DATE_CLOSED_ERROR,
  cashDateClosedResponseMessage,
} from "@/lib/cashRegisterLock";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  try {
    await requireStaffSession(["ADMIN", "CASHIER"]);

    const loans = await prisma.cashLoan.findMany({
      orderBy: [{ status: "asc" }, { issuedAt: "desc" }, { id: "desc" }],
      include: {
        repayments: {
          orderBy: [{ paidAt: "desc" }, { id: "desc" }],
        },
      },
    });

    let principalTotal = 0;
    let repaidTotal = 0;
    let outstandingTotal = 0;
    let openCount = 0;

    const normalized = loans.map((loan) => {
      const principal = Number(loan.principal);
      const trackedRepaid = loan.repayments.reduce(
        (sum, repayment) => sum + Number(repayment.amount),
        0,
      );
      const displayedRepaid = loan.historicalPaidWithoutRepayment
        ? principal
        : Math.min(principal, trackedRepaid);
      const outstanding = loan.historicalPaidWithoutRepayment
        ? 0
        : Math.max(0, principal - trackedRepaid);

      principalTotal += principal;
      repaidTotal += displayedRepaid;
      outstandingTotal += outstanding;
      if (outstanding > 0) openCount += 1;

      return {
        id: loan.id,
        workerName: loan.workerName,
        note: loan.note,
        principal,
        issuedAt: loan.issuedAt,
        status: outstanding > 0 ? "OPEN" : "PAID",
        source: loan.source,
        createdByName: loan.createdByName,
        historicalPaidWithoutRepayment:
          loan.historicalPaidWithoutRepayment,
        repaidAmount: displayedRepaid,
        trackedRepaidAmount: trackedRepaid,
        outstandingAmount: outstanding,
        repayments: loan.repayments.map((repayment) => ({
          id: repayment.id,
          amount: Number(repayment.amount),
          paidAt: repayment.paidAt,
          method: repayment.method,
          note: repayment.note,
          source: repayment.source,
          createdByName: repayment.createdByName,
        })),
      };
    });

    return NextResponse.json({
      summary: {
        loanCount: loans.length,
        openCount,
        principalTotal,
        repaidTotal,
        outstandingTotal,
      },
      loans: normalized,
    });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    if (forbidden || (error instanceof Error && error.message === "UNAUTHORIZED")) {
      return NextResponse.json(
        { error: forbidden ? "Sin permisos." : "No autorizado." },
        { status: forbidden ? 403 : 401 },
      );
    }

    console.error("Cash loans load error", error);
    return NextResponse.json(
      { error: "No fue posible cargar los préstamos." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireStaffSession(["ADMIN", "CASHIER"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  try {
    const body = await request.json();
    const workerName = clean(body.workerName);
    const note = clean(body.note);
    const amount = Number(body.amount);
    const issuedAt = new Date(clean(body.issuedAt));

    if (!workerName) {
      return NextResponse.json(
        { error: "Indica el trabajador." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "El monto debe ser mayor a cero." },
        { status: 400 },
      );
    }

    if (Number.isNaN(issuedAt.getTime())) {
      return NextResponse.json(
        { error: "La fecha del préstamo no es válida." },
        { status: 400 },
      );
    }

    await assertCashDateEditable(issuedAt);

    const loan = await prisma.cashLoan.create({
      data: {
        workerName,
        note: note || null,
        principal: Math.round(amount),
        issuedAt,
        status: "OPEN",
        source: "MANUAL",
        createdByName: session.name,
      },
    });

    return NextResponse.json({
      loan: {
        ...loan,
        principal: Number(loan.principal),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === CASH_DATE_CLOSED_ERROR) {
      return NextResponse.json(
        { error: cashDateClosedResponseMessage() },
        { status: 409 },
      );
    }

    console.error("Cash loan create error", error);
    return NextResponse.json(
      { error: "No fue posible registrar el préstamo." },
      { status: 500 },
    );
  }
}
