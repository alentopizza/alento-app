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
    return NextResponse.json({ error: "Salida inválida." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const planningType =
      typeof body?.planningType === "string"
        ? body.planningType.trim().toUpperCase()
        : "";

    if (!["VARIABLE", "RECURRING", "ONE_TIME"].includes(planningType)) {
      return NextResponse.json(
        { error: "La clasificación del gasto no es válida." },
        { status: 400 },
      );
    }

    const existing = await prisma.cashExpense.findUnique({
      where: { id },
      select: { id: true, source: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "La salida ya no existe." },
        { status: 404 },
      );
    }

    if (existing.source === "PAYROLL") {
      return NextResponse.json(
        {
          error:
            "La nómina se clasifica automáticamente como gasto recurrente.",
        },
        { status: 409 },
      );
    }

    const expense = await prisma.cashExpense.update({
      where: { id },
      data: { planningType },
    });

    return NextResponse.json({
      expense: {
        ...expense,
        amount: Number(expense.amount),
      },
    });
  } catch (error) {
    console.error("Cash expense planning update error", error);
    return NextResponse.json(
      { error: "No fue posible actualizar la clasificación del gasto." },
      { status: 500 },
    );
  }
}

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
    return NextResponse.json({ error: "Salida inválida." }, { status: 400 });
  }

  try {
    const existing = await prisma.cashExpense.findUnique({
      where: { id },
      select: { id: true, occurredAt: true, source: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "La salida ya no existe." },
        { status: 404 },
      );
    }

    await assertCashDateEditable(existing.occurredAt);

    if (existing.source === "PAYROLL") {
      return NextResponse.json(
        {
          error:
            "Este movimiento corresponde a un pago de nómina y está vinculado a turnos pagados. No puede eliminarse como una salida manual.",
        },
        { status: 409 },
      );
    }

    await prisma.cashExpense.delete({ where: { id } });
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

    console.error("Cash expense delete error", error);
    return NextResponse.json(
      { error: "No fue posible eliminar la salida." },
      { status: 500 },
    );
  }
}
