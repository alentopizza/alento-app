import { createOrderTrackingToken } from "@/lib/orderTracking";
import { createDriverOrderToken } from "@/lib/driverTracking";
import {
  findTemplateForEvent,
  getNotificationTemplates,
  type NotificationTemplateConfig,
} from "@/lib/notificationTemplates";
import {
  logInfo,
  reportOperationalIncident,
} from "@/lib/observability";

export type NotificationDispatchResult =
  | { ok: true; status: "queued" | "sent" }
  | { ok: false; status: "skipped" | "failed"; reason: string };

type BaseOrderEvent = {
  orderId: number;
  customerId: number;
  customerName: string;
  phone: string;
  orderCode: string;
  total: number;
  fulfillmentType: string;
};

type NotifierPayload = {
  orderId: number;
  existingRecipientOnly?: boolean;
  orderCode: string;
  total: number;
  fulfillmentType: string;
  recipientKind: "CUSTOMER" | "DRIVER";
  recipientId: number;
  recipientName: string;
  phone: string;
  customerName?: string;
  driverName?: string;
  status?: string;
  previousStatus?: string;
  trackingPath?: string;
  driverTrackingPath?: string;
  template: NotificationTemplateConfig;
};

async function dispatchEvent(
  event: string,
  data: Omit<NotifierPayload, "template">,
  template: NotificationTemplateConfig | null,
): Promise<NotificationDispatchResult> {
  const webhookUrl = process.env.NOTIFIER_WEBHOOK_URL?.trim();
  const secret = process.env.NOTIFIER_SHARED_SECRET?.trim();

  if (!template) {
    return { ok: false, status: "skipped", reason: "No hay una plantilla activa para este evento y modalidad." };
  }

  if (!webhookUrl || !secret) {
    return {
      ok: false,
      status: "skipped",
      reason: "Microservicio de notificaciones no configurado.",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-alento-notifier-secret": secret,
        },
        body: JSON.stringify({ event, data: { ...data, template } }),
      });

      const text = await response.text();
      let body: unknown = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }

      if (!response.ok) {
        const reason = `Notifier ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`;

        await reportOperationalIncident({
          level: "WARNING",
          category: "INTEGRATION",
          code: "NOTIFIER_DELIVERY_FAILED",
          message: reason,
          source: "lib/notifier",
          entityType: "ORDER",
          entityId: data.orderId,
          fingerprintKey: event,
          metadata: {
            event,
            recipientKind: data.recipientKind,
            status: response.status,
          },
        });

        return {
          ok: false,
          status: "failed",
          reason,
        };
      }

      logInfo(
        "NOTIFIER_DELIVERY_SENT",
        `Notificación ${event} enviada al microservicio.`,
        {
          source: "lib/notifier",
          entityType: "ORDER",
          entityId: data.orderId,
          metadata: {
            event,
            recipientKind: data.recipientKind,
          },
        },
      );

      return { ok: true, status: "sent" };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "No fue posible contactar el microservicio de notificaciones.";

    await reportOperationalIncident({
      level: "WARNING",
      category: "INTEGRATION",
      code: "NOTIFIER_UNREACHABLE",
      message: reason,
      source: "lib/notifier",
      entityType: "ORDER",
      entityId: data.orderId,
      fingerprintKey: event,
      metadata: {
        event,
        recipientKind: data.recipientKind,
      },
    });

    return {
      ok: false,
      status: "failed",
      reason,
    };
  }
}

async function templateFor(event: string, fulfillmentType: string) {
  return findTemplateForEvent(await getNotificationTemplates(), event, fulfillmentType);
}

function customerStatusShouldNotify(fulfillmentType: string, status: string) {
  if (fulfillmentType === "DELIVERY") {
    return ["OUT_FOR_DELIVERY", "ARRIVED", "COMPLETED"].includes(status);
  }

  if (fulfillmentType === "PICKUP" || fulfillmentType === "STORE") {
    return ["READY", "COMPLETED"].includes(status);
  }

  return false;
}

function customerPayload(input: BaseOrderEvent) {
  return {
    orderId: input.orderId,
    orderCode: input.orderCode,
    total: input.total,
    fulfillmentType: input.fulfillmentType,
    recipientKind: "CUSTOMER" as const,
    recipientId: input.customerId,
    recipientName: input.customerName,
    customerName: input.customerName,
    phone: input.phone,
    trackingPath: `seguimiento/${createOrderTrackingToken(input.orderId)}`,
  };
}

export async function dispatchOrderCreatedNotification(
  input: BaseOrderEvent,
  options: { existingRecipientOnly?: boolean } = {},
): Promise<NotificationDispatchResult> {
  const event = "order.created";
  return dispatchEvent(
    event,
    {
      ...customerPayload(input),
      existingRecipientOnly: options.existingRecipientOnly === true,
    },
    await templateFor(event, input.fulfillmentType),
  );
}

export async function dispatchOrderStatusNotification(
  input: BaseOrderEvent & { status: string; previousStatus: string },
): Promise<NotificationDispatchResult> {
  if (!customerStatusShouldNotify(input.fulfillmentType, input.status)) {
    return {
      ok: false,
      status: "skipped",
      reason: `El estado ${input.status} es operativo y no genera notificación para ${input.fulfillmentType}.`,
    };
  }

  const event = `order.status.${input.status}`;
  return dispatchEvent(
    event,
    { ...customerPayload(input), status: input.status, previousStatus: input.previousStatus },
    await templateFor(event, input.fulfillmentType),
  );
}

export async function dispatchDriverAssignedNotification(input: {
  orderId: number;
  orderCode: string;
  total: number;
  fulfillmentType: string;
  driverId: number;
  driverName: string;
  driverPhone: string;
}): Promise<NotificationDispatchResult> {
  const event = "order.driver_assigned";
  return dispatchEvent(
    event,
    {
      orderId: input.orderId,
      orderCode: input.orderCode,
      total: input.total,
      fulfillmentType: input.fulfillmentType,
      recipientKind: "DRIVER",
      recipientId: input.driverId,
      recipientName: input.driverName,
      driverName: input.driverName,
      phone: input.driverPhone,
      driverTrackingPath: `repartidor/pedido/${createDriverOrderToken(input.orderId, input.driverId)}`,
    },
    await templateFor(event, input.fulfillmentType),
  );
}

export async function dispatchReviewNotification(
  input: BaseOrderEvent,
): Promise<NotificationDispatchResult> {
  const event = "order.review";
  return dispatchEvent(event, customerPayload(input), await templateFor(event, input.fulfillmentType));
}
