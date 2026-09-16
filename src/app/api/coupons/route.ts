import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function serializeCoupon(coupon: { id: number; name: string; type: "FIXED" | "PERCENTAGE"; value: unknown; active: boolean; createdAt: Date; updatedAt: Date }) {
  return {
    ...coupon,
    value: Number(coupon.value),
  };
}

export async function GET(request: NextRequest) {
  const activeOnly = request.nextUrl.searchParams.get("active") === "1";
  const coupons = await prisma.coupon.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ coupons: coupons.map(serializeCoupon) });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = body.type === "PERCENTAGE" ? "PERCENTAGE" : body.type === "FIXED" ? "FIXED" : null;
  const value = Number(body.value);
  const active = body.active !== false;

  if (!name) return NextResponse.json({ error: "El nombre del cupón es obligatorio." }, { status: 400 });
  if (!type) return NextResponse.json({ error: "Selecciona un tipo de descuento válido." }, { status: 400 });
  if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ error: "El valor del cupón debe ser mayor a cero." }, { status: 400 });
  if (type === "PERCENTAGE" && value > 100) return NextResponse.json({ error: "El porcentaje no puede superar 100%." }, { status: 400 });

  try {
    const coupon = await prisma.coupon.create({ data: { name, type, value, active } });
    return NextResponse.json({ coupon: serializeCoupon(coupon) }, { status: 201 });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") return NextResponse.json({ error: "Ya existe un cupón con ese nombre." }, { status: 409 });
    console.error("Error creating coupon", error);
    return NextResponse.json({ error: "No fue posible crear el cupón." }, { status: 500 });
  }
}
