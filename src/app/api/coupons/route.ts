import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function serializeCoupon(
  coupon: {
    id: number;
    name: string;
    type: "FIXED" | "PERCENTAGE";
    value: unknown;
    active: boolean;
    visibleInPos: boolean;
    visibleInCart: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  stats?: {
    usageCount: number;
    totalDiscount: number;
    lastUsedAt: Date | null;
  },
) {
  return {
    ...coupon,
    value: Number(coupon.value),
    usageCount: stats?.usageCount ?? 0,
    totalDiscount: stats?.totalDiscount ?? 0,
    lastUsedAt: stats?.lastUsedAt ?? null,
  };
}

export async function GET(request: NextRequest) {
  const activeOnly = request.nextUrl.searchParams.get("active") === "1";

  const [coupons, usageRows] = await Promise.all([
    prisma.coupon.findMany({
      where: activeOnly ? { active: true, visibleInPos: true } : undefined,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.order.groupBy({
      by: ["couponId"],
      where: {
        couponId: { not: null },
        status: { notIn: ["DRAFT", "CANCELED"] },
      },
      _count: { id: true },
      _sum: { discount: true },
      _max: { createdAt: true },
    }),
  ]);

  const usageByCoupon = new Map(
    usageRows
      .filter((row) => row.couponId != null)
      .map((row) => [
        row.couponId as number,
        {
          usageCount: row._count.id,
          totalDiscount: Number(row._sum.discount ?? 0),
          lastUsedAt: row._max.createdAt ?? null,
        },
      ]),
  );

  const serialized = coupons.map((coupon) =>
    serializeCoupon(coupon, usageByCoupon.get(coupon.id)),
  );

  return NextResponse.json({
    coupons: serialized,
    summary: {
      total: serialized.length,
      active: serialized.filter((coupon) => coupon.active).length,
      totalUses: serialized.reduce(
        (sum, coupon) => sum + coupon.usageCount,
        0,
      ),
      totalDiscount: serialized.reduce(
        (sum, coupon) => sum + coupon.totalDiscount,
        0,
      ),
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = body.type === "PERCENTAGE" ? "PERCENTAGE" : body.type === "FIXED" ? "FIXED" : null;
  const value = Number(body.value);
  const active = body.active !== false;
  const visibleInPos = body.visibleInPos !== false;
  const visibleInCart = body.visibleInCart === true;

  if (!name) return NextResponse.json({ error: "El nombre del cupón es obligatorio." }, { status: 400 });
  if (!type) return NextResponse.json({ error: "Selecciona un tipo de descuento válido." }, { status: 400 });
  if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ error: "El valor del cupón debe ser mayor a cero." }, { status: 400 });
  if (type === "PERCENTAGE" && value > 100) return NextResponse.json({ error: "El porcentaje no puede superar 100%." }, { status: 400 });

  try {
    const coupon = await prisma.coupon.create({
      data: { name, type, value, active, visibleInPos, visibleInCart },
    });
    return NextResponse.json({ coupon: serializeCoupon(coupon) }, { status: 201 });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") return NextResponse.json({ error: "Ya existe un cupón con ese nombre." }, { status: 409 });
    console.error("Error creating coupon", error);
    return NextResponse.json({ error: "No fue posible crear el cupón." }, { status: 500 });
  }
}
