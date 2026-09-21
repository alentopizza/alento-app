import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import {
  getNotificationTemplates,
  normalizeNotificationTemplates,
  saveNotificationTemplates,
} from "@/lib/notificationTemplates";

export async function GET() {
  try {
    await requireStaffSession(["ADMIN"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json({ error: forbidden ? "Sin permisos." : "No autorizado." }, { status: forbidden ? 403 : 401 });
  }

  return NextResponse.json({ templates: await getNotificationTemplates() });
}

export async function PATCH(request: NextRequest) {
  try {
    await requireStaffSession(["ADMIN"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json({ error: forbidden ? "Sin permisos." : "No autorizado." }, { status: forbidden ? 403 : 401 });
  }

  const body = await request.json().catch(() => ({}));
  const templates = normalizeNotificationTemplates(Array.isArray(body?.templates) ? body.templates : null);
  await saveNotificationTemplates(templates);
  return NextResponse.json({ templates });
}
