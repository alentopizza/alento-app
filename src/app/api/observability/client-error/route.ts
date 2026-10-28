import { NextRequest, NextResponse } from "next/server";
import {
  consumeRateLimit,
  rateLimitExceededResponse,
  requestClientIp,
} from "@/lib/rateLimit";
import {
  reportOperationalIncident,
  requestIdFromHeaders,
} from "@/lib/observability";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safePath(value: unknown) {
  const raw = text(value, 500);
  if (!raw.startsWith("/")) return "/";
  return raw.split("?")[0]?.split("#")[0] || "/";
}

export async function POST(request: NextRequest) {
  const requestId = requestIdFromHeaders(request.headers);
  const ip = requestClientIp(request);

  const rateLimit = await consumeRateLimit({
    scope: "client-observability",
    key: ip,
    limit: 20,
    windowMs: 10 * 60_000,
    blockMs: 10 * 60_000,
  });

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(
      rateLimit,
      "Se alcanzó el límite temporal de reportes de diagnóstico.",
    );
  }

  const body = await request.json().catch(() => ({}));
  const message = text(body?.message, 600);
  const name = text(body?.name, 120) || "Error";
  const path = safePath(body?.path);
  const digest = text(body?.digest, 160) || null;
  const clientEventId = text(body?.clientEventId, 100) || null;

  if (!message) {
    return NextResponse.json(
      { error: "El reporte no contiene un error válido." },
      { status: 400 },
    );
  }

  await reportOperationalIncident({
    level: "ERROR",
    category: "FRONTEND",
    code: "CLIENT_RUNTIME_ERROR",
    message,
    requestId,
    source: `frontend:${path}`,
    fingerprintKey: [name, digest || ""].join(":"),
    metadata: {
      name,
      path,
      digest,
      clientEventId,
    },
  });

  return new NextResponse(null, { status: 202 });
}
