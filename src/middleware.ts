import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/observability";

const STAFF_COOKIE = "alento_staff_session";
const STAFF_SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
const STAFF_SESSION_REFRESH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function withRequestId(response: NextResponse, requestId: string) {
  response.headers.set("X-Request-Id", requestId);
  return response;
}

function nextWithRequestId(request: NextRequest, requestId: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  return withRequestId(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    requestId,
  );
}

const PAGE_ROLE_RULES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/usuarios", roles: ["ADMIN"] },
  { prefix: "/configuracion", roles: ["ADMIN"] },
  { prefix: "/personalizacion", roles: ["ADMIN"] },
  { prefix: "/interno/menu", roles: ["ADMIN"] },
  { prefix: "/cupones", roles: ["ADMIN"] },
  { prefix: "/caja", roles: ["ADMIN", "CASHIER"] },
  { prefix: "/cocina", roles: ["ADMIN", "KITCHEN"] },
  { prefix: "/masa", roles: ["ADMIN", "KITCHEN"] },
  { prefix: "/notificaciones", roles: ["ADMIN"] },
  { prefix: "/club-alento", roles: ["ADMIN"] },
  { prefix: "/turnos", roles: ["ADMIN"] },
  { prefix: "/metricas", roles: ["ADMIN"] },
  { prefix: "/auditoria", roles: ["ADMIN"] },
  { prefix: "/salud-sistema", roles: ["ADMIN"] },
  { prefix: "/clientes", roles: ["ADMIN", "POS"] },
  { prefix: "/pedidos", roles: ["ADMIN", "POS", "CASHIER"] },
];

const PROTECTED_API_PREFIXES = [
  "/api/users",
  "/api/menu-admin",
  "/api/public-home-admin",
  "/api/settings",
  "/api/coupons",
  "/api/caja",
  "/api/customers",
  "/api/orders",
  "/api/delivery",
  "/api/discount",
  "/api/audit-logs",
  "/api/observability",
];

function isIndexablePublicPage(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/menu" ||
    pathname.startsWith("/menu/") ||
    pathname === "/club" ||
    pathname === "/ubicacion" ||
    pathname === "/domicilios"
  );
}

function applySearchHeaders(response: NextResponse, pathname: string) {
  if (!isIndexablePublicPage(pathname)) {
    response.headers.set(
      "X-Robots-Tag",
      "noindex, nofollow, noarchive, nosnippet",
    );
  }
  return response;
}

function isProtectedPage(pathname: string) {
  if (pathname === "/interno" || pathname.startsWith("/interno/")) {
    return true;
  }

  return PAGE_ROLE_RULES.some(
    (item) =>
      pathname === item.prefix ||
      pathname.startsWith(`${item.prefix}/`),
  );
}

