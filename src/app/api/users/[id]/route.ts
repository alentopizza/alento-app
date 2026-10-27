import { NextRequest, NextResponse } from "next/server";
import type { UserPermission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, normalizeEmail, requireStaffSession, setStaffSession } from "@/lib/auth";

const VALID_ROLES: UserRole[] = ["ADMIN", "POS", "KITCHEN", "CASHIER", "DRIVER", "DISPATCH"];
const VALID_PERMISSIONS: UserPermission[] = ["CANCEL_ORDERS", "DELETE_ORDERS"];

function parsePermissions(value: unknown): UserPermission[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((permission): permission is UserPermission => VALID_PERMISSIONS.includes(permission as UserPermission)))];
}

function parseRoles(value: unknown): UserRole[] {
  if (!Array.isArray(value)) return [];
  const roles = value
    .map((role) => role === "DISPATCH" ? "DRIVER" : role)
    .filter((role): role is UserRole => VALID_ROLES.includes(role as UserRole));
  return [...new Set(roles)];
}

function allowedPermissionsForRoles(roles: UserRole[], permissions: UserPermission[]) {
  if (roles.includes("ADMIN")) return [];
  const eligible = roles.includes("POS") || roles.includes("CASHIER");
  return eligible ? permissions : [];
}

function sameValues<T extends string>(left: T[], right: T[]) {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

function publicRoles(roles: UserRole[]) {
  return roles.map((role) => role === "DISPATCH" ? "DRIVER" : role);
}

function cleanPhone(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 15) : "";
}

function cleanCountryCode(value: unknown) {
  const digits = typeof value === "string" ? value.replace(/\D/g, "").slice(0, 4) : "57";
  return `+${digits || "57"}`;
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

  const roles = body.roles === undefined ? parseRoles(existing.roles) : parseRoles(body.roles);
  const requestedPermissions = body.permissions === undefined ? existing.permissions : parsePermissions(body.permissions);
  const permissions = allowedPermissionsForRoles(roles, requestedPermissions);
  const active = typeof body.active === "boolean" ? body.active : existing.active;
  const whatsappCountryCode = body.whatsappCountryCode === undefined ? existing.whatsappCountryCode : cleanCountryCode(body.whatsappCountryCode);
  const whatsappPhone = body.whatsappPhone === undefined ? (existing.whatsappPhone ?? "") : cleanPhone(body.whatsappPhone);
  if (roles.length === 0) return NextResponse.json({ error: "El usuario debe conservar al menos un rol." }, { status: 400 });

  if (session.userId === userId && (!active || !roles.includes("ADMIN"))) {
    return NextResponse.json({ error: "No puedes quitarte tu propio acceso de administrador ni desactivarte." }, { status: 409 });
  }

  if (roles.includes("DRIVER") && whatsappPhone.length < 7) {
    return NextResponse.json({ error: "El número de WhatsApp es obligatorio para los repartidores." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  const nextEmail =
    typeof body.email === "string" && body.email.trim()
      ? normalizeEmail(body.email)
      : existing.email;
  const securityChanged =
    active !== existing.active ||
    nextEmail !== existing.email ||
    Boolean(password) ||
    !sameValues(roles, existing.roles) ||
    !sameValues(permissions, existing.permissions);

  if (password && password.length < 8) {
    return NextResponse.json({ error: "La nueva contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(typeof body.name === "string" && body.name.trim() ? { name: body.name.trim() } : {}),
        ...(nextEmail !== existing.email ? { email: nextEmail } : {}),
        whatsappCountryCode,
        whatsappPhone: whatsappPhone || null,
        roles,
        permissions,
        active,
        ...(password ? { passwordHash: hashPassword(password) } : {}),
        ...(securityChanged ? { sessionVersion: { increment: 1 } } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        whatsappCountryCode: true,
        whatsappPhone: true,
        roles: true,
        permissions: true,
        active: true,
        sessionVersion: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (session.userId === userId && securityChanged && user.active) {
      await setStaffSession(user);
    }

    return NextResponse.json({ user: { ...user, roles: publicRoles(user.roles) } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo." }, { status: 409 });
    }
    throw error;
  }
}
