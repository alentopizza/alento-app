import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  if (channel !== "WEB") {
    return NextResponse.json(
      { error: "Canal inválido." },
      { status: 400 },
    );
  }

  const recipientKey = text(body?.recipientKey, 200);
  if (!recipientKey.startsWith("web:")) {
    return NextResponse.json(
      { error: "Identificador web inválido." },
      { status: 400 },
    );
  }

  const subscriptionId = recipientKey.slice(4);
  const subscription = await prisma.driverPushSubscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, userId: true },
  });

  if (!subscription) {
    return NextResponse.json(
      { error: "Suscripción web no registrada." },
      { status: 404 },
    );
  }

  const existing = await prisma.pushCampaignOpen.findUnique({
    where: {
      campaignId_channel_recipientKey: {
        campaignId: id,
        channel: "WEB",
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
        userId: subscription.userId,
        channel: "WEB",
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
