import {
  formatServiceTime,
  normalizeServiceHours,
  SERVICE_DAY_LABELS,
  SERVICE_DAY_ORDER,
  type ServiceDay,
} from "@/lib/storeServiceHours";

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

function bogotaScheduleClock(value: Date | string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const weekdays: Record<string, ServiceDay> = {
    Mon: "MON",
    Tue: "TUE",
    Wed: "WED",
    Thu: "THU",
    Fri: "FRI",
    Sat: "SAT",
    Sun: "SUN",
  };

  return {
    day: weekdays[map.weekday] ?? "MON",
    minute:
      Number(map.hour ?? 0) * 60 + Number(map.minute ?? 0),
  };
}

function serviceMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function scheduledServiceWindow(
  scheduledFor: Date | string,
  serviceHoursInput: unknown,
) {
  const hours = normalizeServiceHours(serviceHoursInput);
  const clock = bogotaScheduleClock(scheduledFor);
  const currentIndex = SERVICE_DAY_ORDER.indexOf(clock.day);
  const current = hours[currentIndex];
  const previous =
    hours[
      (currentIndex - 1 + SERVICE_DAY_ORDER.length) %
        SERVICE_DAY_ORDER.length
    ];

  const currentOpen = serviceMinutes(current.open);
  const currentClose = serviceMinutes(current.close);
  const previousOpen = serviceMinutes(previous.open);
  const previousClose = serviceMinutes(previous.close);

  const insideCurrent =
    current.enabled &&
    currentOpen !== currentClose &&
    (currentClose > currentOpen
      ? clock.minute >= currentOpen &&
        clock.minute < currentClose
      : clock.minute >= currentOpen);

  const insidePreviousOvernight =
    previous.enabled &&
    previousOpen !== previousClose &&
    previousClose < previousOpen &&
    clock.minute < previousClose;

  if (insideCurrent) {
    return {
      valid: true as const,
      schedule: current,
      day: current.day,
      dayLabel: SERVICE_DAY_LABELS[current.day],
    };
  }

  if (insidePreviousOvernight) {
    return {
      valid: true as const,
      schedule: previous,
      day: previous.day,
      dayLabel: SERVICE_DAY_LABELS[previous.day],
    };
  }

  return {
    valid: false as const,
    schedule: current,
    day: current.day,
    dayLabel: SERVICE_DAY_LABELS[current.day],
  };
}

export function validateScheduledServiceHours(
  scheduledFor: Date | null,
  serviceHoursInput: unknown,
) {
  if (!scheduledFor) return null;

  const result = scheduledServiceWindow(
    scheduledFor,
    serviceHoursInput,
  );

  if (result.valid) return scheduledFor;

  if (
    !result.schedule.enabled ||
    result.schedule.open === result.schedule.close
  ) {
    throw new Error(
      `No se reciben pedidos programados el ${result.dayLabel.toLowerCase()} porque el servicio está cerrado.`,
    );
  }

  throw new Error(
    `El ${result.dayLabel.toLowerCase()} solo puedes programar pedidos entre ${formatServiceTime(
      result.schedule.open,
    )} y ${formatServiceTime(result.schedule.close)}.`,
  );
}
