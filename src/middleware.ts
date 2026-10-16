import { NextRequest, NextResponse } from "next/server";

const STAFF_COOKIE = "alento_staff_session";
const STAFF_SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
const STAFF_SESSION_REFRESH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

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
];

function isIndexablePublicPage(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/menu" ||
    pathname.startsWith("/menu/") ||
    pathname === "/club"
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
      ["GET", "PUT"].includes(method))
  );
}

function apiRoles(pathname: string, method: string): string[] | null {
  if (pathname.startsWith("/api/users")) return ["ADMIN"];
  if (pathname.startsWith("/api/menu-admin")) return ["ADMIN"];
  if (pathname.startsWith("/api/public-home-admin")) return ["ADMIN"];

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
    if (pathname.endsWith("/payment") || /\/payment\/\d+$/.test(pathname)) return ["ADMIN", "POS", "CASHIER"];
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
}) {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || session.kind !== "staff") return null;

  const payload = {
    kind: "staff",
    userId: session.userId,
    email: session.email,
    name: session.name,
    roles: session.roles ?? [],
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

  // Alentó no usa React/Next Server Actions. Rechazamos cualquier solicitud
  // que intente invocarlas antes de que llegue al runtime de Next.js.
  // Esto evita ruido de escáneres automatizados como "Next-Action: x".
  if (request.headers.has("next-action")) {
    return new NextResponse(null, {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  const protectedPage = isProtectedPage(pathname);
  const protectedApi = isProtectedApi(pathname);

  // El middleware ahora cubre también la web pública para poder filtrar
  // Next-Action, pero no debe exigir sesión en rutas públicas.
  if (!protectedPage && !protectedApi) {
    return applySearchHeaders(NextResponse.next(), pathname);
  }

  // Cotización pública del checkout: no requiere sesión de colaborador.
  if (isPublicStaffApiException(pathname, request.method)) {
    return applySearchHeaders(NextResponse.next(), pathname);
  }

  const session = await readStaffSession(request);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/api/")) {
    const roles = apiRoles(pathname, request.method);
    if (roles && !roles.some((role) => session.roles?.includes(role))) {
      return NextResponse.json({ error: "Sin permisos." }, { status: 403 });
    }
  } else {
    const rule = PAGE_ROLE_RULES.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
    if (rule && !rule.roles.some((role) => session.roles?.includes(role))) {
      return NextResponse.redirect(new URL("/sin-acceso", request.url));
    }
  }

  if (pathname === "/interno" && !["ADMIN", "POS", "CASHIER"].some((role) => session.roles?.includes(role))) {
    return NextResponse.redirect(new URL("/sin-acceso", request.url));
  }

  const response = NextResponse.next();

  // Renueva silenciosamente la sesión cuando se acerca al vencimiento.
  // Así los despliegues no obligan a volver a iniciar sesión.
  if (session.exp && session.exp - Date.now() <= STAFF_SESSION_REFRESH_WINDOW_MS) {
    const refreshed = await refreshStaffSessionToken(session);
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
  // Ejecutamos el filtro de seguridad en toda la aplicación, excepto recursos
  // internos de Next que nunca pueden contener una acción válida de Alentó.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
