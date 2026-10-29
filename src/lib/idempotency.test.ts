import { randomUUID } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  assertSameIdempotentRequest,
  IdempotencyKeyError,
  idempotencyRequestHash,
  lockIdempotencyKey,
  requireIdempotencyKey,
} from "@/lib/idempotency";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const createdOrderIds: number[] = [];

afterEach(async () => {
  if (!hasDatabase || createdOrderIds.length === 0) return;
  await prisma.order.deleteMany({
    where: { id: { in: createdOrderIds.splice(0) } },
  });
});

describe("idempotency helpers", () => {
  it("acepta una clave suficientemente fuerte desde el header estándar", () => {
    const key = "b35207d8-60c0-4dda-a0d0-f3dcead7cc91";
    const result = requireIdempotencyKey({
      headers: new Headers({ "Idempotency-Key": key }),
    } as never);

    expect(result).toBe(key);
  });

  it("rechaza requests críticos sin Idempotency-Key", () => {
    expect(() =>
      requireIdempotencyKey({ headers: new Headers() } as never),
    ).toThrowError(IdempotencyKeyError);
  });

  it("produce el mismo hash para objetos equivalentes aunque cambie el orden de propiedades", () => {
    const first = idempotencyRequestHash({
      operation: "TEST",
      body: { b: 2, a: 1, nested: { y: true, x: "ok" } },
    });
    const second = idempotencyRequestHash({
      body: { nested: { x: "ok", y: true }, a: 1, b: 2 },
      operation: "TEST",
    });

    expect(first).toBe(second);
  });

  it("detecta reutilización de clave con contenido diferente", () => {
    expect(() =>
      assertSameIdempotentRequest("hash-original", "hash-distinto"),
    ).toThrowError(IdempotencyKeyError);
  });
});

describe.skipIf(!hasDatabase)("idempotency database constraints", () => {
  it("adquiere advisory lock sin exponer el tipo void a Prisma", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await lockIdempotencyKey(tx, `test-lock-${randomUUID()}`);
      }),
    ).resolves.toBeUndefined();
  });

  it("impide dos pedidos con la misma clave idempotente", async () => {
    const key = `test-order-${randomUUID()}`;

    const first = await prisma.order.create({
      data: {
        source: "POS",
        fulfillmentType: "STORE",
        status: "READY",
        total: 10000,
        idempotencyKey: key,
        idempotencyHash: "hash-a",
      },
    });
    createdOrderIds.push(first.id);

    await expect(
      prisma.order.create({
        data: {
          source: "POS",
          fulfillmentType: "STORE",
          status: "READY",
          total: 10000,
          idempotencyKey: key,
          idempotencyHash: "hash-a",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("impide dos pagos con la misma clave idempotente", async () => {
    const order = await prisma.order.create({
      data: {
        source: "POS",
        fulfillmentType: "STORE",
        status: "READY",
        total: 10000,
      },
    });
    createdOrderIds.push(order.id);

    const key = `test-payment-${randomUUID()}`;
    await prisma.payment.create({
      data: {
        orderId: order.id,
        method: "Nequi",
        amount: 5000,
        status: "PAID",
        paidAt: new Date(),
        idempotencyKey: key,
        idempotencyHash: "hash-payment",
      },
    });

    await expect(
      prisma.payment.create({
        data: {
          orderId: order.id,
          method: "Nequi",
          amount: 5000,
          status: "PAID",
          paidAt: new Date(),
          idempotencyKey: key,
          idempotencyHash: "hash-payment",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
