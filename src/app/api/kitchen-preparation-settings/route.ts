import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

const KEY = "kitchen_preparation_settings";
const DEFAULT_MINUTES = 30;
const ALLOWED = [15, 20, 25, 30, 35, 40, 45, 50, 60];

export async function GET() {
  const saved = await prisma.appSetting.findUnique({ where: { key: KEY } });
  const raw = saved?.value && typeof saved.value === "object" && !Array.isArray(saved.value)
    ? Number((saved.value as { leadMinutes?: unknown }).leadMinutes)
    : DEFAULT_MINUTES;
  const leadMinutes = ALLOWED.includes(raw) ? raw : DEFAULT_MINUTES;
  return NextResponse.json({ leadMinutes, allowed: ALLOWED });
}

export async function PUT(request: NextRequest) {
  let session;
  try {
    session = await requireStaffSession(["ADMIN", "KITCHEN"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json({ error: forbidden ? "Sin permisos." : "No autorizado." }, { status: forbidden ? 403 : 401 });
  }

  const body = await request.json().catch(() => ({}));
  const leadMinutes = Number(body?.leadMinutes);
  if (!ALLOWED.includes(leadMinutes)) {
    return NextResponse.json({ error: "Selecciona un tiempo de preparación válido." }, { status: 400 });
  }

  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: { leadMinutes } },
    update: { value: { leadMinutes } },
  });
  return NextResponse.json({ leadMinutes });
}
