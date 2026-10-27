import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditDb = Prisma.TransactionClient | typeof prisma;

export type AuditActor = {
  type: "STAFF" | "CUSTOMER" | "GUEST" | "SYSTEM";
  userId?: number | null;
  name?: string | null;
  email?: string | null;
};

export type AuditLogInput = {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  summary?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  source?: string | null;
};

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "secret",
  "auth",
  "codehash",
  "p256dh",
  "fcmtoken",
  "idempotencyhash",
]);

function normalizeAuditValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((item) => normalizeAuditValue(item));
  }

  if (typeof value === "object") {
    const maybeDecimal = value as { toJSON?: () => unknown };
    if (typeof maybeDecimal.toJSON === "function") {
      const serialized = maybeDecimal.toJSON();
      if (
        serialized == null ||
        typeof serialized !== "object" ||
        serialized instanceof Date
      ) {
        return normalizeAuditValue(serialized);
      }
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SENSITIVE_KEYS.has(key.toLowerCase()))
        .map(([key, item]) => [key, normalizeAuditValue(item)]),
    );
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return String(value);
}

export function auditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return normalizeAuditValue(value) as Prisma.InputJsonValue;
}

export function staffAuditActor(session: {
  userId: number;
  name: string;
  email: string;
}): AuditActor {
  return {
    type: "STAFF",
    userId: session.userId,
    name: session.name,
    email: session.email,
  };
}

export async function writeAuditLog(
  db: AuditDb,
  input: AuditLogInput,
) {
  return db.auditLog.create({
    data: {
      actorType: input.actor.type,
      actorUserId: input.actor.userId ?? null,
      actorName: input.actor.name ?? null,
      actorEmail: input.actor.email ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId:
        input.entityId == null ? null : String(input.entityId),
      summary: input.summary?.trim().slice(0, 500) || null,
      before: auditJson(input.before),
      after: auditJson(input.after),
      metadata: auditJson(input.metadata),
      source: input.source?.trim().slice(0, 120) || null,
    },
  });
}
