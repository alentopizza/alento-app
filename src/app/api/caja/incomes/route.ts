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
    const category = clean(body.category);
    const note = clean(body.note);
    const amount = Number(body.amount);
    const occurredAt = new Date(clean(body.occurredAt));

    if (!category) {
      return NextResponse.json(
        { error: "Selecciona el tipo de ingreso." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "El monto debe ser mayor a cero." },
        { status: 400 },
      );
    }

    if (Number.isNaN(occurredAt.getTime())) {
      return NextResponse.json(
        { error: "La fecha del ingreso no es válida." },
        { status: 400 },
      );
    }

    await assertCashDateEditable(occurredAt);

    const income = await prisma.$transaction(async (tx) => {
      const created = await tx.cashIncome.create({
        data: {
          category,
          note: note || null,
          amount: Math.round(amount),
          occurredAt,
          source: "MANUAL",
          createdByName: session.name,
        },
      });

      await writeAuditLog(tx, {
        actor: staffAuditActor(session),
        action: "CASH_INCOME_CREATED",
        entityType: "CASH_INCOME",
        entityId: created.id,
        summary: `Ingreso de caja por ${Math.round(amount).toLocaleString("es-CO")} registrado en ${category}.`,
        after: {
          id: created.id,
          category: created.category,
          amount: Number(created.amount),
          occurredAt: created.occurredAt,
          source: created.source,
        },
        source: "api/caja/incomes",
      });

      return created;
    });

    return NextResponse.json({
      income: {
        ...income,
        amount: Number(income.amount),
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

    console.error("Cash income create error", error);
    return NextResponse.json(
      { error: "No fue posible registrar el ingreso." },
      { status: 500 },
    );
  }
}
