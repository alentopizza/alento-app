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

export async function PATCH(
  request: NextRequest,
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
      select: {
        id: true,
        source: true,
        category: true,
        subcategory: true,
        amount: true,
        occurredAt: true,
        planningType: true,
      },
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

    const expense = await prisma.$transaction(async (tx) => {
      const updated = await tx.cashExpense.update({
        where: { id },
        data: { planningType },
      });

      await writeAuditLog(tx, {
        actor: staffAuditActor(session),
        action: "CASH_EXPENSE_UPDATED",
        entityType: "CASH_EXPENSE",
        entityId: updated.id,
        summary: `Clasificación de salida #${updated.id} actualizada a ${planningType}.`,
        before: {
          planningType: existing.planningType,
          category: existing.category,
          subcategory: existing.subcategory,
          amount: Number(existing.amount),
        },
        after: {
          planningType: updated.planningType,
          category: updated.category,
          subcategory: updated.subcategory,
          amount: Number(updated.amount),
        },
        source: "api/caja/expenses/[id]",
      });

      return updated;
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
    return NextResponse.json({ error: "Salida inválida." }, { status: 400 });
  }

  try {
    const existing = await prisma.cashExpense.findUnique({
      where: { id },
      select: {
        id: true,
        driverId: true,
        category: true,
        subcategory: true,
        note: true,
        amount: true,
        occurredAt: true,
        source: true,
        planningType: true,
        createdByName: true,
        payrollPayment: {
          select: {
            id: true,
            shifts: {
              select: { shiftId: true },
            },
            loanRepayments: {
              select: { loanId: true },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "La salida ya no existe." },
        { status: 404 },
      );
    }

    await assertCashDateEditable(existing.occurredAt);

    if (existing.source === "PAYROLL" && existing.payrollPayment) {
      const payrollPaymentId = existing.payrollPayment.id;
      const shiftIds = existing.payrollPayment.shifts.map(
        (item) => item.shiftId,
      );
      const affectedLoanIds = [
        ...new Set(
          existing.payrollPayment.loanRepayments.map(
            (item) => item.loanId,
          ),
        ),
      ];

      await prisma.$transaction(async (tx) => {
        if (shiftIds.length > 0) {
          await tx.workShift.updateMany({
            where: { id: { in: shiftIds } },
            data: {
              status: "PENDING",
              paidAt: null,
            },
          });
        }

        await tx.cashLoanRepayment.deleteMany({
          where: { payrollPaymentId },
        });

        await tx.payrollPayment.delete({
          where: { id: payrollPaymentId },
        });

        await tx.cashExpense.delete({ where: { id } });

        for (const loanId of affectedLoanIds) {
          const loan = await tx.cashLoan.findUnique({
            where: { id: loanId },
            select: {
              principal: true,
              repayments: {
                select: { amount: true },
              },
            },
          });

          if (!loan) continue;

          const repaid = loan.repayments.reduce(
            (sum, repayment) => sum + Number(repayment.amount),
            0,
          );
          const principal = Number(loan.principal);

          await tx.cashLoan.update({
            where: { id: loanId },
            data: {
              status: repaid >= principal ? "PAID" : "OPEN",
            },
          });
        }

        await writeAuditLog(tx, {
          actor: staffAuditActor(session),
          action: "PAYROLL_REVERSED",
          entityType: "CASH_EXPENSE",
          entityId: existing.id,
          summary: `Pago de nómina #${payrollPaymentId} revertido desde Caja.`,
          before: {
            expenseId: existing.id,
            payrollPaymentId,
            category: existing.category,
            subcategory: existing.subcategory,
            amount: Number(existing.amount),
            occurredAt: existing.occurredAt,
            source: existing.source,
          },
          metadata: {
            shiftIds,
            affectedLoanIds,
          },
          source: "api/caja/expenses/[id]",
        });
      });

      return NextResponse.json({
        ok: true,
        payrollReversed: true,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.cashExpense.delete({ where: { id } });
      await writeAuditLog(tx, {
        actor: staffAuditActor(session),
        action: "CASH_EXPENSE_DELETED",
        entityType: "CASH_EXPENSE",
        entityId: existing.id,
        summary: `Salida de caja por ${Math.round(Number(existing.amount)).toLocaleString("es-CO")} eliminada.`,
        before: {
          id: existing.id,
          driverId: existing.driverId,
          category: existing.category,
          subcategory: existing.subcategory,
          amount: Number(existing.amount),
          occurredAt: existing.occurredAt,
          source: existing.source,
          planningType: existing.planningType,
          createdByName: existing.createdByName,
        },
        source: "api/caja/expenses/[id]",
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

    console.error("Cash expense delete error", error);
    return NextResponse.json(
      { error: "No fue posible eliminar la salida." },
      { status: 500 },
    );
  }
}
