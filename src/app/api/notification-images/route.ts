import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { getNotificationTemplates, saveNotificationTemplates } from "@/lib/notificationTemplates";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  try {
    await requireStaffSession(["ADMIN"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json({ error: forbidden ? "Sin permisos." : "No autorizado." }, { status: forbidden ? 403 : 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const templateId = String(form.get("templateId") ?? "").trim();

  if (!templateId) {
    return NextResponse.json({ error: "No se pudo identificar la plantilla." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecciona una imagen válida." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Formato no permitido. Usa JPG, PNG o WebP." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen debe pesar máximo 8 MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const record = await prisma.notificationImage.create({
    data: {
      filename: file.name.slice(0, 180) || "notificacion",
      contentType: file.type,
      data: buffer,
      sizeBytes: file.size,
    },
    select: { id: true },
  });

  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const fallbackOrigin = new URL(request.url).origin;
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : fallbackOrigin;
  const url = `${origin}/api/notification-images/${record.id}`;

  const templates = await getNotificationTemplates();
  const current = templates.find((template) => template.id === templateId);
  if (!current) {
    await prisma.notificationImage.delete({ where: { id: record.id } }).catch(() => undefined);
    return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
  }

  const previousUrl = current.headerImageUrl;
  const updatedTemplates = templates.map((template) =>
    template.id === templateId ? { ...template, headerImageUrl: url } : template,
  );
  await saveNotificationTemplates(updatedTemplates);

  const oldInternalId = previousUrl.match(/\/api\/notification-images\/([^/?#]+)/)?.[1];
  if (oldInternalId && oldInternalId !== record.id) {
    await prisma.notificationImage.delete({ where: { id: oldInternalId } }).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    id: record.id,
    url,
    template: updatedTemplates.find((template) => template.id === templateId),
  }, { status: 201 });
}
