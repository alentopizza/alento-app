import { randomUUID } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  operationalFingerprint,
  persistOperationalIncident,
  resolveOperationalIncident,
  structuredLog,
} from "@/lib/observability";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const createdIncidentIds: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  if (!hasDatabase || createdIncidentIds.length === 0) return;
  await prisma.operationalIncident.deleteMany({
    where: { id: { in: createdIncidentIds.splice(0) } },
  });
});

describe("observability helpers", () => {
  it("genera una huella estable para el mismo incidente", () => {
    const base = {
      category: "INTEGRATION",
      code: "NOTIFIER_FAILED",
      source: "notifier",
      entityType: "ORDER",
      entityId: 801,
      fingerprintKey: "delivery",
    };

    expect(operationalFingerprint(base)).toBe(
      operationalFingerprint({ ...base }),
    );
    expect(
      operationalFingerprint({ ...base, entityId: 802 }),
    ).not.toBe(operationalFingerprint(base));
  });

  it("estructura logs y elimina secretos del mensaje/metadata", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const payload = structuredLog({
      level: "INFO",
      event: "TEST_LOG",
      message: "token=super-secreto operación normal",
      requestId: "req-123",
      metadata: {
        apiKey: "no-guardar",
        nested: { password: "no-guardar", ok: true },
      },
    });

    expect(payload.message).toContain("token=[REDACTADO]");
    expect(payload.message).not.toContain("super-secreto");
    expect(payload.metadata).toEqual({
      nested: { ok: true },
    });
    expect(payload.requestId).toBe("req-123");
  });
});

describe.skipIf(!hasDatabase)("operational incidents persistence", () => {
  it("agrupa ocurrencias y reabre un incidente resuelto", async () => {
    const fingerprintKey = randomUUID();
    const first = await persistOperationalIncident({
      level: "WARNING",
      category: "JOBS",
      code: "TEST_JOB_WARNING",
      message: "Fallo de prueba",
      requestId: "req-first",
      source: "vitest",
      fingerprintKey,
      metadata: { token: "no-guardar", attempt: 1 },
    });
    createdIncidentIds.push(first.id);

    expect(first.occurrenceCount).toBe(1);
    expect(first.metadata).toEqual({ attempt: 1 });

    const resolved = await resolveOperationalIncident({
      id: first.id,
      userId: 999999,
      userName: "Vitest",
    });
    expect(resolved.resolvedAt).not.toBeNull();

    const second = await persistOperationalIncident({
      level: "ERROR",
      category: "JOBS",
      code: "TEST_JOB_WARNING",
      message: "Fallo de prueba nuevamente",
      requestId: "req-second",
      source: "vitest",
      fingerprintKey,
      metadata: { attempt: 2 },
    });

    expect(second.id).toBe(first.id);
    expect(second.occurrenceCount).toBe(2);
    expect(second.level).toBe("ERROR");
    expect(second.lastRequestId).toBe("req-second");
    expect(second.resolvedAt).toBeNull();
    expect(second.metadata).toEqual({ attempt: 2 });
  });
});
