import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function secureEqual(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function phoneCandidates(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return { e164: "", local: [] as string[] };

  const local =
    digits.startsWith("57") && digits.length === 12 ? digits.slice(2) : digits;

  const e164 =
    digits.startsWith("57")
      ? `+${digits}`
      : digits.length === 10
        ? `+57${digits}`
        : `+${digits}`;

  return {
    e164,
    local: Array.from(new Set([digits, local].filter(Boolean))),
  };
}

function orderCode(source: string, sequenceNumber: number | null, id: number) {
  const number = sequenceNumber ?? id;
  return `${source}-${String(number).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  const configuredKey = process.env.CHATWOOT_DASHBOARD_KEY?.trim() ?? "";
  const receivedKey = request.headers.get("x-alento-chatwoot-key")?.trim() ?? "";

  if (!configuredKey) {
    return NextResponse.json(
      { error: "La integración de Chatwoot todavía no tiene una clave configurada." },
      { status: 503 },
    );
  }

  if (!receivedKey || !secureEqual(receivedKey, configuredKey)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const rawPhone = request.nextUrl.searchParams.get("phone")?.trim() ?? "";
  const { e164, local } = phoneCandidates(rawPhone);

  if (!rawPhone || local.length === 0) {
    return NextResponse.json({ error: "Teléfono inválido." }, { status: 400 });
  }

  let customerId: number | null = null;

  if (e164) {
    const account = await prisma.customerAccount.findUnique({
      where: { phoneE164: e164 },
      select: { customerId: true },
    });
    customerId = account?.customerId ?? null;
  }

  const customer = customerId
    ? await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          name: true,
          phone: true,
          countryCode: true,
          email: true,
          notes: true,
          addresses: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: { address: true, neighborhood: true, city: true },
          },
        },
      })
    : await prisma.customer.findFirst({
        where: { phone: { in: local } },
        select: {
          id: true,
          name: true,
          phone: true,
          countryCode: true,
          email: true,
          notes: true,
          addresses: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: { address: true, neighborhood: true, city: true },
          },
        },
      });

  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  const [aggregate, orders] = await Promise.all([
    prisma.order.aggregate({
      where: { customerId: customer.id, status: { not: "CANCELED" } },
      _count: { _all: true },
      _sum: { total: true },
      _avg: { total: true },
      _max: { createdAt: true },
    }),
    prisma.order.findMany({
      where: { customerId: customer.id, status: { not: "CANCELED" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        sequenceNumber: true,
        source: true,
        status: true,
        fulfillmentType: true,
        total: true,
        createdAt: true,
        items: {
          orderBy: { id: "asc" },
          select: { productName: true, quantity: true },
        },
      },
    }),
  ]);

  const response = NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      countryCode: customer.countryCode,
      email: customer.email,
      notes: customer.notes,
      defaultAddress: customer.addresses[0] ?? null,
    },
    metrics: {
      purchaseCount: aggregate._count._all,
      totalSpent: Number(aggregate._sum.total ?? 0),
      averageTicket: Number(aggregate._avg.total ?? 0),
      lastOrderAt: aggregate._max.createdAt,
    },
    orders: orders.map((order) => ({
      id: order.id,
      code: orderCode(order.source, order.sequenceNumber, order.id),
      status: order.status,
      fulfillmentType: order.fulfillmentType,
      total: Number(order.total),
      createdAt: order.createdAt,
      items: order.items,
    })),
  });

  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
