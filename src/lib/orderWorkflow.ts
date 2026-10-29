export type FulfillmentType = "DELIVERY" | "PICKUP" | "STORE";

/**
 * Convención operativa de Alentó:
 *
 * PREPARED es el identificador técnico/histórico del estado visible "Horneando".
 *
 * Flujo operativo:
 * PREPARING = Preparando en Cocina
 * PREPARED  = Horneando (ya salió del tablero de Cocina)
 * READY     = Salió del horno / Listo
 *
 * No crear un enum HORNEANDO ni renombrar PREPARED sin una migración deliberada,
 * porque PREPARED ya está persistido y es usado por Prisma, APIs y datos históricos.
 */
export type OrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PREPARING"
  | "PREPARED"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "ARRIVED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELED";

export const DELIVERY_FLOW: OrderStatus[] = [
  "PREPARING",
  "PREPARED",
  "READY",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
  "DELIVERED",
  "COMPLETED",
];

export const STORE_FLOW: OrderStatus[] = ["PREPARING", "PREPARED", "READY", "COMPLETED"];

export function workflowFor(fulfillmentType: FulfillmentType): OrderStatus[] {
  return fulfillmentType === "DELIVERY" ? DELIVERY_FLOW : STORE_FLOW;
}

export function statusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    DRAFT: "Borrador",
    CONFIRMED: "Confirmado",
    PREPARING: "En preparación",
    PREPARED: "Horneando",
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
  if (current === "CONFIRMED") return "PREPARING";
  const flow = workflowFor(fulfillmentType);
  const index = flow.indexOf(current);
  if (index < 0 || index >= flow.length - 1) return null;
  return flow[index + 1];
}

export function canTransition(current: OrderStatus, target: OrderStatus, fulfillmentType: FulfillmentType) {
  return nextStatus(current, fulfillmentType) === target;
}
