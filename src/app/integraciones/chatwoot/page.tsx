"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  MapPin,
  MessageSquareText,
  Navigation,
  Phone,
  Route,
  Star,
  UserRound,
  WalletCards,
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

type DeliveryContext = {
  available: boolean;
  covered: boolean;
  distanceMeters: number | null;
  durationSeconds: number | null;
  quotedFee: number | null;
  zoneName: string | null;
  origin: {
    address: string;
    latitude: number;
    longitude: number;
  } | null;
  destination: {
    address: string;
    latitude: number;
    longitude: number;
  } | null;
};

type OrderSummary = {
  id: number;
  number: number;
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
  pointsEarned: number;
  pointsBase: number | null;
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
  deliveryContext: DeliveryContext;
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
  }).format(Number(value || 0));
}

function points(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function shortDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date(value));
}

function shortDate(value: string | null) {
  if (!value) return "Sin compras";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

function fulfillmentLabel(value: string) {
  const labels: Record<string, string> = {
    DELIVERY: "DOMICILIO",
    PICKUP: "RECOGER EN TIENDA",
    STORE: "EN LOCAL",
  };
  return labels[value] ?? value;
}

function statusLabel(value: string) {
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
  };
  return labels[value] ?? value;
}

function initials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "C"
  );
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

function durationLabel(seconds: number | null) {
  if (seconds == null) return "—";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function distanceLabel(meters: number | null) {
  if (meters == null) return "—";
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function itemDetails(value: string) {
  return value
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
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

  const delivery = data?.deliveryContext ?? null;
  const routeOrigin = delivery?.origin
    ? `${delivery.origin.latitude},${delivery.origin.longitude}`
    : "";
  const routeDestination = delivery?.destination
    ? `${delivery.destination.latitude},${delivery.destination.longitude}`
    : "";
  const directionsEmbed =
    routeOrigin && routeDestination
      ? `https://www.google.com/maps?output=embed&saddr=${encodeURIComponent(
          routeOrigin,
        )}&daddr=${encodeURIComponent(routeDestination)}&travelmode=driving`
      : "";
  const directionsUrl =
    routeOrigin && routeDestination
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
          routeOrigin,
        )}&destination=${encodeURIComponent(
          routeDestination,
        )}&travelmode=driving`
      : "";

  return (
    <main className="chat-panel">
      <header className="chatwoot-header">
        <div>
          <span className="chatwoot-kicker">ATENCIÓN AL CLIENTE</span>
          <h1>Chatwoot</h1>
        </div>
        <span className="alento-badge">ALENTÓ</span>
      </header>

      {loading ? (
        <div className="state-card">Consultando información del cliente…</div>
      ) : null}

      {!loading && message ? (
        <div className="state-card">
          <UserRound size={18} />
          {message}
        </div>
      ) : null}

      {data ? (
        <>
          <section className="customer-card">
            <div className="customer-main">
              <div className="avatar">{initials(displayName)}</div>
              <div className="customer-copy">
                <span className="eyebrow">CLIENTE #{data.customer.id}</span>
                <h2>{displayName}</h2>
                <p>
                  <Phone size={13} />
                  {phone || "Sin teléfono"}
                </p>
              </div>
              <span className="customer-status">
                {signalLabel(data.metrics.commercialSignal)}
              </span>
            </div>

            <div className="customer-stats">
              <div>
                <span>Pedidos</span>
                <strong>{data.metrics.purchaseCount}</strong>
              </div>
              <div>
                <span>Ticket prom.</span>
                <strong>{money(data.metrics.averageTicket)}</strong>
              </div>
              <div>
                <span>Última compra</span>
                <strong>{shortDate(data.metrics.lastOrderAt)}</strong>
              </div>
            </div>

            {data.customer.notes ? (
              <div className="customer-note">
                <MessageSquareText size={14} />
                <p>{data.customer.notes}</p>
              </div>
            ) : null}
          </section>

          <section className="points-card">
            <div className="points-icon">
              <Star size={21} fill="currentColor" />
            </div>
            <div>
              <span>CLUB ALENTÓ</span>
              <h3>{points(data.metrics.clubPoints)} puntos</h3>
              <p>Saldo acumulado del cliente</p>
            </div>
            {data.orders[0] ? (
              <div className="points-last">
                <span>Último pedido</span>
                <strong>
                  +{points(data.orders[0].pointsEarned)} pts
                </strong>
              </div>
            ) : null}
          </section>

          {data.customer.defaultAddress ? (
            <section className="map-card">
              <div className="section-title">
                <div>
                  <span>UBICACIÓN DEL CLIENTE</span>
                  <h3>Ruta desde Alentó</h3>
                </div>
                {directionsUrl ? (
                  <a href={directionsUrl} target="_blank" rel="noreferrer">
                    Abrir ruta
                  </a>
                ) : null}
              </div>

              <div className="route-metrics">
                <div>
                  <Route size={16} />
                  <span>Distancia</span>
                  <strong>{distanceLabel(delivery?.distanceMeters ?? null)}</strong>
                </div>
                <div>
                  <Clock3 size={16} />
                  <span>Tiempo</span>
                  <strong>{durationLabel(delivery?.durationSeconds ?? null)}</strong>
                </div>
                <div>
                  <WalletCards size={16} />
                  <span>Domicilio</span>
                  <strong>
                    {delivery?.quotedFee == null
                      ? "—"
                      : money(delivery.quotedFee)}
                  </strong>
                </div>
              </div>

              {directionsEmbed ? (
                <div className="route-map">
                  <iframe
                    title="Ruta de domicilio"
                    src={directionsEmbed}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : null}

              <div className="route-address">
                <MapPin size={16} />
                <div>
                  <strong>
                    {compactAddress(data.customer.defaultAddress)}
                  </strong>
                  {data.customer.defaultAddress.notes ? (
                    <p>
                      <b>Indicaciones:</b>{" "}
                      {data.customer.defaultAddress.notes}
                    </p>
                  ) : null}
                  {delivery?.zoneName ? (
                    <small>{delivery.zoneName}</small>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          <section className="history">
            <div className="history-head">
              <div>
                <span>HISTORIAL DEL CLIENTE</span>
                <h3>Pedidos recientes</h3>
              </div>
              <b>{data.orders.length}</b>
            </div>

            <div className="order-list">
              {data.orders.map((order) => (
                <article className="order-card" key={order.id}>
                  <div className="order-header">
                    <div>
                      <div className="order-title-line">
                        <strong>Pedido #{order.number}</strong>
                        <span>{fulfillmentLabel(order.fulfillmentType)}</span>
                      </div>
                      <p>{shortDateTime(order.createdAt)}</p>
                    </div>
                    <div className="order-header-right">
                      <span className="order-status">
                        {statusLabel(order.status)}
                      </span>
                      <span className="order-points">
                        <Star size={11} fill="currentColor" />
                        +{points(order.pointsEarned)} pts
                      </span>
                    </div>
                  </div>

                  <div className="order-items">
                    {order.items.map((item, index) => (
                      <div className="order-item" key={`${order.id}-${index}`}>
                        <span className="qty-badge">{item.quantity}×</span>
                        <div className="item-copy">
                          <div className="item-name-line">
                            <strong>{item.productName}</strong>
                            <b>{money(item.lineTotal)}</b>
                          </div>
                          {item.variantName ? (
                            <p className="variant">{item.variantName}</p>
                          ) : null}
                          {itemDetails(item.detail).map((detail) => {
                            const separator = detail.indexOf(":");
                            return separator > 0 ? (
                              <p className="item-detail" key={detail}>
                                <b>{detail.slice(0, separator)}:</b>
                                {detail.slice(separator + 1)}
                              </p>
                            ) : (
                              <p className="item-detail" key={detail}>
                                {detail}
                              </p>
                            );
                          })}
                          {item.notes ? (
                            <p className="item-note">Nota: {item.notes}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  {order.address ? (
                    <div className="order-address">
                      <Navigation size={14} />
                      <div>
                        <strong>{compactAddress(order.address)}</strong>
                        {order.address.notes ? (
                          <p>{order.address.notes}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="order-total-box">
                    <div>
                      <span>Subtotal</span>
                      <b>{money(order.subtotal)}</b>
                    </div>
                    <div>
                      <span>Domicilio</span>
                      <b>{money(order.deliveryFee)}</b>
                    </div>
                    <div className={order.discount > 0 ? "discount" : ""}>
                      <span>Descuento</span>
                      <b>
                        {order.discount > 0 ? "- " : ""}
                        {money(order.discount)}
                      </b>
                    </div>
                    <div className="total-rule" />
                    <div className="grand-total">
                      <span>TOTAL</span>
                      <strong>{money(order.total)}</strong>
                    </div>
                    <div className="points-earned">
                      <span>Puntos de este pedido</span>
                      <b>+{points(order.pointsEarned)} pts</b>
                    </div>
                  </div>
                </article>
              ))}
            </div>
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
          background: #f4f3f0;
          color: #171717;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .chat-panel {
          min-height: 100vh;
          padding: 10px;
        }

        .chatwoot-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-radius: 18px;
          padding: 14px 16px;
          background:
            radial-gradient(circle at 95% 15%, rgba(226,26,34,.5), transparent 32%),
            linear-gradient(135deg, #0c0d10 0%, #111216 58%, #4b090d 100%);
          color: white;
          box-shadow: 0 12px 30px rgba(34,18,17,.13);
        }

        .chatwoot-kicker {
          color: rgba(255,255,255,.42);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .16em;
        }

        .chatwoot-header h1 {
          margin: 3px 0 0;
          font-size: 22px;
          font-weight: 950;
          letter-spacing: -.045em;
        }

        .alento-badge {
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 999px;
          background: rgba(255,255,255,.08);
          padding: 7px 10px;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: .12em;
        }

        .state-card {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 9px;
          border: 1px solid #e2dfda;
          border-radius: 16px;
          background: white;
          padding: 18px;
          color: #77716b;
          font-size: 11px;
          font-weight: 700;
        }

        .customer-card,
        .points-card,
        .map-card,
        .history {
          margin-top: 9px;
          border: 1px solid #e1ded8;
          border-radius: 18px;
          background: #fff;
        }

        .customer-card {
          overflow: hidden;
        }

        .customer-main {
          display: grid;
          grid-template-columns: 48px minmax(0,1fr) auto;
          gap: 11px;
          align-items: center;
          padding: 13px;
        }

        .avatar {
          display: grid;
          width: 48px;
          height: 48px;
          place-items: center;
          border-radius: 15px;
          background: #111;
          color: white;
          font-size: 13px;
          font-weight: 950;
        }

        .customer-copy {
          min-width: 0;
        }

        .eyebrow,
        .section-title span,
        .history-head span,
        .points-card > div:nth-child(2) > span {
          color: #9b9791;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .13em;
        }

        .customer-copy h2 {
          overflow: hidden;
          margin: 3px 0 0;
          font-size: 17px;
          font-weight: 950;
          letter-spacing: -.03em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .customer-copy p {
          display: flex;
          align-items: center;
          gap: 5px;
          margin: 4px 0 0;
          color: #817c76;
          font-size: 10px;
        }

        .customer-status {
          border-radius: 999px;
          background: #111;
          padding: 6px 8px;
          color: white;
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .customer-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          border-top: 1px solid #ebe8e3;
          background: #faf9f7;
        }

        .customer-stats div {
          min-width: 0;
          padding: 9px 10px;
        }

        .customer-stats div + div {
          border-left: 1px solid #ebe8e3;
        }

        .customer-stats span,
        .customer-stats strong {
          display: block;
        }

        .customer-stats span {
          color: #aaa59f;
          font-size: 7px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .customer-stats strong {
          overflow: hidden;
          margin-top: 3px;
          color: #393632;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .customer-note {
          display: flex;
          gap: 8px;
          margin: 0 12px 12px;
          border-radius: 12px;
          background: #fff5e8;
          padding: 9px;
          color: #8e5f22;
        }

        .customer-note p {
          margin: 0;
          font-size: 9px;
          line-height: 1.45;
        }

        .points-card {
          display: grid;
          grid-template-columns: 42px minmax(0,1fr) auto;
          gap: 10px;
          align-items: center;
          padding: 12px;
          background:
            radial-gradient(circle at 95% 15%, rgba(226,26,34,.07), transparent 36%),
            #fff;
        }

        .points-icon {
          display: grid;
          width: 42px;
          height: 42px;
          place-items: center;
          border-radius: 13px;
          background: #fff0f1;
          color: #e21a22;
        }

        .points-card h3 {
          margin: 2px 0 0;
          font-size: 17px;
          font-weight: 950;
          letter-spacing: -.035em;
        }

        .points-card p {
          margin: 2px 0 0;
          color: #98938d;
          font-size: 8px;
        }

        .points-last {
          text-align: right;
        }

        .points-last span,
        .points-last strong {
          display: block;
        }

        .points-last span {
          color: #aaa59f;
          font-size: 7px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .points-last strong {
          margin-top: 3px;
          color: #e21a22;
          font-size: 11px;
          font-weight: 950;
        }

        .map-card {
          padding: 12px;
        }

        .section-title,
        .history-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .section-title h3,
        .history-head h3 {
          margin: 3px 0 0;
          font-size: 15px;
          font-weight: 950;
          letter-spacing: -.025em;
        }

        .section-title a {
          border: 1px solid #e2ded8;
          border-radius: 10px;
          background: #faf9f7;
          padding: 6px 8px;
          color: #55514c;
          font-size: 8px;
          font-weight: 900;
          text-decoration: none;
        }

        .route-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap: 6px;
          margin-top: 10px;
        }

        .route-metrics div {
          position: relative;
          min-width: 0;
          border: 1px solid #ebe7e1;
          border-radius: 13px;
          background: #faf9f7;
          padding: 9px;
        }

        .route-metrics svg {
          position: absolute;
          top: 8px;
          right: 8px;
          color: #d2cec8;
        }

        .route-metrics span,
        .route-metrics strong {
          display: block;
        }

        .route-metrics span {
          color: #aaa59f;
          font-size: 7px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .route-metrics strong {
          overflow: hidden;
          margin-top: 4px;
          padding-right: 12px;
          font-size: 12px;
          font-weight: 950;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .route-map {
          height: 170px;
          margin-top: 9px;
          overflow: hidden;
          border: 1px solid #e1ddd7;
          border-radius: 14px;
          background: #eeeae5;
        }

        .route-map iframe {
          width: 100%;
          height: 100%;
          border: 0;
        }

        .route-address {
          display: flex;
          gap: 8px;
          margin-top: 9px;
          border-radius: 12px;
          background: #f8f6f3;
          padding: 9px;
          color: #e21a22;
        }

        .route-address div {
          min-width: 0;
        }

        .route-address strong,
        .route-address p,
        .route-address small {
          display: block;
        }

        .route-address strong {
          color: #292724;
          font-size: 10px;
          line-height: 1.35;
        }

        .route-address p {
          margin: 3px 0 0;
          color: #68635d;
          font-size: 9px;
          line-height: 1.4;
        }

        .route-address small {
          margin-top: 3px;
          color: #a29c95;
          font-size: 8px;
        }

        .history {
          padding: 10px;
        }

        .history-head {
          padding: 2px 2px 8px;
        }

        .history-head > b {
          display: grid;
          min-width: 28px;
          height: 28px;
          place-items: center;
          border-radius: 9px;
          background: #111;
          color: white;
          font-size: 9px;
        }

        .order-list {
          display: grid;
          gap: 10px;
        }

        .order-card {
          overflow: hidden;
          border: 1px solid #ddd9d3;
          border-radius: 17px;
          background: white;
        }

        .order-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          padding: 11px 12px;
          border-bottom: 1px solid #e8e4de;
        }

        .order-title-line {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }

        .order-title-line > strong {
          font-size: 11px;
          font-weight: 950;
        }

        .order-title-line > span {
          border-radius: 999px;
          background: #111;
          padding: 4px 7px;
          color: white;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: .04em;
        }

        .order-header p {
          margin: 4px 0 0;
          color: #99948d;
          font-size: 8px;
        }

        .order-header-right {
          display: grid;
          justify-items: end;
          gap: 4px;
        }

        .order-status {
          color: #77716a;
          font-size: 7px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .order-points {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          border-radius: 999px;
          background: #fff0f1;
          padding: 4px 6px;
          color: #e21a22;
          font-size: 8px;
          font-weight: 950;
        }

        .order-items {
          display: grid;
        }

        .order-item {
          display: grid;
          grid-template-columns: 34px minmax(0,1fr);
          gap: 9px;
          padding: 12px;
        }

        .order-item + .order-item {
          border-top: 1px solid #e8e4de;
        }

        .qty-badge {
          display: grid;
          width: 32px;
          height: 32px;
          place-items: center;
          border-radius: 10px;
          background: #ef1722;
          color: white;
          font-size: 9px;
          font-weight: 950;
          box-shadow: 0 7px 14px rgba(226,26,34,.18);
        }

        .item-copy {
          min-width: 0;
        }

        .item-name-line {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }

        .item-name-line strong {
          color: #171717;
          font-size: 10px;
          font-weight: 950;
        }

        .item-name-line > b {
          flex: 0 0 auto;
          color: #111;
          font-size: 9px;
          font-weight: 950;
        }

        .variant {
          margin: 3px 0 0;
          color: #aaa49d;
          font-size: 8px;
        }

        .item-detail,
        .item-note {
          margin: 4px 0 0;
          color: #625e58;
          font-size: 8px;
          line-height: 1.35;
        }

        .item-detail b {
          margin-right: 3px;
          color: #2d2a27;
        }

        .item-note {
          color: #995b0a;
        }

        .order-address {
          display: flex;
          gap: 8px;
          border-top: 1px solid #ebe7e1;
          background: #faf9f7;
          padding: 9px 12px;
          color: #e21a22;
        }

        .order-address strong {
          display: block;
          color: #393632;
          font-size: 8px;
          line-height: 1.35;
        }

        .order-address p {
          margin: 2px 0 0;
          color: #8f8982;
          font-size: 7px;
        }

        .order-total-box {
          background: #111;
          padding: 11px 12px;
          color: white;
        }

        .order-total-box > div:not(.total-rule):not(.grand-total):not(.points-earned) {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 4px;
          color: #bdb8b1;
          font-size: 8px;
        }

        .order-total-box b {
          color: white;
        }

        .order-total-box .discount,
        .order-total-box .discount b {
          color: #ff4c58 !important;
        }

        .total-rule {
          height: 1px;
          margin: 9px 0;
          background: rgba(255,255,255,.12);
        }

        .grand-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .grand-total span {
          color: #c4beb7;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .1em;
        }

        .grand-total strong {
          font-size: 19px;
          font-weight: 950;
        }

        .points-earned {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
          border-radius: 9px;
          background: rgba(226,26,34,.13);
          padding: 7px 8px;
          color: #ff9ca1;
          font-size: 8px;
        }

        .points-earned b {
          color: #fff;
          font-size: 9px;
        }

        @media (max-width: 350px) {
          .chat-panel {
            padding: 7px;
          }

          .customer-main {
            grid-template-columns: 42px minmax(0,1fr);
          }

          .customer-status {
            grid-column: 1 / -1;
            justify-self: start;
          }

          .route-metrics {
            grid-template-columns: 1fr;
          }

          .points-card {
            grid-template-columns: 38px minmax(0,1fr);
          }

          .points-last {
            grid-column: 1 / -1;
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}
