import { describe, expect, it } from "vitest";
import { calculateOrderDiscount } from "@/lib/orderDiscount";

describe("order discounts", () => {
  it("removes a discount when mode is NONE", () => {
    expect(
      calculateOrderDiscount({
        mode: "NONE",
        eligibleSubtotal: 50000,
      }),
    ).toBe(0);
  });

  it("accepts a manual discount up to the eligible subtotal", () => {
    expect(
      calculateOrderDiscount({
        mode: "MANUAL",
        eligibleSubtotal: 50000,
        manualDiscount: 12000,
      }),
    ).toBe(12000);
  });

  it("rejects a manual discount above the eligible subtotal", () => {
    expect(() =>
      calculateOrderDiscount({
        mode: "MANUAL",
        eligibleSubtotal: 50000,
        manualDiscount: 50001,
      }),
    ).toThrow("El descuento manual no puede superar la base elegible");
  });

  it("calculates a percentage coupon over eligible products only", () => {
    expect(
      calculateOrderDiscount({
        mode: "COUPON",
        eligibleSubtotal: 40000,
        coupon: {
          id: 7,
          name: "10% OFF",
          type: "PERCENTAGE",
          value: 10,
        },
      }),
    ).toBe(4000);
  });

  it("caps a fixed coupon at the eligible subtotal", () => {
    expect(
      calculateOrderDiscount({
        mode: "COUPON",
        eligibleSubtotal: 8000,
        coupon: {
          id: 9,
          name: "Cupón $20.000",
          type: "FIXED",
          value: 20000,
        },
      }),
    ).toBe(8000);
  });

  it("rejects discounts when the order has no eligible products", () => {
    expect(() =>
      calculateOrderDiscount({
        mode: "COUPON",
        eligibleSubtotal: 0,
        coupon: {
          id: 7,
          name: "10% OFF",
          type: "PERCENTAGE",
          value: 10,
        },
      }),
    ).toThrow("Este pedido no tiene productos elegibles");
  });
});
