import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const image = await prisma.notificationImage.findUnique({
    where: { id },
    select: { contentType: true, data: true, filename: true, sizeBytes: true },
  });

  if (!image) {
    return NextResponse.json({ error: "Imagen no encontrada." }, { status: 404 });
  }

  const bytes = new Uint8Array(image.data.byteLength);
  bytes.set(image.data);
  const body = new Blob([bytes.buffer], { type: image.contentType });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.sizeBytes),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="${encodeURIComponent(image.filename)}"`,
    },
  });
}
