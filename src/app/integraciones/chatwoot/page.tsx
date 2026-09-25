"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Clock3,
  MapPin,
  MessageSquareText,
  PackageCheck,
  Phone,
  ReceiptText,
  Star,
  UserRound,
} from "lucide-react";

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

type AddressSummary = {
  label?: string | null;
  address: string;
  formattedAddress?: string | null;
  neighborhood: string | null;
  city: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type OrderSummary = {
  id: number;
  code: string;
  source: string;
  status: string;
  fulfillmentType: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  notes: string | null;
  deliveryZoneName: string | null;
  createdAt: string;
  address: AddressSummary | null;
  items: Array<{
    productName: string;
    variantName: string | null;
    quantity: number;
    lineTotal: number;
    detail: string;
    notes: string | null;
  }>;
  payments: Array<{
    method: string;
    amount: number;
    cashReceived: number | null;
    changeDue: number | null;
    status: string;
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
    createdAt: string;
    defaultAddress: AddressSummary | null;
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

function shortDate(value: string | null) {
  if (!value) return "Sin compras";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function dateTime(value: string | null) {
  if (!value) return "Sin compras";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
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

function fulfillmentLabel(value: string) {
  const labels: Record<string, string> = {
    DELIVERY: "Domicilio",
    PICKUP: "Recoger",
    STORE: "En local",
  };
  return labels[value] ?? value;
}

function paymentStatusLabel(value: string) {
  const labels: Record<string, string> = {
    PAID: "Pagado",
    PENDING: "Pendiente",
    PARTIAL: "Parcial",
    FAILED: "Fallido",
    REFUNDED: "Reembolsado",
  };
  return labels[value] ?? value;
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "C";
}

function compactAddress(address: AddressSummary | null) {
  if (!address) return "";
  const base =
    address.address?.trim() ||
    address.formattedAddress?.trim() ||
    "";
  const neighborhood = address.neighborhood?.trim() || "";

  if (!neighborhood) return base;
  if (base.toLowerCase().includes(neighborhood.toLowerCase())) return base;
  return [base, neighborhood].filter(Boolean).join(", ");
}

function mapQuery(address: AddressSummary | null) {
  if (!address) return "";
  if (
    typeof address.latitude === "number" &&
    typeof address.longitude === "number"
  ) {
    return `${address.latitude},${address.longitude}`;
  }

  return [
    address.address,
    address.neighborhood,
    address.city,
    "Colombia",
  ]
    .filter(Boolean)
    .join(", ");
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
  const [message, setMessage] = useState(
    "Abre una conversación para consultar el cliente.",
  );

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
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
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

  const address = data?.customer.defaultAddress ?? null;
  const locationQuery = mapQuery(address);
  const mapEmbedUrl = locationQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(locationQuery)}&z=16&output=embed`
    : "";
  const mapOpenUrl = locationQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`
    : "";

  return (
    <main className="cw-panel">
      <section className="cw-hero">
        <div className="cw-hero-glow" />
        <div className="cw-hero-top">
          <div className="cw-avatar">{initials(displayName)}</div>
          <div className="cw-person">
            <div className="cw-kicker">
              <span />
              CLIENTE ALENTÓ
            </div>
            <h1>{displayName}</h1>
            <p>
              <Phone size={12} strokeWidth={2.2} />
              {phone || "Sin teléfono"}
              {data ? <em>#{data.customer.id}</em> : null}
            </p>
          </div>
        </div>

        {data ? (
          <div className="cw-hero-badges">
            <span className={`cw-signal cw-signal-${data.metrics.commercialSignal.toLowerCase()}`}>
              {signalLabel(data.metrics.commercialSignal)}
            </span>
            <span className="cw-points">
              <Star size={12} fill="currentColor" />
              {data.metrics.clubPoints} pts
            </span>
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className="cw-state">
          <span className="cw-loader" />
          Consultando historial…
        </div>
      ) : null}

      {!loading && message ? (
        <div className="cw-state">
          <UserRound size={18} />
          {message}
        </div>
      ) : null}

      {data ? (
        <>
          <section className="cw-metrics">
            <article>
              <ReceiptText size={16} />
              <strong>{data.metrics.purchaseCount}</strong>
              <span>Pedidos</span>
            </article>
            <article>
              <PackageCheck size={16} />
              <strong>{money(data.metrics.averageTicket)}</strong>
              <span>Ticket</span>
            </article>
            <article>
              <Star size={16} />
              <strong>{money(data.metrics.totalSpent)}</strong>
              <span>Comprado</span>
            </article>
            <article>
              <Clock3 size={16} />
              <strong>{data.metrics.daysSinceLastOrder ?? "—"}</strong>
              <span>Días sin compra</span>
            </article>
          </section>

          <section className="cw-card cw-context">
            <div className="cw-section-head">
              <div>
                <span>CONTEXTO COMERCIAL</span>
                <h2>Lo importante mientras hablas</h2>
              </div>
            </div>

            <div className="cw-context-grid">
              <div>
                <span>Última compra</span>
                <strong>{shortDate(data.metrics.lastOrderAt)}</strong>
              </div>
              <div>
                <span>Frecuencia</span>
                <strong>
                  {data.metrics.frequencyDays
                    ? `Cada ${data.metrics.frequencyDays} días`
                    : "Por definir"}
                </strong>
              </div>
              <div>
                <span>Cliente desde</span>
                <strong>{shortDate(data.metrics.firstOrderAt)}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>{signalLabel(data.metrics.commercialSignal)}</strong>
              </div>
            </div>

            {data.customer.notes ? (
              <div className="cw-note">
                <MessageSquareText size={14} />
                <div>
                  <span>Nota del cliente</span>
                  <p>{data.customer.notes}</p>
                </div>
              </div>
            ) : null}
          </section>

          {address ? (
            <section className="cw-card cw-location">
              <div className="cw-section-head cw-map-head">
                <div>
                  <span>UBICACIÓN HABITUAL</span>
                  <h2>{address.label || "Dirección del cliente"}</h2>
                </div>
                {mapOpenUrl ? (
                  <a href={mapOpenUrl} target="_blank" rel="noreferrer">
                    Abrir mapa
                  </a>
                ) : null}
              </div>

              {mapEmbedUrl ? (
                <div className="cw-map">
                  <iframe
                    title={`Ubicación de ${data.customer.name}`}
                    src={mapEmbedUrl}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="cw-map-pin">
                    <MapPin size={15} fill="currentColor" />
                  </div>
                </div>
              ) : null}

              <div className="cw-address">
                <MapPin size={15} />
                <div>
                  <strong>{compactAddress(address)}</strong>
                  {address.notes ? (
                    <p>
                      <b>Indicaciones:</b> {address.notes}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          <section className="cw-orders">
            <div className="cw-section-head">
              <div>
                <span>HISTORIAL DEL CLIENTE</span>
                <h2>Últimos pedidos</h2>
              </div>
              <b>{data.orders.length}</b>
            </div>

            {data.orders.length === 0 ? (
              <div className="cw-state">Este cliente todavía no tiene pedidos.</div>
            ) : (
              data.orders.map((order, index) => (
                <details className="cw-order" key={order.id} open={index === 0}>
                  <summary>
                    <div className="cw-order-summary">
                      <div className="cw-order-code">
                        <strong>{order.code}</strong>
                        <span>{dateTime(order.createdAt)}</span>
                      </div>
                      <div className="cw-order-right">
                        <b>{money(order.total)}</b>
                        <span className={`cw-status cw-status-${order.status.toLowerCase()}`}>
                          {labelStatus(order.status)}
                        </span>
                      </div>
                    </div>
                    <div className="cw-order-sub">
                      <span>{fulfillmentLabel(order.fulfillmentType)}</span>
                      <span>{order.source}</span>
                      <span>{order.items.length} producto{order.items.length === 1 ? "" : "s"}</span>
                      <ChevronDown className="cw-chevron" size={16} />
                    </div>
                  </summary>

                  <div className="cw-order-body">
                    <div className="cw-items">
                      {order.items.map((item, itemIndex) => (
                        <div
                          className="cw-item"
                          key={`${order.id}-${itemIndex}`}
                        >
                          <div className="cw-item-line">
                            <div>
                              <span className="cw-qty">{item.quantity}×</span>
                              <strong>{item.productName}</strong>
                              {item.variantName ? <em>{item.variantName}</em> : null}
                            </div>
                            <b>{money(item.lineTotal)}</b>
                          </div>
                          {item.detail ? <p>{item.detail}</p> : null}
                          {item.notes ? (
                            <p className="cw-item-note">Nota: {item.notes}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    {(order.deliveryFee > 0 || order.discount > 0) && (
                      <div className="cw-totals">
                        <div>
                          <span>Productos</span>
                          <b>{money(order.subtotal)}</b>
                        </div>
                        {order.deliveryFee > 0 ? (
                          <div>
                            <span>Domicilio</span>
                            <b>{money(order.deliveryFee)}</b>
                          </div>
                        ) : null}
                        {order.discount > 0 ? (
                          <div>
                            <span>Descuento</span>
                            <b>- {money(order.discount)}</b>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {order.address ? (
                      <div className="cw-detail-box">
                        <MapPin size={14} />
                        <div>
                          <span>Entrega</span>
                          <strong>{compactAddress(order.address)}</strong>
                          {order.address.notes ? (
                            <p>{order.address.notes}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {order.payments.length > 0 ? (
                      <div className="cw-payments">
                        {order.payments.map((payment, paymentIndex) => (
                          <div
                            key={`${order.id}-payment-${paymentIndex}`}
                            className="cw-payment"
                          >
                            <div>
                              <span>{payment.method}</span>
                              <small>{paymentStatusLabel(payment.status)}</small>
                            </div>
                            <b>{money(payment.amount)}</b>
                            {payment.cashReceived != null ? (
                              <p>
                                Recibe {money(payment.cashReceived)} · vueltas{" "}
                                {money(payment.changeDue || 0)}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {order.notes ? (
                      <div className="cw-order-note">
                        <MessageSquareText size={14} />
                        <p>{order.notes}</p>
                      </div>
                    ) : null}
                  </div>
                </details>
              ))
            )}
          </section>
        </>
      ) : null}

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(html),
        :global(body) {
          margin: 0;
          min-height: 100%;
          background: #f5f4f1;
          color: #171717;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        :global(body) {
          overflow-x: hidden;
        }

        .cw-panel {
          min-height: 100vh;
          padding: 12px;
        }

        .cw-hero {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 22px;
          padding: 17px;
          background:
            radial-gradient(circle at 90% 0%, rgba(226,26,34,.45), transparent 35%),
            linear-gradient(135deg, #0c0d10 0%, #121116 53%, #3a090d 100%);
          color: #fff;
          box-shadow: 0 14px 34px rgba(20,12,12,.16);
        }

        .cw-hero-glow {
          position: absolute;
          width: 120px;
          height: 120px;
          right: -25px;
          bottom: -50px;
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 38px;
          transform: rotate(20deg);
          background: rgba(255,255,255,.025);
        }

        .cw-hero-top {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .cw-avatar {
          display: grid;
          width: 50px;
          height: 50px;
          flex: 0 0 50px;
          place-items: center;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 16px;
          background: rgba(255,255,255,.08);
          color: #fff;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: -.02em;
        }

        .cw-person {
          min-width: 0;
        }

        .cw-kicker {
          display: flex;
          align-items: center;
          gap: 7px;
          color: rgba(255,255,255,.45);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .14em;
        }

        .cw-kicker span {
          width: 20px;
          height: 2px;
          border-radius: 99px;
          background: #e21a22;
        }

        h1 {
          overflow: hidden;
          margin: 4px 0 0;
          font-size: 20px;
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -.035em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cw-person p {
          display: flex;
          align-items: center;
          gap: 5px;
          margin: 6px 0 0;
          color: rgba(255,255,255,.55);
          font-size: 10px;
        }

        .cw-person em {
          border-left: 1px solid rgba(255,255,255,.14);
          padding-left: 6px;
          font-style: normal;
        }

        .cw-hero-badges {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid rgba(255,255,255,.08);
        }

        .cw-signal,
        .cw-points {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 9px;
          font-weight: 900;
        }

        .cw-signal {
          background: #fff;
          color: #171717;
        }

        .cw-signal-frecuente {
          background: #e21a22;
          color: #fff;
        }

        .cw-signal-por_recuperar {
          background: #fff0d9;
          color: #9a5a00;
        }

        .cw-points {
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.07);
          color: rgba(255,255,255,.78);
        }

        .cw-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 10px;
          border: 1px solid #e4e2dd;
          border-radius: 17px;
          background: #fff;
          padding: 18px;
          color: #6f6c68;
          font-size: 11px;
          font-weight: 700;
        }

        .cw-loader {
          width: 14px;
          height: 14px;
          border: 2px solid #dedbd6;
          border-top-color: #e21a22;
          border-radius: 50%;
          animation: cw-spin .7s linear infinite;
        }

        @keyframes cw-spin {
          to { transform: rotate(360deg); }
        }

        .cw-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 7px;
          margin-top: 9px;
        }

        .cw-metrics article {
          position: relative;
          overflow: hidden;
          min-width: 0;
          border: 1px solid #e5e2dc;
          border-radius: 17px;
          background: #fff;
          padding: 11px 12px;
        }

        .cw-metrics svg {
          position: absolute;
          top: 10px;
          right: 10px;
          color: #d5d1ca;
        }

        .cw-metrics strong,
        .cw-metrics span {
          display: block;
        }

        .cw-metrics strong {
          overflow: hidden;
          padding-right: 19px;
          font-size: 17px;
          font-weight: 900;
          letter-spacing: -.035em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cw-metrics span {
          margin-top: 3px;
          color: #9a9792;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .07em;
          text-transform: uppercase;
        }

        .cw-card,
        .cw-orders {
          margin-top: 9px;
          border: 1px solid #e5e2dc;
          border-radius: 19px;
          background: #fff;
          padding: 14px;
        }

        .cw-section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .cw-section-head span {
          display: block;
          color: #aaa6a0;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .13em;
        }

        .cw-section-head h2 {
          margin: 3px 0 0;
          color: #191817;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: -.02em;
        }

        .cw-section-head > b {
          display: grid;
          min-width: 28px;
          height: 28px;
          place-items: center;
          border-radius: 9px;
          background: #f2f0ec;
          color: #55514c;
          font-size: 10px;
        }

        .cw-context-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap: 1px;
          margin-top: 12px;
          overflow: hidden;
          border: 1px solid #eeeae5;
          border-radius: 13px;
          background: #eeeae5;
        }

        .cw-context-grid div {
          min-width: 0;
          background: #faf9f7;
          padding: 10px;
        }

        .cw-context-grid span,
        .cw-context-grid strong {
          display: block;
        }

        .cw-context-grid span {
          color: #aaa6a0;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .cw-context-grid strong {
          overflow: hidden;
          margin-top: 3px;
          color: #3d3a36;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cw-note,
        .cw-address,
        .cw-detail-box,
        .cw-order-note {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-top: 10px;
          border-radius: 13px;
          background: #f8f6f3;
          padding: 10px;
          color: #77726c;
        }

        .cw-note svg,
        .cw-address svg,
        .cw-detail-box svg,
        .cw-order-note svg {
          flex: 0 0 auto;
          margin-top: 1px;
          color: #e21a22;
        }

        .cw-note span,
        .cw-detail-box span {
          color: #a39f99;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .07em;
          text-transform: uppercase;
        }

        .cw-note p,
        .cw-address p,
        .cw-detail-box p,
        .cw-order-note p {
          margin: 3px 0 0;
          color: #5c5853;
          font-size: 10px;
          line-height: 1.45;
        }

        .cw-map-head a {
          border: 1px solid #e4e0da;
          border-radius: 10px;
          background: #faf9f7;
          padding: 6px 8px;
          color: #55514c;
          font-size: 8px;
          font-weight: 900;
          text-decoration: none;
        }

        .cw-map {
          position: relative;
          height: 142px;
          margin-top: 11px;
          overflow: hidden;
          border: 1px solid #e6e2dc;
          border-radius: 15px;
          background: #efede9;
        }

        .cw-map iframe {
          width: 100%;
          height: 100%;
          border: 0;
          filter: saturate(.75) contrast(.95);
        }

        .cw-map-pin {
          position: absolute;
          top: 50%;
          left: 50%;
          display: grid;
          width: 31px;
          height: 31px;
          place-items: center;
          transform: translate(-50%,-65%);
          border: 3px solid #fff;
          border-radius: 12px 12px 12px 3px;
          background: #e21a22;
          color: #fff;
          box-shadow: 0 8px 18px rgba(76,10,12,.28);
          rotate: -45deg;
          pointer-events: none;
        }

        .cw-map-pin svg {
          rotate: 45deg;
        }

        .cw-address strong {
          display: block;
          color: #292724;
          font-size: 11px;
          line-height: 1.35;
        }

        .cw-address b {
          color: #3c3935;
        }

        .cw-orders {
          padding: 12px;
        }

        .cw-orders > .cw-section-head {
          padding: 2px 2px 8px;
        }

        .cw-order {
          overflow: hidden;
          margin-top: 7px;
          border: 1px solid #e8e4de;
          border-radius: 15px;
          background: #fff;
        }

        .cw-order summary {
          position: relative;
          cursor: pointer;
          list-style: none;
          padding: 11px;
          user-select: none;
        }

        .cw-order summary::-webkit-details-marker {
          display: none;
        }

        .cw-order[open] {
          border-color: #d9d4cc;
          box-shadow: 0 7px 20px rgba(36,27,20,.045);
        }

        .cw-order[open] summary {
          background: #faf9f7;
        }

        .cw-order-summary {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .cw-order-code strong,
        .cw-order-code span,
        .cw-order-right b {
          display: block;
        }

        .cw-order-code strong {
          color: #1f1e1c;
          font-size: 11px;
          font-weight: 900;
        }

        .cw-order-code span {
          margin-top: 3px;
          color: #a09c96;
          font-size: 8px;
        }

        .cw-order-right {
          flex: 0 0 auto;
          text-align: right;
        }

        .cw-order-right b {
          color: #1c1b19;
          font-size: 12px;
          font-weight: 900;
        }

        .cw-status {
          display: inline-flex;
          margin-top: 4px;
          border-radius: 999px;
          background: #efede9;
          padding: 3px 6px;
          color: #6c6761;
          font-size: 7px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .cw-status-completed,
        .cw-status-delivered {
          background: #e9f8ef;
          color: #187546;
        }

        .cw-status-out_for_delivery,
        .cw-status-ready {
          background: #fff2dc;
          color: #9d6509;
        }

        .cw-status-preparing,
        .cw-status-confirmed {
          background: #edf5ff;
          color: #276da5;
        }

        .cw-order-sub {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 8px;
          color: #8e8982;
          font-size: 8px;
          font-weight: 700;
        }

        .cw-order-sub span:not(:last-of-type)::after {
          content: "·";
          margin-left: 5px;
          color: #cac5be;
        }

        .cw-chevron {
          margin-left: auto;
          transition: transform .2s ease;
        }

        .cw-order[open] .cw-chevron {
          transform: rotate(180deg);
        }

        .cw-order-body {
          border-top: 1px solid #eeeae5;
          padding: 11px;
        }

        .cw-items {
          display: grid;
          gap: 8px;
        }

        .cw-item + .cw-item {
          padding-top: 8px;
          border-top: 1px solid #f1efeb;
        }

        .cw-item-line {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }

        .cw-item-line > div {
          min-width: 0;
        }

        .cw-item-line strong {
          color: #2a2825;
          font-size: 10px;
          font-weight: 800;
        }

        .cw-item-line em {
          display: inline;
          margin-left: 4px;
          color: #928d86;
          font-size: 8px;
          font-style: normal;
        }

        .cw-item-line > b {
          flex: 0 0 auto;
          color: #3d3934;
          font-size: 9px;
        }

        .cw-qty {
          margin-right: 5px;
          color: #e21a22;
          font-size: 9px;
          font-weight: 900;
        }

        .cw-item p {
          margin: 3px 0 0 19px;
          color: #817c75;
          font-size: 8px;
          line-height: 1.4;
        }

        .cw-item-note {
          color: #a05d00 !important;
        }

        .cw-totals {
          margin-top: 10px;
          border-top: 1px solid #efede9;
          padding-top: 8px;
        }

        .cw-totals div {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 4px;
          color: #77726b;
          font-size: 8px;
        }

        .cw-totals b {
          color: #46423d;
        }

        .cw-detail-box strong {
          display: block;
          margin-top: 2px;
          color: #373430;
          font-size: 9px;
          line-height: 1.35;
        }

        .cw-payments {
          display: grid;
          gap: 6px;
          margin-top: 9px;
        }

        .cw-payment {
          display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          gap: 2px 8px;
          border: 1px solid #e9e6e1;
          border-radius: 11px;
          background: #faf9f7;
          padding: 8px;
        }

        .cw-payment span,
        .cw-payment small {
          display: block;
        }

        .cw-payment span {
          color: #45413c;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .cw-payment small {
          margin-top: 2px;
          color: #99948d;
          font-size: 7px;
          font-weight: 700;
        }

        .cw-payment > b {
          color: #282622;
          font-size: 10px;
        }

        .cw-payment p {
          grid-column: 1 / -1;
          margin: 3px 0 0;
          color: #837e77;
          font-size: 8px;
        }

        .cw-order-note {
          margin-top: 9px;
        }

        .cw-order-note p {
          margin: 0;
        }

        @media (max-width: 320px) {
          .cw-panel {
            padding: 8px;
          }

          .cw-metrics {
            grid-template-columns: 1fr;
          }

          .cw-context-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
