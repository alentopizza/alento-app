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

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id: rawId } = await context.params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ingreso inválido." }, { status: 400 });
  }

  try {
    const existing = await prisma.cashIncome.findUnique({
      where: { id },
      select: {
        id: true,
        category: true,
        note: true,
        amount: true,
        occurredAt: true,
        source: true,
        createdByName: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "El ingreso ya no existe." },
        { status: 404 },
      );
    }

    await assertCashDateEditable(existing.occurredAt);

    await prisma.$transaction(async (tx) => {
      await tx.cashIncome.delete({ where: { id } });
      await writeAuditLog(tx, {
        actor: staffAuditActor(session),
        action: "CASH_INCOME_DELETED",
        entityType: "CASH_INCOME",
        entityId: existing.id,
        summary: `Ingreso de caja por ${Math.round(Number(existing.amount)).toLocaleString("es-CO")} eliminado.`,
        before: {
          id: existing.id,
          category: existing.category,
          amount: Number(existing.amount),
          occurredAt: existing.occurredAt,
          source: existing.source,
          createdByName: existing.createdByName,
        },
        source: "api/caja/incomes/[id]",
      });
    });
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

    console.error("Cash income delete error", error);
    return NextResponse.json(
      { error: "No fue posible eliminar el ingreso." },
      { status: 500 },
    );
  }
}
