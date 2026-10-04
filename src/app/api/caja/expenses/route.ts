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
    const driverId =
      body.driverId == null || body.driverId === ""
        ? null
        : Number(body.driverId);
    const occurredAt = new Date(clean(body.occurredAt));

    if (!category) {
      return NextResponse.json(
        { error: "Selecciona el tipo de salida." },
        { status: 400 },
      );
    }

    if (category === "Nomina") {
      return NextResponse.json(
        {
          error:
            "La nómina debe pagarse desde el flujo de Nómina para vincular la salida con los turnos seleccionados.",
        },
        { status: 409 },
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

    await assertCashDateEditable(occurredAt);

    if (
      category === "Domicilios" &&
      (!Number.isInteger(driverId) || Number(driverId) <= 0)
    ) {
      return NextResponse.json(
        { error: "Selecciona el repartidor al que vas a realizar el pago." },
        { status: 400 },
      );
    }

    const expense = await prisma.$transaction(async (tx) => {
      if (category !== "Domicilios") {
        return tx.cashExpense.create({
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
      }

      const driver = await tx.user.findFirst({
        where: {
          id: driverId!,
          active: true,
          roles: { hasSome: ["DRIVER", "DISPATCH"] },
        },
        select: { id: true, name: true },
      });

      if (!driver) {
        throw new Error("DRIVER_NOT_FOUND");
      }

      const [earnings, payouts] = await Promise.all([
        tx.order.aggregate({
          where: {
            driverId: driver.id,
            fulfillmentType: "DELIVERY",
            driverEarningCreditedAt: { not: null },
          },
          _sum: { driverEarningAmount: true },
        }),
        tx.cashExpense.aggregate({
          where: { driverId: driver.id },
          _sum: { amount: true },
        }),
      ]);

      const earnedTotal = Number(
        earnings._sum.driverEarningAmount ?? 0,
      );
      const paidTotal = Number(payouts._sum.amount ?? 0);
      const available = Math.max(0, earnedTotal - paidTotal);
      const roundedAmount = Math.round(amount);

      if (roundedAmount > available) {
        throw new Error(`DRIVER_BALANCE:${available}`);
      }

      return tx.cashExpense.create({
        data: {
          driverId: driver.id,
          category: "Domicilios",
          subcategory: driver.name,
          note: note || `Pago de cartera a ${driver.name}`,
          amount: roundedAmount,
          occurredAt,
          source: "DRIVER_PAYMENT",
          createdByName: session.name,
        },
      });
    });

    return NextResponse.json({
      expense: {
        ...expense,
        amount: Number(expense.amount),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DRIVER_NOT_FOUND") {
      return NextResponse.json(
        { error: "El repartidor seleccionado ya no está disponible." },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message.startsWith("DRIVER_BALANCE:")
    ) {
      const available = Number(error.message.split(":")[1] || 0);
      return NextResponse.json(
        {
          error: `El pago supera el saldo disponible del repartidor. Saldo actual: ${Math.round(
            available,
          ).toLocaleString("es-CO")}.`,
          available,
        },
        { status: 409 },
      );
    }

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

    console.error("Cash expense create error", error);
    return NextResponse.json(
      { error: "No fue posible registrar la salida." },
      { status: 500 },
    );
  }
}
