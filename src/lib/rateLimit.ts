import { createHmac } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
  blockedUntil: Date | null;
};

type ConsumeRateLimitInput = {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
  blockMs?: number;
};

type RateLimitRow = {
  count: number;
  blockedUntil: Date | null;
};

function rateLimitSecret() {
  const value = process.env.AUTH_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SESSION_SECRET debe existir y tener al menos 32 caracteres.",
    );
  }
  return value;
}

export function securityKeyHash(value: string) {
  return createHmac("sha256", rateLimitSecret())
    .update("security-rate-limit:" + value)
    .digest("hex");
}

export function requestClientIp(request: Pick<NextRequest, "headers">) {
  const cloudflare = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

export async function consumeRateLimit({
  scope,
  key,
  limit,
  windowMs,
  blockMs = windowMs,
}: ConsumeRateLimitInput): Promise<RateLimitResult> {
  if (!scope.trim() || !key.trim()) {
    throw new Error("Rate limit scope/key are required.");
  }
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("Rate limit must be at least 1.");
  }
  if (!Number.isFinite(windowMs) || windowMs < 1) {
    throw new Error("Rate limit window must be positive.");
  }

  const normalizedScope = scope.trim().slice(0, 80);
  const keyHash = securityKeyHash(key.trim());
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - windowMs);
  const nextBlockUntil = new Date(now.getTime() + Math.max(1, blockMs));

  const rows = await prisma.$queryRawUnsafe<RateLimitRow[]>(
    `
    INSERT INTO "SecurityRateLimit" (
      "scope",
      "keyHash",
      "windowStartedAt",
      "count",
      "blockedUntil",
      "createdAt",
      "updatedAt"
    )
    VALUES ($1, $2, $3, 1, NULL, $3, $3)
    ON CONFLICT ("scope", "keyHash")
    DO UPDATE SET
      "count" = CASE
        WHEN "SecurityRateLimit"."blockedUntil" IS NOT NULL
          AND "SecurityRateLimit"."blockedUntil" > $3
          THEN "SecurityRateLimit"."count"
        WHEN "SecurityRateLimit"."blockedUntil" IS NOT NULL
          AND "SecurityRateLimit"."blockedUntil" <= $3
          THEN 1
        WHEN "SecurityRateLimit"."windowStartedAt" <= $4
          THEN 1
        ELSE "SecurityRateLimit"."count" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "SecurityRateLimit"."blockedUntil" IS NOT NULL
          AND "SecurityRateLimit"."blockedUntil" > $3
          THEN "SecurityRateLimit"."windowStartedAt"
        WHEN "SecurityRateLimit"."blockedUntil" IS NOT NULL
          AND "SecurityRateLimit"."blockedUntil" <= $3
          THEN $3
        WHEN "SecurityRateLimit"."windowStartedAt" <= $4
          THEN $3
        ELSE "SecurityRateLimit"."windowStartedAt"
      END,
      "blockedUntil" = CASE
        WHEN "SecurityRateLimit"."blockedUntil" IS NOT NULL
          AND "SecurityRateLimit"."blockedUntil" > $3
          THEN "SecurityRateLimit"."blockedUntil"
        WHEN "SecurityRateLimit"."blockedUntil" IS NOT NULL
          AND "SecurityRateLimit"."blockedUntil" <= $3
          THEN NULL
        WHEN "SecurityRateLimit"."windowStartedAt" <= $4
          THEN NULL
        WHEN "SecurityRateLimit"."count" + 1 > $5
          THEN $6
        ELSE NULL
      END,
      "updatedAt" = $3
    RETURNING "count", "blockedUntil";
    `,
    normalizedScope,
    keyHash,
    now,
    windowCutoff,
    limit,
    nextBlockUntil,
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Rate limit state could not be persisted.");
  }

  const blockedUntil =
    row.blockedUntil instanceof Date
      ? row.blockedUntil
      : row.blockedUntil
        ? new Date(row.blockedUntil)
        : null;
  const blocked = Boolean(blockedUntil && blockedUntil.getTime() > now.getTime());
  const retryAfterSeconds = blocked
    ? Math.max(
        1,
        Math.ceil((blockedUntil!.getTime() - now.getTime()) / 1000),
      )
    : 0;

  return {
    allowed: !blocked,
    limit,
    count: row.count,
    remaining: blocked ? 0 : Math.max(0, limit - row.count),
    retryAfterSeconds,
    blockedUntil,
  };
}

export async function clearRateLimit(scope: string, key: string) {
  const normalizedScope = scope.trim().slice(0, 80);
  if (!normalizedScope || !key.trim()) return;

  await prisma.securityRateLimit.deleteMany({
    where: {
      scope: normalizedScope,
      keyHash: securityKeyHash(key.trim()),
    },
  });
}

export function rateLimitResponseHeaders(result: RateLimitResult) {
  return {
    "Retry-After": String(Math.max(1, result.retryAfterSeconds)),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
  };
}


export function rateLimitExceededResponse(
  result: RateLimitResult,
  message = "Demasiadas solicitudes. Intenta nuevamente más tarde.",
) {
  return NextResponse.json(
    { error: message, retryAfterSeconds: result.retryAfterSeconds },
    {
      status: 429,
      headers: rateLimitResponseHeaders(result),
    },
  );
}
