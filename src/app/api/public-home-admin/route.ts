import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PUBLIC_HOME_SETTINGS,
  PUBLIC_HOME_SETTING_KEY,
  normalizePublicHomeSettings,
} from "@/lib/publicHome";
import { requireStaffSession } from "@/lib/auth";
import { staffAuditActor, writeAuditLog } from "@/lib/auditLog";

export async function GET() {
  try {
    await requireStaffSession(["ADMIN"]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Sin permisos." : "No autorizado." },
      { status: message === "FORBIDDEN" ? 403 : 401 },
    );
  }

  const saved = await prisma.appSetting.findUnique({
    where: { key: PUBLIC_HOME_SETTING_KEY },
  });

  return NextResponse.json({
    settings: saved
      ? normalizePublicHomeSettings(saved.value)
      : DEFAULT_PUBLIC_HOME_SETTINGS,
  });
}

export async function PUT(request: NextRequest) {
  let session;
  try {
    session = await requireStaffSession(["ADMIN"]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Sin permisos." : "No autorizado." },
      { status: message === "FORBIDDEN" ? 403 : 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const settings = normalizePublicHomeSettings(body?.settings);

  if (settings.menuHero.active && !settings.menuHero.imageUrl) {
    return NextResponse.json(
      { error: "La portada del menú está activa pero no tiene imagen." },
      { status: 400 },
    );
  }

  const previous = await prisma.appSetting.findUnique({
    where: { key: PUBLIC_HOME_SETTING_KEY },
  });

  const saved = await prisma.$transaction(async (tx) => {
    const updated = await tx.appSetting.upsert({
      where: { key: PUBLIC_HOME_SETTING_KEY },
      update: { value: settings },
      create: { key: PUBLIC_HOME_SETTING_KEY, value: settings },
    });

    await writeAuditLog(tx, {
      actor: staffAuditActor(session),
      action: "PUBLIC_HOME_SETTINGS_UPDATED",
      entityType: "APP_SETTING",
      entityId: PUBLIC_HOME_SETTING_KEY,
      summary: "Personalización de la experiencia pública actualizada.",
      before: previous ? normalizePublicHomeSettings(previous.value) : null,
      after: settings,
      source: "api/public-home-admin",
    });

    return updated;
  });

  return NextResponse.json({
    settings: normalizePublicHomeSettings(saved.value),
  });
}
