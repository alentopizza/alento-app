import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { orderItemDetailText } from "@/lib/orderPresentation";

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

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.floor((a.getTime() - b.getTime()) / 86400000));
}

function commercialSignal(args: {
  purchaseCount: number;
  lastOrderAt: Date | null;
  frequencyDays: number | null;
}) {
  const { purchaseCount, lastOrderAt, frequencyDays } = args;
  if (purchaseCount === 0) return "SIN_COMPRAS";
  if (purchaseCount === 1) return "NUEVO";

  if (lastOrderAt) {
    const daysSinceLastOrder = daysBetween(new Date(), lastOrderAt);
    const recoveryThreshold = Math.max(21, Math.round((frequencyDays ?? 14) * 1.6));
    if (daysSinceLastOrder > recoveryThreshold) return "POR_RECUPERAR";
  }

  if (purchaseCount >= 4) return "FRECUENTE";
  return "ACTIVO";
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
          createdAt: true,
          addresses: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              label: true,
              address: true,
              formattedAddress: true,
              neighborhood: true,
              city: true,
              notes: true,
              latitude: true,
              longitude: true,
            },
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
          createdAt: true,
          addresses: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              label: true,
              address: true,
              formattedAddress: true,
              neighborhood: true,
              city: true,
              notes: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      });

  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  const orderWhere = {
    customerId: customer.id,
    status: { not: "CANCELED" as const },
  };

  const [ordersForMetrics, recentOrders, points] = await Promise.all([
    prisma.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: "desc" },
      select: {
        total: true,
        createdAt: true,
      },
    }),
    prisma.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        sequenceNumber: true,
        source: true,
        status: true,
        fulfillmentType: true,
        subtotal: true,
        deliveryFee: true,
        discount: true,
        total: true,
        notes: true,
        deliveryZoneName: true,
        createdAt: true,
        address: {
          select: {
            address: true,
            formattedAddress: true,
            neighborhood: true,
            city: true,
            notes: true,
            latitude: true,
            longitude: true,
          },
        },
        items: {
          orderBy: { id: "asc" },
          select: {
            productName: true,
            variantName: true,
            quantity: true,
            lineTotal: true,
            configuration: true,
            notes: true,
          },
        },
        payments: {
          orderBy: { id: "asc" },
          select: {
            method: true,
            amount: true,
            cashReceived: true,
            changeDue: true,
            status: true,
          },
        },
      },
    }),
    prisma.clubPointTransaction.aggregate({
      where: { customerId: customer.id },
      _sum: { points: true },
    }),
  ]);

  const purchaseCount = ordersForMetrics.length;
  const totalSpent = ordersForMetrics.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );
  const averageTicket = purchaseCount ? totalSpent / purchaseCount : 0;
  const chronological = [...ordersForMetrics].reverse();
  const firstOrderAt = chronological[0]?.createdAt ?? null;
  const lastOrderAt = ordersForMetrics[0]?.createdAt ?? null;
  const frequencyDays =
    purchaseCount > 1 && firstOrderAt && lastOrderAt
      ? Math.max(
          1,
          Math.round(
            (lastOrderAt.getTime() - firstOrderAt.getTime()) /
              86400000 /
              (purchaseCount - 1),
          ),
        )
      : null;
  const daysSinceLastOrder = lastOrderAt ? daysBetween(new Date(), lastOrderAt) : null;
  const signal = commercialSignal({ purchaseCount, lastOrderAt, frequencyDays });

  const response = NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      countryCode: customer.countryCode,
      email: customer.email,
      notes: customer.notes,
      createdAt: customer.createdAt,
      defaultAddress: customer.addresses[0] ?? null,
    },
    metrics: {
      purchaseCount,
      totalSpent,
      averageTicket,
      firstOrderAt,
      lastOrderAt,
      frequencyDays,
      daysSinceLastOrder,
      commercialSignal: signal,
      clubPoints: points._sum.points ?? 0,
    },
    orders: recentOrders.map((order) => ({
      id: order.id,
      code: orderCode(order.source, order.sequenceNumber, order.id),
      source: order.source,
      status: order.status,
      fulfillmentType: order.fulfillmentType,
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee),
      discount: Number(order.discount),
      total: Number(order.total),
      notes: order.notes,
      deliveryZoneName: order.deliveryZoneName,
      createdAt: order.createdAt,
      address: order.address,
      items: order.items.map((item) => ({
        productName: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        lineTotal: Number(item.lineTotal),
        detail: orderItemDetailText(item.configuration),
        notes: item.notes,
      })),
      payments: order.payments.map((payment) => ({
        method: payment.method,
        amount: Number(payment.amount),
        cashReceived:
          payment.cashReceived == null ? null : Number(payment.cashReceived),
        changeDue:
          payment.changeDue == null ? null : Number(payment.changeDue),
        status: payment.status,
      })),
    })),
  });

  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
