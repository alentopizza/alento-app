import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(
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
    return NextResponse.json(
      { error: "Préstamo inválido." },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const amount = Number(body.amount);
    const method = clean(body.method) || "PAGO";
    const note = clean(body.note);
    const paidAt = new Date(clean(body.paidAt));

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "El abono debe ser mayor a cero." },
        { status: 400 },
      );
    }
    if (Number.isNaN(paidAt.getTime())) {
      return NextResponse.json(
        { error: "La fecha del abono no es válida." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const loan = await tx.cashLoan.findUnique({
        where: { id },
        include: {
          repayments: { select: { amount: true } },
        },
      });

      if (!loan) throw new Error("LOAN_NOT_FOUND");
      if (loan.historicalPaidWithoutRepayment || loan.status === "PAID") {
        throw new Error("LOAN_ALREADY_PAID");
      }

      const principal = Number(loan.principal);
      const repaid = loan.repayments.reduce(
        (sum, repayment) => sum + Number(repayment.amount),
        0,
      );
      const outstanding = Math.max(0, principal - repaid);

      if (amount > outstanding) {
        throw new Error("PAYMENT_EXCEEDS_BALANCE");
      }

      const repayment = await tx.cashLoanRepayment.create({
        data: {
          loanId: id,
          amount: Math.round(amount),
          paidAt,
          method,
          note: note || null,
          source: "MANUAL",
          createdByName: session.name,
        },
      });

      const remaining = Math.max(0, outstanding - amount);
      if (remaining <= 0) {
        await tx.cashLoan.update({
          where: { id },
          data: { status: "PAID" },
        });
      }

      return {
        repayment: {
          ...repayment,
          amount: Number(repayment.amount),
        },
        remaining,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "LOAN_NOT_FOUND") {
        return NextResponse.json(
          { error: "El préstamo ya no existe." },
          { status: 404 },
        );
      }
      if (error.message === "LOAN_ALREADY_PAID") {
        return NextResponse.json(
          { error: "Este préstamo ya está pagado." },
          { status: 409 },
        );
      }
      if (error.message === "PAYMENT_EXCEEDS_BALANCE") {
        return NextResponse.json(
          { error: "El abono no puede superar el saldo pendiente." },
          { status: 400 },
        );
      }
    }

    console.error("Cash loan repayment error", error);
    return NextResponse.json(
      { error: "No fue posible registrar el abono." },
      { status: 500 },
    );
  }
}
