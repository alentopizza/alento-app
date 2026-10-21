export const ORDER_KITCHEN_LEAD_MINUTES = 30;
export const ORDER_KITCHEN_LEAD_MS =
  ORDER_KITCHEN_LEAD_MINUTES * 60 * 1000;

export function parseScheduledFor(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("La fecha programada no es válida.");
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("La fecha programada no es válida.");
  }

  return date;
}

export function validateFutureSchedule(
  value: Date | null,
  now = new Date(),
) {
  if (!value) return null;

  if (value.getTime() <= now.getTime()) {
    throw new Error("La hora programada debe estar en el futuro.");
  }

  return value;
}

export function kitchenWindowStartsAt(
  scheduledFor: Date | string,
) {
  const scheduled = new Date(scheduledFor);
  return new Date(scheduled.getTime() - ORDER_KITCHEN_LEAD_MS);
}

export function isInKitchenWindow(
  scheduledFor: Date | string | null | undefined,
  now = new Date(),
) {
  if (!scheduledFor) return true;
  return kitchenWindowStartsAt(scheduledFor).getTime() <= now.getTime();
}

export function scheduleStatusForKitchen(
  hasKitchenPreparation: boolean,
  scheduledFor: Date | null,
  now = new Date(),
) {
  if (!hasKitchenPreparation) return "READY" as const;
  if (scheduledFor && !isInKitchenWindow(scheduledFor, now)) {
    return "CONFIRMED" as const;
  }
  return "PREPARING" as const;
}

export function scheduledTimeLabel(
  value: Date | string,
) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
