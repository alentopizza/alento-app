export type CanonicalPaymentMethod = {
  id: string;
  name: string;
};

export const CANONICAL_PAYMENT_METHODS: CanonicalPaymentMethod[] = [
  { id: "cash", name: "Efectivo" },
  { id: "nequi", name: "Nequi" },
  { id: "daviplata", name: "DaviPlata" },
  { id: "card", name: "Tarjeta" },
  { id: "key", name: "Llave" },
];

export function normalizePaymentMethodLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveCanonicalPaymentMethod(value: string) {
  const normalized = normalizePaymentMethodLabel(value);

  return (
    CANONICAL_PAYMENT_METHODS.find(
      (method) =>
        normalizePaymentMethodLabel(method.name) === normalized ||
        normalizePaymentMethodLabel(method.id) === normalized,
    ) ?? null
  );
}
