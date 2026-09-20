import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, normalizeEmail, requireStaffSession } from "@/lib/auth";

const VALID_ROLES: UserRole[] = ["ADMIN", "POS", "KITCHEN", "CASHIER", "DISPATCH"];

function parseRoles(value: unknown): UserRole[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((role): role is UserRole => VALID_ROLES.includes(role as UserRole)))];
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireStaffSession(["ADMIN"]);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Sin permisos." : "No autorizado." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 });
  }

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) return NextResponse.json({ error: "Usuario inválido." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });

  const roles = body.roles === undefined ? existing.roles : parseRoles(body.roles);
  const active = typeof body.active === "boolean" ? body.active : existing.active;
  if (roles.length === 0) return NextResponse.json({ error: "El usuario debe conservar al menos un rol." }, { status: 400 });

  if (session.userId === userId && (!active || !roles.includes("ADMIN"))) {
    return NextResponse.json({ error: "No puedes quitarte tu propio acceso de administrador ni desactivarte." }, { status: 409 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password && password.length < 8) {
    return NextResponse.json({ error: "La nueva contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(typeof body.name === "string" && body.name.trim() ? { name: body.name.trim() } : {}),
        ...(typeof body.email === "string" && body.email.trim() ? { email: normalizeEmail(body.email) } : {}),
        roles,
        active,
        ...(password ? { passwordHash: hashPassword(password) } : {}),
      },
      select: { id: true, name: true, email: true, roles: true, active: true, lastLoginAt: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ user });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo." }, { status: 409 });
    }
    throw error;
  }
}
