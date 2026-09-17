export type FulfillmentType = "DELIVERY" | "PICKUP" | "STORE";

export type OrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "ARRIVED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELED";

export const DELIVERY_FLOW: OrderStatus[] = [
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
  "DELIVERED",
  "COMPLETED",
];

export const STORE_FLOW: OrderStatus[] = ["PREPARING", "READY", "COMPLETED"];

export function workflowFor(fulfillmentType: FulfillmentType): OrderStatus[] {
  return fulfillmentType === "DELIVERY" ? DELIVERY_FLOW : STORE_FLOW;
}

export function statusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    DRAFT: "Borrador",
    CONFIRMED: "Confirmado",
    PREPARING: "Preparado",
    READY: "Listo",
    OUT_FOR_DELIVERY: "En camino",
    ARRIVED: "Ha llegado",
    DELIVERED: "Entregado",
    COMPLETED: "Finalizado",
    CANCELED: "Cancelado",
  };
  return labels[status] ?? status;
}

export function fulfillmentLabel(type: FulfillmentType) {
  if (type === "DELIVERY") return "Domicilio";
  if (type === "PICKUP") return "Recoger";
  return "Local";
}

export function nextStatus(current: OrderStatus, fulfillmentType: FulfillmentType): OrderStatus | null {
  // Compatibilidad temporal con pedidos creados antes del nuevo flujo.
  if (current === "CONFIRMED") return "PREPARING";
  const flow = workflowFor(fulfillmentType);
  const index = flow.indexOf(current);
  if (index < 0 || index >= flow.length - 1) return null;
  return flow[index + 1];
}

export function canTransition(current: OrderStatus, target: OrderStatus, fulfillmentType: FulfillmentType) {
  return nextStatus(current, fulfillmentType) === target;
}
