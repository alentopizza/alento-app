import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { staffAuditActor, writeAuditLog } from "@/lib/auditLog";
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
  let session;
  try {
    session = await requireStaffSession(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const settings = normalizeTrackingSettings(body?.settings ?? body);

  const previous = await prisma.appSetting.findUnique({
    where: { key: TRACKING_SETTINGS_KEY },
  });

  await prisma.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: TRACKING_SETTINGS_KEY },
      create: {
        key: TRACKING_SETTINGS_KEY,
        value: trackingSettingsAsJson(settings),
      },
      update: {
        value: trackingSettingsAsJson(settings),
      },
    });

    await writeAuditLog(tx, {
      actor: staffAuditActor(session),
      action: "TRACKING_SETTINGS_UPDATED",
      entityType: "APP_SETTING",
      entityId: TRACKING_SETTINGS_KEY,
      summary: "Configuración de métricas y tracking actualizada.",
      before: previous
        ? normalizeTrackingSettings(previous.value)
        : null,
      after: settings,
      source: "api/metrics/settings",
    });
  });

  return NextResponse.json({ settings });
}
