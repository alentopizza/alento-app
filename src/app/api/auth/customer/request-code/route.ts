import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashOtp, normalizePhoneE164 } from "@/lib/auth";
import {
  consumeRateLimit,
  rateLimitExceededResponse,
  requestClientIp,
} from "@/lib/rateLimit";
import { sendCustomerOtpWhatsApp } from "@/lib/whatsappAuth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const countryCode = typeof body.countryCode === "string" ? body.countryCode : "+57";
  const rawPhone = typeof body.phone === "string" ? body.phone : "";
  const phoneE164 = normalizePhoneE164(countryCode, rawPhone);
  const countryDigits = countryCode.replace(/\D/g, "");
  let localPhone = rawPhone.replace(/\D/g, "");
  if (countryDigits && localPhone.startsWith(countryDigits)) {
    localPhone = localPhone.slice(countryDigits.length);
  }

  if (!phoneE164 || localPhone.length < 7) {
    return NextResponse.json({ error: "Ingresa un número de teléfono válido." }, { status: 400 });
  }

  const ipLimit = await consumeRateLimit({
    scope: "customer-otp-request-ip",
    key: requestClientIp(request),
    limit: 20,
    windowMs: 15 * 60_000,
    blockMs: 15 * 60_000,
  });
  if (!ipLimit.allowed) {
    return rateLimitExceededResponse(
      ipLimit,
      "Demasiadas solicitudes de código. Intenta nuevamente más tarde.",
    );
  }

  const phoneLimit = await consumeRateLimit({
    scope: "customer-otp-request-phone",
    key: phoneE164,
    limit: 5,
    windowMs: 60 * 60_000,
    blockMs: 60 * 60_000,
  });
  if (!phoneLimit.allowed) {
    return rateLimitExceededResponse(
      phoneLimit,
      "Se solicitaron demasiados códigos para este número. Intenta nuevamente más tarde.",
    );
  }

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { phone: localPhone },
        { phone: phoneE164.replace(/^\+/, "") },
      ],
    },
    select: { id: true, name: true, phone: true, countryCode: true },
  });

  const latest = await prisma.customerAuthCode.findFirst({
    where: { phoneE164, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (latest && Date.now() - latest.createdAt.getTime() < 60_000) {
    return NextResponse.json({ error: "Espera un minuto antes de solicitar otro código." }, { status: 429 });
  }

  const code = String(randomInt(100000, 1_000_000));
  const authCode = await prisma.customerAuthCode.create({
    data: {
      phoneE164,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });

  try {
    await sendCustomerOtpWhatsApp(phoneE164, code, customer?.name?.trim() || "NUEVO");
  } catch (error) {
    console.error("Customer OTP send failed", error);
    await prisma.customerAuthCode.delete({ where: { id: authCode.id } }).catch(() => undefined);
    return NextResponse.json({ error: "No fue posible enviar el código por WhatsApp." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    phone: phoneE164,
    expiresInSeconds: 600,
  });
}
