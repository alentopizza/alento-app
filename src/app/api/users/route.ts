import { NextRequest, NextResponse } from "next/server";
import type { UserPermission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, normalizeEmail, requireStaffSession } from "@/lib/auth";

const VALID_ROLES: UserRole[] = ["ADMIN", "POS", "KITCHEN", "CASHIER", "DISPATCH"];
const VALID_PERMISSIONS: UserPermission[] = ["CANCEL_ORDERS", "DELETE_ORDERS"];

function parsePermissions(value: unknown): UserPermission[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((permission): permission is UserPermission => VALID_PERMISSIONS.includes(permission as UserPermission)))];
}

function parseRoles(value: unknown): UserRole[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((role): role is UserRole => VALID_ROLES.includes(role as UserRole)))];
}

export async function GET() {
  try {
    await requireStaffSession(["ADMIN"]);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Sin permisos." : "No autorizado." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, roles: true, permissions: true, active: true, lastLoginAt: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  try {
    await requireStaffSession(["ADMIN"]);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Sin permisos." : "No autorizado." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const password = typeof body.password === "string" ? body.password : "";
  const roles = parseRoles(body.roles);
  const permissions = parsePermissions(body.permissions);

  if (!name || !email || password.length < 8 || roles.length === 0) {
    return NextResponse.json({ error: "Nombre, correo, contraseña de mínimo 8 caracteres y al menos un rol son obligatorios." }, { status: 400 });
  }

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash: hashPassword(password), roles, permissions, active: true },
      select: { id: true, name: true, email: true, roles: true, permissions: true, active: true, lastLoginAt: true, createdAt: true },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo." }, { status: 409 });
    }
    throw error;
  }
}
