import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "No fue posible leer la imagen." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Selecciona una imagen válida." },
      { status: 400 },
    );
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Usa una imagen JPG, PNG o WebP." },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "La imagen debe pesar máximo 8 MB." },
      { status: 400 },
    );
  }

  try {
    const record = await prisma.notificationImage.create({
      data: {
        filename: file.name.slice(0, 180) || "push",
        contentType: file.type,
        data: Buffer.from(await file.arrayBuffer()),
        sizeBytes: file.size,
      },
      select: { id: true },
    });

    return NextResponse.json(
      {
        ok: true,
        url: `/api/notification-images/${record.id}`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.warn("Push campaign image upload failed", {
      error:
        error instanceof Error ? error.message : "Unknown upload error",
    });

    return NextResponse.json(
      {
        error:
          "No fue posible guardar la imagen de la notificación. Intenta nuevamente.",
      },
      { status: 500 },
    );
  }
}
