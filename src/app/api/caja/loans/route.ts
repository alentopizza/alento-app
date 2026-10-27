import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { staffAuditActor, writeAuditLog } from "@/lib/auditLog";
import {
  assertCashDateEditable,
  CASH_DATE_CLOSED_ERROR,
  CASH_SESSION_REQUIRED_ERROR,
  CASH_MOVEMENT_BEFORE_OPEN_ERROR,
  cashDateClosedResponseMessage,
  cashSessionRequiredResponseMessage,
  cashMovementBeforeOpenResponseMessage,
} from "@/lib/cashRegisterLock";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function payrollMonthFromDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}`;
}

function validPayrollMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export async function GET() {
  try {
    await requireStaffSession(["ADMIN", "CASHIER"]);

    const [loans, workers] = await Promise.all([
      prisma.cashLoan.findMany({
        orderBy: [{ status: "asc" }, { issuedAt: "desc" }, { id: "desc" }],
        include: {
          worker: {
            select: {
              id: true,
              name: true,
              email: true,
              active: true,
            },
          },
          repayments: {
            orderBy: [{ paidAt: "desc" }, { id: "desc" }],
          },
        },
      }),
      prisma.user.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
        },
      }),
    ]);

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
        workerId: loan.workerId,
        workerName: loan.worker?.name || loan.workerName,
        worker: loan.worker,
        note: loan.note,
        principal,
        issuedAt: loan.issuedAt,
        payrollMonth:
          loan.payrollMonth || payrollMonthFromDate(loan.issuedAt),
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
      workers,
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
    const workerId = Number(body.workerId);
    const note = clean(body.note);
    const amount = Number(body.amount);
    const issuedAt = new Date(clean(body.issuedAt));
    const requestedPayrollMonth = clean(body.payrollMonth);

    if (!Number.isInteger(workerId) || workerId <= 0) {
      return NextResponse.json(
        { error: "Selecciona un trabajador." },
        { status: 400 },
      );
    }

    const worker = await prisma.user.findFirst({
      where: { id: workerId, active: true },
      select: { id: true, name: true },
    });

    if (!worker) {
      return NextResponse.json(
        { error: "El trabajador seleccionado no está activo." },
        { status: 409 },
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

    const payrollMonth =
      requestedPayrollMonth || payrollMonthFromDate(issuedAt);

    if (!validPayrollMonth(payrollMonth)) {
      return NextResponse.json(
        { error: "El mes de nómina no es válido." },
        { status: 400 },
      );
    }

    await assertCashDateEditable(issuedAt);

    const loan = await prisma.$transaction(async (tx) => {
      const created = await tx.cashLoan.create({
        data: {
          workerId: worker.id,
          workerName: worker.name,
          note: note || null,
          principal: Math.round(amount),
          issuedAt,
          payrollMonth,
          status: "OPEN",
          source: "MANUAL",
          createdByName: session.name,
        },
      });

      await writeAuditLog(tx, {
        actor: staffAuditActor(session),
        action: "CASH_LOAN_CREATED",
        entityType: "CASH_LOAN",
        entityId: created.id,
        summary: `Préstamo de ${Math.round(amount).toLocaleString("es-CO")} registrado para ${worker.name}.`,
        after: {
          id: created.id,
          workerId: created.workerId,
          workerName: created.workerName,
          principal: Number(created.principal),
          issuedAt: created.issuedAt,
          payrollMonth: created.payrollMonth,
          status: created.status,
          source: created.source,
        },
        source: "api/caja/loans",
      });

      return created;
    });

    return NextResponse.json({
      loan: {
        ...loan,
        worker: {
          id: worker.id,
          name: worker.name,
          email: null,
          active: true,
        },
        principal: Number(loan.principal),
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === CASH_SESSION_REQUIRED_ERROR
    ) {
      return NextResponse.json(
        { error: cashSessionRequiredResponseMessage() },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === CASH_MOVEMENT_BEFORE_OPEN_ERROR
    ) {
      return NextResponse.json(
        { error: cashMovementBeforeOpenResponseMessage() },
        { status: 409 },
      );
    }

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
