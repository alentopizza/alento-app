import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{16,128}$/;

export class IdempotencyKeyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: "IDEMPOTENCY_KEY_REQUIRED" | "IDEMPOTENCY_KEY_INVALID" | "IDEMPOTENCY_KEY_CONFLICT",
  ) {
    super(message);
  }
}

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((item) => stableSerialize(item)).join(",") + "]";
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return (
      "{" +
      entries
        .map(([key, item]) => JSON.stringify(key) + ":" + stableSerialize(item))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(String(value));
}

export function requireIdempotencyKey(request: Pick<NextRequest, "headers">) {
  const value = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!value) {
    throw new IdempotencyKeyError(
      "Falta la clave de seguridad del intento. Actualiza la aplicación e inténtalo nuevamente.",
      428,
      "IDEMPOTENCY_KEY_REQUIRED",
    );
  }
  if (!IDEMPOTENCY_KEY_RE.test(value)) {
    throw new IdempotencyKeyError(
      "La clave de seguridad del intento no es válida.",
      400,
      "IDEMPOTENCY_KEY_INVALID",
    );
  }
  return value;
}

export function idempotencyRequestHash(payload: unknown) {
  return createHash("sha256").update(stableSerialize(payload)).digest("hex");
}

export function assertSameIdempotentRequest(
  storedHash: string | null | undefined,
  requestHash: string,
) {
  if (!storedHash || storedHash !== requestHash) {
    throw new IdempotencyKeyError(
      "Esta clave de intento ya fue usada con datos diferentes. Actualiza la información antes de reintentar.",
      409,
      "IDEMPOTENCY_KEY_CONFLICT",
    );
  }
}

export function idempotencyErrorResponse(error: unknown) {
  if (!(error instanceof IdempotencyKeyError)) return null;
  return {
    status: error.status,
    body: {
      error: error.message,
      code: error.code,
    },
  };
}

export function isIdempotencyUniqueConflict(error: unknown) {
  const candidate = error as {
    code?: string;
    meta?: { target?: unknown };
  };
  if (candidate?.code !== "P2002") return false;
  const target = candidate.meta?.target;
  if (Array.isArray(target)) {
    return target.some((item) => String(item).includes("idempotencyKey"));
  }
  return String(target ?? "").includes("idempotencyKey");
}


export async function lockIdempotencyKey(
  tx: Prisma.TransactionClient,
  key: string,
) {
  await tx.$queryRawUnsafe<Array<{ locked: number }>>(
    `WITH lock_acquired AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended($1, 0))
    )
    SELECT 1::int AS "locked"
    FROM lock_acquired`,
    key,
  );
}
