import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_SLOTS = new Set(["MAIN", "SECONDARY"]);

function productImageUrl(id: string) {
  return `/api/product-images/${id}`;
}

export async function POST(request: NextRequest) {
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
      { error: "No fue posible leer la imagen." },
      { status: 400 },
    );
  }

  const productId = Number(form.get("productId"));
  const slot = String(form.get("slot") ?? "").trim().toUpperCase();
  const file = form.get("file");

  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: "Producto inválido." }, { status: 400 });
  }

  if (!ALLOWED_SLOTS.has(slot)) {
    return NextResponse.json({ error: "Tipo de imagen inválido." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecciona una imagen válida." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
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

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await prisma.$transaction(async (tx) => {
      const image = await tx.productImage.create({
        data: {
          productId,
          slot,
          filename: file.name.slice(0, 180) || "producto",
          contentType: file.type,
          data: buffer,
          sizeBytes: file.size,
        },
        select: { id: true },
      });

      const url = productImageUrl(image.id);

      await tx.product.update({
        where: { id: productId },
        data:
          slot === "MAIN"
            ? { imageUrl: url }
            : { imageUrl2: url },
      });

      await tx.productImage.deleteMany({
        where: {
          productId,
          slot,
          id: { not: image.id },
        },
      });

      return { id: image.id, url };
    });

    return NextResponse.json(
      {
        ok: true,
        productId,
        slot,
        ...result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Product image upload failed", error);
    return NextResponse.json(
      { error: "No fue posible guardar la imagen del producto." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireStaffSession(["ADMIN"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const productId = Number(body.productId);
  const slot = String(body.slot ?? "").trim().toUpperCase();

  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: "Producto inválido." }, { status: 400 });
  }

  if (!ALLOWED_SLOTS.has(slot)) {
    return NextResponse.json({ error: "Tipo de imagen inválido." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data:
          slot === "MAIN"
            ? { imageUrl: null }
            : { imageUrl2: null },
      });

      await tx.productImage.deleteMany({
        where: { productId, slot },
      });
    });

    return NextResponse.json({ ok: true, productId, slot });
  } catch (error) {
    console.error("Product image removal failed", error);
    return NextResponse.json(
      { error: "No fue posible quitar la imagen del producto." },
      { status: 500 },
    );
  }
}
