export type OrderSourceCode = "POS" | "WEB" | "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | "OTHER" | string;

export function orderPrefix(source: OrderSourceCode | null | undefined) {
  const value = String(source ?? "POS").trim().toUpperCase();
  if (value === "POS" || value === "WEB") return value;
  if (value === "WHATSAPP") return "WSP";
  if (value === "INSTAGRAM") return "IG";
  if (value === "FACEBOOK") return "FB";
  if (value === "RAPPI") return "RAP";
  if (value === "DIDI") return "DID";
  return value || "POS";
}

/**
 * Public order identifier.
 *
 * The numeric part is always Order.id, so every source shares the same global
 * PostgreSQL sequence. Example: POS-0001, WEB-0002, POS-0003.
 * Deleting an order never renumbers or reuses an issued sequence number.
 */
export function orderCode(id: number, source: OrderSourceCode | null | undefined = "POS") {
  return `${orderPrefix(source)}-${String(id).padStart(4, "0")}`;
}
