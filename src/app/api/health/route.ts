import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError, requestIdFromHeaders } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = requestIdFromHeaders(request.headers);
  const startedAt = performance.now();

  try {
    const databaseStartedAt = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    const databaseLatencyMs = Math.round(performance.now() - databaseStartedAt);
    const totalLatencyMs = Math.round(performance.now() - startedAt);

    return NextResponse.json(
      {
        status: "ok",
        service: "alento-app",
        timestamp: new Date().toISOString(),
        requestId,
        uptimeSeconds: Math.round(process.uptime()),
        latencyMs: totalLatencyMs,
        checks: {
          database: {
            status: "ok",
            latencyMs: databaseLatencyMs,
          },
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    logError(
      "DATABASE_HEALTH_CHECK_FAILED",
      error instanceof Error
        ? error.message
        : "Falló la comprobación de PostgreSQL.",
      {
        requestId,
        source: "api/health",
      },
    );

    return NextResponse.json(
      {
        status: "error",
        service: "alento-app",
        timestamp: new Date().toISOString(),
        requestId,
        uptimeSeconds: Math.round(process.uptime()),
        latencyMs: Math.round(performance.now() - startedAt),
        checks: {
          database: {
            status: "error",
          },
        },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
