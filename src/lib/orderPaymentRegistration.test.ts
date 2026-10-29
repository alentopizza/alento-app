import { randomUUID } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { idempotencyRequestHash } from "@/lib/idempotency";
import { registerOrderPayment } from "@/lib/orderPaymentRegistration";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const createdOrderIds: number[] = [];

afterEach(async () => {
  if (!hasDatabase || createdOrderIds.length === 0) return;
  await prisma.order.deleteMany({
    where: { id: { in: createdOrderIds.splice(0) } },
  });
});

describe.skipIf(!hasDatabase)("serialized order payment registration", () => {
  it("solo permite un cobro completo cuando dos terminales pagan el mismo saldo al mismo tiempo", async () => {
    const order = await prisma.order.create({
      data: {
        source: "POS",
        fulfillmentType: "STORE",
        status: "READY",
        subtotal: 10000,
        total: 10000,
        payments: {
          create: {
            method: "Nequi",
            amount: 10000,
            status: "PENDING",
          },
        },
      },
    });
    createdOrderIds.push(order.id);

    const firstKey = `test-pay-a-${randomUUID()}`;
    const secondKey = `test-pay-b-${randomUUID()}`;
    const firstHash = idempotencyRequestHash({
      operation: "ORDER_PAYMENT_CREATE",
      orderId: order.id,
      body: { paymentMethodId: "nequi", amount: 10000 },
    });
    const secondHash = idempotencyRequestHash({
      operation: "ORDER_PAYMENT_CREATE",
      orderId: order.id,
      body: { paymentMethodId: "nequi", amount: 10000, terminal: "second" },
    });

    const [first, second] = await Promise.all([
      registerOrderPayment({
        orderId: order.id,
        idempotencyKey: firstKey,
        idempotencyHash: firstHash,
        method: "Nequi",
        amount: 10000,
        cashReceived: null,
        changeDue: null,
        reference: null,
        paidAt: new Date(),
      }),
      registerOrderPayment({
        orderId: order.id,
        idempotencyKey: secondKey,
        idempotencyHash: secondHash,
        method: "Nequi",
        amount: 10000,
        cashReceived: null,
        changeDue: null,
        reference: null,
        paidAt: new Date(),
      }),
    ]);

    const kinds = [first.kind, second.kind].sort();
    expect(kinds).toEqual(["created", "error"]);

    const error = first.kind === "error" ? first : second;
    expect(error.kind).toBe("error");
    if (error.kind === "error") {
      expect(error.status).toBe(409);
      expect(error.error).toContain("pagado completamente");
    }

    const payments = await prisma.payment.findMany({
      where: { orderId: order.id },
      orderBy: { id: "asc" },
    });

    const paid = payments.filter((payment) => payment.status === "PAID");
    const pending = payments.filter(
      (payment) =>
        payment.status === "PENDING" || payment.status === "PARTIAL",
    );

    expect(paid).toHaveLength(1);
    expect(Number(paid[0]?.amount ?? 0)).toBe(10000);
    expect(pending).toHaveLength(0);
  });

  it("reproduce el mismo pago cuando se reintenta con la misma clave y el mismo hash", async () => {
    const order = await prisma.order.create({
      data: {
        source: "POS",
        fulfillmentType: "STORE",
        status: "READY",
        subtotal: 10000,
        total: 10000,
        payments: {
          create: {
            method: "Nequi",
            amount: 10000,
            status: "PENDING",
          },
        },
      },
    });
    createdOrderIds.push(order.id);

    const key = `test-pay-replay-${randomUUID()}`;
    const hash = idempotencyRequestHash({
      operation: "ORDER_PAYMENT_CREATE",
      orderId: order.id,
      body: { paymentMethodId: "nequi", amount: 6000 },
    });
    const input = {
      orderId: order.id,
      idempotencyKey: key,
      idempotencyHash: hash,
      method: "Nequi",
      amount: 6000,
      cashReceived: null,
      changeDue: null,
      reference: null,
      paidAt: new Date(),
    };

    const first = await registerOrderPayment(input);
    const replay = await registerOrderPayment({
      ...input,
      paidAt: new Date(Date.now() + 1000),
    });

    expect(first.kind).toBe("created");
    expect(replay.kind).toBe("replay");

    const paid = await prisma.payment.findMany({
      where: { orderId: order.id, status: "PAID" },
    });
    expect(paid).toHaveLength(1);
    expect(Number(paid[0]?.amount ?? 0)).toBe(6000);
  });
});
