import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { getNotificationTemplates, saveNotificationTemplates } from "@/lib/notificationTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  try {
    try {
      await requireStaffSession(["ADMIN"]);
    } catch (error) {
      const forbidden = error instanceof Error && error.message === "FORBIDDEN";
      return NextResponse.json(
        { error: forbidden ? "Sin permisos." : "No autorizado." },
        { status: forbidden ? 403 : 401 },
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "No fue posible leer el archivo. Intenta con una imagen JPG, PNG o WebP menor a 8 MB." },
        { status: 400 },
      );
    }

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

    const templates = await getNotificationTemplates();
    const current = templates.find((template) => template.id === templateId);
    if (!current) {
      return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
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

    const url = `/api/notification-images/${record.id}`;
    const previousUrl = current.headerImageUrl;

    // Al cargar la imagen la notificación queda disponible, pero sigue apagada
    // hasta que el usuario active explícitamente el switch.
    const updatedTemplates = templates.map((template) =>
      template.id === templateId
        ? { ...template, headerImageUrl: url, active: false }
        : template,
    );

    try {
      await saveNotificationTemplates(updatedTemplates);
    } catch (error) {
      await prisma.notificationImage.delete({ where: { id: record.id } }).catch(() => undefined);
      throw error;
    }

    const oldInternalId = previousUrl.match(/\/api\/notification-images\/([^/?#]+)/)?.[1];
    if (oldInternalId && oldInternalId !== record.id) {
      await prisma.notificationImage.delete({ where: { id: oldInternalId } }).catch(() => undefined);
    }

    return NextResponse.json(
      {
        ok: true,
        id: record.id,
        url,
        template: updatedTemplates.find((template) => template.id === templateId),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Notification image upload failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error
          ? `No fue posible guardar la imagen: ${error.message}`
          : "No fue posible guardar la imagen.",
      },
      { status: 500 },
    );
  }
}
