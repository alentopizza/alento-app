import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDriverLocationToken } from "@/lib/driverLocationToken";

function text(value: unknown, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const campaign = await prisma.pushCampaign.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!campaign) {
    return NextResponse.json(
      { error: "Campaña no encontrada." },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const channel = text(body?.channel, 20).toUpperCase();

  let userId: number | null = null;
  let recipientKey = "";

  if (channel === "ANDROID") {
    const nativeToken = request.headers
      .get("x-alento-driver-location-token")
      ?.trim();
    const payload = verifyDriverLocationToken(nativeToken);

    if (!payload) {
      return NextResponse.json(
        { error: "Token nativo inválido o vencido." },
        { status: 401 },
      );
    }

    const deviceKey = text(body?.deviceKey, 160);
    if (!deviceKey) {
      return NextResponse.json(
        { error: "Dispositivo inválido." },
        { status: 400 },
      );
    }

    userId = payload.userId;
    recipientKey = `native:${deviceKey}`;
  } else if (channel === "WEB") {
    const supplied = text(body?.recipientKey, 200);
    if (!supplied.startsWith("web:")) {
      return NextResponse.json(
        { error: "Identificador web inválido." },
        { status: 400 },
      );
    }
    recipientKey = supplied;
  } else {
    return NextResponse.json(
      { error: "Canal inválido." },
      { status: 400 },
    );
  }

  const existing = await prisma.pushCampaignOpen.findUnique({
    where: {
      campaignId_channel_recipientKey: {
        campaignId: id,
        channel,
        recipientKey,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ ok: true, counted: false });
  }

  await prisma.$transaction([
    prisma.pushCampaignOpen.create({
      data: {
        campaignId: id,
        userId,
        channel,
        recipientKey,
      },
    }),
    prisma.pushCampaign.update({
      where: { id },
      data: {
        openedCount: { increment: 1 },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, counted: true });
}
