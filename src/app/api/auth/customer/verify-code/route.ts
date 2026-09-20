import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneE164, setCustomerSession, verifyOtp } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const countryCode = typeof body.countryCode === "string" ? body.countryCode : "+57";
  const rawPhone = typeof body.phone === "string" ? body.phone : "";
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
  const phoneE164 = normalizePhoneE164(countryCode, rawPhone);
  const localPhone = rawPhone.replace(/\D/g, "");

  if (!phoneE164 || code.length !== 6) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
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

  const customer = await prisma.customer.findFirst({
    where: { OR: [{ phone: localPhone }, { phone: phoneE164.replace(/^\+/, "") }] },
    select: { id: true, name: true },
  });

  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  const account = await prisma.$transaction(async (tx) => {
    await tx.customerAuthCode.update({ where: { id: authCode.id }, data: { consumedAt: new Date() } });
    return tx.customerAccount.upsert({
      where: { customerId: customer.id },
      update: { phoneE164, phoneVerifiedAt: new Date(), active: true },
      create: { customerId: customer.id, phoneE164, phoneVerifiedAt: new Date(), active: true },
    });
  });

  await setCustomerSession(account);

  return NextResponse.json({
    ok: true,
    customer: { id: customer.id, name: customer.name },
  });
}
