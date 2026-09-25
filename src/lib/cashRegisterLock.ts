import { prisma } from "@/lib/prisma";

export function cashBusinessDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const map = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${map.year}-${map.month}-${map.day}`;
}

export async function isCashDateClosed(value: Date) {
  const businessDate = cashBusinessDate(value);
  const session = await prisma.cashRegisterSession.findUnique({
    where: { businessDate },
    select: { status: true },
  });

  return session?.status === "CLOSED";
}

export const CASH_DATE_CLOSED_ERROR = "CASH_DATE_CLOSED";

export async function assertCashDateEditable(value: Date) {
  if (await isCashDateClosed(value)) {
    throw new Error(CASH_DATE_CLOSED_ERROR);
  }
}

export function cashDateClosedResponseMessage() {
  return "La caja de esta fecha ya está cerrada. El cierre quedó bloqueado y no admite nuevos movimientos.";
}
