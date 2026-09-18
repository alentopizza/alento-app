import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type OAuthStateValue = {
  verifier?: string;
  redirectUri?: string;
  createdAt?: string;
};

type StoreOption = {
  id: string;
  name: string;
  address: string;
};

function htmlMessage(payload: Record<string, unknown>, title: string, message: string) {
  const safePayload = JSON.stringify(payload).replace(/</g, "\\u003c");
  const safeTitle = title.replace(/[<>]/g, "");
  const safeMessage = message.replace(/[<>]/g, "");

  return new NextResponse(
    `<!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>${safeTitle}</title>
          <style>
            body{font-family:system-ui,-apple-system,sans-serif;background:#f7f5f2;margin:0;display:grid;place-items:center;min-height:100vh;color:#171717}
            .card{width:min(420px,calc(100vw - 40px));background:#fff;border:1px solid #e5e5e5;border-radius:22px;padding:28px;box-shadow:0 24px 70px rgba(0,0,0,.12)}
            h1{font-size:22px;margin:0 0 8px} p{font-size:14px;line-height:1.5;color:#666;margin:0}
          </style>
        </head>
        <body>
          <div class="card"><h1>${safeTitle}</h1><p>${safeMessage}</p></div>
          <script>
            try { window.opener?.postMessage(${safePayload}, window.location.origin); } catch {}
            setTimeout(() => window.close(), 900);
          </script>
        </body>
      </html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function collectStoreCandidates(value: unknown, result: StoreOption[], depth = 0) {
  if (depth > 5 || result.length >= 100 || value == null) return;

  if (Array.isArray(value)) {
    for (const item of value) collectStoreCandidates(item, result, depth + 1);
    return;
  }

  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  const rawId =
    record.store_id ??
    record.storeId ??
    record.id ??
    record.restaurant_id ??
    record.restaurantId ??
    record.rappi_store_id;

  const rawName =
    record.name ??
    record.store_name ??
    record.storeName ??
    record.restaurant_name ??
    record.restaurantName ??
    record.trade_name;

  if (
    (typeof rawId === "string" || typeof rawId === "number") &&
    typeof rawName === "string" &&
    rawName.trim()
  ) {
    const addressValue =
      record.address ??
      record.store_address ??
      record.storeAddress ??
      record.full_address ??
      record.fullAddress ??
      "";

    const option = {
      id: String(rawId),
      name: rawName.trim(),
      address: typeof addressValue === "string" ? addressValue.trim() : "",
    };

    if (!result.some((item) => item.id === option.id)) result.push(option);
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      collectStoreCandidates(nested, result, depth + 1);
    }
  }
}

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (error) {
    return htmlMessage(
      { type: "rappi-oauth-error", message: errorDescription || error },
      "Rappi no autorizó la conexión",
      errorDescription || error,
    );
  }

  if (!code || !state) {
    return htmlMessage(
      { type: "rappi-oauth-error", message: "Rappi no devolvió una autorización válida." },
      "No fue posible conectar Rappi",
      "Rappi no devolvió una autorización válida.",
    );
  }

  const stateKey = `rappi_oauth_state:${state}`;
  const savedState = await prisma.appSetting.findUnique({ where: { key: stateKey } });
  const stateValue =
    savedState?.value && typeof savedState.value === "object" && !Array.isArray(savedState.value)
      ? savedState.value as OAuthStateValue
      : null;

  await prisma.appSetting.deleteMany({ where: { key: stateKey } });

  if (!stateValue?.verifier || !stateValue.redirectUri) {
    return htmlMessage(
      { type: "rappi-oauth-error", message: "La sesión de conexión expiró. Intenta nuevamente." },
      "Sesión expirada",
      "La sesión de conexión expiró. Intenta nuevamente desde Alentó.",
    );
  }

  const clientId = process.env.RAPPI_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.RAPPI_OAUTH_CLIENT_SECRET?.trim();
  const authorizeUrl =
    process.env.RAPPI_OAUTH_AUTHORIZE_URL?.trim() ||
    "https://login.partners.rappi.com/authorize";
  const tokenUrl =
    process.env.RAPPI_OAUTH_TOKEN_URL?.trim() ||
    `${new URL(authorizeUrl).origin}/oauth/token`;
  const storesUrl = process.env.RAPPI_OAUTH_STORES_URL?.trim();

  if (!clientId || !storesUrl) {
    return htmlMessage(
      { type: "rappi-oauth-error", message: "La integración OAuth de Alentó aún no está habilitada por Rappi." },
      "Integración pendiente",
      "Rappi todavía debe habilitar las credenciales OAuth de Alentó.",
    );
  }

  try {
    const tokenBody: Record<string, string> = {
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: stateValue.redirectUri,
      code_verifier: stateValue.verifier,
    };
    if (clientSecret) tokenBody.client_secret = clientSecret;

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenBody),
      cache: "no-store",
    });

    const tokenData = await tokenResponse.json().catch(() => null) as Record<string, unknown> | null;
    const accessToken =
      tokenData && typeof tokenData.access_token === "string"
        ? tokenData.access_token
        : tokenData && typeof tokenData.token === "string"
          ? tokenData.token
          : "";

    if (!tokenResponse.ok || !accessToken) {
      const detail =
        tokenData && typeof tokenData.error_description === "string"
          ? tokenData.error_description
          : tokenData && typeof tokenData.message === "string"
            ? tokenData.message
            : "Rappi rechazó el intercambio de autorización.";

      return htmlMessage(
        { type: "rappi-oauth-error", message: detail },
        "No fue posible completar el acceso",
        detail,
      );
    }

    const storesResponse = await fetch(storesUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-authorization": `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const storesData = await storesResponse.json().catch(() => null);

    if (!storesResponse.ok) {
      return htmlMessage(
        { type: "rappi-oauth-error", message: "Rappi autorizó la cuenta, pero no permitió consultar sus tiendas." },
        "No fue posible listar las tiendas",
        "Rappi autorizó la cuenta, pero no permitió consultar sus tiendas.",
      );
    }

    const stores: StoreOption[] = [];
    collectStoreCandidates(storesData, stores);

    if (stores.length === 0) {
      return htmlMessage(
        { type: "rappi-oauth-error", message: "La cuenta fue autorizada, pero Rappi no devolvió tiendas disponibles." },
        "Sin tiendas disponibles",
        "La cuenta fue autorizada, pero Rappi no devolvió tiendas disponibles.",
      );
    }

    const sessionId = randomBytes(24).toString("hex");
    await prisma.appSetting.create({
      data: {
        key: `rappi_oauth_session:${sessionId}`,
        value: {
          stores,
          createdAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return htmlMessage(
      {
        type: "rappi-oauth-stores",
        sessionId,
        stores,
      },
      "Cuenta Rappi autorizada",
      `Encontramos ${stores.length} tienda(s). Regresa a Alentó para seleccionar cuál deseas integrar.`,
    );
  } catch (callbackError) {
    const message =
      callbackError instanceof Error
        ? callbackError.message
        : "No fue posible completar la conexión con Rappi.";

    return htmlMessage(
      { type: "rappi-oauth-error", message },
      "Error conectando Rappi",
      message,
    );
  }
}
