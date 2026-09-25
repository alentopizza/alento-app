import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import {
  assertCashDateEditable,
  CASH_DATE_CLOSED_ERROR,
  cashDateClosedResponseMessage,
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

    const income = await prisma.cashIncome.create({
      data: {
        category,
        note: note || null,
        amount: Math.round(amount),
        occurredAt,
        source: "MANUAL",
        createdByName: session.name,
      },
    });

    return NextResponse.json({
      income: {
        ...income,
        amount: Number(income.amount),
      },
    });
  } catch (error) {
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
