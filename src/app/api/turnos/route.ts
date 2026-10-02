import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

function monthRange(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new Error("Mes inválido.");
  }

  const [year, month] = value.split("-").map(Number);
  if (month < 1 || month > 12) throw new Error("Mes inválido.");

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    start: new Date(
      `${year}-${String(month).padStart(2, "0")}-01T00:00:00-05:00`,
    ),
    end: new Date(
      `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00-05:00`,
    ),
  };
}

function serializeShift(shift: {
  id: number;
  startsAt: Date;
  endsAt: Date;
  amount: { toString(): string };
  status: string;
  paidAt: Date | null;
  notes: string | null;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: number;
    name: string;
    email: string;
    active: boolean;
  };
}) {
  return {
    ...shift,
    amount: Number(shift.amount),
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireStaffSession(["ADMIN"]);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "FORBIDDEN"
            ? "Sin permisos."
            : "No autorizado.",
      },
      {
        status:
          error instanceof Error && error.message === "FORBIDDEN"
            ? 403
            : 401,
      },
    );
  }

  try {
    const month =
      request.nextUrl.searchParams.get("month") ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
      })
        .format(new Date())
        .slice(0, 7);

    const { start, end } = monthRange(month);

    const [shifts, users, loans] = await Promise.all([
      prisma.workShift.findMany({
        where: {
          startsAt: {
            gte: start,
            lt: end,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              active: true,
            },
          },
        },
        orderBy: [{ startsAt: "asc" }, { userId: "asc" }],
      }),
      prisma.user.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          roles: true,
        },
      }),
      prisma.cashLoan.findMany({
        where: {
          workerId: { not: null },
          historicalPaidWithoutRepayment: false,
          issuedAt: {
            gte: start,
            lt: end,
          },
        },
        select: {
          workerId: true,
          principal: true,
          repayments: {
            select: {
              amount: true,
              paidAt: true,
            },
          },
        },
      }),
    ]);

    const serialized = shifts.map(serializeShift);
    const total = serialized.reduce((sum, shift) => sum + shift.amount, 0);
    const paid = serialized
      .filter((shift) => shift.status === "PAID")
      .reduce((sum, shift) => sum + shift.amount, 0);
    const pending = serialized
      .filter((shift) => shift.status !== "PAID")
      .reduce((sum, shift) => sum + shift.amount, 0);

    const loanBalances = loans.reduce<Record<number, number>>((map, loan) => {
      if (loan.workerId == null) return map;

      const principal = Number(loan.principal);
      const repaid = loan.repayments.reduce(
        (sum, repayment) => sum + Number(repayment.amount),
        0,
      );
      const outstanding = Math.max(0, principal - repaid);

      map[loan.workerId] = (map[loan.workerId] ?? 0) + outstanding;
      return map;
    }, {});

    return NextResponse.json({
      month,
      shifts: serialized,
      users,
      loanBalances,
      summary: {
        shifts: serialized.length,
        total,
        paid,
        pending,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible cargar los turnos.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireStaffSession(["ADMIN"]);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "FORBIDDEN"
            ? "Sin permisos."
            : "No autorizado.",
      },
      {
        status:
          error instanceof Error && error.message === "FORBIDDEN"
            ? 403
            : 401,
      },
    );
  }

  const body = await request.json().catch(() => ({}));
  const userId = Number(body?.userId);
  const startsAt = new Date(String(body?.startsAt || ""));
  const endsAt = new Date(String(body?.endsAt || ""));
  const amount = Math.round(Number(body?.amount ?? 0));
  const notes =
    typeof body?.notes === "string"
      ? body.notes.trim().slice(0, 240) || null
      : null;

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    return NextResponse.json(
      { error: "Completa trabajador, entrada, salida y valor correctamente." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, active: true },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "El trabajador seleccionado no está activo." },
      { status: 409 },
    );
  }

  const overlap = await prisma.workShift.findFirst({
    where: {
      userId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });

  if (overlap) {
    return NextResponse.json(
      { error: "Ese trabajador ya tiene un turno que se cruza con este horario." },
      { status: 409 },
    );
  }

  const shift = await prisma.workShift.create({
    data: {
      userId,
      startsAt,
      endsAt,
      amount,
      notes,
      status: "PENDING",
      createdById: session.userId,
      createdByName: session.name,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
        },
      },
    },
  });

  return NextResponse.json(
    { shift: serializeShift(shift) },
    { status: 201 },
  );
}
