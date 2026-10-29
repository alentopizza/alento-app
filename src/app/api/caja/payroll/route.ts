import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { staffAuditActor, writeAuditLog } from "@/lib/auditLog";
import {
  assertCashDateEditable,
  CASH_DATE_CLOSED_ERROR,
  CASH_MOVEMENT_BEFORE_OPEN_ERROR,
  CASH_SESSION_REQUIRED_ERROR,
  cashDateClosedResponseMessage,
  cashMovementBeforeOpenResponseMessage,
  cashSessionRequiredResponseMessage,
} from "@/lib/cashRegisterLock";

function payrollMonthFromDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}`;
}

function serializePendingShift(shift: {
  id: number;
  userId: number;
  startsAt: Date;
  endsAt: Date;
  amount: { toString(): string };
  status: string;
  paidAt: Date | null;
  notes: string | null;
  user: { id: number; name: string; active: boolean };
}) {
  return {
    id: shift.id,
    userId: shift.userId,
    startsAt: shift.startsAt.toISOString(),
    endsAt: shift.endsAt.toISOString(),
    amount: Number(shift.amount),
    status: shift.status,
    paidAt: shift.paidAt?.toISOString() ?? null,
    notes: shift.notes,
    user: shift.user,
  };
}

function cashLockResponse(error: unknown) {
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

  return null;
}

export async function GET() {
  try {
    await requireStaffSession(["ADMIN", "CASHIER"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  try {
    const shifts = await prisma.workShift.findMany({
      where: {
        status: { not: "PAID" },
        payrollPaymentItem: null,
        startsAt: { lte: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            active: true,
          },
        },
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    });

    const workers = new Map<
      number,
      {
        id: number;
        name: string;
        active: boolean;
        pendingAmount: number;
        pendingCount: number;
        oldestPendingAt: string;
      }
    >();

    for (const shift of shifts) {
      const current = workers.get(shift.userId);
      if (current) {
        current.pendingAmount += Number(shift.amount);
        current.pendingCount += 1;
        continue;
      }

      workers.set(shift.userId, {
        id: shift.user.id,
        name: shift.user.name,
        active: shift.user.active,
        pendingAmount: Number(shift.amount),
        pendingCount: 1,
        oldestPendingAt: shift.startsAt.toISOString(),
      });
    }

    const workerIds = [...workers.keys()];
    const loans =
      workerIds.length === 0
        ? []
        : await prisma.cashLoan.findMany({
            where: {
              historicalPaidWithoutRepayment: false,
              OR: [
                { workerId: { in: workerIds } },
                {
                  workerId: null,
                  workerName: {
                    in: [...workers.values()].map((worker) => worker.name),
                  },
                },
              ],
            },
            include: {
              repayments: {
                select: { amount: true },
              },
            },
            orderBy: [{ issuedAt: "asc" }, { id: "asc" }],
          });

    const pendingLoans = loans
      .map((loan) => {
        const principal = Number(loan.principal);
        const repaidAmount = loan.repayments.reduce(
          (sum, repayment) => sum + Number(repayment.amount),
          0,
        );
        return {
          id: loan.id,
          workerId:
            loan.workerId ??
            [...workers.values()].find(
              (worker) => worker.name === loan.workerName,
            )?.id ??
            null,
          workerName: loan.workerName,
          note: loan.note,
          principal,
          issuedAt: loan.issuedAt.toISOString(),
          payrollMonth:
            loan.payrollMonth || payrollMonthFromDate(loan.issuedAt),
          repaidAmount,
          outstandingAmount: Math.max(0, principal - repaidAmount),
        };
      })
      .filter((loan) => loan.outstandingAmount > 0);

    return NextResponse.json({
      workers: [...workers.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "es"),
      ),
      shifts: shifts.map(serializePendingShift),
      loans: pendingLoans,
    });
  } catch (error) {
    console.error("Payroll pending load error", error);
    return NextResponse.json(
      { error: "No fue posible cargar la nómina pendiente." },
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

  const body = await request.json().catch(() => ({}));
  const workerId = Number(body?.workerId);
  const rawShiftIds: unknown[] = Array.isArray(body?.shiftIds)
    ? body.shiftIds
    : [];
  const shiftIds: number[] = [
    ...new Set<number>(
      rawShiftIds.map((value) => Number(value)),
    ),
  ];
  const rawLoanDeductions: unknown[] = Array.isArray(body?.loanDeductions)
    ? body.loanDeductions
    : [];
  const loanDeductionMap = new Map<number, number>();

  for (const value of rawLoanDeductions) {
    if (!value || typeof value !== "object") continue;
    const row = value as { loanId?: unknown; amount?: unknown };
    const loanId = Number(row.loanId);
    const amount = Number(row.amount);
    if (
      Number.isInteger(loanId) &&
      loanId > 0 &&
      Number.isFinite(amount) &&
      amount > 0
    ) {
      loanDeductionMap.set(
        loanId,
        (loanDeductionMap.get(loanId) ?? 0) + Math.round(amount),
      );
    }
  }

  const loanDeductions = [...loanDeductionMap.entries()].map(
    ([loanId, amount]) => ({ loanId, amount }),
  );
  const occurredAt = new Date();
  const note =
    typeof body?.note === "string"
      ? body.note.trim().slice(0, 240) || null
      : null;

  if (!Number.isInteger(workerId) || workerId <= 0) {
    return NextResponse.json(
      { error: "Selecciona el trabajador." },
      { status: 400 },
    );
  }

  if (
    shiftIds.length === 0 ||
    shiftIds.some((id) => !Number.isInteger(id) || id <= 0)
  ) {
    return NextResponse.json(
      { error: "Selecciona al menos un turno pendiente." },
      { status: 400 },
    );
  }

  try {
    await assertCashDateEditable(occurredAt);

    const result = await prisma.$transaction(async (tx) => {
      const worker = await tx.user.findUnique({
        where: { id: workerId },
        select: { id: true, name: true },
      });

      if (!worker) throw new Error("WORKER_NOT_FOUND");

      const shifts = await tx.workShift.findMany({
        where: {
          id: { in: shiftIds },
          userId: workerId,
        },
        include: {
          payrollPaymentItem: {
            select: { id: true },
          },
        },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      });

      if (shifts.length !== shiftIds.length) {
        throw new Error("SHIFT_SELECTION_CHANGED");
      }

      const unavailable = shifts.find(
        (shift) =>
          shift.status === "PAID" ||
          shift.payrollPaymentItem != null ||
          shift.startsAt > occurredAt,
      );

      if (unavailable) {
        throw new Error("SHIFT_SELECTION_CHANGED");
      }

      const grossAmount = shifts.reduce(
        (sum, shift) => sum + Number(shift.amount),
        0,
      );
      const selectedPayrollMonths = new Set(
        shifts.map((shift) => payrollMonthFromDate(shift.startsAt)),
      );

      if (grossAmount <= 0) {
        throw new Error("INVALID_PAYROLL_TOTAL");
      }

      const loanIds = loanDeductions.map((deduction) => deduction.loanId);
      const loans =
        loanIds.length === 0
          ? []
          : await tx.cashLoan.findMany({
              where: {
                id: { in: loanIds },
                historicalPaidWithoutRepayment: false,
                OR: [
                  { workerId },
                  { workerId: null, workerName: worker.name },
                ],
              },
              include: {
                repayments: {
                  select: { amount: true },
                },
              },
            });

      if (loans.length !== loanIds.length) {
        throw new Error("LOAN_SELECTION_CHANGED");
      }

      const validatedLoanDeductions = loanDeductions.map((deduction) => {
        const loan = loans.find((item) => item.id === deduction.loanId);
        if (!loan) throw new Error("LOAN_SELECTION_CHANGED");

        const principal = Number(loan.principal);
        const repaid = loan.repayments.reduce(
          (sum, repayment) => sum + Number(repayment.amount),
          0,
        );
        const outstanding = Math.max(0, principal - repaid);
        const loanPayrollMonth =
          loan.payrollMonth || payrollMonthFromDate(loan.issuedAt);

        if (
          loan.status === "PAID" ||
          outstanding <= 0 ||
          deduction.amount > outstanding ||
          !selectedPayrollMonths.has(loanPayrollMonth)
        ) {
          throw new Error("LOAN_SELECTION_CHANGED");
        }

        return {
          loan,
          amount: deduction.amount,
          outstanding,
        };
      });

      const loanDeduction = validatedLoanDeductions.reduce(
        (sum, deduction) => sum + deduction.amount,
        0,
      );

      if (loanDeduction > grossAmount) {
        throw new Error("LOAN_DEDUCTION_EXCEEDS_PAYROLL");
      }

      const netAmount = Math.max(0, grossAmount - loanDeduction);

      const firstDate = shifts[0].startsAt;
      const lastDate = shifts[shifts.length - 1].startsAt;
      const day = (value: Date) =>
        new Intl.DateTimeFormat("es-CO", {
          timeZone: "America/Bogota",
          day: "numeric",
          month: "short",
        }).format(value);

      const baseNote =
        shifts.length === 1
          ? `Pago de nómina · ${worker.name} · turno ${day(firstDate)}`
          : `Pago de nómina · ${worker.name} · ${shifts.length} turnos · ${day(firstDate)} – ${day(lastDate)}`;
      const automaticNote =
        loanDeduction > 0
          ? `${baseNote} · bruto ${Math.round(grossAmount).toLocaleString("es-CO")} · préstamos -${Math.round(loanDeduction).toLocaleString("es-CO")} · neto ${Math.round(netAmount).toLocaleString("es-CO")}`
          : baseNote;

      const expense = await tx.cashExpense.create({
        data: {
          category: "Nomina",
          subcategory: worker.name,
          note: note || automaticNote,
          amount: Math.round(netAmount),
          occurredAt,
          source: "PAYROLL",
          planningType: "RECURRING",
          createdByName: session.name,
        },
      });

      const payrollPayment = await tx.payrollPayment.create({
        data: {
          workerId: worker.id,
          workerName: worker.name,
          grossAmount,
          loanDeduction,
          netAmount,
          occurredAt,
          note,
          source: "CASH",
          createdById: session.userId,
          createdByName: session.name,
          cashExpenseId: expense.id,
          shifts: {
            create: shifts.map((shift) => ({
              shiftId: shift.id,
              amount: shift.amount,
            })),
          },
        },
      });

      for (const deduction of validatedLoanDeductions) {
        if (deduction.loan.workerId == null) {
          await tx.cashLoan.update({
            where: { id: deduction.loan.id },
            data: { workerId: worker.id },
          });
        }

        await tx.cashLoanRepayment.create({
          data: {
            loanId: deduction.loan.id,
            payrollPaymentId: payrollPayment.id,
            amount: deduction.amount,
            paidAt: occurredAt,
            method: "DESCUENTO_NOMINA",
            note: `Descuento aplicado en pago de nómina #${payrollPayment.id}`,
            source: "PAYROLL",
            createdByName: session.name,
          },
        });

        const remaining = Math.max(
          0,
          deduction.outstanding - deduction.amount,
        );

        if (remaining <= 0) {
          await tx.cashLoan.update({
            where: { id: deduction.loan.id },
            data: { status: "PAID" },
          });
        }
      }

      await tx.workShift.updateMany({
        where: {
          id: { in: shiftIds },
          userId: workerId,
          status: { not: "PAID" },
        },
        data: {
          status: "PAID",
          paidAt: occurredAt,
        },
      });

      await writeAuditLog(tx, {
        actor: staffAuditActor(session),
        action: "PAYROLL_PAID",
        entityType: "PAYROLL_PAYMENT",
        entityId: payrollPayment.id,
        summary: `Nómina de ${worker.name} pagada por ${Math.round(netAmount).toLocaleString("es-CO")} netos.`,
        after: {
          paymentId: payrollPayment.id,
          expenseId: expense.id,
          workerId: worker.id,
          workerName: worker.name,
          shiftCount: shifts.length,
          grossAmount,
          loanDeduction,
          netAmount,
          occurredAt,
        },
        metadata: {
          shiftIds,
          loanDeductions: validatedLoanDeductions.map((deduction) => ({
            loanId: deduction.loan.id,
            amount: deduction.amount,
          })),
        },
        source: "api/caja/payroll",
      });

      return {
        paymentId: payrollPayment.id,
        expenseId: expense.id,
        workerId: worker.id,
        workerName: worker.name,
        shiftCount: shifts.length,
        grossAmount,
        loanDeduction,
        netAmount,
        occurredAt: occurredAt.toISOString(),
        loanDeductions: validatedLoanDeductions.map((deduction) => ({
          loanId: deduction.loan.id,
          note: deduction.loan.note,
          payrollMonth:
            deduction.loan.payrollMonth ||
            payrollMonthFromDate(deduction.loan.issuedAt),
          amount: deduction.amount,
          remaining: Math.max(
            0,
            deduction.outstanding - deduction.amount,
          ),
        })),
        receiptUrl: `/caja/nomina/${payrollPayment.id}/imprimir`,
      };
    });

    return NextResponse.json({ payment: result }, { status: 201 });
  } catch (error) {
    const lockResponse = cashLockResponse(error);
    if (lockResponse) return lockResponse;

    if (error instanceof Error && error.message === "WORKER_NOT_FOUND") {
      return NextResponse.json(
        { error: "El trabajador ya no existe." },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "SHIFT_SELECTION_CHANGED"
    ) {
      return NextResponse.json(
        {
          error:
            "Uno o más turnos ya fueron pagados o cambiaron. Actualiza la nómina pendiente y vuelve a intentarlo.",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "INVALID_PAYROLL_TOTAL"
    ) {
      return NextResponse.json(
        { error: "El total de nómina debe ser mayor a cero." },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "LOAN_SELECTION_CHANGED"
    ) {
      return NextResponse.json(
        {
          error:
            "Uno de los préstamos cambió o ya fue pagado. Actualiza la nómina pendiente y vuelve a intentarlo.",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "LOAN_DEDUCTION_EXCEEDS_PAYROLL"
    ) {
      return NextResponse.json(
        {
          error:
            "Los descuentos por préstamo no pueden superar el valor de los turnos seleccionados.",
        },
        { status: 400 },
      );
    }

    console.error("Payroll payment create error", error);
    return NextResponse.json(
      { error: "No fue posible registrar el pago de nómina." },
      { status: 500 },
    );
  }
}
