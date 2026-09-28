import { createHmac, timingSafeEqual } from "node:crypto";

type JsonObject = Record<string, unknown>;

type RappiTokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: RappiTokenCache | null = null;

function envBoolean(value: string | undefined, fallback = false) {
  if (value == null || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function normalizedBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export type RappiConfig = {
  enabled: boolean;
  environment: "sandbox" | "production";
  apiBaseUrl: string;
  storeId: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  autoAccept: boolean;
  rejectCancelType: string;
};

export function rappiConfig(): RappiConfig {
  const environment =
    process.env.RAPPI_ENVIRONMENT?.trim().toLowerCase() === "production"
      ? "production"
      : "sandbox";

  const defaultBaseUrl =
    environment === "production"
      ? "https://api.rappi.com.co"
      : "https://api.dev.rappi.com";

  return {
    enabled: envBoolean(process.env.RAPPI_ENABLED, false),
    environment,
    apiBaseUrl: normalizedBaseUrl(
      process.env.RAPPI_API_BASE_URL?.trim() || defaultBaseUrl,
    ),
    storeId: process.env.RAPPI_STORE_ID?.trim() || "",
    clientId: process.env.RAPPI_CLIENT_ID?.trim() || "",
    clientSecret: process.env.RAPPI_CLIENT_SECRET?.trim() || "",
    webhookSecret: process.env.RAPPI_WEBHOOK_SECRET?.trim() || "",
    autoAccept: envBoolean(process.env.RAPPI_AUTO_ACCEPT, false),
    rejectCancelType: process.env.RAPPI_REJECT_CANCEL_TYPE?.trim() || "",
  };
}

export function rappiIntegrationStatus() {
  const config = rappiConfig();
  return {
    enabled: config.enabled,
    environment: config.environment,
    apiBaseUrl: config.apiBaseUrl,
    storeId: config.storeId || null,
    autoAccept: config.autoAccept,
    apiConfigured: Boolean(
      config.enabled &&
        config.storeId &&
        config.clientId &&
        config.clientSecret,
    ),
    webhookConfigured: Boolean(config.enabled && config.webhookSecret),
    rejectConfigured: Boolean(config.rejectCancelType),
  };
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function tokenFromResponse(value: unknown) {
  const data = asObject(value);
  if (!data) return null;

  const direct = data.access_token;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const nested =
    asObject(data.data)?.access_token ??
    asObject(data.response)?.access_token;

  return typeof nested === "string" && nested.trim()
    ? nested.trim()
    : null;
}

function tokenTtlSeconds(value: unknown) {
  const data = asObject(value);
  const candidates = [
    data?.expires_in,
    asObject(data?.data)?.expires_in,
    asObject(data?.response)?.expires_in,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 60) return parsed;
  }

  // Rappi documenta actualmente una vigencia de una semana. Dejamos margen
  // para renovar antes de que el token expire.
  return 6 * 24 * 60 * 60;
}

async function fetchRappiToken(force = false) {
  const config = rappiConfig();

  if (!config.enabled) {
    throw new Error("La integración con Rappi está deshabilitada.");
  }

  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      "Faltan RAPPI_CLIENT_ID o RAPPI_CLIENT_SECRET en el servidor.",
    );
  }

  if (
    !force &&
    tokenCache &&
    tokenCache.expiresAt > Date.now() + 5 * 60_000
  ) {
    return tokenCache.token;
  }

  const response = await fetch(
    `${config.apiBaseUrl}/restaurants/auth/v1/token/login/integrations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    },
  );

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(
      `Rappi rechazó la autenticación (${response.status}).`,
    );
  }

  const token = tokenFromResponse(payload);
  if (!token) {
    throw new Error("Rappi no devolvió un access_token válido.");
  }

  const ttlSeconds = tokenTtlSeconds(payload);
  tokenCache = {
    token,
    expiresAt: Date.now() + ttlSeconds * 1000,
  };

  return token;
}

async function rappiRequest(
  path: string,
  init: RequestInit = {},
  retryAuth = true,
) {
  const config = rappiConfig();
  if (!config.enabled) {
    throw new Error("La integración con Rappi está deshabilitada.");
  }

  const token = await fetchRappiToken();
  const headers = new Headers(init.headers);
  headers.set("x-authorization", `Bearer ${token}`);
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(12_000),
  });

  if (response.status === 401 && retryAuth) {
    tokenCache = null;
    await fetchRappiToken(true);
    return rappiRequest(path, init, false);
  }

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const data = asObject(payload);
    const message =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.description === "string" && data.description) ||
      `Rappi respondió con HTTP ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

function encoded(value: string | number) {
  return encodeURIComponent(String(value));
}

function resolveStoreId(storeId?: string | number | null) {
  const value = String(storeId ?? "").trim() || rappiConfig().storeId;
  if (!value) {
    throw new Error("Falta RAPPI_STORE_ID en el servidor.");
  }
  return value;
}

export async function rappiListStoreOrders(storeId?: string | null) {
  const resolvedStoreId = resolveStoreId(storeId);
  return rappiRequest(
    `/restaurants/orders/v1/stores/${encoded(resolvedStoreId)}/orders`,
    { method: "GET" },
  );
}

export async function rappiTakeOrder(input: {
  storeId?: string | null;
  orderId: string;
  cookingTime?: number | null;
}) {
  const storeId = resolveStoreId(input.storeId);
  const orderId = input.orderId.trim();
  if (!orderId) throw new Error("El pedido Rappi no tiene orderId.");

  const cookingTime = Number(input.cookingTime);
  const suffix =
    Number.isInteger(cookingTime) && cookingTime > 0
      ? `/cooking_time/${cookingTime}/take`
      : "/take";

  return rappiRequest(
    `/restaurants/orders/v1/stores/${encoded(storeId)}/orders/${encoded(orderId)}${suffix}`,
    { method: "PUT" },
  );
}

export async function rappiReadyForPickup(input: {
  storeId?: string | null;
  orderId: string;
}) {
  const storeId = resolveStoreId(input.storeId);
  const orderId = input.orderId.trim();
  if (!orderId) throw new Error("El pedido Rappi no tiene orderId.");

  return rappiRequest(
    `/restaurants/orders/v1/stores/${encoded(storeId)}/orders/${encoded(orderId)}/ready-for-pickup`,
    { method: "POST" },
  );
}

export async function rappiRejectOrder(input: {
  storeId?: string | null;
  orderId: string;
  cancelType?: string | number | null;
}) {
  const storeId = resolveStoreId(input.storeId);
  const orderId = input.orderId.trim();
  const cancelType =
    String(input.cancelType ?? "").trim() ||
    rappiConfig().rejectCancelType;

  if (!orderId) throw new Error("El pedido Rappi no tiene orderId.");
  if (!cancelType) {
    throw new Error(
      "Falta RAPPI_REJECT_CANCEL_TYPE. Debe configurarse con el tipo de rechazo habilitado por Rappi.",
    );
  }

  return rappiRequest(
    `/restaurants/orders/v1/stores/${encoded(storeId)}/orders/${encoded(orderId)}/cancel_type/${encoded(cancelType)}/reject`,
    { method: "PUT" },
  );
}

export function verifyRappiWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
) {
  const secret = rappiConfig().webhookSecret;
  if (!secret || !signatureHeader) return false;

  const parts = new Map<string, string>();
  signatureHeader.split(",").forEach((piece) => {
    const separator = piece.indexOf("=");
    if (separator <= 0) return;
    parts.set(
      piece.slice(0, separator).trim().toLowerCase(),
      piece.slice(separator + 1).trim(),
    );
  });

  const timestamp = parts.get("t");
  const signature = parts.get("sign");
  if (!timestamp || !signature || !/^[a-f0-9]+$/i.test(signature)) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function extractRappiOrders(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const data = asObject(value);
  if (!data) return [];

  for (const candidate of [
    data.orders,
    data.data,
    asObject(data.data)?.orders,
    data.response,
    asObject(data.response)?.orders,
  ]) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}
