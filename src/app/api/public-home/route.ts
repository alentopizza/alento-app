import { NextResponse } from "next/server";
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

  const response = NextResponse.json({
    settings: saved
      ? normalizePublicHomeSettings(saved.value)
      : DEFAULT_PUBLIC_HOME_SETTINGS,
  });

  response.headers.set(
    "Cache-Control",
    "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  );

  return response;
}