function isProtectedApi(pathname: string) {
  return PROTECTED_API_PREFIXES.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isPublicStaffApiException(pathname: string, method: string) {
  return (
    (pathname === "/api/delivery/quote" && method === "POST") ||
    (pathname === "/api/delivery/origin" && method === "GET") ||
    (pathname === "/api/delivery/customer-default-address" &&
      ["GET", "PUT"].includes(method)) ||
    (pathname === "/api/observability/client-error" && method === "POST")
  );
}

function apiRoles(pathname: string, method: string): string[] | null {
  if (pathname.startsWith("/api/users")) return ["ADMIN"];
  if (pathname.startsWith("/api/menu-admin")) return ["ADMIN"];
  if (pathname.startsWith("/api/public-home-admin")) return ["ADMIN"];
  if (pathname.startsWith("/api/audit-logs")) return ["ADMIN"];
  if (pathname.startsWith("/api/observability")) return ["ADMIN"];

  if (pathname === "/api/settings") {
    return method === "GET" ? ["ADMIN", "POS", "CASHIER"] : ["ADMIN"];
  }

  if (pathname === "/api/coupons") {
    return method === "GET" ? ["ADMIN", "POS", "CASHIER"] : ["ADMIN"];
  }
  if (pathname.startsWith("/api/coupons/")) return ["ADMIN"];

  if (pathname.startsWith("/api/cocina/push")) return ["ADMIN", "KITCHEN"];
  if (pathname.startsWith("/api/caja")) return ["ADMIN", "CASHIER"];
  if (pathname.startsWith("/api/customers")) return ["ADMIN", "POS", "CASHIER"];
  if (pathname.startsWith("/api/delivery")) return ["ADMIN", "POS", "CASHIER"];
  if (pathname.startsWith("/api/discount")) return ["ADMIN", "POS", "CASHIER"];

  if (pathname.startsWith("/api/orders/")) {
    if (pathname.endsWith("/history-import")) return ["ADMIN"];
    if (pathname.includes("/items/") && pathname.endsWith("/prepared")) return ["ADMIN", "KITCHEN"];
    if (
      pathname.endsWith("/payment") ||
      /\/payment\/\d+(?:\/refund)?$/.test(pathname)
    ) {
      return ["ADMIN", "POS", "CASHIER"];
    }
    if (pathname.endsWith("/driver")) return ["ADMIN", "POS", "CASHIER"];
    if (pathname.endsWith("/delivery-address")) return ["ADMIN", "POS", "CASHIER"];
    if (pathname.endsWith("/edit")) return ["ADMIN", "POS", "CASHIER"];
    if (pathname.endsWith("/status")) return ["ADMIN", "POS", "KITCHEN", "CASHIER"];
    if (/^\/api\/orders\/\d+$/.test(pathname)) return ["ADMIN", "POS", "CASHIER", "KITCHEN"];
    if (method === "GET") return ["ADMIN", "POS", "KITCHEN", "CASHIER"];
    return ["ADMIN", "POS"];
  }

  if (pathname === "/api/orders") {
    return method === "GET"
      ? ["ADMIN", "POS", "KITCHEN", "CASHIER"]
      : ["ADMIN", "POS", "CASHIER"];
  }

  return null;
}

function base64urlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function readStaffSession(request: NextRequest) {
  const token = request.cookies.get(STAFF_COOKIE)?.value;
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!token || !secret) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToBytes(signature),
      new TextEncoder().encode(encoded),
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(encoded))) as {
      kind?: string;
      userId?: number;
      email?: string;
      name?: string;
      exp?: number;
      roles?: string[];
      sessionVersion?: number;
    };

    if (payload.kind !== "staff" || !payload.exp || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function refreshStaffSessionToken(session: {
  kind?: string;
  userId?: number;
  email?: string;
  name?: string;
  exp?: number;
  roles?: string[];
  sessionVersion?: number;
}) {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || session.kind !== "staff") return null;

  const payload = {
    kind: "staff",
    userId: session.userId,
    email: session.email,
    name: session.name,
    roles: session.roles ?? [],
    sessionVersion: session.sessionVersion,
    exp: Date.now() + STAFF_SESSION_MAX_AGE_SECONDS * 1000,
  };

  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded)),
  );
  let binary = "";
  for (const byte of signatureBytes) binary += String.fromCharCode(byte);
  const signature = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${encoded}.${signature}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = crypto.randomUUID();

  // Alentó no usa React/Next Server Actions. Rechazamos cualquier solicitud
  // que intente invocarlas antes de que llegue al runtime de Next.js.
  // Esto evita ruido de escáneres automatizados como "Next-Action: x".
  if (request.headers.has("next-action")) {
    return withRequestId(
      new NextResponse(null, {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
        },
      }),
      requestId,
    );
  }

  const protectedPage = isProtectedPage(pathname);
  const protectedApi = isProtectedApi(pathname);

  // El middleware ahora cubre también la web pública para poder filtrar
  // Next-Action, pero no debe exigir sesión en rutas públicas.
  if (!protectedPage && !protectedApi) {
    return applySearchHeaders(nextWithRequestId(request, requestId), pathname);
  }

  // Cotización pública del checkout: no requiere sesión de colaborador.
  if (isPublicStaffApiException(pathname, request.method)) {
    return applySearchHeaders(nextWithRequestId(request, requestId), pathname);
  }

  const session = await readStaffSession(request);

  if (!session?.userId) {
    if (pathname.startsWith("/api/")) {
      return withRequestId(
        NextResponse.json({ error: "No autorizado." }, { status: 401 }),
        requestId,
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return withRequestId(NextResponse.redirect(loginUrl), requestId);
  }

  let user:
    | {
        id: number;
        email: string;
        name: string;
        roles: string[];
        active: boolean;
        sessionVersion: number;
      }
    | null = null;

  try {
    user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        roles: true,
        active: true,
        sessionVersion: true,
      },
    });
  } catch (error) {
    logError(
      "STAFF_SESSION_VALIDATION_FAILED",
      error instanceof Error
        ? error.message
        : "Falló la validación de la sesión del colaborador.",
      {
        requestId,
        source: "middleware",
        metadata: {
          pathname,
          method: request.method,
        },
      },
    );
    if (pathname.startsWith("/api/")) {
      return withRequestId(
        NextResponse.json(
          { error: "Servicio de autenticación no disponible." },
          { status: 503 },
        ),
        requestId,
      );
    }
    return withRequestId(
      new NextResponse("Servicio temporalmente no disponible.", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }),
      requestId,
    );
  }

  if (
    !user?.active ||
    (session.sessionVersion != null &&
      session.sessionVersion !== user.sessionVersion)
  ) {
    if (pathname.startsWith("/api/")) {
      return withRequestId(
        NextResponse.json({ error: "No autorizado." }, { status: 401 }),
        requestId,
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const response = withRequestId(
      NextResponse.redirect(loginUrl),
      requestId,
    );
    response.cookies.set(STAFF_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  const effectiveSession = {
    ...session,
    userId: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles,
    sessionVersion: user.sessionVersion,
  };

  if (pathname.startsWith("/api/")) {
    const roles = apiRoles(pathname, request.method);
    if (roles && !roles.some((role) => effectiveSession.roles.includes(role))) {
      return withRequestId(
        NextResponse.json({ error: "Sin permisos." }, { status: 403 }),
        requestId,
      );
    }
  } else {
    const rule = PAGE_ROLE_RULES.find(
      (item) =>
        pathname === item.prefix || pathname.startsWith(`${item.prefix}/`),
    );
    if (
      rule &&
      !rule.roles.some((role) => effectiveSession.roles.includes(role))
    ) {
      return withRequestId(
        NextResponse.redirect(new URL("/sin-acceso", request.url)),
        requestId,
      );
    }
  }

  if (
    pathname === "/interno" &&
    !["ADMIN", "POS", "CASHIER"].some((role) =>
      effectiveSession.roles.includes(role),
    )
  ) {
    return withRequestId(
      NextResponse.redirect(new URL("/sin-acceso", request.url)),
      requestId,
    );
  }

  const response = nextWithRequestId(request, requestId);
  const tokenNeedsRefresh =
    session.sessionVersion == null ||
    session.email !== user.email ||
    session.name !== user.name ||
    JSON.stringify([...(session.roles ?? [])].sort()) !==
      JSON.stringify([...user.roles].sort()) ||
    Boolean(
      session.exp &&
        session.exp - Date.now() <= STAFF_SESSION_REFRESH_WINDOW_MS,
    );

  // Migra cookies legacy a una versión revocable y renueva silenciosamente
  // cuando la sesión se acerca al vencimiento.
  if (tokenNeedsRefresh) {
    const refreshed = await refreshStaffSessionToken(effectiveSession);
    if (refreshed) {
      response.cookies.set(STAFF_COOKIE, refreshed, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: STAFF_SESSION_MAX_AGE_SECONDS,
      });
    }
  }

  return applySearchHeaders(response, pathname);
}

export const config = {
  runtime: "nodejs",
  // Ejecutamos el filtro de seguridad en toda la aplicación, excepto recursos
  // internos de Next que nunca pueden contener una acción válida de Alentó.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
