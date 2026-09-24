import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

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
    const subcategory = clean(body.subcategory);
    const note = clean(body.note);
    const amount = Number(body.amount);
    const occurredAt = new Date(clean(body.occurredAt));

    if (!category) {
      return NextResponse.json(
        { error: "Selecciona el tipo de salida." },
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
        { error: "La fecha de la salida no es válida." },
        { status: 400 },
      );
    }

    const expense = await prisma.cashExpense.create({
      data: {
        category,
        subcategory: subcategory || null,
        note: note || null,
        amount: Math.round(amount),
        occurredAt,
        source: "MANUAL",
        createdByName: session.name,
      },
    });

    return NextResponse.json({
      expense: {
        ...expense,
        amount: Number(expense.amount),
      },
    });
  } catch (error) {
    console.error("Cash expense create error", error);
    return NextResponse.json(
      { error: "No fue posible registrar la salida." },
      { status: 500 },
    );
  }
}
