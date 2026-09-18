import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function base64Url(value: Buffer) {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function popupError(message: string) {
  const payload = JSON.stringify({ type: "rappi-oauth-error", message }).replace(/</g, "\\u003c");
  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;padding:32px"><script>
      try { window.opener?.postMessage(${payload}, window.location.origin); } catch {}
      setTimeout(() => window.close(), 500);
    </script><h2>No fue posible iniciar Rappi</h2><p>${message.replace(/[<>]/g, "")}</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: NextRequest) {
  const clientId = process.env.RAPPI_OAUTH_CLIENT_ID?.trim();
  const authorizeUrl = process.env.RAPPI_OAUTH_AUTHORIZE_URL?.trim() || "https://login.partners.rappi.com/authorize";
  const storesUrl = process.env.RAPPI_OAUTH_STORES_URL?.trim();

  if (!clientId || !storesUrl) {
    return popupError(
      !clientId
        ? "Rappi todavía no ha habilitado el cliente OAuth de Alentó."
        : "Falta configurar el endpoint de tiendas autorizado por Rappi.",
    );
  }

  const state = base64Url(randomBytes(24));
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const redirectUri =
    process.env.RAPPI_OAUTH_CALLBACK_URL?.trim() ||
    `${request.nextUrl.origin}/api/integrations/rappi/oauth/callback`;

  await prisma.appSetting.create({
    data: {
      key: `rappi_oauth_state:${state}`,
      value: {
        verifier,
        redirectUri,
        createdAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });

  const url = new URL(authorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", process.env.RAPPI_OAUTH_SCOPE?.trim() || "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "login");

  const audience = process.env.RAPPI_OAUTH_AUDIENCE?.trim();
  if (audience) url.searchParams.set("audience", audience);

  return NextResponse.redirect(url);
}
