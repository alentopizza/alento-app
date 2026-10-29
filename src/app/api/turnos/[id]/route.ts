import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

async function auth() {
  try {
    await requireStaffSession(["ADMIN"]);
    return null;
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
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await auth();
  if (unauthorized) return unauthorized;

  const { id: rawId } = await context.params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Turno inválido." }, { status: 400 });
  }

  const existing = await prisma.workShift.findUnique({
    where: { id },
    include: {
      payrollPaymentItem: {
        select: {
          id: true,
          payrollPaymentId: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Turno no encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  if (body?.action === "toggle-payment") {
    const nextPaid = existing.status !== "PAID";

    if (nextPaid) {
      return NextResponse.json(
        {
          error:
            "Los turnos pendientes se pagan desde Caja → Salidas → Nómina para conservar el movimiento contable.",
        },
        { status: 409 },
      );
    }

    if (existing.payrollPaymentItem) {
      return NextResponse.json(
        {
          error:
            "Este turno pertenece a un pago de nómina registrado en Caja y no puede volver a pendiente desde Turnos.",
        },
        { status: 409 },
      );
    }

    const updated = await prisma.workShift.update({
      where: { id },
      data: {
        status: "PENDING",
        paidAt: null,
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

    return NextResponse.json({
      shift: {
        ...updated,
        amount: Number(updated.amount),
      },
    });
  }

  if (existing.payrollPaymentItem) {
    return NextResponse.json(
      {
        error:
          "Este turno ya hace parte de un pago de nómina registrado en Caja y quedó bloqueado para proteger el historial.",
      },
      { status: 409 },
    );
  }

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
      id: { not: id },
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

  const updated = await prisma.workShift.update({
    where: { id },
    data: {
      userId,
      startsAt,
      endsAt,
      amount,
      notes,
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

  return NextResponse.json({
    shift: {
      ...updated,
      amount: Number(updated.amount),
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await auth();
  if (unauthorized) return unauthorized;

  const { id: rawId } = await context.params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Turno inválido." }, { status: 400 });
  }

  const existing = await prisma.workShift.findUnique({
    where: { id },
    include: {
      payrollPaymentItem: {
        select: { id: true },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ ok: true });
  }

  if (existing.payrollPaymentItem) {
    return NextResponse.json(
      {
        error:
          "Este turno pertenece a un pago de nómina registrado en Caja y no puede eliminarse.",
      },
      { status: 409 },
    );
  }

  await prisma.workShift.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
