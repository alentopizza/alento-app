export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffSession(["ADMIN", "CASHIER"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "Préstamo inválido." },
      { status: 400 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const workerId = Number(body?.workerId);
    const note =
      typeof body?.note === "string"
        ? body.note.trim().slice(0, 240) || null
        : undefined;

    if (!Number.isInteger(workerId) || workerId <= 0) {
      return NextResponse.json(
        { error: "Selecciona un trabajador." },
        { status: 400 },
      );
    }

    const [loan, worker] = await Promise.all([
      prisma.cashLoan.findUnique({ where: { id } }),
      prisma.user.findFirst({
        where: { id: workerId, active: true },
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
        },
      }),
    ]);

    if (!loan) {
      return NextResponse.json(
        { error: "El préstamo ya no existe." },
        { status: 404 },
      );
    }

    if (!worker) {
      return NextResponse.json(
        { error: "El trabajador seleccionado no está activo." },
        { status: 409 },
      );
    }

    const updated = await prisma.cashLoan.update({
      where: { id },
      data: {
        workerId: worker.id,
        workerName: worker.name,
        ...(note !== undefined ? { note } : {}),
      },
    });

    return NextResponse.json({
      loan: {
        ...updated,
        principal: Number(updated.principal),
        worker,
      },
    });
  } catch (error) {
    console.error("Cash loan update error", error);
    return NextResponse.json(
      { error: "No fue posible actualizar el préstamo." },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import {
  assertCashDateEditable,
  CASH_DATE_CLOSED_ERROR,
  CASH_SESSION_REQUIRED_ERROR,
  CASH_MOVEMENT_BEFORE_OPEN_ERROR,
  cashDateClosedResponseMessage,
  cashSessionRequiredResponseMessage,
  cashMovementBeforeOpenResponseMessage,
} from "@/lib/cashRegisterLock";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffSession(["ADMIN", "CASHIER"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "Préstamo inválido." },
      { status: 400 },
    );
  }

  try {
    const loan = await prisma.cashLoan.findUnique({
      where: { id },
      include: { repayments: { select: { id: true } } },
    });

    if (!loan) {
      return NextResponse.json(
        { error: "El préstamo ya no existe." },
        { status: 404 },
      );
    }

    await assertCashDateEditable(loan.issuedAt);

    if (loan.repayments.length > 0) {
      return NextResponse.json(
        {
          error:
            "Este préstamo ya tiene abonos. Conserva la trazabilidad en lugar de eliminarlo.",
        },
        { status: 409 },
      );
    }

    await prisma.cashLoan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
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

    console.error("Cash loan delete error", error);
    return NextResponse.json(
      { error: "No fue posible eliminar el préstamo." },
      { status: 500 },
    );
  }
}
