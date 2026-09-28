import { NextRequest, NextResponse } from "next/server";
import {
  rappiConfig,
  verifyRappiWebhookSignature,
} from "@/lib/rappi";
import {
  applyRappiCancellation,
  applyRappiOperationalEvent,
  importRappiOrder,
} from "@/lib/rappiOrderImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function webhookEvent(body: JsonObject) {
  const explicit = firstText(
    body.event,
    body.event_type,
    body.eventType,
    body.type,
    body.name,
  );
  if (explicit) return explicit;

  const detail = asObject(body.order_detail) ?? asObject(body.orderDetail);
  const action = firstText(body.action).toLowerCase();

  if (action === "scheduled" && Array.isArray(detail?.items)) {
    return "NEW_ORDER_SCHEDULED";
  }
  if (action === "cancelled" && detail?.place_at) {
    return "NEW_ORDER_SCHEDULED_CANCELLED";
  }
  if (Array.isArray(detail?.items)) {
    return "NEW_ORDER";
  }
  if (
    body.order_id != null &&
    body.eta_in_millis != null &&
    body.lat != null &&
    body.lng != null
  ) {
    return "ORDER_RT_TRACKING";
  }

  return "";
}

function orderPayload(body: JsonObject) {
  return (
    asObject(body.order) ??
    asObject(body.data) ??
    asObject(body.payload) ??
    body
  );
}

function isPing(body: JsonObject, eventName: string) {
  if (eventName.toUpperCase() === "PING") return true;

  const hasStoreId =
    body.store_id != null ||
    body.storeId != null;
  const hasOrder =
    body.order_id != null ||
    body.orderId != null ||
    body.order_detail != null ||
    body.order != null;

  return !eventName && hasStoreId && !hasOrder;
}

function isNewOrderEvent(eventName: string) {
  return eventName.trim().toUpperCase() === "NEW_ORDER";
}

function isCancellationEvent(eventName: string) {
  const normalized = eventName.trim().toUpperCase();
  return (
    normalized === "ORDER_EVENT_CANCEL" ||
    normalized === "ORDER_CANCEL" ||
    normalized === "ORDER_CANCELED" ||
    normalized === "ORDER_CANCELLED" ||
    normalized.includes("CANCEL")
  );
}

export async function POST(request: NextRequest) {
  const config = rappiConfig();
  if (!config.enabled) {
    return NextResponse.json(
      { error: "Integración Rappi deshabilitada." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("rappi-signature");

  if (!verifyRappiWebhookSignature(rawBody, signature)) {
    console.warn("Rappi webhook rejected: invalid signature");
    return NextResponse.json(
      { error: "Firma Rappi inválida." },
      { status: 401 },
    );
  }

  let parsed: unknown;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json(
      { error: "Payload JSON inválido." },
      { status: 400 },
    );
  }

  const body = asObject(parsed);
  if (!body) {
    return NextResponse.json(
      { error: "Payload Rappi inválido." },
      { status: 400 },
    );
  }

  const eventName = webhookEvent(body);

  if (isPing(body, eventName)) {
    return NextResponse.json({
      status: "OK",
      description: "Store on",
    });
  }

  try {
    if (eventName.toUpperCase() === "NEW_ORDER_SCHEDULED") {
      // Rappi envía este aviso con precios provisionales en cero. No se crea
      // una orden operativa hasta que llegue NEW_ORDER con valores definitivos.
      return NextResponse.json({
        ok: true,
        event: eventName,
        scheduled: true,
        imported: false,
      });
    }

    if (isNewOrderEvent(eventName)) {
      const result = await importRappiOrder(orderPayload(body), {
        eventName,
      });

      return NextResponse.json({
        ok: true,
        event: eventName,
        created: result.created,
        orderId: result.order?.id ?? null,
        autoAccepted: result.autoAccepted,
      });
    }

    if (isCancellationEvent(eventName)) {
      const result = await applyRappiCancellation(body, eventName);
      return NextResponse.json({
        ok: true,
        event: eventName,
        matched: result.found,
        orderId: result.found ? result.orderId : null,
      });
    }

    const result = await applyRappiOperationalEvent(
      body,
      eventName || "RAPPI_EVENT",
    );

    return NextResponse.json({
      ok: true,
      event: eventName || "RAPPI_EVENT",
      matched: result.found,
      orderId: result.found ? result.orderId : null,
    });
  } catch (error) {
    console.error("Rappi webhook processing failed", {
      event: eventName || "UNKNOWN",
      error:
        error instanceof Error ? error.message : "Unknown webhook error",
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible procesar el evento de Rappi.",
      },
      { status: 500 },
    );
  }
}
