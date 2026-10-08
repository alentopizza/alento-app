import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_TYPES = new Set([
  "MENU_VIEW",
  "PRODUCT_VIEW",
  "ADD_TO_CART",
  "CART_VIEW",
  "CHECKOUT_STARTED",
  "CART_EMPTIED",
  "ORDER_CREATED",
]);

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = text(body?.eventType, 40);

    if (!EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
    }

    const eventId = text(body?.eventId, 120);
    const visitorId = text(body?.visitorId, 120);
    const sessionId = text(body?.sessionId, 120);

    if (!eventId || !visitorId || !sessionId) {
      return NextResponse.json({ error: "Evento incompleto." }, { status: 400 });
    }

    const metadata =
      body?.metadata &&
      typeof body.metadata === "object" &&
      !Array.isArray(body.metadata)
        ? (body.metadata as Prisma.InputJsonValue)
        : undefined;

    await prisma.catalogAnalyticsEvent.create({
      data: {
        eventId,
        eventType,
        visitorId,
        sessionId,
        cartId: text(body?.cartId, 120) || null,
        productId: positiveInt(body?.productId),
        productName: text(body?.productName, 180) || null,
        path: text(body?.path, 240) || null,
        referrer: text(body?.referrer, 180) || null,
        source: text(body?.source, 120) || null,
        medium: text(body?.medium, 120) || null,
        campaign: text(body?.campaign, 160) || null,
        value: finiteNumber(body?.value),
        quantity: positiveInt(body?.quantity),
        itemCount: positiveInt(body?.itemCount),
        orderId: positiveInt(body?.orderId),
        metadata,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    console.error("Catalog analytics event failed", error);
    return NextResponse.json(
      { error: "No fue posible registrar la métrica." },
      { status: 500 },
    );
  }
}
