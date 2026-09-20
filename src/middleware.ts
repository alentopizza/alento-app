import { NextRequest, NextResponse } from "next/server";

const STAFF_COOKIE = "alento_staff_session";

const PAGE_ROLE_RULES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/usuarios", roles: ["ADMIN"] },
  { prefix: "/configuracion", roles: ["ADMIN"] },
  { prefix: "/personalizacion", roles: ["ADMIN"] },
  { prefix: "/menu", roles: ["ADMIN"] },
  { prefix: "/cupones", roles: ["ADMIN"] },
  { prefix: "/caja", roles: ["ADMIN", "CASHIER"] },
  { prefix: "/cocina", roles: ["ADMIN", "KITCHEN"] },
  { prefix: "/clientes", roles: ["ADMIN", "POS"] },
  { prefix: "/pedidos", roles: ["ADMIN", "POS", "CASHIER"] },
];

function apiRoles(pathname: string, method: string): string[] | null {
  if (pathname.startsWith("/api/users")) return ["ADMIN"];
  if (pathname.startsWith("/api/menu-admin")) return ["ADMIN"];
  if (pathname.startsWith("/api/public-home-admin")) return ["ADMIN"];

  if (pathname === "/api/settings") {
    return method === "GET" ? ["ADMIN", "POS", "CASHIER"] : ["ADMIN"];
  }

  if (pathname === "/api/coupons") {
    return method === "GET" ? ["ADMIN", "POS"] : ["ADMIN"];
  }
  if (pathname.startsWith("/api/coupons/")) return ["ADMIN"];

  if (pathname.startsWith("/api/caja")) return ["ADMIN", "CASHIER"];
  if (pathname.startsWith("/api/customers")) return ["ADMIN", "POS"];
  if (pathname.startsWith("/api/delivery")) return ["ADMIN", "POS"];
  if (pathname.startsWith("/api/discount")) return ["ADMIN", "POS"];

  if (pathname.startsWith("/api/orders/")) {
    if (pathname.includes("/items/") && pathname.endsWith("/prepared")) return ["ADMIN", "KITCHEN"];
    if (pathname.endsWith("/payment") || /\/payment\/\d+$/.test(pathname)) return ["ADMIN", "POS", "CASHIER"];
    if (pathname.endsWith("/edit")) return ["ADMIN", "POS"];
    if (pathname.endsWith("/status")) return ["ADMIN", "POS", "KITCHEN"];
    if (/^\/api\/orders\/\d+$/.test(pathname)) return ["ADMIN", "POS", "CASHIER", "KITCHEN"];
    if (method === "GET") return ["ADMIN", "POS", "KITCHEN", "CASHIER"];
    return ["ADMIN", "POS"];
  }

  if (pathname === "/api/orders") {
    return method === "GET"
      ? ["ADMIN", "POS", "KITCHEN", "CASHIER"]
      : ["ADMIN", "POS"];
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
      exp?: number;
      roles?: string[];
    };

    if (payload.kind !== "staff" || !payload.exp || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/interno/:path*",
    "/pedidos/:path*",
    "/cocina/:path*",
    "/clientes/:path*",
    "/menu/:path*",
    "/cupones/:path*",
    "/caja/:path*",
    "/configuracion/:path*",
    "/personalizacion/:path*",
    "/usuarios/:path*",
    "/api/users/:path*",
    "/api/menu-admin/:path*",
    "/api/public-home-admin/:path*",
    "/api/settings/:path*",
    "/api/coupons/:path*",
    "/api/caja/:path*",
    "/api/customers/:path*",
    "/api/orders/:path*",
    "/api/delivery/:path*",
    "/api/discount/:path*",
  ],
};
