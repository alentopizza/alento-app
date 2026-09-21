import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PUBLIC_HOME_SETTINGS,
  PUBLIC_HOME_SETTING_KEY,
  normalizePublicHomeSettings,
} from "@/lib/publicHome";

export async function GET() {
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
  const body = await request.json().catch(() => ({}));
  const settings = normalizePublicHomeSettings(body?.settings);

  if (settings.menuHero.active && !settings.menuHero.imageUrl) {
    return NextResponse.json(
      { error: "La portada del menú está activa pero no tiene imagen." },
      { status: 400 },
    );
  }

  const saved = await prisma.appSetting.upsert({
    where: { key: PUBLIC_HOME_SETTING_KEY },
    update: { value: settings },
    create: { key: PUBLIC_HOME_SETTING_KEY, value: settings },
  });

  return NextResponse.json({
    settings: normalizePublicHomeSettings(saved.value),
  });
}
