import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BOGOTA_TZ = "America/Bogota";

function bogotaHour(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOGOTA_TZ,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const raw = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  return raw === 24 ? 0 : raw;
}

function bogotaDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

export async function GET(request: NextRequest) {
  try {
    await requireStaffSession(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const requested = Number(request.nextUrl.searchParams.get("days") || 7);
  const days = [1, 7, 30, 90].includes(requested) ? requested : 7;
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const events = await prisma.catalogAnalyticsEvent.findMany({
    where: { createdAt: { gte: start, lte: now } },
    orderBy: { createdAt: "asc" },
    select: {
      eventType: true,
      visitorId: true,
      sessionId: true,
      cartId: true,
      productId: true,
      productName: true,
      source: true,
      medium: true,
      campaign: true,
      value: true,
      itemCount: true,
      orderId: true,
      createdAt: true,
    },
  });

  const menuViews = events.filter((event) => event.eventType === "MENU_VIEW");
  const productViews = events.filter(
    (event) => event.eventType === "PRODUCT_VIEW",
  );
  const addEvents = events.filter(
    (event) => event.eventType === "ADD_TO_CART",
  );
  const checkoutEvents = events.filter(
    (event) => event.eventType === "CHECKOUT_STARTED",
  );
  const orderEvents = events.filter(
    (event) => event.eventType === "ORDER_CREATED",
  );

  const uniqueVisitors = new Set(menuViews.map((event) => event.visitorId));
  const cartsStarted = new Set(
    addEvents.map((event) => event.cartId).filter(Boolean),
  );
  const checkoutCarts = new Set(
    checkoutEvents.map((event) => event.cartId).filter(Boolean),
  );
  const completedCarts = new Set(
    orderEvents.map((event) => event.cartId).filter(Boolean),
  );

  const byCart = new Map<
    string,
    {
      hasAdd: boolean;
      completed: boolean;
      emptied: boolean;
      lastAt: Date;
      value: number;
    }
  >();

  for (const event of events) {
    if (!event.cartId) continue;

    const current = byCart.get(event.cartId) ?? {
      hasAdd: false,
      completed: false,
      emptied: false,
      lastAt: event.createdAt,
      value: 0,
    };

    if (event.eventType === "ADD_TO_CART") current.hasAdd = true;
    if (event.eventType === "ORDER_CREATED") {
      current.completed = true;
      current.value = Number(event.value ?? 0);
    }
    if (event.eventType === "CART_EMPTIED") current.emptied = true;
    if (event.createdAt > current.lastAt) current.lastAt = event.createdAt;

    byCart.set(event.cartId, current);
  }

  const abandonmentCutoff = now.getTime() - 30 * 60 * 1000;
  const abandonedCarts = [...byCart.values()].filter(
    (cart) =>
      cart.hasAdd &&
      !cart.completed &&
      !cart.emptied &&
      cart.lastAt.getTime() <= abandonmentCutoff,
  ).length;

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    menuViews: 0,
    productViews: 0,
    adds: 0,
    orders: 0,
  }));

  for (const event of events) {
    const bucket = hourly[bogotaHour(event.createdAt)];
    if (event.eventType === "MENU_VIEW") bucket.menuViews += 1;
    if (event.eventType === "PRODUCT_VIEW") bucket.productViews += 1;
    if (event.eventType === "ADD_TO_CART") bucket.adds += 1;
    if (event.eventType === "ORDER_CREATED") bucket.orders += 1;
  }

  const productMap = new Map<
    number | string,
    { productId: number | null; name: string; views: number; adds: number }
  >();

  for (const event of events) {
    if (
      !["PRODUCT_VIEW", "ADD_TO_CART"].includes(event.eventType) ||
      (!event.productId && !event.productName)
    ) {
      continue;
    }

    const key = event.productId ?? event.productName ?? "sin-producto";
    const current = productMap.get(key) ?? {
      productId: event.productId ?? null,
      name: event.productName || `Producto ${event.productId ?? ""}`.trim(),
      views: 0,
      adds: 0,
    };

    if (event.eventType === "PRODUCT_VIEW") current.views += 1;
    if (event.eventType === "ADD_TO_CART") current.adds += 1;
    productMap.set(key, current);
  }

  const topProducts = [...productMap.values()]
    .map((product) => ({
      ...product,
      addRate: pct(product.adds, product.views),
    }))
    .sort((a, b) => b.views - a.views || b.adds - a.adds)
    .slice(0, 15);

  const sourceMap = new Map<string, { source: string; views: number; visitors: Set<string> }>();
  for (const event of menuViews) {
    const key = event.source || "direct";
    const current = sourceMap.get(key) ?? {
      source: key,
      views: 0,
      visitors: new Set<string>(),
    };
    current.views += 1;
    current.visitors.add(event.visitorId);
    sourceMap.set(key, current);
  }

  const sources = [...sourceMap.values()]
    .map((source) => ({
      source: source.source,
      views: source.views,
      visitors: source.visitors.size,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 12);

  const dayMap = new Map<
    string,
    { date: string; menuViews: number; visitors: Set<string>; orders: number }
  >();

  for (const event of events) {
    const date = bogotaDate(event.createdAt);
    const current = dayMap.get(date) ?? {
      date,
      menuViews: 0,
      visitors: new Set<string>(),
      orders: 0,
    };

    if (event.eventType === "MENU_VIEW") {
      current.menuViews += 1;
      current.visitors.add(event.visitorId);
    }
    if (event.eventType === "ORDER_CREATED") current.orders += 1;

    dayMap.set(date, current);
  }

  const trend = [...dayMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({
      date: day.date,
      menuViews: day.menuViews,
      visitors: day.visitors.size,
      orders: day.orders,
    }));

  const revenue = orderEvents.reduce(
    (sum, event) => sum + Number(event.value ?? 0),
    0,
  );

  return NextResponse.json({
    period: { days, start: start.toISOString(), end: now.toISOString() },
    summary: {
      menuViews: menuViews.length,
      uniqueVisitors: uniqueVisitors.size,
      productViews: productViews.length,
      addToCartActions: addEvents.length,
      cartsStarted: cartsStarted.size,
      checkoutStarted: checkoutCarts.size,
      orders: orderEvents.length,
      abandonedCarts,
      revenue,
      menuToCartRate: pct(cartsStarted.size, uniqueVisitors.size),
      cartToOrderRate: pct(completedCarts.size, cartsStarted.size),
      conversionRate: pct(orderEvents.length, uniqueVisitors.size),
    },
    hourly,
    trend,
    topProducts,
    sources,
  });
}
