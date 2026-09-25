"use client";

import { useEffect, useMemo, useState } from "react";
import ChatwootCustomerRouteMap from "@/components/ChatwootCustomerRouteMap";
import StructuredPosPageV2 from "@/components/StructuredPosPageV2";
import {
  Clock3,
  MapPin,
  MessageSquareText,
  Navigation,
  Phone,
  Plus,
  RotateCcw,
  Route,
  Star,
  UserRound,
  WalletCards,
  X,
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
  walkingRoute: {
    distanceMeters: number;
    durationSeconds: number | null;
    encodedPolyline: string;
  } | null;
  motorcycleRoute: {
    distanceMeters: number;
    durationSeconds: number | null;
    encodedPolyline: string;
    fallbackToDriving: boolean;
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

type RepeatPreview = {
  sourceOrderId: number;
  sourceOrderNumber: number;
  customer: {
    id: number;
    name: string;
    countryCode: string;
    phone: string | null;
  };
  fulfillmentType: string;
  address: {
    id: number;
    address: string;
    formattedAddress: string | null;
    neighborhood: string | null;
  } | null;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  previousDiscount: number;
  notes: string | null;
  items: Array<{
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    detail: string;
    notes: string | null;
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

function compactAddress(
  address:
    | Pick<AddressSummary, "address" | "formattedAddress" | "neighborhood">
    | null,
) {
  if (!address) return "";
  const base = (
    address.address?.trim() ||
    address.formattedAddress?.trim() ||
    ""
  )
    .replace(/,\s*Bogot[aá]\b.*$/i, "")
    .replace(/\s*,\s*$/, "")
    .trim();
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

function isHistoricalOrder(order: OrderSummary) {
  return order.payments.some((payment) =>
    ["histórico", "historico"].includes(
      payment.method.trim().toLocaleLowerCase("es"),
    ),
  );
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
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [posOpen, setPosOpen] = useState(false);
  const [repeatPreview, setRepeatPreview] = useState<RepeatPreview | null>(null);
  const [repeatLoadingId, setRepeatLoadingId] = useState<number | null>(null);
  const [repeatCreating, setRepeatCreating] = useState(false);
  const [repeatError, setRepeatError] = useState("");
  const [actionNotice, setActionNotice] = useState("");

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
  }, [phone, dashboardKey, refreshVersion]);

  async function prepareRepeat(orderId: number) {
    if (repeatLoadingId != null) return;
    setRepeatLoadingId(orderId);
    setRepeatError("");
    setActionNotice("");

    try {
      const response = await fetch(
        `/api/integrations/chatwoot/orders/${orderId}/repeat`,
        {
          cache: "no-store",
          headers: {
            "x-alento-chatwoot-key": dashboardKey,
          },
        },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(
          body.error || "No fue posible preparar este pedido.",
        );
      }
      setRepeatPreview(body.preview as RepeatPreview);
    } catch (error) {
      setRepeatError(
        error instanceof Error
          ? error.message
          : "No fue posible preparar este pedido.",
      );
    } finally {
      setRepeatLoadingId(null);
    }
  }

  async function confirmRepeat() {
    if (!repeatPreview || repeatCreating) return;
    setRepeatCreating(true);
    setRepeatError("");

    try {
      const response = await fetch(
        `/api/integrations/chatwoot/orders/${repeatPreview.sourceOrderId}/repeat`,
        {
          method: "POST",
          headers: {
            "x-alento-chatwoot-key": dashboardKey,
          },
        },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "No fue posible repetir el pedido.");
      }

      setRepeatPreview(null);
      setActionNotice(
        `${body.order.code} creado correctamente por ${money(body.order.total)}.`,
      );
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      setRepeatError(
        error instanceof Error
          ? error.message
          : "No fue posible repetir el pedido.",
      );
    } finally {
      setRepeatCreating(false);
    }
  }

  function closePos() {
    setPosOpen(false);
    setRefreshVersion((value) => value + 1);
  }

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
      <header className="chatwoot-header premium-header">
        <div className="header-brand">
          <span className="chatwoot-kicker">ATENCIÓN AL CLIENTE</span>
          <h1>Chatwoot</h1>
          <p>Contexto comercial en tiempo real · Alentó Pizza</p>
        </div>

        {data ? (
          <div className="header-club">
            <div className="header-club-icon">
              <Star size={22} fill="currentColor" />
            </div>
            <div className="header-club-copy">
              <span>CLUB ALENTÓ</span>
              <strong>{points(data.metrics.clubPoints)} pts</strong>
              <small>Saldo actual</small>
            </div>
            {data.orders[0] ? (
              <div className="header-club-last">
                <span>ÚLTIMO PEDIDO</span>
                <b>+{points(data.orders[0].pointsEarned)} pts</b>
              </div>
            ) : null}
          </div>
        ) : (
          <span className="alento-badge">ALENTÓ</span>
        )}
      </header>

      {actionNotice ? (
        <div className="action-notice">
          <span>{actionNotice}</span>
          <button type="button" onClick={() => setActionNotice("")}>×</button>
        </div>
      ) : null}

      {repeatError && !repeatPreview ? (
        <div className="action-error">
          <span>{repeatError}</span>
          <button type="button" onClick={() => setRepeatError("")}>×</button>
        </div>
      ) : null}

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
          <section className="top-grid">
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
                <span>Ticket promedio</span>
                <strong>{money(data.metrics.averageTicket)}</strong>
              </div>
              <div>
                <span>Comprado</span>
                <strong>{money(data.metrics.totalSpent)}</strong>
              </div>
              <div>
                <span>Última compra</span>
                <strong>{shortDate(data.metrics.lastOrderAt)}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPosOpen(true)}
              className="create-order-button"
            >
              <span className="create-order-icon"><Plus size={20} /></span>
              <span>
                <b>Crear orden</b>
                <small>Abre el POS con este cliente seleccionado</small>
              </span>
            </button>

            {data.customer.notes ? (
              <div className="customer-note">
                <MessageSquareText size={14} />
                <p>{data.customer.notes}</p>
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
                  <span>A pie</span>
                  <strong>
                    {distanceLabel(delivery?.walkingRoute?.distanceMeters ?? null)}
                    <small>{durationLabel(delivery?.walkingRoute?.durationSeconds ?? null)}</small>
                  </strong>
                </div>
                <div>
                  <Clock3 size={16} />
                  <span>Moto</span>
                  <strong>
                    {distanceLabel(delivery?.motorcycleRoute?.distanceMeters ?? null)}
                    <small>{durationLabel(delivery?.motorcycleRoute?.durationSeconds ?? null)}</small>
                  </strong>
                </div>
                <div>
                  <WalletCards size={16} />
                  <span>Domicilio</span>
                  <strong>
                    {delivery?.quotedFee == null
                      ? "—"
                      : money(delivery.quotedFee)}
                    <small>{delivery?.zoneName || "Tarifa actual"}</small>
                  </strong>
                </div>
              </div>

              {delivery?.origin && delivery?.destination ? (
                <div className="route-map">
                  <ChatwootCustomerRouteMap
                    origin={delivery.origin}
                    destination={delivery.destination}
                    walkingRoute={delivery.walkingRoute}
                    motorcycleRoute={delivery.motorcycleRoute}
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

          </section>

          <section className="history">
            <div className="history-head">
              <div>
                <span>HISTORIAL DEL CLIENTE</span>
                <h3>Pedidos recientes</h3>
              </div>
              <b>{data.orders.length}</b>
            </div>

            <div className="order-list order-grid">
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
                      <button
                        type="button"
                        className="repeat-order-button"
                        disabled={
                          repeatLoadingId === order.id ||
                          isHistoricalOrder(order)
                        }
                        title={
                          isHistoricalOrder(order)
                            ? "Los pedidos importados no conservan la configuración estructurada necesaria para repetirlos con seguridad."
                            : "Repetir este pedido"
                        }
                        onClick={() => void prepareRepeat(order.id)}
                      >
                        <RotateCcw size={13} />
                        {isHistoricalOrder(order)
                          ? "Pedido histórico"
                          : repeatLoadingId === order.id
                            ? "Preparando..."
                            : "Repetir pedido"}
                      </button>
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

                  <div className="order-meta">
                    <div>
                      <span>Pago</span>
                      <strong>{order.payments[0]?.method || "Sin registro"}</strong>
                    </div>
                    <div>
                      <span>Origen</span>
                      <strong>{order.source}</strong>
                    </div>
                    <div>
                      <span>Puntos</span>
                      <strong>+{points(order.pointsEarned)}</strong>
                    </div>
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

      {repeatPreview ? (
        <div className="repeat-overlay">
          <div className="repeat-modal">
            <div className="repeat-modal-head">
              <div>
                <span>REPETIR PEDIDO #{repeatPreview.sourceOrderNumber}</span>
                <h2>Confirma antes de crear</h2>
                <p>
                  Alentó recalculó productos y domicilio con los valores actuales.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRepeatPreview(null);
                  setRepeatError("");
                }}
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="repeat-modal-body">
              <div className="repeat-summary-grid">
                <div>
                  <span>Cliente</span>
                  <strong>{repeatPreview.customer.name}</strong>
                </div>
                <div>
                  <span>Modalidad</span>
                  <strong>{fulfillmentLabel(repeatPreview.fulfillmentType)}</strong>
                </div>
                <div>
                  <span>Pago</span>
                  <strong>{repeatPreview.paymentMethod}</strong>
                </div>
                <div>
                  <span>Total actual</span>
                  <strong>{money(repeatPreview.total)}</strong>
                </div>
              </div>

              {repeatPreview.address ? (
                <div className="repeat-address">
                  <MapPin size={17} />
                  <div>
                    <span>Dirección</span>
                    <strong>{compactAddress(repeatPreview.address)}</strong>
                  </div>
                </div>
              ) : null}

              <div className="repeat-products">
                {repeatPreview.items.map((item, index) => (
                  <div className="repeat-product" key={`${item.productId}-${index}`}>
                    <span>{item.quantity}×</span>
                    <div>
                      <strong>{item.productName}</strong>
                      {item.detail ? <p>{item.detail}</p> : null}
                      {item.notes ? <small>Nota: {item.notes}</small> : null}
                    </div>
                    <b>{money(item.lineTotal)}</b>
                  </div>
                ))}
              </div>

              <div className="repeat-totals">
                <div><span>Productos</span><b>{money(repeatPreview.subtotal)}</b></div>
                <div><span>Domicilio</span><b>{money(repeatPreview.deliveryFee)}</b></div>
                <div className="repeat-total"><span>TOTAL</span><strong>{money(repeatPreview.total)}</strong></div>
              </div>

              {repeatPreview.previousDiscount > 0 ? (
                <div className="repeat-warning">
                  El pedido anterior tenía {money(repeatPreview.previousDiscount)} de descuento.
                  Ese descuento no se repite automáticamente.
                </div>
              ) : null}

              {repeatError ? (
                <div className="repeat-warning repeat-warning-error">{repeatError}</div>
              ) : null}
            </div>

            <div className="repeat-modal-actions">
              <button
                type="button"
                onClick={() => {
                  setRepeatPreview(null);
                  setRepeatError("");
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="confirm-repeat"
                disabled={repeatCreating}
                onClick={() => void confirmRepeat()}
              >
                {repeatCreating ? "Creando..." : "Confirmar y crear pedido"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {posOpen && data ? (
        <div className="pos-overlay">
          <div className="pos-overlay-head">
            <div>
              <span>NUEVA ORDEN DESDE CHATWOOT</span>
              <h2>{data.customer.name}</h2>
            </div>
            <button type="button" onClick={closePos}>
              <X size={21} />
              Cerrar POS
            </button>
          </div>
          <div className="pos-overlay-body">
            <StructuredPosPageV2 initialCustomerId={data.customer.id} />
          </div>
        </div>
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

        .route-map > :global(*) {
          width: 100%;
          height: 100%;
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


        /* Premium desktop layout */
        :global(html),
        :global(body) {
          background: #08090b;
          color: #f5f2ee;
        }

        .chat-panel {
          min-height: 100vh;
          padding: 18px;
          background:
            radial-gradient(circle at 88% 0%, rgba(126, 8, 14, .30), transparent 28%),
            radial-gradient(circle at 8% 16%, rgba(226, 26, 34, .08), transparent 24%),
            #08090b;
        }

        .premium-header {
          min-height: 132px;
          padding: 24px 28px;
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 28px;
          background:
            radial-gradient(circle at 86% 28%, rgba(226,26,34,.54), transparent 27%),
            linear-gradient(112deg, #101116 0%, #121114 52%, #51090e 100%);
          box-shadow: 0 24px 64px rgba(0,0,0,.30);
        }

        .header-brand {
          min-width: 0;
        }

        .header-brand h1 {
          margin: 5px 0 0;
          font-size: 36px;
          font-weight: 950;
          letter-spacing: -.055em;
        }

        .header-brand p {
          margin: 7px 0 0;
          color: rgba(255,255,255,.50);
          font-size: 14px;
          font-weight: 600;
        }

        .chatwoot-kicker {
          font-size: 11px;
          letter-spacing: .17em;
        }

        .header-club {
          display: grid;
          min-width: 390px;
          grid-template-columns: 54px minmax(0,1fr) auto;
          align-items: center;
          gap: 14px;
          border: 1px solid rgba(255,255,255,.11);
          border-radius: 22px;
          background: rgba(5,5,6,.34);
          padding: 15px 17px;
          backdrop-filter: blur(12px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
        }

        .header-club-icon {
          display: grid;
          width: 54px;
          height: 54px;
          place-items: center;
          border-radius: 17px;
          background: #e21a22;
          color: #fff;
          box-shadow: 0 10px 24px rgba(226,26,34,.24);
        }

        .header-club-copy span,
        .header-club-last span {
          display: block;
          color: #9d9893;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .13em;
        }

        .header-club-copy strong {
          display: block;
          margin-top: 3px;
          color: #fff;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -.04em;
        }

        .header-club-copy small {
          display: block;
          margin-top: 2px;
          color: rgba(255,255,255,.42);
          font-size: 11px;
        }

        .header-club-last {
          border-left: 1px solid rgba(255,255,255,.10);
          padding-left: 15px;
          text-align: right;
        }

        .header-club-last b {
          display: block;
          margin-top: 5px;
          color: #ff6972;
          font-size: 17px;
          font-weight: 950;
        }

        .state-card {
          margin-top: 16px;
          border-color: #292a2e;
          background: #121315;
          color: #aaa5a0;
          font-size: 15px;
        }

        .top-grid {
          display: grid;
          grid-template-columns: minmax(0, .84fr) minmax(0, 1.16fr);
          gap: 16px;
          margin-top: 16px;
        }

        .customer-card,
        .map-card,
        .history {
          margin-top: 0;
          border: 1px solid #28292d;
          border-radius: 24px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.025), transparent 22%),
            #121315;
          box-shadow: 0 18px 42px rgba(0,0,0,.18);
        }

        .customer-card {
          padding: 22px;
        }

        .customer-main {
          grid-template-columns: 68px minmax(0,1fr) auto;
          gap: 16px;
          padding: 0;
        }

        .avatar {
          width: 68px;
          height: 68px;
          border: 1px solid #38393d;
          border-radius: 20px;
          background: linear-gradient(145deg, #202126, #0f1012);
          font-size: 19px;
        }

        .eyebrow,
        .section-title span,
        .history-head span {
          color: #817c77;
          font-size: 10px;
          letter-spacing: .13em;
        }

        .customer-copy h2 {
          font-size: 28px;
          color: #fff;
        }

        .customer-copy p {
          margin-top: 7px;
          color: #aaa5a0;
          font-size: 14px;
        }

        .customer-status {
          border: 1px solid rgba(226,26,34,.33);
          background: rgba(226,26,34,.12);
          color: #ff7d84;
          padding: 8px 11px;
          font-size: 11px;
        }

        .customer-stats {
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap: 9px;
          margin-top: 22px;
          border: 0;
          background: transparent;
        }

        .customer-stats div,
        .customer-stats div + div {
          border: 1px solid #292a2e;
          border-radius: 16px;
          background: #0d0e10;
          padding: 14px;
        }

        .customer-stats span {
          color: #77736f;
          font-size: 10px;
        }

        .customer-stats strong {
          margin-top: 5px;
          color: #f3efeb;
          font-size: 16px;
        }

        .customer-note {
          margin: 14px 0 0;
          border: 1px solid rgba(255,183,77,.14);
          border-radius: 16px;
          background: rgba(255,183,77,.07);
          padding: 13px;
          color: #ffb86b;
        }

        .customer-note p {
          color: #d0c7bb;
          font-size: 13px;
        }

        .map-card {
          padding: 20px;
        }

        .section-title h3,
        .history-head h3 {
          color: #fff;
          font-size: 25px;
        }

        .section-title a {
          border-color: #3a3b40;
          background: #1a1b1e;
          color: #f4f0ec;
          padding: 9px 12px;
          font-size: 12px;
        }

        .route-metrics {
          gap: 9px;
          margin-top: 15px;
        }

        .route-metrics div {
          border-color: #2c2d31;
          background: #0d0e10;
          padding: 14px;
        }

        .route-metrics span {
          color: #7b7772;
          font-size: 10px;
        }

        .route-metrics strong {
          margin-top: 7px;
          color: #fff;
          font-size: 18px;
        }

        .route-map {
          height: 245px;
          margin-top: 12px;
          border-color: #2d2e32;
          border-radius: 18px;
          background: #0d0e10;
        }

        .route-address {
          margin-top: 12px;
          border: 1px solid #292a2e;
          border-radius: 16px;
          background: #0d0e10;
          padding: 13px 14px;
        }

        .route-address strong {
          color: #f2eeea;
          font-size: 14px;
        }

        .route-address p {
          color: #aaa49d;
          font-size: 12px;
        }

        .route-address small {
          color: #77736f;
          font-size: 11px;
        }

        .history {
          margin-top: 16px;
          padding: 20px;
        }

        .history-head {
          padding: 0 2px 16px;
        }

        .history-head > b {
          min-width: 44px;
          height: 44px;
          border-radius: 14px;
          background: #e21a22;
          font-size: 15px;
          box-shadow: 0 10px 22px rgba(226,26,34,.18);
        }

        .order-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          align-items: start;
          gap: 16px;
        }

        .order-card {
          margin-top: 0;
          border: 1px solid #2d2e32;
          border-radius: 21px;
          background: #18191c;
          box-shadow: 0 15px 35px rgba(0,0,0,.16);
        }

        .order-header {
          min-height: 84px;
          padding: 16px 17px;
          border-color: #292a2e;
          background: #151619;
        }

        .order-title-line > strong {
          color: #fff;
          font-size: 17px;
        }

        .order-title-line > span {
          padding: 6px 9px;
          background: #050506;
          font-size: 10px;
        }

        .order-header p {
          margin-top: 6px;
          color: #817c76;
          font-size: 12px;
        }

        .order-status {
          color: #9d9891;
          font-size: 10px;
        }

        .order-points {
          padding: 6px 8px;
          color: #ff737b;
          font-size: 11px;
        }

        .order-items {
          background: #1b1c1f;
        }

        .order-item {
          grid-template-columns: 44px minmax(0,1fr);
          gap: 12px;
          padding: 17px;
        }

        .order-item + .order-item {
          border-color: #2a2b2f;
        }

        .qty-badge {
          width: 42px;
          height: 42px;
          border-radius: 13px;
          font-size: 12px;
        }

        .item-name-line strong {
          color: #fff;
          font-size: 15px;
        }

        .item-name-line > b {
          color: #fff;
          font-size: 14px;
        }

        .variant {
          color: #77736f;
          font-size: 12px;
        }

        .item-detail,
        .item-note {
          margin-top: 6px;
          color: #aca69f;
          font-size: 12px;
        }

        .item-detail b {
          color: #e7e1da;
        }

        .order-meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap: 1px;
          border-top: 1px solid #292a2e;
          border-bottom: 1px solid #292a2e;
          background: #292a2e;
        }

        .order-meta div {
          min-width: 0;
          background: #121315;
          padding: 11px 13px;
        }

        .order-meta span,
        .order-meta strong {
          display: block;
        }

        .order-meta span {
          color: #716d68;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .order-meta strong {
          overflow: hidden;
          margin-top: 3px;
          color: #d8d2cc;
          font-size: 11px;
          font-weight: 850;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .order-address {
          border-color: #292a2e;
          background: #141517;
          padding: 12px 16px;
        }

        .order-address strong {
          color: #ddd7d0;
          font-size: 12px;
        }

        .order-address p {
          color: #85807a;
          font-size: 11px;
        }

        .order-total-box {
          padding: 16px 17px;
          background:
            radial-gradient(circle at 100% 100%, rgba(226,26,34,.08), transparent 33%),
            #09090a;
        }

        .order-total-box > div:not(.total-rule):not(.grand-total):not(.points-earned) {
          margin-top: 6px;
          color: #8e8983;
          font-size: 12px;
        }

        .total-rule {
          margin: 13px 0;
        }

        .grand-total span {
          font-size: 11px;
        }

        .grand-total strong {
          font-size: 29px;
        }

        .points-earned {
          margin-top: 13px;
          border: 1px solid rgba(226,26,34,.14);
          border-radius: 12px;
          background: rgba(226,26,34,.10);
          padding: 9px 10px;
          color: #d69296;
          font-size: 11px;
        }

        .points-earned b {
          color: #ff747c;
          font-size: 12px;
        }

        @media (max-width: 900px) {
          .premium-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-club {
            width: 100%;
            min-width: 0;
          }

          .top-grid,
          .order-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .chat-panel {
            padding: 10px;
          }

          .premium-header {
            min-height: auto;
            padding: 18px;
          }

          .header-brand h1 {
            font-size: 29px;
          }

          .header-club {
            grid-template-columns: 46px minmax(0,1fr);
          }

          .header-club-last {
            grid-column: 1 / -1;
            border-top: 1px solid rgba(255,255,255,.10);
            border-left: 0;
            padding-top: 10px;
            padding-left: 0;
            text-align: left;
          }

          .customer-main {
            grid-template-columns: 58px minmax(0,1fr);
          }

          .customer-status {
            grid-column: 1 / -1;
            justify-self: start;
          }

          .customer-stats,
          .route-metrics,
          .order-meta {
            grid-template-columns: 1fr;
          }

          .route-map {
            height: 200px;
          }
        }

        .route-metrics strong small {
          display: block;
          margin-top: 3px;
          color: #8e8983;
          font-size: 11px;
          font-weight: 800;
        }

        .route-map {
          min-height: 245px;
        }

        .action-notice,
        .action-error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 14px;
          border-radius: 16px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 800;
        }

        .action-notice {
          border: 1px solid rgba(16,185,129,.25);
          background: rgba(16,185,129,.10);
          color: #8cf0c8;
        }

        .action-error {
          border: 1px solid rgba(239,68,68,.25);
          background: rgba(239,68,68,.10);
          color: #ff9ca1;
        }

        .action-notice button,
        .action-error button {
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font-size: 18px;
          font-weight: 900;
        }

        .create-order-button {
          display: flex;
          width: 100%;
          align-items: center;
          gap: 12px;
          margin-top: 14px;
          border: 1px solid rgba(226,26,34,.32);
          border-radius: 17px;
          background:
            linear-gradient(135deg, rgba(226,26,34,.18), rgba(105,10,15,.15)),
            #0d0e10;
          padding: 13px 14px;
          color: #fff;
          text-align: left;
          cursor: pointer;
          transition: border-color .2s ease, transform .2s ease;
        }

        .create-order-button:hover {
          border-color: rgba(226,26,34,.72);
          transform: translateY(-1px);
        }

        .create-order-icon {
          display: grid;
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          place-items: center;
          border-radius: 13px;
          background: #e21a22;
          box-shadow: 0 8px 18px rgba(226,26,34,.22);
        }

        .create-order-button b,
        .create-order-button small {
          display: block;
        }

        .create-order-button b {
          font-size: 15px;
          font-weight: 950;
        }

        .create-order-button small {
          margin-top: 3px;
          color: #a49e97;
          font-size: 11px;
          font-weight: 650;
        }

        .history {
          border: 0;
          background: transparent;
          box-shadow: none;
          padding: 0;
        }

        .history-head {
          margin-bottom: 14px;
          border: 1px solid #28292d;
          border-radius: 20px;
          background:
            linear-gradient(110deg, #141518, #101113 62%, #250b0d);
          padding: 18px 20px;
        }

        .order-grid {
          gap: 16px;
        }

        .repeat-order-button {
          display: inline-flex;
          min-height: 34px;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: 1px solid #3a3b40;
          border-radius: 10px;
          background: #0d0e10;
          padding: 7px 9px;
          color: #f4f0ec;
          cursor: pointer;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
        }

        .repeat-order-button:hover {
          border-color: rgba(226,26,34,.65);
          color: #ff7b82;
        }

        .repeat-order-button:disabled {
          cursor: wait;
          opacity: .55;
        }

        .repeat-overlay {
          position: fixed;
          inset: 0;
          z-index: 300;
          display: grid;
          place-items: center;
          overflow-y: auto;
          background: rgba(0,0,0,.78);
          padding: 24px;
          backdrop-filter: blur(8px);
        }

        .repeat-modal {
          width: min(760px, 100%);
          overflow: hidden;
          border: 1px solid #38393d;
          border-radius: 24px;
          background: #121315;
          color: #fff;
          box-shadow: 0 30px 90px rgba(0,0,0,.5);
        }

        .repeat-modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          border-bottom: 1px solid #292a2e;
          padding: 20px 22px;
          background:
            radial-gradient(circle at 88% 0%, rgba(226,26,34,.28), transparent 35%),
            #111214;
        }

        .repeat-modal-head span {
          color: #8e8983;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .13em;
        }

        .repeat-modal-head h2 {
          margin: 4px 0 0;
          font-size: 24px;
          font-weight: 950;
        }

        .repeat-modal-head p {
          margin: 5px 0 0;
          color: #8f8983;
          font-size: 12px;
        }

        .repeat-modal-head button {
          display: grid;
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          place-items: center;
          border: 1px solid #3a3b40;
          border-radius: 12px;
          background: #191a1d;
          color: #fff;
          cursor: pointer;
        }

        .repeat-modal-body {
          padding: 20px 22px;
        }

        .repeat-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap: 8px;
        }

        .repeat-summary-grid > div {
          min-width: 0;
          border: 1px solid #292a2e;
          border-radius: 13px;
          background: #0d0e10;
          padding: 11px;
        }

        .repeat-summary-grid span,
        .repeat-summary-grid strong {
          display: block;
        }

        .repeat-summary-grid span {
          color: #77736f;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .repeat-summary-grid strong {
          overflow: hidden;
          margin-top: 4px;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .repeat-address {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-top: 10px;
          border-radius: 13px;
          background: #0d0e10;
          padding: 11px;
          color: #e21a22;
        }

        .repeat-address span,
        .repeat-address strong {
          display: block;
        }

        .repeat-address span {
          color: #77736f;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .repeat-address strong {
          margin-top: 3px;
          color: #eee9e4;
          font-size: 12px;
        }

        .repeat-products {
          display: grid;
          gap: 1px;
          margin-top: 12px;
          overflow: hidden;
          border: 1px solid #292a2e;
          border-radius: 15px;
          background: #292a2e;
        }

        .repeat-product {
          display: grid;
          grid-template-columns: 34px minmax(0,1fr) auto;
          align-items: start;
          gap: 10px;
          background: #17181b;
          padding: 12px;
        }

        .repeat-product > span {
          display: grid;
          width: 32px;
          height: 32px;
          place-items: center;
          border-radius: 10px;
          background: #e21a22;
          font-size: 10px;
          font-weight: 950;
        }

        .repeat-product strong {
          display: block;
          font-size: 12px;
        }

        .repeat-product p,
        .repeat-product small {
          display: block;
          margin: 4px 0 0;
          color: #8f8983;
          font-size: 10px;
          line-height: 1.4;
        }

        .repeat-product > b {
          font-size: 12px;
        }

        .repeat-totals {
          margin-top: 12px;
          border-radius: 15px;
          background: #08090a;
          padding: 13px 14px;
        }

        .repeat-totals > div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 4px;
          color: #8f8983;
          font-size: 11px;
        }

        .repeat-totals b {
          color: #fff;
        }

        .repeat-totals .repeat-total {
          margin-top: 10px;
          border-top: 1px solid #292a2e;
          padding-top: 10px;
          align-items: center;
        }

        .repeat-total strong {
          color: #fff;
          font-size: 22px;
          font-weight: 950;
        }

        .repeat-warning {
          margin-top: 10px;
          border: 1px solid rgba(245,158,11,.22);
          border-radius: 12px;
          background: rgba(245,158,11,.08);
          padding: 10px 12px;
          color: #e8bb73;
          font-size: 11px;
          line-height: 1.4;
        }

        .repeat-warning-error {
          border-color: rgba(239,68,68,.25);
          background: rgba(239,68,68,.10);
          color: #ff9ca1;
        }

        .repeat-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          border-top: 1px solid #292a2e;
          padding: 14px 18px;
        }

        .repeat-modal-actions button {
          min-height: 42px;
          border: 1px solid #38393d;
          border-radius: 12px;
          background: #18191c;
          padding: 0 16px;
          color: #fff;
          cursor: pointer;
          font-size: 12px;
          font-weight: 900;
        }

        .repeat-modal-actions .confirm-repeat {
          border-color: #e21a22;
          background: #e21a22;
        }

        .repeat-modal-actions button:disabled {
          cursor: wait;
          opacity: .55;
        }

        .pos-overlay {
          position: fixed;
          inset: 0;
          z-index: 280;
          overflow-y: auto;
          background: #f5f3ef;
          color: #171717;
        }

        .pos-overlay-head {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          background:
            radial-gradient(circle at 85% 0%, rgba(226,26,34,.35), transparent 30%),
            #0d0e10;
          padding: 14px 20px;
          color: #fff;
          box-shadow: 0 8px 24px rgba(0,0,0,.18);
        }

        .pos-overlay-head span {
          color: #827d78;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .12em;
        }

        .pos-overlay-head h2 {
          margin: 3px 0 0;
          font-size: 20px;
          font-weight: 950;
        }

        .pos-overlay-head button {
          display: inline-flex;
          min-height: 42px;
          align-items: center;
          gap: 7px;
          border: 1px solid #38393d;
          border-radius: 12px;
          background: #191a1d;
          padding: 0 13px;
          color: #fff;
          cursor: pointer;
          font-size: 11px;
          font-weight: 900;
        }

        .pos-overlay-body {
          min-height: 100%;
        }

        @media (max-width: 900px) {
          .repeat-summary-grid {
            grid-template-columns: repeat(2, minmax(0,1fr));
          }
        }

        @media (max-width: 560px) {
          .repeat-overlay {
            padding: 8px;
          }

          .repeat-summary-grid {
            grid-template-columns: 1fr;
          }

          .repeat-modal-actions {
            flex-direction: column-reverse;
          }

          .repeat-modal-actions button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
