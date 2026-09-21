"use client";

import { useEffect, useMemo, useState } from "react";

const CHATWOOT_ORIGIN = "https://chat.operadoranordecolombia.com";
const FETCH_INFO_MESSAGE = "chatwoot-dashboard-app:fetch-info";

type ChatwootContext = {
  contact?: {
    id?: number;
    name?: string;
    email?: string;
    phone_number?: string;
  };
  conversation?: {
    id?: number;
    meta?: {
      sender?: {
        id?: number;
        name?: string;
        email?: string;
        phone_number?: string;
      };
    };
  };
};

type OrderSummary = {
  id: number;
  code: string;
  status: string;
  fulfillmentType: string;
  total: number;
  createdAt: string;
  items: Array<{
    productName: string;
    quantity: number;
  }>;
};

type CustomerPayload = {
  customer: {
    id: number;
    name: string;
    phone: string | null;
    countryCode: string;
    email: string | null;
    notes: string | null;
    defaultAddress: {
      address: string;
      neighborhood: string | null;
      city: string | null;
    } | null;
  };
  metrics: {
    purchaseCount: number;
    totalSpent: number;
    averageTicket: number;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
    frequencyDays: number | null;
    daysSinceLastOrder: number | null;
    commercialSignal: string;
    clubPoints: number;
  };
  orders: OrderSummary[];
};

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value: string | null) {
  if (!value) return "Sin compras";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function signalLabel(value: string) {
  const labels: Record<string, string> = {
    SIN_COMPRAS: "Sin compras",
    NUEVO: "Nuevo",
    ACTIVO: "Activo",
    FRECUENTE: "Frecuente",
    POR_RECUPERAR: "Por recuperar",
  };
  return labels[value] ?? value;
}

function labelStatus(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Borrador",
    CONFIRMED: "Confirmado",
    PREPARING: "En preparación",
    PREPARED: "Preparado",
    READY: "Listo",
    OUT_FOR_DELIVERY: "En camino",
    ARRIVED: "Llegó",
    DELIVERED: "Entregado",
    COMPLETED: "Completado",
    CANCELED: "Cancelado",
  };
  return labels[status] ?? status;
}

function parseContextMessage(data: unknown): ChatwootContext | null {
  try {
    const payload = typeof data === "string" ? JSON.parse(data) : data;
    if (!payload || typeof payload !== "object") return null;
    const event = payload as { event?: string; data?: ChatwootContext };
    if (event.event !== "appContext") return null;
    return event.data ?? null;
  } catch {
    return null;
  }
}

