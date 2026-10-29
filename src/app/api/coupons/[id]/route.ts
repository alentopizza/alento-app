import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { staffAuditActor, writeAuditLog } from "@/lib/auditLog";

function serializeCoupon(coupon: { id: number; name: string; type: "FIXED" | "PERCENTAGE"; value: unknown; active: boolean; visibleInPos: boolean; visibleInCart: boolean; createdAt: Date; updatedAt: Date }) {
  return { ...coupon, value: Number(coupon.value) };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireStaffSession(["ADMIN"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  const { id } = await params;
  const couponId = Number(id);
  const body = await request.json();

  if (!Number.isInteger(couponId)) return NextResponse.json({ error: "Cupón inválido." }, { status: 400 });

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
    const coupon = await prisma.$transaction(async (tx) => {
      const existing = await tx.coupon.findUnique({ where: { id: couponId } });
      if (!existing) {
        throw Object.assign(new Error("COUPON_NOT_FOUND"), { code: "P2025" });
      }

      const updated = await tx.coupon.update({
        where: { id: couponId },
        data: { name, type, value, active, visibleInPos, visibleInCart },
      });

      await writeAuditLog(tx, {
        actor: staffAuditActor(session),
        action: "COUPON_UPDATED",
        entityType: "COUPON",
        entityId: updated.id,
        summary: `Cupón ${updated.name} actualizado.`,
        before: {
          name: existing.name,
          type: existing.type,
          value: Number(existing.value),
          active: existing.active,
          visibleInPos: existing.visibleInPos,
          visibleInCart: existing.visibleInCart,
        },
        after: {
          name: updated.name,
          type: updated.type,
          value: Number(updated.value),
          active: updated.active,
          visibleInPos: updated.visibleInPos,
          visibleInCart: updated.visibleInCart,
        },
        source: "api/coupons/[id]",
      });

      return updated;
    });
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
  let session;
  try {
    session = await requireStaffSession(["ADMIN"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  const { id } = await params;
  const couponId = Number(id);
  if (!Number.isInteger(couponId)) return NextResponse.json({ error: "Cupón inválido." }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.coupon.findUnique({ where: { id: couponId } });
      if (!existing) {
        throw Object.assign(new Error("COUPON_NOT_FOUND"), { code: "P2025" });
      }

      await tx.coupon.delete({ where: { id: couponId } });
      await writeAuditLog(tx, {
        actor: staffAuditActor(session),
        action: "COUPON_DELETED",
        entityType: "COUPON",
        entityId: existing.id,
        summary: `Cupón ${existing.name} eliminado.`,
        before: {
          name: existing.name,
          type: existing.type,
          value: Number(existing.value),
          active: existing.active,
          visibleInPos: existing.visibleInPos,
          visibleInCart: existing.visibleInCart,
        },
        source: "api/coupons/[id]",
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2025") return NextResponse.json({ error: "Cupón no encontrado." }, { status: 404 });
    if (prismaError.code === "P2003") return NextResponse.json({ error: "Este cupón ya está asociado a pedidos. Desactívalo en lugar de eliminarlo." }, { status: 409 });
    console.error("Error deleting coupon", error);
    return NextResponse.json({ error: "No fue posible eliminar el cupón." }, { status: 500 });
  }
}
