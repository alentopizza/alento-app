import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const account = await prisma.customerAccount.findUnique({
    where: { id: session.accountId },
    select: { active: true, customerId: true },
  });

  if (!account?.active || account.customerId !== session.customerId) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const deviceKey = String(body?.deviceKey ?? "").trim();
  const platform = String(body?.platform ?? "Otro").trim().slice(0, 40) || "Otro";

  if (deviceKey.length < 8 || deviceKey.length > 120) {
    return NextResponse.json(
      { error: "Identificador de dispositivo inválido." },
      { status: 400 },
    );
  }

  const now = new Date();
  const installation = await prisma.customerAppInstallation.upsert({
    where: {
      customerId_deviceKey: {
        customerId: session.customerId,
        deviceKey,
      },
    },
    update: {
      platform,
      lastSeenAt: now,
    },
    create: {
      customerId: session.customerId,
      deviceKey,
      platform,
      firstDetectedAt: now,
      lastSeenAt: now,
    },
    select: {
      id: true,
      platform: true,
      firstDetectedAt: true,
      lastSeenAt: true,
    },
  });

  return NextResponse.json({
    tracked: true,
    installation: {
      ...installation,
      firstDetectedAt: installation.firstDetectedAt.toISOString(),
      lastSeenAt: installation.lastSeenAt.toISOString(),
    },
  });
}
