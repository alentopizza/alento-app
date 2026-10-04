import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import {
  assertCashDateEditable,
  CASH_DATE_CLOSED_ERROR,
  CASH_MOVEMENT_BEFORE_OPEN_ERROR,
  CASH_SESSION_REQUIRED_ERROR,
  cashDateClosedResponseMessage,
  cashMovementBeforeOpenResponseMessage,
  cashSessionRequiredResponseMessage,
} from "@/lib/cashRegisterLock";

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

    return NextResponse.json({
      workers: [...workers.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "es"),
      ),
      shifts: shifts.map(serializePendingShift),
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
  const occurredAt = new Date(String(body?.occurredAt || ""));
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

  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json(
      { error: "La fecha del pago no es válida." },
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

      if (grossAmount <= 0) {
        throw new Error("INVALID_PAYROLL_TOTAL");
      }

      const firstDate = shifts[0].startsAt;
      const lastDate = shifts[shifts.length - 1].startsAt;
      const day = (value: Date) =>
        new Intl.DateTimeFormat("es-CO", {
          timeZone: "America/Bogota",
          day: "numeric",
          month: "short",
        }).format(value);

      const automaticNote =
        shifts.length === 1
          ? `Pago de nómina · ${worker.name} · turno ${day(firstDate)}`
          : `Pago de nómina · ${worker.name} · ${shifts.length} turnos · ${day(firstDate)} – ${day(lastDate)}`;

      const expense = await tx.cashExpense.create({
        data: {
          category: "Nomina",
          subcategory: worker.name,
          note: note || automaticNote,
          amount: Math.round(grossAmount),
          occurredAt,
          source: "PAYROLL",
          createdByName: session.name,
        },
      });

      const payrollPayment = await tx.payrollPayment.create({
        data: {
          workerId: worker.id,
          workerName: worker.name,
          grossAmount,
          loanDeduction: 0,
          netAmount: grossAmount,
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

      return {
        paymentId: payrollPayment.id,
        expenseId: expense.id,
        workerId: worker.id,
        workerName: worker.name,
        shiftCount: shifts.length,
        grossAmount,
        netAmount: grossAmount,
        occurredAt: occurredAt.toISOString(),
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

    console.error("Payroll payment create error", error);
    return NextResponse.json(
      { error: "No fue posible registrar el pago de nómina." },
      { status: 500 },
    );
  }
}
