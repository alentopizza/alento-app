import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
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
  try {
    await requireStaffSession(["ADMIN"]);
  } catch (error) {
    const forbidden =
      error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const settings = normalizeClubAlentoSettings(body?.settings);

  if (settings.earnRatePercent < 0 || settings.earnRatePercent > 100) {
    return NextResponse.json(
      { error: "El porcentaje de acumulación debe estar entre 0% y 100%." },
      { status: 400 },
    );
  }

  if (settings.minimumRedemptionPurchase < 0) {
    return NextResponse.json(
      { error: "La compra mínima de canje no puede ser negativa." },
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
