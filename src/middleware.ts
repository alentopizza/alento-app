import { NextRequest, NextResponse } from "next/server";

const STAFF_COOKIE = "alento_staff_session";

const ROLE_RULES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/usuarios", roles: ["ADMIN"] },
  { prefix: "/configuracion", roles: ["ADMIN"] },
  { prefix: "/menu", roles: ["ADMIN"] },
  { prefix: "/cupones", roles: ["ADMIN"] },
  { prefix: "/caja", roles: ["ADMIN", "CASHIER"] },
  { prefix: "/cocina", roles: ["ADMIN", "KITCHEN"] },
  { prefix: "/clientes", roles: ["ADMIN", "POS"] },
  { prefix: "/pedidos", roles: ["ADMIN", "POS", "DISPATCH", "CASHIER"] },
];

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
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const rule = ROLE_RULES.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
  if (rule && !rule.roles.some((role) => session.roles?.includes(role))) {
    return NextResponse.redirect(new URL("/sin-acceso", request.url));
  }

  if (pathname === "/" && !["ADMIN", "POS", "CASHIER"].some((role) => session.roles?.includes(role))) {
    return NextResponse.redirect(new URL("/sin-acceso", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/pedidos/:path*",
    "/cocina/:path*",
    "/clientes/:path*",
    "/menu/:path*",
    "/cupones/:path*",
    "/caja/:path*",
    "/configuracion/:path*",
    "/usuarios/:path*",
  ],
};
