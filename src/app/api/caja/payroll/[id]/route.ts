import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

export async function GET(
  _request: Request,
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
      { error: "Pago de nómina inválido." },
      { status: 400 },
    );
  }

  try {
    const payment = await prisma.payrollPayment.findUnique({
      where: { id },
      include: {
        shifts: {
          include: {
            shift: {
              select: {
                id: true,
                startsAt: true,
                endsAt: true,
                amount: true,
                notes: true,
              },
            },
          },
        },
        loanRepayments: {
          include: {
            loan: {
              select: {
                id: true,
                principal: true,
                note: true,
                issuedAt: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "El pago de nómina no existe." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      payment: {
        id: payment.id,
        workerId: payment.workerId,
        workerName: payment.workerName,
        grossAmount: Number(payment.grossAmount),
        loanDeduction: Number(payment.loanDeduction),
        netAmount: Number(payment.netAmount),
        occurredAt: payment.occurredAt.toISOString(),
        note: payment.note,
        createdByName: payment.createdByName,
        cashExpenseId: payment.cashExpenseId,
        shifts: payment.shifts
          .map((item) => ({
            id: item.shift.id,
            startsAt: item.shift.startsAt.toISOString(),
            endsAt: item.shift.endsAt.toISOString(),
            amount: Number(item.amount),
            notes: item.shift.notes,
          }))
          .sort(
            (a, b) =>
              new Date(a.startsAt).getTime() -
              new Date(b.startsAt).getTime(),
          ),
        loanDeductions: payment.loanRepayments
          .map((repayment) => ({
            id: repayment.id,
            loanId: repayment.loanId,
            amount: Number(repayment.amount),
            paidAt: repayment.paidAt.toISOString(),
            method: repayment.method,
            loanPrincipal: Number(repayment.loan.principal),
            loanNote: repayment.loan.note,
            loanIssuedAt: repayment.loan.issuedAt.toISOString(),
          }))
          .sort((a, b) => a.loanId - b.loanId),
      },
    });
  } catch (error) {
    console.error("Payroll payment detail error", error);
    return NextResponse.json(
      { error: "No fue posible cargar el comprobante de nómina." },
      { status: 500 },
    );
  }
}
