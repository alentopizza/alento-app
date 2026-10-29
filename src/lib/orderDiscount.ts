export type OrderDiscountMode = "NONE" | "COUPON" | "MANUAL";

export type OrderDiscountCoupon = {
  id: number;
  name: string;
  type: "FIXED" | "PERCENTAGE";
  value: number;
};

type CalculateOrderDiscountInput = {
  mode: OrderDiscountMode;
  eligibleSubtotal: number;
  manualDiscount?: unknown;
  coupon?: OrderDiscountCoupon | null;
};

export function calculateOrderDiscount({
  mode,
  eligibleSubtotal,
  manualDiscount,
  coupon = null,
}: CalculateOrderDiscountInput): number {
  const rawEligibleSubtotal = Number(eligibleSubtotal);
  if (!Number.isFinite(rawEligibleSubtotal) || rawEligibleSubtotal < 0) {
    throw new Error("La base elegible para descuento no es válida.");
  }

  const eligible = Math.round(rawEligibleSubtotal);

  if (mode === "NONE") return 0;

  if (eligible <= 0) {
    throw new Error("Este pedido no tiene productos elegibles para descuento.");
  }

  if (mode === "MANUAL") {
    const rawDiscount = Number(manualDiscount ?? 0);
    if (!Number.isFinite(rawDiscount) || rawDiscount < 0) {
      throw new Error("El descuento manual debe ser un valor válido.");
    }

    const requested = Math.round(rawDiscount);
    if (requested > eligible) {
      throw new Error(
        `El descuento manual no puede superar la base elegible de ${eligible.toLocaleString("es-CO")}.`,
      );
    }
    return requested;
  }

  if (!coupon) {
    throw new Error("Selecciona un cupón válido.");
  }

  const value = Number(coupon.value);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("El valor del cupón no es válido.");
  }

  if (coupon.type === "PERCENTAGE") {
    if (value > 100) {
      throw new Error("El porcentaje del cupón no puede superar 100%.");
    }
    return Math.min(eligible, Math.round(eligible * (value / 100)));
  }

  return Math.min(eligible, Math.round(value));
}
