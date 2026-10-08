"use client";

export type CatalogAnalyticsEventType =
  | "MENU_VIEW"
  | "PRODUCT_VIEW"
  | "ADD_TO_CART"
  | "CART_VIEW"
  | "CHECKOUT_STARTED"
  | "CART_EMPTIED"
  | "ORDER_CREATED";

export type CatalogAnalyticsPayload = {
  productId?: number | null;
  productName?: string | null;
  value?: number | null;
  quantity?: number | null;
  itemCount?: number | null;
  orderId?: number | null;
  metadata?: Record<string, unknown>;
};

const VISITOR_KEY = "alento_analytics_visitor_id";
const SESSION_KEY = "alento_analytics_session_v1";
const CART_KEY = "alento_analytics_cart_id";
const ATTRIBUTION_KEY = "alento_analytics_attribution_v1";
const SESSION_TTL_MS = 30 * 60 * 1000;

function id(prefix: string) {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}-${value}`;
}

function readLocal(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function removeLocal(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

function visitorId() {
  const existing = readLocal(VISITOR_KEY);
  if (existing) return existing;
  const next = id("visitor");
  writeLocal(VISITOR_KEY, next);
  return next;
}

function sessionId() {
  const now = Date.now();
  try {
    const saved = readLocal(SESSION_KEY);
    const parsed = saved
      ? (JSON.parse(saved) as { id?: string; lastSeen?: number })
      : null;

    if (
      parsed?.id &&
      parsed.lastSeen &&
      now - parsed.lastSeen <= SESSION_TTL_MS
    ) {
      writeLocal(
        SESSION_KEY,
        JSON.stringify({ id: parsed.id, lastSeen: now }),
      );
      return parsed.id;
    }
  } catch {}

  const next = id("session");
  writeLocal(SESSION_KEY, JSON.stringify({ id: next, lastSeen: now }));
  return next;
}

function cartId(create: boolean) {
  const existing = readLocal(CART_KEY);
  if (existing) return existing;
  if (!create) return null;
  const next = id("cart");
  writeLocal(CART_KEY, next);
  return next;
}

function referrerHost() {
  if (!document.referrer) return "";
  try {
    return new URL(document.referrer).hostname;
  } catch {
    return "";
  }
}

function attribution() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = {
    source: (params.get("utm_source") || "").slice(0, 120),
    medium: (params.get("utm_medium") || "").slice(0, 120),
    campaign: (params.get("utm_campaign") || "").slice(0, 160),
  };

  if (fromUrl.source || fromUrl.medium || fromUrl.campaign) {
    writeLocal(ATTRIBUTION_KEY, JSON.stringify(fromUrl));
    return fromUrl;
  }

  try {
    const saved = readLocal(ATTRIBUTION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as typeof fromUrl;
      return {
        source: String(parsed.source || "").slice(0, 120),
        medium: String(parsed.medium || "").slice(0, 120),
        campaign: String(parsed.campaign || "").slice(0, 160),
      };
    }
  } catch {}

  const referrer = referrerHost();
  return {
    source: referrer || "direct",
    medium: referrer ? "referral" : "direct",
    campaign: "",
  };
}

export function trackCatalogEvent(
  eventType: CatalogAnalyticsEventType,
  payload: CatalogAnalyticsPayload = {},
) {
  if (typeof window === "undefined") return;

  const needsCart = [
    "ADD_TO_CART",
    "CART_VIEW",
    "CHECKOUT_STARTED",
    "ORDER_CREATED",
  ].includes(eventType);
  const currentCartId = cartId(needsCart);

  if (eventType === "CART_EMPTIED" && !currentCartId) return;

  const attr = attribution();
  const event = {
    eventId: id("event"),
    eventType,
    visitorId: visitorId(),
    sessionId: sessionId(),
    cartId: currentCartId,
    productId: payload.productId ?? null,
    productName: payload.productName ?? null,
    path: window.location.pathname,
    referrer: referrerHost(),
    source: attr.source,
    medium: attr.medium,
    campaign: attr.campaign,
    value: payload.value ?? null,
    quantity: payload.quantity ?? null,
    itemCount: payload.itemCount ?? null,
    orderId: payload.orderId ?? null,
    metadata: payload.metadata ?? null,
  };

  try {
    void fetch("/api/metrics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    });
  } catch {}

  window.dispatchEvent(
    new CustomEvent("alento-analytics-event", { detail: event }),
  );

  if (eventType === "ORDER_CREATED" || eventType === "CART_EMPTIED") {
    removeLocal(CART_KEY);
  }
}
