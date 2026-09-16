import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function serializeCoupon(coupon: { id: number; name: string; type: "FIXED" | "PERCENTAGE"; value: unknown; active: boolean; createdAt: Date; updatedAt: Date }) {
  return { ...coupon, value: Number(coupon.value) };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const couponId = Number(id);
  const body = await request.json();

  if (!Number.isInteger(couponId)) return NextResponse.json({ error: "Cupón inválido." }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = body.type === "PERCENTAGE" ? "PERCENTAGE" : body.type === "FIXED" ? "FIXED" : null;
  const value = Number(body.value);
  const active = body.active !== false;

  if (!name) return NextResponse.json({ error: "El nombre del cupón es obligatorio." }, { status: 400 });
  if (!type) return NextResponse.json({ error: "Selecciona un tipo de descuento válido." }, { status: 400 });
  if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ error: "El valor del cupón debe ser mayor a cero." }, { status: 400 });
  if (type === "PERCENTAGE" && value > 100) return NextResponse.json({ error: "El porcentaje no puede superar 100%." }, { status: 400 });

  try {
    const coupon = await prisma.coupon.update({ where: { id: couponId }, data: { name, type, value, active } });
    return NextResponse.json({ coupon: serializeCoupon(coupon) });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") return NextResponse.json({ error: "Ya existe un cupón con ese nombre." }, { status: 409 });
    if (prismaError.code === "P2025") return NextResponse.json({ error: "Cupón no encontrado." }, { status: 404 });
    console.error("Error updating coupon", error);
    return NextResponse.json({ error: "No fue posible actualizar el cupón." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const couponId = Number(id);
  if (!Number.isInteger(couponId)) return NextResponse.json({ error: "Cupón inválido." }, { status: 400 });

  try {
    await prisma.coupon.delete({ where: { id: couponId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2025") return NextResponse.json({ error: "Cupón no encontrado." }, { status: 404 });
    if (prismaError.code === "P2003") return NextResponse.json({ error: "Este cupón ya está asociado a pedidos. Desactívalo en lugar de eliminarlo." }, { status: 409 });
    console.error("Error deleting coupon", error);
    return NextResponse.json({ error: "No fue posible eliminar el cupón." }, { status: 500 });
  }
}
