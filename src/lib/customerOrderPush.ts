import type { FulfillmentType, OrderStatus } from "@/lib/orderWorkflow";
import { createOrderTrackingToken } from "@/lib/orderTracking";
import { sendCustomerPushToCustomer } from "@/lib/driverPush";

function statusMessage(
  status: OrderStatus,
  fulfillmentType: FulfillmentType,
) {
  if (status === "PREPARING") {
    return "Tu pedido ya está en preparación 🍕";
  }
  if (status === "PREPARED") {
    return "Tu pedido está en el horno 🔥";
  }
  if (status === "READY") {
    return fulfillmentType === "DELIVERY"
      ? "Tu pedido está listo y pronto saldrá a domicilio."
      : "Tu pedido está listo para recoger.";
  }
  if (status === "OUT_FOR_DELIVERY") {
    return "Tu pedido va en camino 🛵";
  }
  if (status === "ARRIVED") {
    return "Tu repartidor ya llegó al punto de entrega.";
  }
  if (status === "DELIVERED") {
    return "Tu pedido fue entregado. ¡Gracias por elegir Alentó!";
  }
  if (status === "COMPLETED") {
    return "Tu pedido quedó finalizado. ¡Gracias por elegir Alentó!";
  }
  if (status === "CANCELED") {
    return "Tu pedido fue cancelado.";
  }
  if (status === "CONFIRMED") {
    return "Recibimos tu pedido y ya quedó confirmado.";
  }
  return "Tenemos una actualización de tu pedido.";
}

export async function sendCustomerOrderStatusPush(input: {
  customerId: number;
  orderId: number;
  orderCode: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
}) {
  let url = "/";
  try {
    url = `/seguimiento/${createOrderTrackingToken(input.orderId)}`;
  } catch {
    // Si el token no puede generarse, mantenemos un destino seguro.
  }

  return sendCustomerPushToCustomer(input.customerId, {
    title: `Pedido ${input.orderCode}`,
    body: statusMessage(input.status, input.fulfillmentType),
    url,
    tag: `alento-order-${input.orderId}-${input.status.toLowerCase()}`,
    kind: "CUSTOMER_ORDER_STATUS",
    orderId: input.orderId,
    requireInteraction:
      input.status === "OUT_FOR_DELIVERY" ||
      input.status === "ARRIVED",
  });
}

export async function sendCustomerOrderCreatedPush(input: {
  customerId: number;
  orderId: number;
  orderCode: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
}) {
  let url = "/";
  try {
    url = `/seguimiento/${createOrderTrackingToken(input.orderId)}`;
  } catch {
    // Si el token no puede generarse, mantenemos un destino seguro.
  }

  return sendCustomerPushToCustomer(input.customerId, {
    title: `Pedido ${input.orderCode}`,
    body:
      input.status === "READY"
        ? "Recibimos tu pedido. Ya está listo para continuar."
        : "Recibimos tu pedido. Ya estamos trabajando en él 🍕",
    url,
    tag: `alento-order-${input.orderId}-created`,
    kind: "CUSTOMER_ORDER_CREATED",
    orderId: input.orderId,
    requireInteraction: false,
  });
}
