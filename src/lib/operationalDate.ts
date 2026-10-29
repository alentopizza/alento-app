export const OPERATIONAL_TIME_ZONE = "America/Bogota";

export function operationalDateKey(value: Date | string | number = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("No fue posible determinar la fecha operativa.");
  }

  return `${year}-${month}-${day}`;
}

export function isCurrentOperationalDay(
  value: Date | string | number,
  now: Date | string | number = new Date(),
) {
  return operationalDateKey(value) === operationalDateKey(now);
}
