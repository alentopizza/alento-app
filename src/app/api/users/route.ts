import { NextRequest, NextResponse } from "next/server";
import type { UserPermission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, normalizeEmail, requireStaffSession } from "@/lib/auth";
import { staffAuditActor, writeAuditLog } from "@/lib/auditLog";

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

export async function GET() {
  try {
    await requireStaffSession(["ADMIN"]);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Sin permisos." : "No autorizado." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, whatsappCountryCode: true, whatsappPhone: true, roles: true, permissions: true, active: true, lastLoginAt: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({
    users: users.map((user) => ({ ...user, roles: publicRoles(user.roles) })),
  });
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireStaffSession(["ADMIN"]);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Sin permisos." : "No autorizado." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const password = typeof body.password === "string" ? body.password : "";
  const roles = parseRoles(body.roles);
  const permissions = allowedPermissionsForRoles(roles, parsePermissions(body.permissions));
  const whatsappCountryCode = cleanCountryCode(body.whatsappCountryCode);
  const whatsappPhone = cleanPhone(body.whatsappPhone);

  if (!name || !email || password.length < 8 || roles.length === 0) {
    return NextResponse.json({ error: "Nombre, correo, contraseña de mínimo 8 caracteres y al menos un rol son obligatorios." }, { status: 400 });
  }

  if (roles.includes("DRIVER") && whatsappPhone.length < 7) {
    return NextResponse.json({ error: "El número de WhatsApp es obligatorio para los repartidores." }, { status: 400 });
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name, email, passwordHash: hashPassword(password), whatsappCountryCode, whatsappPhone: whatsappPhone || null, roles, permissions, active: true },
        select: { id: true, name: true, email: true, whatsappCountryCode: true, whatsappPhone: true, roles: true, permissions: true, active: true, lastLoginAt: true, createdAt: true },
      });

      await writeAuditLog(tx, {
        actor: staffAuditActor(session),
        action: "USER_CREATED",
        entityType: "USER",
        entityId: created.id,
        summary: `Usuario ${created.name} creado con roles ${created.roles.join(", ")}.`,
        after: created,
        source: "api/users",
      });

      return created;
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo." }, { status: 409 });
    }
    throw error;
  }
}
