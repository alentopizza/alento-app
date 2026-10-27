import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, normalizeEmail, setStaffSession } from "@/lib/auth";
import {
  consumeRateLimit,
  rateLimitExceededResponse,
  requestClientIp,
} from "@/lib/rateLimit";

export async function GET() {
  const count = await prisma.user.count();
  return NextResponse.json({ needsBootstrap: count === 0 });
}

export async function POST(request: NextRequest) {
  const ipLimit = await consumeRateLimit({
    scope: "staff-bootstrap-ip",
    key: requestClientIp(request),
    limit: 10,
    windowMs: 60 * 60_000,
    blockMs: 60 * 60_000,
  });
  if (!ipLimit.allowed) {
    return rateLimitExceededResponse(
      ipLimit,
      "Demasiados intentos de configuración inicial.",
    );
  }

  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    return NextResponse.json({ error: "El administrador inicial ya fue creado." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const setupKey = typeof body.setupKey === "string" ? body.setupKey : "";
  const expectedKey = process.env.AUTH_BOOTSTRAP_KEY;

  if (!expectedKey || setupKey !== expectedKey) {
    return NextResponse.json({ error: "Clave de configuración inválida." }, { status: 403 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const password = typeof body.password === "string" ? body.password : "";

  if (!name || !email || password.length < 8) {
    return NextResponse.json({ error: "Nombre, correo y una contraseña de mínimo 8 caracteres son obligatorios." }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      roles: ["ADMIN"],
      active: true,
    },
  });

  await setStaffSession(user);
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, roles: user.roles },
  }, { status: 201 });
}
