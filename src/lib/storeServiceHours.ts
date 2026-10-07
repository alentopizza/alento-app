export type ServiceDay = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export type ServiceHour = {
  day: ServiceDay;
  enabled: boolean;
  open: string;
  close: string;
};

export const SERVICE_DAY_ORDER: ServiceDay[] = ["MON","TUE","WED","THU","FRI","SAT","SUN"];

export const SERVICE_DAY_LABELS: Record<ServiceDay, string> = {
  MON: "Lunes",
  TUE: "Martes",
  WED: "Miércoles",
  THU: "Jueves",
  FRI: "Viernes",
  SAT: "Sábado",
  SUN: "Domingo",
};

export const DEFAULT_SERVICE_HOURS: ServiceHour[] = SERVICE_DAY_ORDER.map((day) => ({
  day,
  enabled: true,
  open: "14:00",
  close: "22:00",
}));

function isValidTime(value: unknown) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function normalizeServiceHours(value: unknown): ServiceHour[] {
  const raw = Array.isArray(value) ? value : [];
  return SERVICE_DAY_ORDER.map((day) => {
    const fallback = DEFAULT_SERVICE_HOURS.find((item) => item.day === day)!;
    const saved = raw.find(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        (item as { day?: unknown }).day === day,
    );

    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      return { ...fallback };
    }

    const record = saved as Record<string, unknown>;
    return {
      day,
      enabled: record.enabled !== false,
      open: isValidTime(record.open) ? String(record.open) : fallback.open,
      close: isValidTime(record.close) ? String(record.close) : fallback.close,
    };
  });
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function currentBogotaClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
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
    minute: Number(map.hour ?? 0) * 60 + Number(map.minute ?? 0),
  };
}

export function formatServiceTime(value: string) {
  const [hourValue, minuteValue] = value.split(":").map(Number);
  const suffix = hourValue >= 12 ? "p. m." : "a. m.";
  const hour = hourValue % 12 || 12;
  return hour + ":" + String(minuteValue).padStart(2, "0") + " " + suffix;
}

export function formatServiceRange(schedule: ServiceHour) {
  if (!schedule.enabled) return "Cerrado";
  return formatServiceTime(schedule.open) + " – " + formatServiceTime(schedule.close);
}

export function getStoreServiceStatus(hoursInput: unknown, now = new Date()) {
  const hours = normalizeServiceHours(hoursInput);
  const clock = currentBogotaClock(now);
  const currentIndex = SERVICE_DAY_ORDER.indexOf(clock.day);
  const current = hours[currentIndex];
  const previous = hours[(currentIndex - 1 + SERVICE_DAY_ORDER.length) % SERVICE_DAY_ORDER.length];

  const currentOpen = toMinutes(current.open);
  const currentClose = toMinutes(current.close);
  const previousOpen = toMinutes(previous.open);
  const previousClose = toMinutes(previous.close);

  const openFromCurrent =
    current.enabled &&
    currentOpen !== currentClose &&
    (currentClose > currentOpen
      ? clock.minute >= currentOpen && clock.minute < currentClose
      : clock.minute >= currentOpen);

  const openFromPrevious =
    previous.enabled &&
    previousOpen !== previousClose &&
    previousClose < previousOpen &&
    clock.minute < previousClose;

  const open = openFromCurrent || openFromPrevious;
  let nextOpening: null | {
    day: ServiceDay;
    dayLabel: string;
    relativeLabel: string;
    time: string;
  } = null;

  if (!open) {
    for (let delta = 0; delta < 8; delta += 1) {
      const index = (currentIndex + delta) % SERVICE_DAY_ORDER.length;
      const schedule = hours[index];
      if (!schedule.enabled || schedule.open === schedule.close) continue;
      if (delta === 0 && clock.minute >= toMinutes(schedule.open)) continue;

      nextOpening = {
        day: schedule.day,
        dayLabel: SERVICE_DAY_LABELS[schedule.day],
        relativeLabel:
          delta === 0
            ? "Hoy"
            : delta === 1
              ? "Mañana"
              : SERVICE_DAY_LABELS[schedule.day],
        time: schedule.open,
      };
      break;
    }
  }

  return {
    open,
    currentDay: current.day,
    currentDayLabel: SERVICE_DAY_LABELS[current.day],
    closesAt: openFromPrevious ? previous.close : openFromCurrent ? current.close : null,
    nextOpening,
    hours,
  };
}
