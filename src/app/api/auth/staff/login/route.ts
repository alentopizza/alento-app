import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, setStaffSession, verifyPassword } from "@/lib/auth";
import {
  clearRateLimit,
  consumeRateLimit,
  rateLimitExceededResponse,
  requestClientIp,
} from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Correo y contraseña son obligatorios." }, { status: 400 });
  }

  const ip = requestClientIp(request);
  const ipLimit = await consumeRateLimit({
    scope: "staff-login-ip",
    key: ip,
    limit: 30,
    windowMs: 15 * 60_000,
    blockMs: 15 * 60_000,
  });
  if (!ipLimit.allowed) {
    return rateLimitExceededResponse(
      ipLimit,
      "Demasiados intentos de inicio de sesión. Intenta nuevamente más tarde.",
    );
  }

  const emailLimit = await consumeRateLimit({
    scope: "staff-login-email",
    key: email,
    limit: 10,
    windowMs: 15 * 60_000,
    blockMs: 15 * 60_000,
  });
  if (!emailLimit.allowed) {
    return rateLimitExceededResponse(
      emailLimit,
      "Demasiados intentos de inicio de sesión. Intenta nuevamente más tarde.",
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setStaffSession(user);
  await Promise.all([
    clearRateLimit("staff-login-ip", ip),
    clearRateLimit("staff-login-email", email),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles.map((role) => role === "DISPATCH" ? "DRIVER" : role),
    },
  });
}
