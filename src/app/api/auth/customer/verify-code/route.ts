import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneE164, setCustomerSession, verifyOtp } from "@/lib/auth";
import {
  clearRateLimit,
  consumeRateLimit,
  rateLimitExceededResponse,
  requestClientIp,
} from "@/lib/rateLimit";
import { sendCustomerContactWebhook } from "@/lib/customerContactWebhook";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const countryCode = typeof body.countryCode === "string" ? body.countryCode : "+57";
  const rawPhone = typeof body.phone === "string" ? body.phone : "";
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
  const phoneE164 = normalizePhoneE164(countryCode, rawPhone);
  const countryDigits = countryCode.replace(/\D/g, "");
  let localPhone = rawPhone.replace(/\D/g, "");
  if (countryDigits && localPhone.startsWith(countryDigits)) {
    localPhone = localPhone.slice(countryDigits.length);
  }

  if (!phoneE164 || code.length !== 6) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }

  const ip = requestClientIp(request);
  const ipLimit = await consumeRateLimit({
    scope: "customer-otp-verify-ip",
    key: ip,
    limit: 30,
    windowMs: 15 * 60_000,
    blockMs: 15 * 60_000,
  });
  if (!ipLimit.allowed) {
    return rateLimitExceededResponse(
      ipLimit,
      "Demasiados intentos de verificación. Intenta nuevamente más tarde.",
    );
  }

  const phoneLimit = await consumeRateLimit({
    scope: "customer-otp-verify-phone",
    key: phoneE164,
    limit: 10,
    windowMs: 15 * 60_000,
    blockMs: 15 * 60_000,
  });
  if (!phoneLimit.allowed) {
    return rateLimitExceededResponse(
      phoneLimit,
      "Demasiados intentos de verificación. Intenta nuevamente más tarde.",
    );
  }

  const authCode = await prisma.customerAuthCode.findFirst({
    where: {
      phoneE164,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: 5 },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!authCode) {
    return NextResponse.json({ error: "El código venció o ya no es válido. Solicita uno nuevo." }, { status: 401 });
  }

  if (!verifyOtp(code, authCode.codeHash)) {
    await prisma.customerAuthCode.update({ where: { id: authCode.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: "El código no coincide." }, { status: 401 });
  }

  const existingCustomer = await prisma.customer.findFirst({
    where: { OR: [{ phone: localPhone }, { phone: phoneE164.replace(/^\+/, "") }] },
    select: { id: true, name: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    await tx.customerAuthCode.update({
      where: { id: authCode.id },
      data: { consumedAt: new Date() },
    });

    const customer = existingCustomer ?? await tx.customer.create({
      data: {
        name: "NUEVO",
        countryCode,
        phone: localPhone,
        contactWebhookPending: true,
      },
      select: { id: true, name: true },
    });

    const account = await tx.customerAccount.upsert({
      where: { customerId: customer.id },
      update: { phoneE164, phoneVerifiedAt: new Date(), active: true },
      create: { customerId: customer.id, phoneE164, phoneVerifiedAt: new Date(), active: true },
    });

    return { customer, account };
  });

  const { customer, account } = result;

  await setCustomerSession(account);
  await Promise.all([
    clearRateLimit("customer-otp-verify-ip", ip),
    clearRateLimit("customer-otp-verify-phone", phoneE164),
  ]);

  const contactWebhook = await sendCustomerContactWebhook({
    customerId: customer.id,
    source: "CUSTOMER_ACCOUNT",
  });

  return NextResponse.json({
    ok: true,
    customer: { id: customer.id, name: customer.name },
    contactWebhook,
  });
}
