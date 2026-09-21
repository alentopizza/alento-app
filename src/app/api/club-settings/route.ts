import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CLUB_ALENTO_SETTING_KEY,
  DEFAULT_CLUB_ALENTO_SETTINGS,
  normalizeClubAlentoSettings,
} from "@/lib/clubAlento";

export async function GET() {
  const saved = await prisma.appSetting.findUnique({
    where: { key: CLUB_ALENTO_SETTING_KEY },
  });

  return NextResponse.json({
    settings: saved
      ? normalizeClubAlentoSettings(saved.value)
      : DEFAULT_CLUB_ALENTO_SETTINGS,
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const settings = normalizeClubAlentoSettings(body?.settings);

  if (settings.pointsPerThousand < 0) {
    return NextResponse.json(
      { error: "Los puntos por cada $1.000 no pueden ser negativos." },
      { status: 400 },
    );
  }

  const saved = await prisma.appSetting.upsert({
    where: { key: CLUB_ALENTO_SETTING_KEY },
    update: { value: settings },
    create: { key: CLUB_ALENTO_SETTING_KEY, value: settings },
  });

  return NextResponse.json({
    settings: normalizeClubAlentoSettings(saved.value),
  });
}
