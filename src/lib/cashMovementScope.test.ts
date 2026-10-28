import { describe, expect, it } from "vitest";
import {
  cashReceivedPaymentWhere,
  cashRefundWhere,
} from "@/lib/cashMovementScope";

describe("cash movement scope", () => {
  it("conserva cobros históricos aunque el pedido termine cancelado", () => {
    const start = new Date("2026-10-27T05:00:00.000Z");
    const end = new Date("2026-10-28T05:00:00.000Z");

    expect(cashReceivedPaymentWhere(start, end)).toEqual({
      status: { in: ["PAID", "REFUNDED"] },
      paidAt: { gte: start, lt: end },
    });

    expect(cashReceivedPaymentWhere(start, end)).not.toHaveProperty("order");
  });

  it("atribuye devoluciones por su fecha real", () => {
    const start = new Date("2026-10-27T05:00:00.000Z");
    const end = new Date("2026-10-28T05:00:00.000Z");

    expect(cashRefundWhere(start, end)).toEqual({
      refundedAt: { gte: start, lt: end },
    });
  });
});
