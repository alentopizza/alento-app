import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import {
  DEFAULT_TRACKING_SETTINGS,
  TRACKING_SETTINGS_KEY,
  normalizeTrackingSettings,
  trackingSettingsAsJson,
} from "@/lib/trackingSettings";

async function requireAdmin() {
  await requireStaffSession(["ADMIN"]);
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const row = await prisma.appSetting.findUnique({
    where: { key: TRACKING_SETTINGS_KEY },
  });

  return NextResponse.json({
    settings: row
      ? normalizeTrackingSettings(row.value)
      : DEFAULT_TRACKING_SETTINGS,
  });
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const settings = normalizeTrackingSettings(body?.settings ?? body);

  await prisma.appSetting.upsert({
    where: { key: TRACKING_SETTINGS_KEY },
    create: {
      key: TRACKING_SETTINGS_KEY,
      value: trackingSettingsAsJson(settings),
    },
    update: {
      value: trackingSettingsAsJson(settings),
    },
  });

  return NextResponse.json({ settings });
}
