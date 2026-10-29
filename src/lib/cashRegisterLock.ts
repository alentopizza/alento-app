import { prisma } from "@/lib/prisma";

export const CASH_DATE_CLOSED_ERROR = "CASH_DATE_CLOSED";
export const CASH_SESSION_REQUIRED_ERROR = "CASH_SESSION_REQUIRED";
export const CASH_MOVEMENT_BEFORE_OPEN_ERROR =
  "CASH_MOVEMENT_BEFORE_OPEN";

export async function assertCashDateEditable(value: Date) {
  const closedSession = await prisma.cashRegisterSession.findFirst({
    where: {
      status: "CLOSED",
      openedAt: { lte: value },
      closedAt: { gt: value },
    },
    select: { id: true },
  });

  if (closedSession) {
    throw new Error(CASH_DATE_CLOSED_ERROR);
  }

  const openSession = await prisma.cashRegisterSession.findFirst({
    where: { status: "OPEN" },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      businessDate: true,
      openedAt: true,
    },
  });

  if (!openSession) {
    throw new Error(CASH_SESSION_REQUIRED_ERROR);
  }

  if (value < openSession.openedAt) {
    throw new Error(CASH_MOVEMENT_BEFORE_OPEN_ERROR);
  }

  return openSession;
}

export function cashDateClosedResponseMessage() {
  return "Este movimiento pertenece a una sesión de caja que ya fue cerrada. El cierre está bloqueado y no admite cambios.";
}

export function cashSessionRequiredResponseMessage() {
  return "Primero abre la caja. Todo movimiento operativo debe quedar entre una apertura y su cierre.";
}

export function cashMovementBeforeOpenResponseMessage() {
  return "La fecha u hora del movimiento es anterior a la apertura actual. Ajusta el momento del movimiento o consulta el historial de caja.";
}
