import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashOtp, normalizePhoneE164 } from "@/lib/auth";
import { sendCustomerOtpWhatsApp } from "@/lib/whatsappAuth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const countryCode = typeof body.countryCode === "string" ? body.countryCode : "+57";
  const rawPhone = typeof body.phone === "string" ? body.phone : "";
  const phoneE164 = normalizePhoneE164(countryCode, rawPhone);
  const localPhone = rawPhone.replace(/\D/g, "");

  if (!phoneE164 || localPhone.length < 7) {
    return NextResponse.json({ error: "Ingresa un número de teléfono válido." }, { status: 400 });
  }

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { phone: localPhone },
        { phone: phoneE164.replace(/^\+/, "") },
      ],
    },
    select: { id: true, phone: true, countryCode: true },
  });

  if (!customer) {
    return NextResponse.json({
      error: "No encontramos un cliente registrado con ese número. Puedes seguir navegando como invitado.",
      code: "CUSTOMER_NOT_FOUND",
    }, { status: 404 });
  }

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
    await sendCustomerOtpWhatsApp(phoneE164, code);
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
