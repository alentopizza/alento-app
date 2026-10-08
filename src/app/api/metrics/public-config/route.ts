import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_TRACKING_SETTINGS,
  TRACKING_SETTINGS_KEY,
  hasExternalTracking,
  normalizeTrackingSettings,
} from "@/lib/trackingSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  const row = await prisma.appSetting.findUnique({
    where: { key: TRACKING_SETTINGS_KEY },
  });
  const settings = row
    ? normalizeTrackingSettings(row.value)
    : DEFAULT_TRACKING_SETTINGS;

  return NextResponse.json({
    settings: {
      ...settings,
      hasExternalTracking: hasExternalTracking(settings),
    },
  });
}
