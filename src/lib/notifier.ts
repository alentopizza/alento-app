import { createOrderTrackingToken } from "@/lib/orderTracking";

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

type OrderCreatedEvent = BaseOrderEvent & {
  trackingPath: string;
};

type OrderStatusChangedEvent = BaseOrderEvent & {
  status: string;
  previousStatus: string;
  trackingPath: string;
};

async function dispatchEvent(
  event: "order.created" | "order.status_changed",
  data: OrderCreatedEvent | OrderStatusChangedEvent,
): Promise<NotificationDispatchResult> {
  const webhookUrl = process.env.NOTIFIER_WEBHOOK_URL?.trim();
  const secret = process.env.NOTIFIER_SHARED_SECRET?.trim();

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
        body: JSON.stringify({ event, data }),
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
        return {
          ok: false,
          status: "failed",
          reason: `Notifier ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`,
        };
      }

      return { ok: true, status: "sent" };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      reason:
        error instanceof Error
          ? error.message
          : "No fue posible contactar el microservicio de notificaciones.",
    };
  }
}

export async function dispatchOrderCreatedNotification(
  input: BaseOrderEvent,
): Promise<NotificationDispatchResult> {
  return dispatchEvent("order.created", {
    ...input,
    trackingPath: `seguimiento/${createOrderTrackingToken(input.orderId)}`,
  });
}

export async function dispatchOrderStatusNotification(
  input: BaseOrderEvent & { status: string; previousStatus: string },
): Promise<NotificationDispatchResult> {
  return dispatchEvent("order.status_changed", {
    ...input,
    trackingPath: `seguimiento/${createOrderTrackingToken(input.orderId)}`,
  });
}
