import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { auditJson, writeAuditLog } from "@/lib/auditLog";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe("audit log sanitization", () => {
  it("elimina secretos incluso dentro de estructuras anidadas", () => {
    const result = auditJson({
      name: "Administrador",
      password: "no-guardar",
      passwordHash: "hash-no-guardar",
      nested: {
        token: "token-no-guardar",
        secret: "secret-no-guardar",
        safe: "visible",
      },
      rows: [
        {
          id: 1,
          idempotencyHash: "hash-interno",
          amount: 15000,
        },
      ],
    }) as Record<string, unknown>;

    expect(result).toMatchObject({
      name: "Administrador",
      nested: { safe: "visible" },
      rows: [{ id: 1, amount: 15000 }],
    });
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("passwordHash");
    expect(
      (result.nested as Record<string, unknown>).token,
    ).toBeUndefined();
    expect(
      (result.nested as Record<string, unknown>).secret,
    ).toBeUndefined();
  });

  it("normaliza fechas a ISO sin perder campos seguros", () => {
    const occurredAt = new Date("2026-10-27T22:45:00.000Z");
    expect(
      auditJson({
        occurredAt,
        amount: 25000,
      }),
    ).toEqual({
      occurredAt: occurredAt.toISOString(),
      amount: 25000,
    });
  });
});

describe.skipIf(!hasDatabase)("audit log persistence", () => {
  it("persiste actor y snapshots sanitizados", async () => {
    const marker = randomUUID();
    const created = await writeAuditLog(prisma, {
      actor: {
        type: "STAFF",
        userId: 123456,
        name: "Audit Test",
        email: "audit-test@example.invalid",
      },
      action: "TEST_AUDIT_CREATED",
      entityType: "TEST_ENTITY",
      entityId: marker,
      summary: "Registro de integración de auditoría.",
      after: {
        amount: 10000,
        passwordHash: "must-not-persist",
        nested: { token: "must-not-persist", ok: true },
      },
      metadata: {
        testMarker: marker,
      },
      source: "vitest",
    });

    const stored = await prisma.auditLog.findUnique({
      where: { id: created.id },
    });

    expect(stored).not.toBeNull();
    expect(stored?.actorName).toBe("Audit Test");
    expect(stored?.actorEmail).toBe("audit-test@example.invalid");
    expect(stored?.entityId).toBe(marker);
    expect(stored?.after).toEqual({
      amount: 10000,
      nested: { ok: true },
    });
  });

  it("es append-only a nivel PostgreSQL: UPDATE y DELETE son rechazados", async () => {
    const created = await writeAuditLog(prisma, {
      actor: { type: "SYSTEM", name: "Vitest" },
      action: "TEST_APPEND_ONLY",
      entityType: "TEST_ENTITY",
      entityId: randomUUID(),
      summary: "Debe permanecer inmutable.",
      source: "vitest",
    });

    await expect(
      prisma.auditLog.update({
        where: { id: created.id },
        data: { summary: "Intento de modificación" },
      }),
    ).rejects.toThrow(/append-only/i);

    await expect(
      prisma.auditLog.delete({
        where: { id: created.id },
      }),
    ).rejects.toThrow(/append-only/i);

    const stored = await prisma.auditLog.findUnique({
      where: { id: created.id },
    });
    expect(stored?.summary).toBe("Debe permanecer inmutable.");
  });
});