export default function ChatwootDashboardPage() {
  const [context, setContext] = useState<ChatwootContext | null>(null);
  const [data, setData] = useState<CustomerPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Abre una conversación para consultar el cliente.");

  const dashboardKey = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("key") ?? "";
  }, []);

  const phone =
    context?.contact?.phone_number ??
    context?.conversation?.meta?.sender?.phone_number ??
    "";

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== CHATWOOT_ORIGIN) return;
      const nextContext = parseContextMessage(event.data);
      if (nextContext) setContext(nextContext);
    }

    window.addEventListener("message", onMessage);
    window.parent.postMessage(FETCH_INFO_MESSAGE, CHATWOOT_ORIGIN);

    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomer() {
      setData(null);

      if (!phone) {
        setMessage("Esta conversación no tiene un teléfono disponible.");
        return;
      }

      if (!dashboardKey) {
        setMessage("Falta la clave de integración de Chatwoot.");
        return;
      }

      setLoading(true);
      setMessage("Buscando cliente en Alentó…");

      try {
        const response = await fetch(
          `/api/integrations/chatwoot/customer?phone=${encodeURIComponent(phone)}`,
          {
            cache: "no-store",
            headers: {
              "x-alento-chatwoot-key": dashboardKey,
            },
          },
        );

        if (cancelled) return;

        if (response.status === 404) {
          setMessage(`No encontramos un cliente registrado con ${phone}.`);
          return;
        }

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setMessage(body?.error ?? "No fue posible consultar el cliente.");
          return;
        }

        const payload = (await response.json()) as CustomerPayload;
        setData(payload);
        setMessage("");
      } catch {
        if (!cancelled) setMessage("No fue posible conectar con Alentó.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCustomer();
    return () => {
      cancelled = true;
    };
  }, [phone, dashboardKey]);

  const displayName =
    data?.customer.name ??
    context?.contact?.name ??
    context?.conversation?.meta?.sender?.name ??
    "Cliente";

  return (
    <main className="cw-panel">
      <section className="cw-head">
        <div className="cw-identity">
          <div className="cw-avatar">{displayName.trim().charAt(0).toUpperCase()}</div>
          <div>
            <p className="cw-eyebrow">ALENTÓ · CLIENTE</p>
            <h1>{displayName}</h1>
            <p className="cw-phone">{phone || "Sin teléfono"}{data ? ` · Cliente #${data.customer.id}` : ""}</p>
          </div>
        </div>
        {data ? (
          <div className="cw-tags">
            <span className="cw-pill">{signalLabel(data.metrics.commercialSignal)}</span>
            <span className="cw-points">★ {data.metrics.clubPoints} pts</span>
          </div>
        ) : null}
      </section>

      {loading ? <div className="cw-state">Consultando historial…</div> : null}
      {!loading && message ? <div className="cw-state">{message}</div> : null}

      {data ? (
        <>
          <section className="cw-metrics">
            <article>
              <strong>{data.metrics.purchaseCount}</strong>
              <span>Pedidos</span>
            </article>
            <article>
              <strong>{money(data.metrics.averageTicket)}</strong>
              <span>Ticket promedio</span>
            </article>
            <article>
              <strong>{money(data.metrics.totalSpent)}</strong>
              <span>Total comprado</span>
            </article>
            <article>
              <strong>{data.metrics.daysSinceLastOrder ?? "—"}</strong>
              <span>Días sin comprar</span>
            </article>
          </section>

          <section className="cw-card">
            <div className="cw-row">
              <span>Última compra</span>
              <strong>{dateTime(data.metrics.lastOrderAt)}</strong>
            </div>
            <div className="cw-row">
              <span>Frecuencia</span>
              <strong>{data.metrics.frequencyDays ? `Cada ${data.metrics.frequencyDays} días` : "Por definir"}</strong>
            </div>
            {data.customer.defaultAddress ? (
              <div className="cw-row">
                <span>Dirección</span>
                <strong>
                  {data.customer.defaultAddress.address}
                  {data.customer.defaultAddress.neighborhood
                    ? ` · ${data.customer.defaultAddress.neighborhood}`
                    : ""}
                </strong>
              </div>
            ) : null}
            {data.customer.email ? (
              <div className="cw-row">
                <span>Correo</span>
                <strong>{data.customer.email}</strong>
              </div>
            ) : null}
          </section>

          <section className="cw-orders">
            <div className="cw-title-row">
              <h2>Últimos pedidos</h2>
              <span>{data.orders.length} visibles</span>
            </div>

            {data.orders.length === 0 ? (
              <div className="cw-state">Este cliente todavía no tiene pedidos.</div>
            ) : (
              data.orders.map((order) => (
                <article className="cw-order" key={order.id}>
                  <div className="cw-order-top">
                    <div>
                      <strong>{order.code}</strong>
                      <span>{dateTime(order.createdAt)}</span>
                    </div>
                    <b>{money(order.total)}</b>
                  </div>
                  <div className="cw-order-meta">
                    <span>{labelStatus(order.status)}</span>
                    <span>
                      {order.items
                        .slice(0, 3)
                        .map((item) => `${item.quantity}× ${item.productName}`)
                        .join(" · ")}
                      {order.items.length > 3 ? ` · +${order.items.length - 3}` : ""}
                    </span>
                  </div>
                </article>
              ))
            )}
          </section>
        </>
      ) : null}

      <style jsx>{`
        :global(html),
        :global(body) {
          margin: 0;
          min-height: 100%;
          background:
            radial-gradient(circle at top right, rgba(183,28,28,.07), transparent 30%),
            #f6f7f9;
          color: #171717;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .cw-panel {
          box-sizing: border-box;
          min-height: 100vh;
          padding: 16px;
        }

        .cw-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 14px;
          padding: 2px;
        }

        .cw-identity {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .cw-avatar {
          display: grid;
          place-items: center;
          width: 46px;
          height: 46px;
          flex: 0 0 46px;
          border-radius: 14px;
          background: #111;
          color: #fff;
          font-size: 19px;
          font-weight: 800;
          box-shadow: 0 8px 22px rgba(0,0,0,.14);
        }

        .cw-tags {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .cw-points {
          border: 1px solid #dedee3;
          border-radius: 999px;
          background: #fff;
          padding: 6px 9px;
          color: #444;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .cw-eyebrow {
          margin: 0 0 4px;
          color: #a6171b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.09em;
        }

        h1 {
          margin: 0;
          font-size: 20px;
          line-height: 1.15;
        }

        .cw-phone {
          margin: 5px 0 0;
          color: #71717a;
          font-size: 13px;
        }

        .cw-pill {
          flex: 0 0 auto;
          border-radius: 999px;
          background: #171717;
          color: white;
          padding: 6px 9px;
          font-size: 11px;
          font-weight: 700;
        }

        .cw-state,
        .cw-card,
        .cw-order,
        .cw-metrics article {
          border: 1px solid #e4e4e7;
          background: rgba(255,255,255,.97);
          border-radius: 14px;
        }

        .cw-state {
          padding: 14px;
          color: #52525b;
          font-size: 13px;
        }

        .cw-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .cw-metrics article {
          min-width: 0;
          padding: 12px;
          box-shadow: 0 5px 18px rgba(0,0,0,.025);
        }

        .cw-metrics strong,
        .cw-metrics span {
          display: block;
        }

        .cw-metrics strong {
          overflow: hidden;
          font-size: 17px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cw-metrics span {
          margin-top: 3px;
          color: #71717a;
          font-size: 10px;
          text-transform: uppercase;
        }

        .cw-card {
          padding: 4px 12px;
          margin-bottom: 14px;
        }

        .cw-row {
          display: grid;
          grid-template-columns: 88px minmax(0, 1fr);
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f1;
          font-size: 12px;
        }

        .cw-row:last-child {
          border-bottom: 0;
        }

        .cw-row span {
          color: #71717a;
        }

        .cw-row strong {
          overflow-wrap: anywhere;
          text-align: right;
        }

        .cw-title-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin: 0 2px 8px;
        }

        .cw-title-row h2 {
          margin: 0;
          font-size: 14px;
        }

        .cw-title-row span {
          color: #71717a;
          font-size: 11px;
        }

        .cw-orders {
          display: grid;
          gap: 8px;
        }

        .cw-order {
          padding: 11px 12px;
        }

        .cw-order-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .cw-order-top div {
          min-width: 0;
        }

        .cw-order-top strong,
        .cw-order-top span {
          display: block;
        }

        .cw-order-top strong {
          font-size: 13px;
        }

        .cw-order-top span {
          margin-top: 2px;
          color: #71717a;
          font-size: 10px;
        }

        .cw-order-top b {
          flex: 0 0 auto;
          font-size: 13px;
        }

        .cw-order-meta {
          display: grid;
          gap: 4px;
          margin-top: 9px;
          padding-top: 8px;
          border-top: 1px solid #f0f0f1;
          color: #52525b;
          font-size: 11px;
          line-height: 1.35;
        }

        .cw-order-meta span:first-child {
          color: #a6171b;
          font-weight: 700;
        }
      `}</style>
    </main>
  );
}
