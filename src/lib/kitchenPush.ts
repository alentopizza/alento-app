import type { FulfillmentType } from "@prisma/client";
import { sendStaffPushToRoles } from "@/lib/driverPush";

function fulfillmentText(value: FulfillmentType) {
  if (value === "DELIVERY") return "Domicilio";
  if (value === "PICKUP") return "Recoger en tienda";
  return "Consumo en local";
}

export async function sendKitchenOrderCreatedPush(input: {
  orderId: number;
  orderCode: string;
  fulfillmentType: FulfillmentType;
}) {
  return sendStaffPushToRoles({
    roles: ["KITCHEN", "ADMIN"],
    title: "🔔 Nuevo pedido en Cocina",
    body: `${input.orderCode} · ${fulfillmentText(input.fulfillmentType)}`,
    url: "/cocina",
    tag: `alento-kitchen-order-${input.orderId}`,
    orderId: input.orderId,
    kind: "KITCHEN_ORDER",
    requireInteraction: true,
  });
}

export async function sendRappiOrderCreatedPush(input: {
  orderId: number;
  orderCode: string;
  fulfillmentType: FulfillmentType;
}) {
  return sendStaffPushToRoles({
    roles: ["ADMIN", "POS", "CASHIER", "KITCHEN"],
    title: "🛵 Nuevo pedido de Rappi",
    body: `${input.orderCode} · ${fulfillmentText(input.fulfillmentType)}`,
    url: "/pedidos",
    tag: `alento-rappi-order-${input.orderId}`,
    orderId: input.orderId,
    kind: "RAPPI_ORDER",
    requireInteraction: true,
  });
}
