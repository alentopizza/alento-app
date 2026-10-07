import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  formatServiceRange,
  formatServiceTime,
  getStoreServiceStatus,
  normalizeServiceHours,
  SERVICE_DAY_LABELS,
} from "@/lib/storeServiceHours";

const SETTINGS_KEY = "pos_settings";

export async function GET() {
  try {
    const saved = await prisma.appSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });

    const raw =
      saved?.value &&
      typeof saved.value === "object" &&
      !Array.isArray(saved.value)
        ? (saved.value as Record<string, unknown>)
        : {};

    const store =
      raw.store && typeof raw.store === "object" && !Array.isArray(raw.store)
        ? (raw.store as Record<string, unknown>)
        : {};

    const hours = normalizeServiceHours(store.serviceHours);
    const status = getStoreServiceStatus(hours);

    const response = NextResponse.json({
      open: status.open,
      currentDay: status.currentDay,
      currentDayLabel: status.currentDayLabel,
      closesAt: status.closesAt
        ? formatServiceTime(status.closesAt)
        : null,
      nextOpening: status.nextOpening
        ? {
            ...status.nextOpening,
            timeLabel: formatServiceTime(status.nextOpening.time),
          }
        : null,
      hours: hours.map((schedule) => ({
        ...schedule,
        dayLabel: SERVICE_DAY_LABELS[schedule.day],
        rangeLabel: formatServiceRange(schedule),
      })),
    });

    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Public store status error", error);
    return NextResponse.json(
      { error: "No fue posible consultar el horario de servicio." },
      { status: 500 },
    );
  }
}
