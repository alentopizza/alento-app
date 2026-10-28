import { describe, expect, it } from "vitest";
import {
  netReceivedForPayment,
  orderNetReceived,
  refundableAmount,
  refundedAmount,
} from "@/lib/orderPaymentFinancials";

describe("order payment financials", () => {
  it("calcula el neto recibido después de una devolución parcial", () => {
    const payment = {
      status: "PAID",
      amount: 30000,
      refunds: [{ amount: 7000 }],
    };

    expect(refundedAmount(payment)).toBe(7000);
    expect(netReceivedForPayment(payment)).toBe(23000);
    expect(refundableAmount(payment)).toBe(23000);
  });

  it("un pago completamente devuelto no conserva dinero recibido", () => {
    const payment = {
      status: "REFUNDED",
      amount: 30000,
      refunds: [{ amount: 30000 }],
    };

    expect(netReceivedForPayment(payment)).toBe(0);
    expect(refundableAmount(payment)).toBe(0);
  });

  it("suma únicamente el dinero neto todavía recibido", () => {
    expect(
      orderNetReceived([
        { status: "PAID", amount: 20000, refunds: [{ amount: 5000 }] },
        { status: "PAID", amount: 10000, refunds: [] },
        { status: "PENDING", amount: 8000, refunds: [] },
        { status: "REFUNDED", amount: 4000, refunds: [{ amount: 4000 }] },
      ]),
    ).toBe(25000);
  });
});
