import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditJson } from "@/lib/auditLog";

export type OperationalLevel = "WARNING" | "ERROR";

export type OperationalIncidentInput = {
  level: OperationalLevel;
  category: string;
  code: string;
  message: string;
  requestId?: string | null;
  source?: string | null;
  entityType?: string | null;
  entityId?: string | number | null;
  fingerprintKey?: string | null;
  metadata?: unknown;
};

type StructuredLogInput = {
  level: "INFO" | OperationalLevel;
  event: string;
  message: string;
  requestId?: string | null;
  source?: string | null;
  entityType?: string | null;
  entityId?: string | number | null;
  metadata?: unknown;
};

function safeText(value: unknown, max = 1000) {
  return String(value ?? "")
    .replace(
      /\b(authorization|password|passwordhash|token|accesstoken|refreshtoken|secret|apikey|api_key|clientsecret|privatekey)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDACTADO]",
    )
    .trim()
    .slice(0, max);
}

export function requestIdFromHeaders(
  headers: Pick<Headers, "get">,
): string | null {
  return headers.get("x-request-id")?.trim().slice(0, 100) || null;
}

export function operationalFingerprint(
  input: Pick<
    OperationalIncidentInput,
    "category" | "code" | "source" | "entityType" | "entityId" | "fingerprintKey"
  >,
) {
  return createHash("sha256")
    .update(
      [
        input.category.trim().toUpperCase(),
        input.code.trim().toUpperCase(),
        input.source?.trim() || "",
        input.entityType?.trim().toUpperCase() || "",
        input.entityId == null ? "" : String(input.entityId),
        input.fingerprintKey?.trim() || "",
      ].join("|"),
    )
    .digest("hex");
}

export function structuredLog(input: StructuredLogInput) {
  const payload = {
    timestamp: new Date().toISOString(),
    service: "alento-app",
    level: input.level,
    event: safeText(input.event, 120),
    message: safeText(input.message, 1500),
    requestId: input.requestId?.trim().slice(0, 100) || undefined,
    source: input.source?.trim().slice(0, 160) || undefined,
    entity:
      input.entityType || input.entityId != null
        ? {
            type: input.entityType?.trim().slice(0, 80) || undefined,
            id:
              input.entityId == null
                ? undefined
                : String(input.entityId).slice(0, 120),
          }
        : undefined,
    metadata: auditJson(input.metadata),
  };

  const line = JSON.stringify(payload);
  if (input.level === "ERROR") {
    console.error(line);
  } else if (input.level === "WARNING") {
    console.warn(line);
  } else {
    console.log(line);
  }

  return payload;
}

export function logInfo(
  event: string,
  message: string,
  details: Omit<StructuredLogInput, "level" | "event" | "message"> = {},
) {
  return structuredLog({ level: "INFO", event, message, ...details });
}

export function logWarning(
  event: string,
  message: string,
  details: Omit<StructuredLogInput, "level" | "event" | "message"> = {},
) {
  return structuredLog({ level: "WARNING", event, message, ...details });
}

export function logError(
  event: string,
  message: string,
  details: Omit<StructuredLogInput, "level" | "event" | "message"> = {},
) {
  return structuredLog({ level: "ERROR", event, message, ...details });
}

export async function persistOperationalIncident(
  input: OperationalIncidentInput,
) {
  const now = new Date();
  const fingerprint = operationalFingerprint(input);
  const message = safeText(input.message, 1500) || "Incidente operativo";
  const metadata = auditJson(input.metadata);

  return prisma.operationalIncident.upsert({
    where: { fingerprint },
    create: {
      fingerprint,
      level: input.level,
      category: safeText(input.category, 80).toUpperCase(),
      code: safeText(input.code, 120).toUpperCase(),
      message,
      source: input.source?.trim().slice(0, 160) || null,
      entityType: input.entityType?.trim().slice(0, 80) || null,
      entityId:
        input.entityId == null ? null : String(input.entityId).slice(0, 120),
      firstSeenAt: now,
      lastSeenAt: now,
      occurrenceCount: 1,
      lastRequestId: input.requestId?.trim().slice(0, 100) || null,
      metadata,
    },
    update: {
      level: input.level,
      message,
      lastSeenAt: now,
      occurrenceCount: { increment: 1 },
      lastRequestId: input.requestId?.trim().slice(0, 100) || null,
      metadata,
      resolvedAt: null,
      resolvedByUserId: null,
      resolvedByName: null,
    },
  });
}

export async function reportOperationalIncident(
  input: OperationalIncidentInput,
) {
  structuredLog({
    level: input.level,
    event: input.code,
    message: input.message,
    requestId: input.requestId,
    source: input.source,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata,
  });

  try {
    return await persistOperationalIncident(input);
  } catch (error) {
    structuredLog({
      level: "ERROR",
      event: "OBSERVABILITY_PERSIST_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "No fue posible guardar el incidente operativo.",
      requestId: input.requestId,
      source: "src/lib/observability",
      metadata: {
        originalCategory: input.category,
        originalCode: input.code,
      },
    });
    return null;
  }
}

export async function resolveOperationalIncident(input: {
  id: string;
  userId: number;
  userName: string;
}) {
  return prisma.operationalIncident.update({
    where: { id: input.id },
    data: {
      resolvedAt: new Date(),
      resolvedByUserId: input.userId,
      resolvedByName: input.userName.trim().slice(0, 120),
    },
  });
}

export function incidentMetadata(value: unknown): Prisma.InputJsonValue | undefined {
  return auditJson(value);
}
