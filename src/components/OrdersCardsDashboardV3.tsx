"use client";

import { Clock3, MapPin, MapPinned, UserRound, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ActionConfirmModal from "@/components/ActionConfirmModal";
import FeedbackModal from "@/components/FeedbackModal";
import OrderStatusSelector from "@/components/OrderStatusSelector";
import AdminDeliveryMapModal from "@/components/AdminDeliveryMapModal";
import DeliveryZoneAnalyticsModal from "@/components/DeliveryZoneAnalyticsModal";
import type { GoogleCustomerAddressSelection } from "@/components/GoogleCustomerAddressPicker";
import CustomerAddressEditor, {
  isValidatedCustomerAddress,
  type CustomerAddressEditorValue,
} from "@/components/CustomerAddressEditor";
import CustomerPersonalEditor from "@/components/CustomerPersonalEditor";
import OrderEditStructuredAdder, {
  type ExistingPizzaEditRequest,
  type ExistingPizzaEditUpdate,
  type StructuredEditAddition,
} from "@/components/OrderEditStructuredAdder";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";
import { orderCode } from "@/lib/orderCode";
import {
  isInKitchenWindow,
  isScheduledForFutureDay,
  scheduledServiceWindow,
  validateScheduledServiceHours,
} from "@/lib/orderScheduling";
import {
  formatServiceRange,
  type ServiceHour,
} from "@/lib/storeServiceHours";
import { fulfillmentLabel, statusLabel, type FulfillmentType, type OrderStatus } from "@/lib/orderWorkflow";
import { emitLiveDataChange } from "@/lib/liveDataEvents";
import { createIdempotencyKey } from "@/lib/clientIdempotency";

type CustomerAddress = {
  id: number;
  address: string;
  formattedAddress?: string | null;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  neighborhood?: string | null;
  city?: string | null;
  notes?: string | null;
  isDefault?: boolean;
};
type CustomerSearchResult = {
  id: number;
  name: string;
  countryCode: string;
  phone: string | null;
  email?: string | null;
  addresses: CustomerAddress[];
};
type OrderItem = { id: number; productId: number; productName: string; quantity: number; unitPrice: number | string; lineTotal: number | string; configuration: unknown; notes?: string | null };
type PaymentRefund = {
  id: number;
  amount: number | string;
  method: string;
  reason: string;
  reference?: string | null;
  refundedAt: string;
  createdByName?: string;
};
type Payment = {
  id: number;
  method: string;
  amount: number | string;
  cashReceived: number | string | null;
  changeDue: number | string | null;
  status: string;
  reference?: string | null;
  paidAt?: string | null;
  createdAt?: string;
  refunds?: PaymentRefund[];
};
type Order = {
  id: number;
  sequenceNumber: number | null;
  source: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  subtotal: number | string;
  deliveryFee: number | string;
  discount: number | string;
  total: number | string;
  couponName: string | null;
  deliveryZoneId?: string | null;
  deliveryZoneName: string | null;
  createdAt: string;
  scheduledFor?: string | null;
  customer: { id: number; name: string; countryCode: string; phone: string | null; addresses?: CustomerAddress[] } | null;
  address: CustomerAddress | null;
  driver: { id: number; name: string } | null;
  driverAssignedAt?: string | null;
  items: OrderItem[];
  payments: Payment[];
};
type Settings = {
  deliveryBands: { id: string; name: string; fee: number; active: boolean }[];
  paymentMethods: { id: string; name: string; active: boolean }[];
  store?: {
    serviceHours?: ServiceHour[];
  };
};
type CatalogProduct = { id: number; name: string; type: string; basePrice: number | null };
type CatalogCategory = {
  id?: number;
  name?: string;
  slug?: string;
  products: CatalogProduct[];
};
type CatalogResponse = { categories: CatalogCategory[] };
type Filter = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELED";
type ConfirmAction =
  | { kind: "cancel-order"; order: Order }
  | { kind: "delete-order"; order: Order }
  | { kind: "delete-payment"; order: Order; payment: Payment }
  | null;

const money = (value: number | string | null | undefined) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(value ?? 0));
const dateTime = (value: string) => new Date(value).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });
const displayOrderCode = (order: Order) => orderCode(order.sequenceNumber ?? order.id, order.source);
const scheduledLabel = (value: string) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
const scheduledDayLabel = (value: string) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));

function toDateTimeLocalValue(value: Date | string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function bogotaLocalInputToIso(value: string) {
  if (!value) return null;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
  );
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const iso = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:00-05:00`,
  );
  return Number.isFinite(iso.getTime()) ? iso.toISOString() : null;
}
const activePayments = (order: Order) => order.payments.filter((payment) => payment.status !== "CANCELED");
const refundedAmount = (payment: Payment) =>
  (payment.refunds ?? []).reduce((sum, refund) => sum + Number(refund.amount), 0);
const refundableAmount = (payment: Payment) =>
  payment.status === "PAID"
    ? Math.max(0, Number(payment.amount) - refundedAmount(payment))
    : 0;
const hasRefundHistory = (order: Order) =>
  order.payments.some((payment) => (payment.refunds ?? []).length > 0);
const paidPayments = (order: Order) => order.payments.filter((payment) => payment.status === "PAID");
const paidAmount = (order: Order) =>
  order.payments.reduce((sum, payment) => sum + refundableAmount(payment), 0);
const balance = (order: Order) => Math.max(0, Number(order.total) - paidAmount(order));
const paidInFull = (order: Order) => balance(order) <= 0 && Number(order.total) > 0;
const paymentHint = (order: Order) => activePayments(order).find((payment) => payment.status === "PENDING" || payment.status === "PARTIAL")?.method ?? paidPayments(order).at(-1)?.method ?? "Pago";
const isPizzaItem = (item: OrderItem) => Boolean(
  item.configuration
  && typeof item.configuration === "object"
  && !Array.isArray(item.configuration)
  && String((item.configuration as { kind?: unknown }).kind).toUpperCase() === "PIZZA"
);

const isTwoFlavorOrderItem = (item: OrderItem) => {
  if (!isPizzaItem(item)) return false;
  if (item.productName.toLocaleLowerCase("es").includes("2 sabores")) {
    return true;
  }

  const configuration = item.configuration as {
    flavors?: unknown[];
  };

  return Array.isArray(configuration.flavors) &&
    configuration.flavors.length >= 2;
};

function addressSelectionFromCustomerAddress(
  address: CustomerAddress | null | undefined,
  deliveryFee: number | null = null,
): GoogleCustomerAddressSelection | null {
  if (
    !address?.placeId ||
    address.latitude == null ||
    address.longitude == null ||
    !Number.isFinite(Number(address.latitude)) ||
    !Number.isFinite(Number(address.longitude))
  ) {
    return null;
  }

  return {
    formattedAddress: address.formattedAddress || address.address,
    placeId: address.placeId,
    latitude: Number(address.latitude),
    longitude: Number(address.longitude),
    neighborhood: address.neighborhood || "",
    city: address.city || "Bogotá",
    covered: true,
    deliveryFee,
    distanceMeters: null,
  };
}

function addressSelectionFromEditorValue(
  value: CustomerAddressEditorValue,
): GoogleCustomerAddressSelection | null {
  if (!isValidatedCustomerAddress(value)) return null;

  return {
    formattedAddress:
      value.formattedAddress || value.address || "",
    placeId: value.placeId!,
    latitude: Number(value.latitude),
    longitude: Number(value.longitude),
    neighborhood: value.neighborhood || "",
    city: value.city || "Bogotá",
    covered: value.covered ?? false,
    deliveryFee: value.deliveryFee ?? null,
    distanceMeters: value.distanceMeters ?? null,
  };
}

function statusTone(status: OrderStatus) {
  if (status === "PREPARING") return "bg-amber-500";
  if (status === "PREPARED") return "bg-violet-600";
  if (status === "READY") return "bg-emerald-600";
  if (status === "OUT_FOR_DELIVERY") return "bg-sky-600";
  if (status === "ARRIVED") return "bg-cyan-600";
  if (status === "DELIVERED") return "bg-teal-600";
  if (status === "CANCELED") return "bg-neutral-500";
  if (status === "COMPLETED") return "bg-neutral-700";
  return "bg-neutral-700";
}

function fulfillmentTone(type: FulfillmentType) {
  if (type === "DELIVERY") return "border-red-200 bg-red-50 text-red-700";
  if (type === "PICKUP") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function Icon({ name }: { name: "search" | "refresh" | "print" | "download" | "info" | "close" | "edit" | "trash" | "cancel" | "minus" | "plus" | "wallet" | "status" }) {
  const c = "h-[17px] w-[17px]";
  if (name === "search") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
  if (name === "refresh") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6.3 6.3L4 11M20 13l-2.3 4.7A7 7 0 0 1 5.5 15"/></svg>;
  if (name === "print") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>;
  if (name === "download") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M12 3v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>;
  if (name === "info") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>;
  if (name === "close") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="m6 6 12 12M18 6 6 18"/></svg>;
  if (name === "edit") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>;
  if (name === "trash") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>;
  if (name === "cancel") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><circle cx="12" cy="12" r="9"/><path d="m8.5 8.5 7 7M15.5 8.5l-7 7"/></svg>;
  if (name === "minus") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M5 12h14"/></svg>;
  if (name === "wallet") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M3 7h16a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2Z"/><path d="M3 7V5a2 2 0 0 1 2-2h13v4M16 12h5"/></svg>;
  if (name === "status") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h7M15 17h5"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="13" cy="17" r="2"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M12 5v14M5 12h14"/></svg>;
}

function ProductRow({ item }: { item: OrderItem }) {
  const details = presentOrderItemConfiguration(item.configuration);
  const normalizedName = item.productName.trim().toLocaleLowerCase("es");
  const flavorDetails = details.filter((detail) => detail.label.toLowerCase().startsWith("sabor"));
  const otherDetails = details.filter((detail) => {
    const label = detail.label.toLowerCase();
    if (label.startsWith("sabor")) return false;
    return true;
  });
  const cleanFlavor = (value: string) => value.replace(/^½\s*/, "").trim();
  const visibleFlavorDetails = flavorDetails.filter((detail) => {
    if (flavorDetails.length > 1) return true;
    return cleanFlavor(detail.value).toLocaleLowerCase("es") !== normalizedName;
  });

  return (
    <div className="order-detail-product rounded-xl border border-neutral-200 bg-[#faf9f7] p-3">
      <div className="flex justify-between gap-3">
        <div className="min-w-0 flex-1">
          <b className="order-detail-product-name text-sm">{item.quantity} × {item.productName}</b>

          {otherDetails.length > 0 && (
            <div className="order-detail-product-chips mt-1 flex flex-wrap gap-1.5">
              {otherDetails.map((detail, index) => {
                const extra = detail.label.toLowerCase() === "extra";
                const standard = detail.label.toLowerCase() === "producto";
                return (
                  <span key={`${detail.label}-${index}`} className={`order-detail-chip ${extra ? "order-detail-chip-extra" : standard ? "order-detail-chip-standard" : ""}`}>
                    <strong>{extra ? "+" : detail.label}</strong>{!extra && " · "}{detail.value}
                  </span>
                );
              })}
            </div>
          )}

          {visibleFlavorDetails.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {visibleFlavorDetails.map((detail, index) => (
                <span key={`${detail.label}-${index}`} className="contents">
                  <span className="inline-flex min-h-7 items-center rounded-lg border border-neutral-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.025em] text-neutral-950 shadow-[0_2px_8px_rgba(28,23,20,.04)]">
                    {cleanFlavor(detail.value)}
                  </span>
                  {index < visibleFlavorDetails.length - 1 && <span className="text-[10px] font-bold text-neutral-300">−</span>}
                </span>
              ))}
            </div>
          )}

          {item.notes && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-semibold text-amber-900">
              <span className="mr-1 alento-ui-label uppercase tracking-[.08em] text-amber-600">Nota cocina</span>{item.notes}
            </div>
          )}
        </div>
        <b className="order-detail-product-price shrink-0 text-sm">{money(item.lineTotal)}</b>
      </div>
    </div>
  );
}

export default function OrdersCardsDashboardV3() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deliveryMapOpen, setDeliveryMapOpen] = useState(false);
  const [deliveryZonesOpen, setDeliveryZonesOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [reference, setReference] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const paymentAttemptKeysRef = useRef<Map<number, string>>(new Map());
  const refundAttemptKeysRef = useRef<Map<number, string>>(new Map());
  const [editing, setEditing] = useState<Order | null>(null);
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("PICKUP");
  const [editScheduleMode, setEditScheduleMode] =
    useState<"ASAP" | "SCHEDULED">("ASAP");
  const [editScheduledForInput, setEditScheduledForInput] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({});
  const [additions, setAdditions] = useState<Record<number, number>>({});
  const [structuredAdditions, setStructuredAdditions] = useState<StructuredEditAddition[]>([]);
  const [existingPizzaEdits, setExistingPizzaEdits] = useState<
    Record<number, ExistingPizzaEditUpdate>
  >({});
  const [existingPizzaEditRequest, setExistingPizzaEditRequest] =
    useState<ExistingPizzaEditRequest | null>(null);
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [feedbackModal, setFeedbackModal] = useState<{
    tone: "warning" | "error" | "success";
    title: string;
    message: string;
    detail?: string;
  } | null>(null);
  const [statusOrder, setStatusOrder] = useState<Order | null>(null);
  const [statusDrivers, setStatusDrivers] = useState<
    Array<{ id: number; name: string; ready: boolean }>
  >([]);
  const [statusSelectedDriverId, setStatusSelectedDriverId] =
    useState<number | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusDriverSaving, setStatusDriverSaving] = useState(false);
  const [customerOrder, setCustomerOrder] = useState<Order | null>(null);
  const [customerPanel, setCustomerPanel] = useState<
    "PERSONAL" | "LOCATION" | "CHANGE"
  >("PERSONAL");
  const [customerName, setCustomerName] = useState("");
  const [customerCountryCode, setCustomerCountryCode] = useState("+57");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddressSelection, setCustomerAddressSelection] =
    useState<GoogleCustomerAddressSelection | null>(null);
  const [customerAddressNotes, setCustomerAddressNotes] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerMatches, setCustomerMatches] = useState<CustomerSearchResult[]>([]);
  const [replacementCustomer, setReplacementCustomer] = useState<CustomerSearchResult | null>(null);
  const [replacementAddressId, setReplacementAddressId] = useState<number | null>(null);
  const [replacementAddressSelection, setReplacementAddressSelection] =
    useState<GoogleCustomerAddressSelection | null>(null);
  const [replacementAddressNotes, setReplacementAddressNotes] = useState("");
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [staffAccess, setStaffAccess] = useState<{ isAdmin: boolean; permissions: string[] }>({ isAdmin: false, permissions: [] });

  const canCancelOrders = staffAccess.isAdmin || staffAccess.permissions.includes("CANCEL_ORDERS");
  const canDeleteOrders = staffAccess.isAdmin || staffAccess.permissions.includes("DELETE_ORDERS");

  async function loadStaffAccess() {
    try {
      const response = await fetch("/api/auth/staff/me", { cache: "no-store" });
      const data = await response.json();
      if (response.ok && data.authenticated) {
        setStaffAccess({
          isAdmin: Boolean(data.user?.isAdmin),
          permissions: Array.isArray(data.user?.permissions) ? data.user.permissions : [],
        });
      }
    } catch {
      setStaffAccess({ isAdmin: false, permissions: [] });
    }
  }

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/orders", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const contentType = response.headers.get("content-type") || "";
      const bodyText = await response.text();

      if (!contentType.includes("application/json")) {
        console.warn("Orders API returned non-JSON response", {
          status: response.status,
          contentType,
          preview: bodyText.slice(0, 180),
        });

        if (response.status === 401 || response.status === 403) {
          throw new Error(
            "Tu sesión ya no es válida. Inicia sesión nuevamente para cargar los pedidos.",
          );
        }

        throw new Error(
          "El servidor devolvió una respuesta temporal inesperada. Recarga la página en unos segundos.",
        );
      }

      let data: { orders?: Order[]; error?: string };
      try {
        data = JSON.parse(bodyText) as {
          orders?: Order[];
          error?: string;
        };
      } catch {
        throw new Error(
          "La respuesta de Pedidos llegó incompleta. Recarga la página.",
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible cargar los pedidos.",
        );
      }

      const next = data.orders ?? [];
      setOrders(next);
      setSelected((current) =>
        current
          ? next.find((order) => order.id === current.id) ?? null
          : null,
      );
      setPaymentOrder((current) =>
        current
          ? next.find((order) => order.id === current.id) ?? null
          : null,
      );
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar los pedidos.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void loadStaffAccess();
    const timer = window.setInterval(() => {
      void load(true);
      void loadStaffAccess();
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadSettings() {
    if (settings) return settings;
    const response = await fetch("/api/settings", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No fue posible cargar la configuración.");
    setSettings(data.settings);
    return data.settings as Settings;
  }

  const visible = useMemo(() => orders.filter((order) => {
    if (filter === "ACTIVE" && ["COMPLETED", "CANCELED"].includes(order.status)) return false;
    if (filter === "COMPLETED" && order.status !== "COMPLETED") return false;
    if (filter === "CANCELED" && order.status !== "CANCELED") return false;
    const value = query.trim().toLowerCase();
    if (!value) return true;
    return [
      displayOrderCode(order),
      order.customer?.name,
      order.customer?.phone,
      order.driver?.name,
      statusLabel(order.status),
      fulfillmentLabel(order.fulfillmentType),
      paymentHint(order),
      order.scheduledFor ? "programado" : null,
      order.scheduledFor ? scheduledLabel(order.scheduledFor) : null,
    ]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(value));
  }), [orders, filter, query]);

  const snackProducts = useMemo(() => {
    const unique = new Map<number, CatalogProduct>();

    (catalog?.categories ?? []).forEach((category) => {
      const categoryKey = `${category.slug ?? ""} ${category.name ?? ""}`
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("es");

      const isSnackCategory =
        categoryKey.includes("antojo") ||
        categoryKey.includes("acompan") ||
        categoryKey.includes("snack");

      if (!isSnackCategory) return;

      category.products.forEach((product) => {
        if (
          product.basePrice != null &&
          ![
            "PIZZA_SINGLE",
            "PIZZA_TWO_FLAVORS",
            "PIZZA_CUSTOM",
            "COMBO",
            "INTERNAL",
          ].includes(product.type)
        ) {
          unique.set(product.id, product);
        }
      });
    });

    return [...unique.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "es"),
    );
  }, [catalog]);

  const simpleProducts = useMemo(() => {
    const all =
      catalog?.categories.flatMap((category) => category.products) ?? [];
    const unique = new Map<number, CatalogProduct>();
    const snackIds = new Set(snackProducts.map((product) => product.id));

    all.forEach((product) => {
      const regularSimple =
        ![
          "PIZZA_SINGLE",
          "PIZZA_TWO_FLAVORS",
          "PIZZA_CUSTOM",
          "COMBO",
          "MODIFIER",
          "INTERNAL",
        ].includes(product.type) && product.basePrice != null;

      if (regularSimple || snackIds.has(product.id)) {
        unique.set(product.id, product);
      }
    });

    snackProducts.forEach((product) => unique.set(product.id, product));

    return [...unique.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "es"),
    );
  }, [catalog, snackProducts]);

  const quickProducts = useMemo(() => {
    const snackIds = new Set(snackProducts.map((product) => product.id));
    return simpleProducts.filter((product) => !snackIds.has(product.id));
  }, [simpleProducts, snackProducts]);

  const editPreview = useMemo(() => {
    if (!editing) {
      return { itemCount: 0, addedCount: 0, productsSubtotal: 0 };
    }

    const current = editing.items.reduce(
      (summary, item) => {
        const quantity = Math.max(
          0,
          quantities[item.id] ?? item.quantity,
        );
        summary.itemCount += quantity;
        const editedUnitPrice =
          existingPizzaEdits[item.id]?.estimatedUnitPrice ??
          Number(item.unitPrice);
        summary.productsSubtotal += editedUnitPrice * quantity;
        return summary;
      },
      { itemCount: 0, productsSubtotal: 0 },
    );

    const simpleAdded = simpleProducts.reduce(
      (summary, product) => {
        const quantity = Math.max(0, additions[product.id] ?? 0);
        summary.addedCount += quantity;
        summary.productsSubtotal += Number(product.basePrice ?? 0) * quantity;
        return summary;
      },
      { addedCount: 0, productsSubtotal: 0 },
    );

    const structuredAdded = structuredAdditions.reduce(
      (summary, item) => {
        summary.addedCount += item.quantity;
        summary.productsSubtotal += item.estimatedUnitPrice * item.quantity;
        return summary;
      },
      { addedCount: 0, productsSubtotal: 0 },
    );

    return {
      itemCount: current.itemCount,
      addedCount: simpleAdded.addedCount + structuredAdded.addedCount,
      productsSubtotal:
        current.productsSubtotal +
        simpleAdded.productsSubtotal +
        structuredAdded.productsSubtotal,
    };
  }, [
    additions,
    editing,
    existingPizzaEdits,
    quantities,
    simpleProducts,
    structuredAdditions,
  ]);

  async function unassignDriver(order: Order) {
    if (!order.driver || busy === order.id) return;

    const accepted = window.confirm(
      `¿Desasignar a ${order.driver.name} de ${displayOrderCode(order)}?`,
    );
    if (!accepted) return;

    setBusy(order.id);

    try {
      const response = await fetch(
        `/api/orders/${order.id}/driver`,
        { method: "DELETE" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible desasignar el repartidor.",
        );
      }

      await load(true);
      emitLiveDataChange(["orders"]);
    } catch (actionError) {
      window.alert(
        actionError instanceof Error
          ? actionError.message
          : "No fue posible desasignar el repartidor.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function openStatusManager(order: Order) {
    if (order.scheduledFor && !isInKitchenWindow(order.scheduledFor)) {
      setFeedbackModal({
        tone: "warning",
        title: "Pedido programado",
        message: `La operación de este pedido se habilita 30 minutos antes de ${scheduledLabel(order.scheduledFor)}.`,
        detail:
          "El pedido seguirá visible. Puedes editarlo, reprogramarlo o cancelarlo, pero no adelantar estados o reparto antes de su ventana operativa.",
      });
      return;
    }

    setStatusOrder(order);
    setStatusSelectedDriverId(order.driver?.id ?? null);

    try {
      const response = await fetch("/api/drivers", {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        setStatusDrivers(data.drivers ?? []);
      }
    } catch {
      setStatusDrivers([]);
    }
  }

  async function selectManagedStatus(status: OrderStatus) {
    if (!statusOrder || statusSaving || status === statusOrder.status) return;

    setStatusSaving(true);
    try {
      const response = await fetch(
        `/api/orders/${statusOrder.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible actualizar el estado.",
        );
      }

      setStatusOrder(null);
      await load(true);
      emitLiveDataChange([
        "orders",
        "customers",
        "club",
        "account",
      ]);
    } catch (actionError) {
      setFeedbackModal({
        tone: "error",
        title: "No fue posible actualizar el estado",
        message:
          actionError instanceof Error
            ? actionError.message
            : "No fue posible actualizar el estado del pedido.",
      });
    } finally {
      setStatusSaving(false);
    }
  }

  async function assignManagedDriver() {
    if (
      !statusOrder ||
      !statusSelectedDriverId ||
      statusDriverSaving
    ) {
      return;
    }

    const driverId = statusSelectedDriverId;
    const driver = statusDrivers.find((item) => item.id === driverId);
    setStatusDriverSaving(true);

    try {
      const response = await fetch(
        `/api/orders/${statusOrder.id}/driver`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driverId }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible asignar el repartidor.",
        );
      }

      setStatusOrder((current) =>
        current
          ? {
              ...current,
              status: data.order?.status ?? current.status,
              driver: {
                id: driverId,
                name: driver?.name || "Repartidor",
              },
            }
          : current,
      );

      await load(true);
      emitLiveDataChange(["orders"]);

      setFeedbackModal(
        data.notification?.ok === false
          ? {
              tone: "warning",
              title: driver
                ? `${driver.name} quedó asignado`
                : "Repartidor asignado",
              message:
                "La asignación se guardó, pero la notificación no pudo enviarse.",
              detail: data.notification.reason,
            }
          : {
              tone: "success",
              title: driver
                ? `${driver.name} quedó asignado`
                : "Repartidor asignado",
              message:
                "La asignación se guardó correctamente.",
            },
      );
    } catch (actionError) {
      setFeedbackModal({
        tone: "error",
        title: "No fue posible asignar el repartidor",
        message:
          actionError instanceof Error
            ? actionError.message
            : "No fue posible asignar el repartidor.",
      });
    } finally {
      setStatusDriverSaving(false);
    }
  }

  async function unassignManagedDriver() {
    if (
      !statusOrder?.driver ||
      statusDriverSaving
    ) {
      return;
    }

    const accepted = window.confirm(
      `¿Desasignar a ${statusOrder.driver.name} de ${displayOrderCode(statusOrder)}?`,
    );
    if (!accepted) return;

    setStatusDriverSaving(true);
    try {
      const response = await fetch(
        `/api/orders/${statusOrder.id}/driver`,
        { method: "DELETE" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible desasignar el repartidor.",
        );
      }

      setStatusOrder((current) =>
        current
          ? {
              ...current,
              status: data.order?.status ?? current.status,
              driver: null,
            }
          : current,
      );
      setStatusSelectedDriverId(null);
      await load(true);
      emitLiveDataChange(["orders"]);
    } catch (actionError) {
      setFeedbackModal({
        tone: "error",
        title: "No fue posible desasignar",
        message:
          actionError instanceof Error
            ? actionError.message
            : "No fue posible desasignar el repartidor.",
      });
    } finally {
      setStatusDriverSaving(false);
    }
  }

  function print(order: Order) {
    const frame = document.createElement("iframe");
    Object.assign(frame.style, { position: "fixed", width: "1px", height: "1px", opacity: "0", pointerEvents: "none" });
    frame.src = `/pedidos/${order.id}/imprimir?autoprint=1&embedded=1`;
    document.body.appendChild(frame);
    window.setTimeout(() => frame.remove(), 30000);
  }

  function downloadReceiptImage(order: Order) {
    const anchor = document.createElement("a");
    anchor.href = `/api/orders/${order.id}/receipt-image`;
    anchor.download = `${displayOrderCode(order)}-factura.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function cancelOrder(order: Order) {
    setBusy(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cancelar el pedido.");
      await load(true);
      emitLiveDataChange(["orders", "customers", "club", "account"]);
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "No fue posible cancelar el pedido.";

      setFeedbackModal({
        tone: "warning",
        title: "No se puede cancelar el pedido",
        message:
          "Este pedido ya recibió dinero y debe conservar su trazabilidad financiera.",
        detail: message,
      });
    } finally {
      setBusy(null);
    }
  }

  async function deleteOrder(order: Order) {
    setBusy(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible eliminar el pedido.");
      if (selected?.id === order.id) setSelected(null);
      await load(true);
      emitLiveDataChange(["orders", "customers", "club", "account"]);
    } catch (actionError) {
      window.alert(actionError instanceof Error ? actionError.message : "No fue posible eliminar el pedido.");
    } finally {
      setBusy(null);
    }
  }

  async function voidPayment(order: Order, payment: Payment) {
    setBusy(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}/payment/${payment.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible eliminar el pago.");
      await load(true);
      emitLiveDataChange(["orders", "customers", "club", "account"]);
    } catch (actionError) {
      window.alert(actionError instanceof Error ? actionError.message : "No fue posible eliminar el pago.");
    } finally {
      setBusy(null);
    }
  }

  async function refundPayment(order: Order, payment: Payment) {
    const available = Math.round(refundableAmount(payment));
    if (available <= 0) {
      setFeedbackModal({
        tone: "warning",
        title: "Pago sin saldo para devolver",
        message: "Este pago ya fue devuelto completamente.",
      });
      return;
    }

    const amountText = window.prompt(
      `Valor a devolver (máximo ${money(available)})`,
      String(available),
    );
    if (amountText == null) return;

    const amount = Math.round(Number(amountText.replace(/[^0-9.-]/g, "")));
    if (!Number.isFinite(amount) || amount <= 0 || amount > available) {
      setFeedbackModal({
        tone: "warning",
        title: "Valor de devolución inválido",
        message: `Ingresa un valor entre $1 y ${money(available)}.`,
      });
      return;
    }

    const reason = window.prompt(
      "Motivo de la devolución",
      "Devolución al cliente",
    )?.trim();
    if (!reason) return;

    setBusy(order.id);
    try {
      const idempotencyKey =
        refundAttemptKeysRef.current.get(payment.id) ??
        createIdempotencyKey();
      refundAttemptKeysRef.current.set(payment.id, idempotencyKey);

      const response = await fetch(
        `/api/orders/${order.id}/payment/${payment.id}/refund`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            amount,
            reason,
            method: payment.method,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible registrar la devolución.");
      }

      refundAttemptKeysRef.current.delete(payment.id);
      await load(true);
      emitLiveDataChange(["orders", "customers", "club", "account"]);
      setFeedbackModal({
        tone: "success",
        title: "Devolución registrada",
        message: `Se registró una devolución de ${money(amount)}.`,
        detail:
          "El pago original se conserva y la salida queda reflejada en Caja y Auditoría.",
      });
    } catch (actionError) {
      setFeedbackModal({
        tone: "error",
        title: "No fue posible registrar la devolución",
        message:
          actionError instanceof Error
            ? actionError.message
            : "No fue posible registrar la devolución.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function executeConfirmedAction() {
    if (!confirmAction) return;
    const action = confirmAction;
    try {
      if (action.kind === "cancel-order") await cancelOrder(action.order);
      if (action.kind === "delete-order") await deleteOrder(action.order);
      if (action.kind === "delete-payment") await voidPayment(action.order, action.payment);
    } finally {
      setConfirmAction(null);
    }
  }

  async function openPayment(order: Order) {
    if (isScheduledForFutureDay(order.scheduledFor)) {
      setFeedbackModal({
        tone: "warning",
        title: "Cobro programado",
        message: order.scheduledFor
          ? `Este pedido se cobra el ${scheduledDayLabel(order.scheduledFor)}.`
          : "El cobro todavía no está disponible.",
        detail:
          "Puedes consultar, editar, reprogramar o cancelar el pedido mientras tanto. El cobro se habilita en la fecha programada.",
      });
      return;
    }

    try {
      const cfg = await loadSettings();
      const hint = paymentHint(order);
      const method = cfg.paymentMethods.find((item) => item.name === hint) ?? cfg.paymentMethods.find((item) => item.active);
      const currentBalance = Math.round(balance(order));
      if (!paymentAttemptKeysRef.current.has(order.id)) {
        paymentAttemptKeysRef.current.set(order.id, createIdempotencyKey());
      }
      setPaymentOrder(order);
      setPaymentMethodId(method?.id ?? "");
      setPaymentAmount(currentBalance > 0 ? String(currentBalance) : "");
      setCashReceived("");
      setReference("");
      setPaymentError("");
    } catch (openError) {
      window.alert(openError instanceof Error ? openError.message : "No fue posible abrir el pago.");
    }
  }

  async function registerPayment() {
    if (!paymentOrder) return;
    const amount = Number(paymentAmount);
    const outstanding = balance(paymentOrder);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Ingresa un monto válido para este pago.");
      return;
    }
    if (amount > outstanding) {
      setPaymentError(`El pago no puede superar el saldo de ${money(outstanding)}.`);
      return;
    }

    setBusy(paymentOrder.id);
    setPaymentError("");
    try {
      const idempotencyKey =
        paymentAttemptKeysRef.current.get(paymentOrder.id) ??
        createIdempotencyKey();
      paymentAttemptKeysRef.current.set(paymentOrder.id, idempotencyKey);

      const response = await fetch(`/api/orders/${paymentOrder.id}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          paymentMethodId,
          amount,
          cashReceived: cashReceived ? Number(cashReceived) : null,
          reference,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible registrar el pago.");
      paymentAttemptKeysRef.current.delete(paymentOrder.id);
      setPaymentOrder(null);
      setPaymentAmount("");
      setCashReceived("");
      setReference("");
      await load(true);
      emitLiveDataChange(["orders", "customers", "club", "account"]);
    } catch (saveError) {
      setPaymentError(saveError instanceof Error ? saveError.message : "No fue posible registrar el pago.");
    } finally {
      setBusy(null);
    }
  }

  async function openEdit(order: Order) {
    try {
      const [orderResponse, settingsResponse, catalogResponse] = await Promise.all([
        fetch(`/api/orders/${order.id}`, { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/catalog", { cache: "no-store" }),
      ]);
      const orderData = await orderResponse.json();
      const settingsData = await settingsResponse.json();
      const catalogData = await catalogResponse.json();
      if (!orderResponse.ok) throw new Error(orderData.error || "No fue posible cargar el pedido.");
      const full = orderData.order as Order;
      setSettings(settingsData.settings);
      setCatalog(catalogData);
      setEditing(full);
      setFulfillment(full.fulfillmentType);
      setEditScheduleMode(full.scheduledFor ? "SCHEDULED" : "ASAP");
      setEditScheduledForInput(
        full.scheduledFor ? toDateTimeLocalValue(full.scheduledFor) : "",
      );
      setQuantities(Object.fromEntries(full.items.map((item) => [item.id, item.quantity])));
      setItemNotes(Object.fromEntries(full.items.map((item) => [item.id, item.notes ?? ""])));
      setAdditions({});
      setStructuredAdditions([]);
      setExistingPizzaEdits({});
      setExistingPizzaEditRequest(null);
      setEditError("");
    } catch (openError) {
      window.alert(openError instanceof Error ? openError.message : "No fue posible abrir la edición.");
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setEditError("");

    const scheduledFor =
      editScheduleMode === "SCHEDULED"
        ? bogotaLocalInputToIso(editScheduledForInput)
        : null;

    if (editScheduleMode === "SCHEDULED") {
      if (!scheduledFor) {
        setEditError("Selecciona una fecha y hora válida.");
        setSaving(false);
        return;
      }
      if (new Date(scheduledFor).getTime() <= Date.now()) {
        setEditError("La hora programada debe estar en el futuro.");
        setSaving(false);
        return;
      }

      try {
        validateScheduledServiceHours(
          new Date(scheduledFor),
          settings?.store?.serviceHours,
        );
      } catch (scheduleError) {
        setEditError(
          scheduleError instanceof Error
            ? scheduleError.message
            : "La hora seleccionada está fuera del horario de servicio.",
        );
        setSaving(false);
        return;
      }
    }

    try {
      const response = await fetch(`/api/orders/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillmentType: fulfillment,
          scheduledFor,
          addressId: fulfillment === "DELIVERY" ? editing.address?.id ?? editing.customer?.addresses?.[0]?.id ?? null : null,
          items: editing.items.map((item) => {
            const structuredEdit = existingPizzaEdits[item.id];
            return {
              id: item.id,
              quantity: quantities[item.id] ?? item.quantity,
              notes: isPizzaItem(item)
                ? (itemNotes[item.id] ?? "").trim().slice(0, 120)
                : item.notes ?? null,
              ...(structuredEdit
                ? { configuration: structuredEdit.configuration }
                : {}),
            };
          }),
          additions: [
            ...Object.entries(additions).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId: Number(productId), quantity })),
            ...structuredAdditions.map((item) => ({ productId: item.productId, quantity: item.quantity, configuration: item.configuration, notes: item.notes ?? null })),
          ],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible guardar los cambios.");
      setEditing(null);
      setStructuredAdditions([]);
      setExistingPizzaEdits({});
      setExistingPizzaEditRequest(null);
      await load(true);
      emitLiveDataChange(["orders", "customers", "club", "account"]);
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : "No fue posible guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }


  function openCustomerManager(order: Order) {
    setCustomerOrder(order);
    setCustomerPanel(order.customer ? "PERSONAL" : "CHANGE");
    setCustomerName(order.customer?.name ?? "");
    setCustomerCountryCode(order.customer?.countryCode || "+57");
    setCustomerPhone(order.customer?.phone ?? "");
    setCustomerAddressSelection(
      order.fulfillmentType === "DELIVERY"
        ? addressSelectionFromCustomerAddress(
            order.address,
            Number(order.deliveryFee),
          )
        : null,
    );
    setCustomerAddressNotes(order.address?.notes ?? "");
    setCustomerQuery("");
    setCustomerMatches([]);
    setReplacementCustomer(null);
    setReplacementAddressId(null);
    setReplacementAddressSelection(null);
    setReplacementAddressNotes("");
    setCustomerError("");
  }

  function chooseReplacementCustomer(customer: CustomerSearchResult) {
    const address = customer.addresses?.[0] ?? null;
    const selection = addressSelectionFromCustomerAddress(address);

    setReplacementCustomer(customer);
    setReplacementAddressId(selection ? address?.id ?? null : null);
    setReplacementAddressSelection(selection);
    setReplacementAddressNotes(address?.notes ?? "");
    setCustomerError("");
  }

  async function searchReplacementCustomers(value: string) {
    setCustomerQuery(value);
    setReplacementCustomer(null);
    setReplacementAddressId(null);
    setReplacementAddressSelection(null);
    setReplacementAddressNotes("");

    const term = value.trim();
    if (term.length < 2) {
      setCustomerMatches([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/customers?q=${encodeURIComponent(term)}`,
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible buscar clientes.");
      }

      setCustomerMatches(
        (data.customers ?? []) as CustomerSearchResult[],
      );
    } catch (searchError) {
      setCustomerError(
        searchError instanceof Error
          ? searchError.message
          : "No fue posible buscar clientes.",
      );
    }
  }

  async function saveCurrentCustomer() {
    if (!customerOrder?.customer) return;
    if (!customerName.trim() || !customerPhone.replace(/\D/g, "")) {
      setCustomerPanel("PERSONAL");
      setCustomerError("Nombre y teléfono son obligatorios.");
      return;
    }
    setCustomerSaving(true);
    setCustomerError("");
    try {
      const response = await fetch(`/api/customers/${customerOrder.customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customerName.trim(),
          countryCode: customerCountryCode,
          phone: customerPhone,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible actualizar el cliente.");
      }

      if (customerOrder.fulfillmentType === "DELIVERY") {
        if (!customerAddressSelection) {
          setCustomerPanel("LOCATION");
          throw new Error(
            "Selecciona y valida la dirección del domicilio con Google Maps.",
          );
        }

        const addressResponse = await fetch(
          `/api/orders/${customerOrder.id}/delivery-address`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...customerAddressSelection,
              notes: customerAddressNotes,
            }),
          },
        );
        const addressData = await addressResponse.json();

        if (!addressResponse.ok) {
          throw new Error(
            addressData.error ||
              "No fue posible actualizar la dirección del domicilio.",
          );
        }
      }

      await load(true);
      emitLiveDataChange(["orders", "customers", "club", "account"]);
      setCustomerOrder(null);
    } catch (saveError) {
      setCustomerError(saveError instanceof Error ? saveError.message : "No fue posible actualizar el cliente.");
    } finally {
      setCustomerSaving(false);
    }
  }

  async function changeOrderCustomer() {
    if (!customerOrder || !replacementCustomer) {
      setCustomerPanel("CHANGE");
      setCustomerError(
        "Selecciona el cliente que deseas asignar al pedido.",
      );
      return;
    }

    setCustomerSaving(true);
    setCustomerError("");

    try {
      let addressId = replacementAddressId;

      if (customerOrder.fulfillmentType === "DELIVERY") {
        if (replacementAddressSelection) {
          const addressResponse = await fetch(
            `/api/customers/${replacementCustomer.id}/addresses`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...replacementAddressSelection,
                label: "Casa",
                notes: replacementAddressNotes,
                isDefault: true,
              }),
            },
          );
          const addressData = await addressResponse.json();

          if (!addressResponse.ok) {
            throw new Error(
              addressData.error ||
                "No fue posible guardar la dirección del nuevo cliente.",
            );
          }

          const savedAddress = addressData.customer?.addresses?.[0];
          if (!savedAddress?.id) {
            throw new Error(
              "La dirección se guardó, pero no fue posible usarla en el pedido.",
            );
          }

          addressId = Number(savedAddress.id);
          setReplacementAddressId(addressId);
          setReplacementCustomer((current) =>
            current
              ? {
                  ...current,
                  addresses: addressData.customer.addresses ?? [],
                }
              : current,
          );
        }

        if (!addressId) {
          setCustomerPanel("CHANGE");
          throw new Error(
            "Este cliente necesita una dirección validada con Google Maps para el domicilio.",
          );
        }
      }

      const response = await fetch(
        `/api/orders/${customerOrder.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "change-customer",
            customerId: replacementCustomer.id,
            addressId:
              customerOrder.fulfillmentType === "DELIVERY"
                ? addressId
                : null,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible cambiar el cliente del pedido.",
        );
      }

      await load(true);
      emitLiveDataChange([
        "orders",
        "customers",
        "club",
        "account",
      ]);
      setCustomerOrder(null);
    } catch (saveError) {
      setCustomerError(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible cambiar el cliente del pedido.",
      );
    } finally {
      setCustomerSaving(false);
    }
  }

  async function resendNewOrderTemplate(order: Order) {
    if (!order.customer?.phone) {
      setFeedbackModal({
        tone: "warning",
        title: "Cliente sin teléfono",
        message:
          "Corrige el teléfono del cliente antes de reenviar la plantilla.",
      });
      return;
    }

    setBusy(order.id);

    try {
      const response = await fetch(
        `/api/orders/${order.id}/resend-new-order-template`,
        { method: "POST" },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            "No fue posible reenviar la plantilla nuevo_pedido_v2.",
        );
      }

      setFeedbackModal({
        tone: "success",
        title: "Plantilla reenviada",
        message: `nuevo_pedido_v2 fue enviada a ${data.phone || "el teléfono actual del cliente"}.`,
        detail: `${displayOrderCode(order)} · El reenvío usó el número guardado actualmente en Alentó.`,
      });
    } catch (sendError) {
      setFeedbackModal({
        tone: "error",
        title: "No fue posible reenviar",
        message:
          sendError instanceof Error
            ? sendError.message
            : "No fue posible reenviar la plantilla nuevo_pedido_v2.",
        detail:
          "El reenvío usa el mismo flujo automático de un pedido nuevo y no crea contactos ni conversaciones.",
      });
    } finally {
      setBusy(null);
    }
  }

  const activeCount = orders.filter((order) => !["COMPLETED", "CANCELED"].includes(order.status)).length;

  return <main className="w-full p-3 md:p-5 xl:p-6">
    <div className="w-full space-y-5">
      <section className="relative min-h-[116px] w-full overflow-hidden rounded-[24px] border border-black/5 bg-[#0a0a0b] text-white shadow-[0_14px_36px_rgba(20,16,14,.11)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_42%,rgba(226,26,34,.55),transparent_25%),radial-gradient(circle_at_68%_100%,rgba(132,12,16,.36),transparent_34%),linear-gradient(105deg,#111319_0%,#101116_43%,#1a0b0d_67%,#5a090c_100%)]" />
        <div className="absolute inset-y-0 right-0 w-[46%] opacity-70 [background:linear-gradient(115deg,transparent_0%,rgba(255,255,255,.025)_28%,transparent_29%),repeating-linear-gradient(90deg,transparent_0_54px,rgba(255,255,255,.025)_55px_56px)]" />
        <div className="absolute right-[24%] top-[-18px] h-20 w-20 rounded-full bg-red-500/10 blur-2xl" />
        <div className="absolute right-[9%] top-[22px] h-[2px] w-[30%] bg-gradient-to-r from-transparent via-red-300/40 to-transparent" />

        <div className="relative flex min-h-[116px] flex-col justify-between gap-4 px-5 py-4 md:flex-row md:items-center md:px-6 xl:px-7">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="h-[2px] w-7 rounded-full bg-[var(--brand-red)]" />
              <p className="alento-ui-label uppercase tracking-[0.2em] text-white/55">
                Operación
              </p>
            </div>
            <h1 className="alento-ui-hero-title mt-1.5">
              Pedidos
            </h1>
            <p className="alento-ui-hero-subtitle mt-1.5 text-white/60">
              Todo el flujo de tus órdenes, en un solo lugar.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 self-end md:self-auto">
            <button
              type="button"
              onClick={() => setDeliveryMapOpen(true)}
              aria-label="Mapa de entregas"
              title="Mapa de entregas"
              className="group inline-flex h-[56px] w-[76px] shrink-0 items-center justify-center rounded-[16px] border border-red-400/45 bg-[linear-gradient(135deg,rgba(236,25,31,.96),rgba(119,12,16,.82))] text-white shadow-[0_10px_22px_rgba(168,11,16,.25),inset_0_1px_0_rgba(255,255,255,.13)] transition hover:-translate-y-0.5 hover:border-red-300/70 hover:brightness-110 active:translate-y-0"
            >
              <MapPin className="h-[22px] w-[22px]" strokeWidth={2.25} />
            </button>

            <button
              type="button"
              onClick={() => setDeliveryZonesOpen(true)}
              aria-label="Zonas de entrega"
              title="Zonas de entrega"
              className="group inline-flex h-[56px] w-[76px] shrink-0 items-center justify-center rounded-[16px] border border-white/14 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.12] active:translate-y-0"
            >
              <MapPinned className="h-[22px] w-[22px]" strokeWidth={2.15} />
            </button>

            <div className="flex h-[56px] w-[76px] shrink-0 flex-col items-center justify-center rounded-[16px] border border-white/14 bg-white/[0.08] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-sm">
              <span className="alento-ui-micro uppercase tracking-[0.14em] text-white/50">
                Activos
              </span>
              <b className="alento-ui-metric mt-0.5 tabular-nums text-white">
                {activeCount}
              </b>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full rounded-[20px] border border-neutral-200 bg-white p-2.5 shadow-[0_8px_24px_rgba(28,23,20,.045)]">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
              <Icon name="search" />
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar pedido, cliente, teléfono, pago o estado..."
              className="h-12 w-full rounded-[14px] border border-neutral-200 bg-[#faf9f7] pl-12 pr-4 text-sm font-medium outline-none transition focus:border-neutral-400 focus:bg-white"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto rounded-[14px] border border-neutral-200 bg-[#faf9f7] p-1">
            {([["ACTIVE", "Activos"], ["COMPLETED", "Finalizados"], ["CANCELED", "Cancelados"], ["ALL", "Todos"]] as [Filter, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`h-10 whitespace-nowrap rounded-[11px] px-4 text-[11px] font-black transition ${
                  filter === value
                    ? "bg-neutral-950 text-white shadow-sm"
                    : "text-neutral-600 hover:bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? <div className="rounded-2xl border bg-white p-8 text-center text-sm text-neutral-500">Cargando pedidos...</div> : error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : visible.length === 0 ? <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-neutral-400">No hay pedidos para mostrar.</div> :
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visible.map((order) => {
          const fullyPaid = paidInFull(order);
          const busyOrder = busy === order.id;
          const receivedTotal = paidAmount(order);
          const pendingTotal = balance(order);
          const futureScheduled = isScheduledForFutureDay(order.scheduledFor);
          const operationLocked = Boolean(
            order.scheduledFor && !isInKitchenWindow(order.scheduledFor),
          );
          return <article key={order.id} onClick={() => setSelected(order)} className={`group cursor-pointer overflow-hidden rounded-[22px] border bg-white shadow-[0_12px_32px_rgba(28,23,20,.055)] transition hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(28,23,20,.10)] ${order.scheduledFor ? "border-violet-300 ring-1 ring-violet-100 hover:border-violet-400" : "border-neutral-200 hover:border-neutral-300"} ${order.status === "CANCELED" ? "order-card-canceled" : ""}`}>
            <div className={`${operationLocked ? "bg-violet-600" : statusTone(order.status)} flex items-center justify-between gap-2 px-3.5 py-2 text-white`}>
              <span className="alento-ui-label shrink-0 uppercase tracking-[0.08em]">
                {operationLocked ? "Programado" : statusLabel(order.status)}
              </span>

              <div className="flex min-w-0 items-center justify-end gap-1.5">
                {order.fulfillmentType === "DELIVERY" && order.driver && (
                  <span
                    className="alento-ui-label inline-flex min-w-0 max-w-[190px] items-center rounded-full border border-neutral-950 bg-transparent px-2.5 py-1 uppercase leading-none text-neutral-950 shadow-none"
                    title={`Repartidor: ${order.driver.name}`}
                  >
                    🏍️&nbsp;{order.driver.name}
                  </span>
                )}

                <span
                  className={`alento-ui-label shrink-0 rounded-full border px-2.5 py-1 uppercase shadow-sm ${fulfillmentTone(order.fulfillmentType)}`}
                >
                  {fulfillmentLabel(order.fulfillmentType)}
                </span>
              </div>
            </div>
            <div className="px-3.5 pb-3.5 pt-3">
              <div className="[font-synthesis:none]">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <p className="shrink-0 text-[10px] font-medium leading-4 text-neutral-400">
                    {dateTime(order.createdAt)}
                  </p>
                  {order.scheduledFor && (
                    <div
                      className="inline-flex min-w-0 items-center justify-end gap-1 text-[9px] font-bold leading-4 text-violet-500"
                      title={`Programado para ${scheduledLabel(order.scheduledFor)}`}
                    >
                      <Clock3 className="h-3 w-3 shrink-0" strokeWidth={2} />
                      <span className="truncate">
                        Programado · {scheduledLabel(order.scheduledFor)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-0.5 flex items-end justify-between gap-3">
                  <h2 className="min-w-0 text-[21px] font-bold leading-6 tracking-[-0.035em] text-neutral-950">{displayOrderCode(order)}</h2>
                  <b className="shrink-0 pb-[1px] text-[16px] font-semibold leading-5 tabular-nums tracking-[-0.015em] text-[var(--brand-red)]">{money(order.total)}</b>
                </div>
              </div>
              <div className="order-customer-card mt-2.5 flex items-center gap-3 rounded-[14px] border border-neutral-200 bg-[#f8f7f5] px-3 py-2.5">
                <div className="order-customer-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-sm font-bold shadow-sm">
                  {(order.customer?.name || "C").trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="order-customer-name truncate">
                    {order.customer?.name || "Cliente ocasional"}
                  </p>
                  <p className="order-customer-line mt-0.5 truncate">
                    {order.customer?.phone
                      ? `${order.customer.countryCode} ${order.customer.phone}`
                      : "Sin teléfono"}
                  </p>
                </div>
              </div>
              <div className="mt-2 [font-synthesis:none]" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => { if (!fullyPaid && !futureScheduled) void openPayment(order); }}
                  disabled={fullyPaid || futureScheduled}
                  title={
                    futureScheduled && order.scheduledFor
                      ? `Cobro habilitado el ${scheduledDayLabel(order.scheduledFor)}`
                      : undefined
                  }
                  className={`order-payment-status ${fullyPaid ? "order-payment-status--paid" : "order-payment-status--pending"} block w-full rounded-[11px] border px-3 py-2 text-left transition disabled:cursor-default disabled:opacity-100`}
                >
                  <span className={`block text-[8.5px] font-semibold uppercase tracking-[0.07em] ${fullyPaid ? "text-emerald-700" : futureScheduled ? "text-violet-700" : "text-rose-700"}`}>
                    {fullyPaid
                      ? "Pagado"
                      : futureScheduled
                        ? `Cobro · ${order.scheduledFor ? scheduledDayLabel(order.scheduledFor) : "programado"}`
                        : "Pago pendiente"}
                  </span>
                  <b className={`mt-0.5 block text-[15px] font-bold leading-none tabular-nums tracking-[-0.015em] ${fullyPaid ? "text-emerald-900" : "text-rose-900"}`}>
                    {money(fullyPaid ? receivedTotal : pendingTotal)}
                  </b>
                </button>
              </div>
              <div className="mt-2.5 flex items-center gap-1.5 border-t border-neutral-100 pt-2" onClick={(event) => event.stopPropagation()}>
                <button onClick={() => setSelected(order)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600" title="Detalle"><Icon name="info" /></button>
                <button onClick={() => void openEdit(order)} disabled={["COMPLETED", "CANCELED", "DELIVERED"].includes(order.status)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 disabled:opacity-30" title="Editar"><Icon name="edit" /></button>
                <button onClick={() => print(order)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600" title="Imprimir"><Icon name="print" /></button>
                <button
                  onClick={() => downloadReceiptImage(order)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600"
                  title="Descargar factura en imagen"
                  aria-label="Descargar factura en imagen"
                >
                  <Icon name="download" />
                </button>
                {["CANCELED", "COMPLETED"].includes(order.status) ? (
                  canDeleteOrders && !hasRefundHistory(order) ? (
                    <button
                      onClick={() => setConfirmAction({ kind: "delete-order", order })}
                      disabled={busyOrder}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Eliminar pedido definitivamente"
                      aria-label="Eliminar pedido definitivamente"
                    ><Icon name="trash" /></button>
                  ) : null
                ) : canCancelOrders ? (
                  <button
                    onClick={() => setConfirmAction({ kind: "cancel-order", order })}
                    disabled={busyOrder}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Cancelar pedido"
                    aria-label="Cancelar pedido"
                  ><Icon name="cancel" /></button>
                ) : null}
                <div className="ml-auto min-w-0 flex-1">
                  {["CANCELED", "COMPLETED"].includes(order.status) ? (
                    <span className="flex h-9 items-center justify-center rounded-lg bg-neutral-100 px-2 text-[10px] font-bold text-neutral-400">
                      CERRADO
                    </span>
                  ) : operationLocked ? (
                    <span
                      className="flex h-9 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 px-2 text-[10px] font-black text-violet-700"
                      title={
                        order.scheduledFor
                          ? `Estados habilitados 30 minutos antes de ${scheduledLabel(order.scheduledFor)}`
                          : "Pedido programado"
                      }
                    >
                      PROGRAMADO
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busyOrder}
                      onClick={() => void openStatusManager(order)}
                      className="h-9 w-full rounded-lg bg-black px-2 text-[10px] font-black text-white disabled:opacity-50"
                    >
                      ESTADOS
                    </button>
                  )}
                </div>
              </div>
            </div>
          </article>;
        })}</div>}
    </div>

    {selected && (
      <div
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[4px]"
        onClick={() => setSelected(null)}
      >
        <aside
          onClick={(event) => event.stopPropagation()}
          className="order-detail-drawer absolute inset-y-0 right-0 flex w-full max-w-[680px] flex-col overflow-hidden bg-[#f7f6f3] shadow-[-28px_0_80px_rgba(0,0,0,.28)]"
        >
          <header className="relative shrink-0 overflow-hidden border-b border-red-500/40 bg-[#0b0b0c] px-4 py-4 text-white sm:px-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_20%,rgba(226,26,34,.34),transparent_32%),linear-gradient(120deg,#0b0b0c_0%,#121215_58%,#3c0a0d_100%)]" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-[2px] w-6 rounded-full bg-[var(--brand-red)]" />
                  <p className="alento-ui-label uppercase tracking-[0.16em] text-white/45">
                    Detalle del pedido
                  </p>
                </div>

                <div className="mt-1.5 flex min-w-0 flex-wrap items-end gap-x-3 gap-y-1">
                  <h2 className="text-[26px] font-black leading-none tracking-[-0.035em]">
                    {displayOrderCode(selected)}
                  </h2>
                  <span className="order-detail-date pb-0.5 text-[10px] font-semibold text-white/45">
                    {dateTime(selected.createdAt)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`${statusTone(selected.status)} rounded-full border border-white/10 px-2.5 py-1 alento-ui-label uppercase text-white shadow-sm`}
                  >
                    {statusLabel(selected.status)}
                  </span>
                  {selected.scheduledFor && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/30 bg-violet-400/15 px-2.5 py-1 alento-ui-label font-black uppercase text-violet-100">
                      <Clock3 className="h-3 w-3" />
                      Programado · {scheduledLabel(selected.scheduledFor)}
                    </span>
                  )}
                  {selected.scheduledFor &&
                    !isInKitchenWindow(selected.scheduledFor) && (
                      <span className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-400/15 px-2.5 py-1 alento-ui-label font-black uppercase text-amber-100">
                        Operación bloqueada hasta 30 min antes
                      </span>
                    )}
                  <span
                    className={`rounded-full border px-2.5 py-1 alento-ui-label uppercase ${fulfillmentTone(selected.fulfillmentType)}`}
                  >
                    {fulfillmentLabel(selected.fulfillmentType)}
                  </span>
                  {selected.fulfillmentType === "DELIVERY" && (
                    <span className="order-detail-zone-badge rounded-full border px-2.5 py-1 alento-ui-label uppercase shadow-sm">
                      {selected.deliveryZoneName ||
                        (Number(selected.deliveryFee) > 0
                          ? money(selected.deliveryFee)
                          : "Sin costo")}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.07] text-white/80 transition hover:bg-white/[0.12]"
                aria-label="Cerrar detalle"
              >
                <Icon name="close" />
              </button>
            </div>
          </header>

          <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <section className="rounded-[20px] border border-neutral-200 bg-white p-3.5 shadow-[0_8px_24px_rgba(28,23,20,.045)] sm:p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-neutral-200 bg-[#f7f6f3] alento-ui-status font-black text-neutral-800">
                  {(selected.customer?.name || "C").trim().charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="alento-ui-label uppercase tracking-[0.1em] text-neutral-400">
                    Cliente
                  </p>
                  <h3 className="alento-ui-status mt-0.5 truncate text-neutral-950">
                    {selected.customer?.name || "Cliente ocasional"}
                  </h3>
                  <p className="alento-ui-micro mt-1 text-neutral-500">
                    {selected.customer?.phone
                      ? `${selected.customer.countryCode} ${selected.customer.phone}`
                      : "Sin teléfono"}
                  </p>
                  {selected.address?.address && (
                    <p className="alento-ui-micro mt-1 line-clamp-2 text-neutral-500">
                      {selected.address.address}
                    </p>
                  )}
                </div>
              </div>

              {selected.fulfillmentType === "DELIVERY" && selected.driver && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[13px] border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                  <span className="alento-ui-micro inline-flex min-w-0 items-center gap-1.5 font-bold text-emerald-800">
                    <span aria-hidden="true">🏍️</span>
                    <span className="truncate">{selected.driver.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void unassignDriver(selected)}
                    disabled={busy === selected.id}
                    className="alento-ui-micro rounded-lg border border-red-200 bg-white px-2.5 py-1.5 font-bold text-red-600 disabled:opacity-40"
                  >
                    Desasignar
                  </button>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openCustomerManager(selected)}
                  disabled={["COMPLETED", "CANCELED", "DELIVERED"].includes(selected.status)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-neutral-200 bg-white px-3 alento-ui-control font-bold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon name="edit" />
                  <span>Editar cliente</span>
                </button>

                <button
                  type="button"
                  onClick={() => void resendNewOrderTemplate(selected)}
                  disabled={busy === selected.id || !selected.customer?.phone}
                  className="inline-flex h-10 items-center justify-center rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 alento-ui-control font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === selected.id ? "Enviando..." : "Reenviar WhatsApp"}
                </button>
              </div>
            </section>

            <section className="mt-3 rounded-[20px] border border-neutral-200 bg-white p-3.5 shadow-[0_8px_24px_rgba(28,23,20,.04)] sm:p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="alento-ui-label uppercase tracking-[0.1em] text-neutral-400">
                    Productos
                  </p>
                  <h3 className="alento-ui-status mt-0.5 text-neutral-950">
                    Detalle de la orden
                  </h3>
                </div>
                <span className="alento-ui-micro rounded-full bg-neutral-100 px-2.5 py-1 font-bold text-neutral-500">
                  {selected.items.reduce((sum, item) => sum + item.quantity, 0)} productos
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {selected.items.map((item) => (
                  <ProductRow key={item.id} item={item} />
                ))}
              </div>
            </section>

            <section className="mt-3 grid gap-3 sm:grid-cols-[0.82fr_1.18fr]">
              <div className="rounded-[20px] border border-neutral-200 bg-white p-3.5 shadow-[0_8px_24px_rgba(28,23,20,.04)]">
                <p className="alento-ui-label uppercase tracking-[0.1em] text-neutral-400">
                  Totales
                </p>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="alento-ui-body text-neutral-500">Subtotal</span>
                    <b className="alento-ui-control text-neutral-900">
                      {money(selected.subtotal)}
                    </b>
                  </div>

                  {Number(selected.deliveryFee) > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="alento-ui-body text-neutral-500">Domicilio</span>
                      <b className="alento-ui-control text-neutral-900">
                        {money(selected.deliveryFee)}
                      </b>
                    </div>
                  )}

                  {Number(selected.discount) > 0 && (
                    <div className="flex items-center justify-between gap-3 text-emerald-700">
                      <span className="alento-ui-body">Descuento</span>
                      <b className="alento-ui-control">- {money(selected.discount)}</b>
                    </div>
                  )}
                </div>

                <div className="mt-3 rounded-[14px] bg-[#111113] px-3.5 py-3 text-white">
                  <span className="alento-ui-micro uppercase tracking-[0.09em] text-white/45">
                    Total
                  </span>
                  <b className="mt-1 block text-[24px] font-black leading-none tracking-[-0.035em] text-[#ff3038]">
                    {money(selected.total)}
                  </b>
                </div>
              </div>

              <div className="rounded-[20px] border border-neutral-200 bg-white p-3.5 shadow-[0_8px_24px_rgba(28,23,20,.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="alento-ui-label uppercase tracking-[0.1em] text-neutral-400">
                      Pago
                    </p>
                    <h3 className="alento-ui-status mt-0.5 text-neutral-950">
                      Estado financiero
                    </h3>
                  </div>
                  {balance(selected) > 0 && (
                    <button
                      type="button"
                      onClick={() => void openPayment(selected)}
                      disabled={isScheduledForFutureDay(selected.scheduledFor)}
                      title={
                        isScheduledForFutureDay(selected.scheduledFor) &&
                        selected.scheduledFor
                          ? `Cobro habilitado el ${scheduledDayLabel(selected.scheduledFor)}`
                          : undefined
                      }
                      className="h-9 rounded-[11px] bg-black px-3 alento-ui-micro font-black uppercase text-white disabled:cursor-not-allowed disabled:bg-violet-100 disabled:text-violet-700"
                    >
                      {isScheduledForFutureDay(selected.scheduledFor)
                        ? "Cobro programado"
                        : "Registrar pago"}
                    </button>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-[12px] border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                    <span className="alento-ui-micro block uppercase text-emerald-600">
                      Recibido
                    </span>
                    <b className="alento-ui-status mt-1 block text-emerald-800">
                      {money(paidAmount(selected))}
                    </b>
                  </div>
                  <div className="rounded-[12px] border border-amber-100 bg-amber-50 px-3 py-2.5">
                    <span className="alento-ui-micro block uppercase text-amber-600">
                      Pendiente
                    </span>
                    <b className={`alento-ui-status mt-1 block ${balance(selected) > 0 ? "text-amber-800" : "text-emerald-700"}`}>
                      {money(balance(selected))}
                    </b>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-3 rounded-[20px] border border-neutral-200 bg-white p-3.5 shadow-[0_8px_24px_rgba(28,23,20,.04)] sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="alento-ui-label uppercase tracking-[0.1em] text-neutral-400">
                    Movimientos de pago
                  </p>
                  <h3 className="alento-ui-status mt-0.5 text-neutral-950">
                    Pagos registrados
                  </h3>
                </div>
                <span className="alento-ui-micro rounded-full bg-neutral-100 px-2.5 py-1 font-bold text-neutral-500">
                  {selected.payments.filter((payment) => payment.status !== "CANCELED").length}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {selected.payments.filter((payment) => payment.status !== "CANCELED").length === 0 ? (
                  <div className="rounded-[12px] border border-dashed border-neutral-200 bg-[#faf9f7] px-3 py-4 text-center alento-ui-body text-neutral-400">
                    Sin movimientos registrados.
                  </div>
                ) : (
                  selected.payments
                    .filter((payment) => payment.status !== "CANCELED")
                    .map((payment) => {
                      const received =
                        payment.status === "PAID" ||
                        payment.status === "REFUNDED";
                      const refundable = refundableAmount(payment);
                      const refunds = payment.refunds ?? [];
                      return (
                        <div
                          key={payment.id}
                          className={`rounded-[13px] border px-3 py-2.5 ${
                            received
                              ? "border-emerald-100 bg-emerald-50/55"
                              : "border-amber-100 bg-amber-50/55"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <b className="alento-ui-control text-neutral-900">
                                  {payment.method}
                                </b>
                                <span
                                  className={`rounded-full px-2 py-0.5 alento-ui-micro font-bold uppercase ${
                                    received
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {received ? "Recibido" : "Medio previsto"}
                                </span>
                              </div>
                              <p className="alento-ui-micro mt-1 text-neutral-500">
                                {received && payment.paidAt
                                  ? `Recibido ${dateTime(payment.paidAt)}`
                                  : "Indicado desde POS · aún no ingresado a Caja"}
                                {payment.reference ? ` · Ref. ${payment.reference}` : ""}
                              </p>
                              {received && payment.cashReceived != null && (
                                <p className="alento-ui-micro mt-1 text-neutral-400">
                                  Efectivo {money(payment.cashReceived)}
                                  {payment.changeDue != null
                                    ? ` · Cambio ${money(payment.changeDue)}`
                                    : ""}
                                </p>
                              )}
                              {refunds.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {refunds.map((refund) => (
                                    <div
                                      key={refund.id}
                                      className="rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-2 text-rose-800"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="alento-ui-micro font-bold uppercase">
                                          Devuelto · {dateTime(refund.refundedAt)}
                                        </span>
                                        <b className="alento-ui-micro">
                                          - {money(refund.amount)}
                                        </b>
                                      </div>
                                      <p className="alento-ui-micro mt-1 text-rose-700">
                                        {refund.reason}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <b className="alento-ui-control text-neutral-950">
                                {money(payment.amount)}
                              </b>
                              {refundable > 0 && (
                                <button
                                  type="button"
                                  onClick={() => void refundPayment(selected, payment)}
                                  disabled={busy === selected.id}
                                  className="inline-flex h-8 items-center justify-center rounded-[9px] border border-rose-200 bg-rose-50 px-2.5 alento-ui-micro font-bold text-rose-700 disabled:opacity-40"
                                  title="Registrar devolución real"
                                >
                                  Devolver
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmAction({
                                    kind: "delete-payment",
                                    order: selected,
                                    payment,
                                  })
                                }
                                disabled={
                                  busy === selected.id ||
                                  isScheduledForFutureDay(selected.scheduledFor) ||
                                  refunds.length > 0
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] border border-red-100 bg-white text-red-600 disabled:opacity-40"
                                title={
                                  isScheduledForFutureDay(selected.scheduledFor)
                                    ? "Los movimientos de pago se habilitan en la fecha programada"
                                    : refunds.length > 0
                                      ? "El pago tiene devoluciones y debe conservarse"
                                      : received
                                        ? "Eliminar pago registrado por error"
                                        : "Eliminar medio previsto"
                                }
                              >
                                <Icon name="trash" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </section>
          </div>

          <footer className="shrink-0 border-t border-neutral-200 bg-white p-3 sm:p-4">
            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => void openEdit(selected)}
                disabled={["COMPLETED", "CANCELED", "DELIVERED"].includes(selected.status)}
                className="order-detail-action-button inline-flex h-11 w-11 items-center justify-center rounded-[13px] border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-30"
                aria-label="Editar pedido"
                title="Editar"
              >
                <Icon name="edit" />
              </button>

              <button
                type="button"
                onClick={() => print(selected)}
                className="order-detail-action-button inline-flex h-11 w-11 items-center justify-center rounded-[13px] border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                aria-label="Imprimir pedido"
                title="Imprimir"
              >
                <Icon name="print" />
              </button>

              {["CANCELED", "COMPLETED"].includes(selected.status) ? (
                <span
                  className="order-detail-action-button inline-flex h-11 w-11 items-center justify-center rounded-[13px] bg-neutral-100 text-neutral-400"
                  aria-label="Pedido cerrado"
                  title="Cerrado"
                >
                  <Icon name="status" />
                </span>
              ) : selected.scheduledFor &&
                !isInKitchenWindow(selected.scheduledFor) ? (
                <span
                  className="order-detail-action-button inline-flex h-11 w-11 items-center justify-center rounded-[13px] border border-violet-200 bg-violet-50 text-violet-600"
                  aria-label="Pedido programado"
                  title={`Estados habilitados 30 minutos antes de ${scheduledLabel(selected.scheduledFor)}`}
                >
                  <Clock3 className="h-[17px] w-[17px]" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void openStatusManager(selected)}
                  className="order-detail-action-button order-detail-action-button--primary inline-flex h-11 w-11 items-center justify-center rounded-[13px] bg-black text-white transition hover:bg-neutral-800"
                  aria-label="Cambiar estado"
                  title="Estados"
                >
                  <Icon name="status" />
                </button>
              )}
            </div>
          </footer>
        </aside>
      </div>
    )}

    {confirmAction && <ActionConfirmModal
      variant={confirmAction.kind === "cancel-order" ? "warning" : "danger"}
      eyebrow={confirmAction.kind === "cancel-order" ? "Confirmar cancelación" : "Acción irreversible"}
      title={
        confirmAction.kind === "cancel-order"
          ? "Cancelar pedido"
          : confirmAction.kind === "delete-order"
            ? "Eliminar pedido"
            : "Eliminar pago"
      }
      description={
        confirmAction.kind === "cancel-order"
          ? `¿Deseas cancelar ${displayOrderCode(confirmAction.order)}?`
          : confirmAction.kind === "delete-order"
            ? `¿Deseas eliminar definitivamente ${displayOrderCode(confirmAction.order)}?`
            : confirmAction.payment.status === "PAID"
              ? `¿Deseas eliminar el pago de ${money(confirmAction.payment.amount)} recibido por ${confirmAction.payment.method}?`
              : `¿Deseas eliminar la referencia de pago prevista por ${confirmAction.payment.method}?`
      }
      detail={
        confirmAction.kind === "cancel-order"
          ? "El pedido, sus productos y pagos se conservarán para mantener trazabilidad, pero quedarán fuera de la operación activa."
          : confirmAction.kind === "delete-order"
            ? confirmAction.order.status === "COMPLETED"
              ? "Se borrarán definitivamente el pedido finalizado, sus productos, pagos, puntos Club y registros asociados. También dejará de aparecer en métricas e historial. Esta acción no se puede deshacer."
              : "Se borrarán definitivamente el pedido cancelado, sus productos, pagos y registros asociados. Esta acción no se puede deshacer."
            : confirmAction.payment.status === "PAID"
              ? "El ingreso desaparecerá de Caja y el saldo pendiente del pedido aumentará."
              : "Solo se eliminará esta referencia de pago prevista."
      }
      confirmLabel={
        confirmAction.kind === "cancel-order"
          ? "Cancelar pedido"
          : confirmAction.kind === "delete-order"
            ? "Eliminar definitivamente"
            : "Eliminar pago"
      }
      cancelLabel={confirmAction.kind === "delete-order" ? "Conservar pedido" : "Volver"}
      busy={busy === confirmAction.order.id}
      onClose={() => {
        if (busy !== confirmAction.order.id) setConfirmAction(null);
      }}
      onConfirm={() => void executeConfirmedAction()}
    />}

    {statusOrder && (
      <OrderStatusSelector
        orderCode={displayOrderCode(statusOrder)}
        currentStatus={statusOrder.status}
        fulfillmentType={statusOrder.fulfillmentType}
        pendingBalance={balance(statusOrder)}
        busy={statusSaving}
        drivers={statusDrivers}
        assignedDriverId={statusOrder.driver?.id ?? null}
        selectedDriverId={statusSelectedDriverId}
        driverBusy={statusDriverSaving}
        onDriverChange={setStatusSelectedDriverId}
        onConfirmDriver={() => void assignManagedDriver()}
        onUnassignDriver={() => void unassignManagedDriver()}
        onClose={() => {
          if (!statusSaving && !statusDriverSaving) {
            setStatusOrder(null);
          }
        }}
        onSelect={(status) => void selectManagedStatus(status)}
      />
    )}

    {feedbackModal && (
      <FeedbackModal
        tone={feedbackModal.tone}
        title={feedbackModal.title}
        message={feedbackModal.message}
        detail={feedbackModal.detail}
        buttonLabel="Entendido"
        onClose={() => setFeedbackModal(null)}
      />
    )}

    {paymentOrder && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-3" onClick={() => setPaymentOrder(null)}><div onClick={(event) => event.stopPropagation()} className="w-full max-w-[420px] overflow-hidden rounded-[22px] bg-white shadow-2xl"><div className="bg-black px-5 py-3.5 text-white"><p className="alento-ui-label font-bold uppercase tracking-[.14em] text-white/50">Registrar ingreso</p><div className="mt-0.5 flex items-end justify-between gap-3"><h3 className="text-[19px] font-black">Saldo {money(balance(paymentOrder))}</h3><span className="pb-0.5 text-[10px] text-white/50">Total o parcial</span></div></div><div className="space-y-2.5 p-4"><div><label className="mb-1 block alento-ui-label uppercase tracking-[.08em] text-neutral-400">Monto de este pago</label><input value={paymentAmount} onChange={(event) => { setPaymentAmount(event.target.value.replace(/\D/g, "")); setPaymentError(""); }} placeholder="Monto a registrar" inputMode="numeric" className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-base font-bold outline-none focus:border-neutral-400"/><div className="mt-1.5 flex items-center justify-between text-[11px]"><span className="text-neutral-500">Saldo después</span><b className="text-amber-700">{money(Math.max(0, balance(paymentOrder) - Number(paymentAmount || 0)))}</b></div></div><div><p className="mb-1 block alento-ui-label uppercase tracking-[.08em] text-neutral-400">Medio recibido</p><div className="grid grid-cols-2 gap-1.5">{settings?.paymentMethods.filter((method) => method.active).map((method) => <button key={method.id} onClick={() => { setPaymentMethodId(method.id); setCashReceived(""); setPaymentError(""); }} className={`h-10 rounded-xl border px-3 text-sm font-semibold ${paymentMethodId === method.id ? "border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]" : "border-neutral-200"}`}>{method.name}</button>)}</div></div>{settings?.paymentMethods.find((method) => method.id === paymentMethodId)?.name.toLowerCase() === "efectivo" && <div><label className="mb-1 block alento-ui-label uppercase tracking-[.08em] text-neutral-400">Efectivo entregado <span className="font-medium normal-case tracking-normal text-neutral-400">(opcional)</span></label><input value={cashReceived} onChange={(event) => { setCashReceived(event.target.value.replace(/\D/g, "")); setPaymentError(""); }} placeholder="Solo si deseas calcular cambio" inputMode="numeric" className="h-10 w-full rounded-xl border px-3 text-sm"/>{cashReceived && Number(cashReceived) >= Number(paymentAmount || 0) && <p className="mt-1 text-[11px] text-neutral-500">Cambio: <b>{money(Number(cashReceived) - Number(paymentAmount || 0))}</b></p>}</div>}<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Referencia (opcional)" className="h-10 w-full rounded-xl border px-3 text-sm" />{paymentError && <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">{paymentError}</p>}<div className="grid grid-cols-2 gap-2 pt-0.5"><button onClick={() => setPaymentOrder(null)} className="h-10 rounded-xl border text-sm font-semibold">Cancelar</button><button onClick={() => void registerPayment()} disabled={!paymentMethodId || !paymentAmount || Number(paymentAmount) <= 0 || Number(paymentAmount) > balance(paymentOrder) || busy === paymentOrder.id} className="h-10 rounded-xl bg-[var(--brand-red)] text-sm font-bold text-white disabled:opacity-50">Registrar pago</button></div></div></div></div>}

    {customerOrder && (
      <div
        className="fixed inset-0 z-[115] flex items-center justify-center bg-black/70 p-2 backdrop-blur-[4px] sm:p-4"
        onClick={() => {
          if (!customerSaving) setCustomerOrder(null);
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          className="flex max-h-[94dvh] w-[min(98vw,1180px)] max-w-none flex-col overflow-hidden rounded-[30px] border border-white/10 bg-white shadow-[0_30px_100px_rgba(0,0,0,.34)]"
        >
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200 bg-[radial-gradient(circle_at_88%_12%,rgba(226,26,34,.20),transparent_28%),linear-gradient(135deg,#080809,#1a1718)] px-5 py-4 text-white sm:px-7 sm:py-5">
            <div className="min-w-0">
              <p className="alento-ui-label uppercase tracking-[0.18em] text-[#ff5a60]">
                Cliente del pedido
              </p>
              <h3 className="mt-1 text-[24px] font-black tracking-[-0.03em] sm:text-[28px]">
                {displayOrderCode(customerOrder)}
              </h3>
              <p className="mt-1 text-[11px] text-white/48">
                Actualiza datos, ubicación o asigna otro cliente sin salir del pedido.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!customerSaving) setCustomerOrder(null);
              }}
              disabled={customerSaving}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] text-white/65 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
              aria-label="Cerrar edición del cliente"
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-[#f7f6f3] lg:flex-row">
            <aside className="shrink-0 border-b border-neutral-200 bg-white p-3 lg:w-[245px] lg:border-b-0 lg:border-r lg:p-4">
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
                <button
                  type="button"
                  disabled={!customerOrder.customer}
                  onClick={() => {
                    setCustomerPanel("PERSONAL");
                    setCustomerError("");
                  }}
                  className={`flex min-h-[58px] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    customerPanel === "PERSONAL"
                      ? "border-neutral-950 bg-neutral-950 text-white shadow-[0_8px_20px_rgba(0,0,0,.12)]"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      customerPanel === "PERSONAL"
                        ? "bg-white/12 text-white"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    <UserRound className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <b className="block text-[11px] sm:text-[12px]">
                      Información personal
                    </b>
                    <span
                      className={`mt-0.5 hidden text-[10px] leading-4 lg:block ${
                        customerPanel === "PERSONAL"
                          ? "text-white/55"
                          : "text-neutral-400"
                      }`}
                    >
                      Nombre y contacto
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  disabled={
                    !customerOrder.customer ||
                    customerOrder.fulfillmentType !== "DELIVERY"
                  }
                  onClick={() => {
                    setCustomerPanel("LOCATION");
                    setCustomerError("");
                  }}
                  className={`flex min-h-[58px] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    customerPanel === "LOCATION"
                      ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white shadow-[0_8px_20px_rgba(226,26,34,.18)]"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      customerPanel === "LOCATION"
                        ? "bg-white/14 text-white"
                        : "bg-red-50 text-[var(--brand-red)]"
                    }`}
                  >
                    <MapPin className="h-[18px] w-[18px]" strokeWidth={2.1} />
                  </span>
                  <span className="min-w-0">
                    <b className="block text-[11px] sm:text-[12px]">
                      Ubicación
                    </b>
                    <span
                      className={`mt-0.5 hidden text-[10px] leading-4 lg:block ${
                        customerPanel === "LOCATION"
                          ? "text-white/65"
                          : "text-neutral-400"
                      }`}
                    >
                      Dirección y mapa
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomerPanel("CHANGE");
                    setCustomerError("");
                  }}
                  className={`flex min-h-[58px] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    customerPanel === "CHANGE"
                      ? "border-neutral-950 bg-neutral-950 text-white shadow-[0_8px_20px_rgba(0,0,0,.12)]"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      customerPanel === "CHANGE"
                        ? "bg-white/12 text-white"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    <Users className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <b className="block text-[11px] sm:text-[12px]">
                      Cambiar cliente
                    </b>
                    <span
                      className={`mt-0.5 hidden text-[10px] leading-4 lg:block ${
                        customerPanel === "CHANGE"
                          ? "text-white/55"
                          : "text-neutral-400"
                      }`}
                    >
                      Buscar y asignar
                    </span>
                  </span>
                </button>
              </div>

              {customerOrder.fulfillmentType === "DELIVERY" && (
                <div className="mt-4 hidden rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3 lg:block">
                  <span className="alento-ui-label uppercase tracking-[0.12em] text-neutral-400">
                    Estado de ubicación
                  </span>
                  {customerPanel === "CHANGE" ? (
                    replacementCustomer ? (
                      replacementAddressSelection || replacementAddressId ? (
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Lista para el domicilio
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-amber-700">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          Falta dirección
                        </div>
                      )
                    ) : (
                      <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-neutral-500">
                        <span className="h-2 w-2 rounded-full bg-neutral-300" />
                        Selecciona un cliente
                      </div>
                    )
                  ) : customerAddressSelection ? (
                    <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Validada con Google
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-amber-700">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Pendiente de validar
                    </div>
                  )}
                </div>
              )}
            </aside>

            <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
              {customerPanel === "PERSONAL" && customerOrder.customer && (
                <div className="mx-auto max-w-[830px]">
                  <CustomerPersonalEditor
                    name={customerName}
                    countryCode={customerCountryCode}
                    phone={customerPhone}
                    onNameChange={setCustomerName}
                    onCountryCodeChange={setCustomerCountryCode}
                    onPhoneChange={setCustomerPhone}
                    description="Corrige los datos del mismo cliente sin afectar su historial."
                  />
                  <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-[11px] leading-5 text-emerald-800">
                    Se actualiza el mismo registro, por lo que conserva todos sus pedidos, puntos e historial.
                  </div>
                </div>
              )}

              {customerPanel === "LOCATION" &&
                customerOrder.customer &&
                customerOrder.fulfillmentType === "DELIVERY" && (
                  <div className="mx-auto max-w-[880px]">
                    <CustomerAddressEditor
                      value={{
                        address:
                          customerOrder.address?.address || "",
                        formattedAddress:
                          customerAddressSelection?.formattedAddress ||
                          customerOrder.address?.formattedAddress ||
                          customerOrder.address?.address ||
                          "",
                        placeId:
                          customerAddressSelection?.placeId ||
                          customerOrder.address?.placeId ||
                          null,
                        latitude:
                          customerAddressSelection?.latitude ??
                          customerOrder.address?.latitude ??
                          null,
                        longitude:
                          customerAddressSelection?.longitude ??
                          customerOrder.address?.longitude ??
                          null,
                        neighborhood:
                          customerAddressSelection?.neighborhood ||
                          customerOrder.address?.neighborhood ||
                          "",
                        city:
                          customerAddressSelection?.city ||
                          customerOrder.address?.city ||
                          "Bogotá",
                        notes: customerAddressNotes,
                        covered:
                          customerAddressSelection?.covered,
                        deliveryFee:
                          customerAddressSelection?.deliveryFee ??
                          Number(customerOrder.deliveryFee),
                        distanceMeters:
                          customerAddressSelection?.distanceMeters ??
                          null,
                      }}
                      description="El mapa, la tarifa y la ruta se recalculan al guardar."
                      showDetailsBeforeValidation
                      onChange={(next) => {
                        setCustomerAddressNotes(next.notes ?? "");
                        setCustomerAddressSelection(
                          addressSelectionFromEditorValue(next),
                        );
                        setCustomerError("");
                      }}
                    />
                  </div>
                )}

              {customerPanel === "CHANGE" && (
                <section className="mx-auto max-w-[880px] space-y-4">
                  <div className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-[0_10px_30px_rgba(20,18,16,.04)] sm:p-6">
                    <div className="border-b border-neutral-100 pb-4">
                      <p className="alento-ui-label uppercase tracking-[.12em] text-neutral-400">
                        Cambiar cliente
                      </p>
                      <h3 className="mt-1 text-[22px] font-bold tracking-[-0.025em] text-neutral-950">
                        Buscar otro cliente
                      </h3>
                      <p className="mt-1 text-[12px] leading-5 text-neutral-400">
                        El cliente seleccionado quedará asociado únicamente a este pedido.
                      </p>
                    </div>

                    <div className="mt-4">
                      <input
                        value={customerQuery}
                        onChange={(event) =>
                          void searchReplacementCustomers(event.target.value)
                        }
                        placeholder="Nombre, teléfono o correo"
                        className="alento-input h-12 w-full rounded-2xl px-4"
                      />
                    </div>

                    {customerMatches.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {customerMatches.map((customer) => {
                          const selectedCustomer =
                            replacementCustomer?.id === customer.id;
                          const validAddress =
                            addressSelectionFromCustomerAddress(
                              customer.addresses?.[0],
                            );
                          return (
                            <button
                              type="button"
                              key={customer.id}
                              onClick={() =>
                                chooseReplacementCustomer(customer)
                              }
                              className={`rounded-2xl border p-3.5 text-left transition ${
                                selectedCustomer
                                  ? "border-[var(--brand-red)] bg-red-50 shadow-[0_6px_16px_rgba(226,26,34,.08)]"
                                  : "border-neutral-200 bg-[#fcfbf9] hover:border-neutral-300"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <b className="block truncate text-[13px] text-neutral-950">
                                    {customer.name}
                                  </b>
                                  <p className="mt-1 text-[11px] text-neutral-500">
                                    {customer.countryCode}{" "}
                                    {customer.phone || "Sin teléfono"}
                                  </p>
                                  {customerOrder.fulfillmentType ===
                                    "DELIVERY" && (
                                    <span
                                      className={`mt-2 inline-flex rounded-full px-2 py-1 alento-ui-label font-bold uppercase ${
                                        validAddress
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-amber-100 text-amber-700"
                                      }`}
                                    >
                                      {validAddress
                                        ? "Dirección registrada"
                                        : "Sin dirección validada"}
                                    </span>
                                  )}
                                </div>
                                {selectedCustomer && (
                                  <span className="rounded-full bg-[var(--brand-red)] px-2 py-1 alento-ui-label uppercase text-white">
                                    Seleccionado
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {replacementCustomer && (
                    <div className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-[0_10px_30px_rgba(20,18,16,.04)] sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-4">
                        <div>
                          <p className="alento-ui-label uppercase tracking-[.12em] text-neutral-400">
                            Cliente seleccionado
                          </p>
                          <h4 className="mt-1 text-[18px] font-black text-neutral-950">
                            {replacementCustomer.name}
                          </h4>
                          <p className="mt-1 text-[11px] text-neutral-500">
                            {replacementCustomer.countryCode}{" "}
                            {replacementCustomer.phone || "Sin teléfono"}
                          </p>
                        </div>
                        {customerOrder.fulfillmentType === "DELIVERY" &&
                          (replacementAddressSelection ||
                          replacementAddressId ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase text-emerald-700">
                              ✓ Ubicación lista
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase text-amber-700">
                              Agrega una dirección
                            </span>
                          ))}
                      </div>

                      {customerOrder.fulfillmentType === "DELIVERY" && (
                        <div className="mt-4 space-y-4">
                          {!replacementAddressSelection &&
                            !replacementAddressId && (
                              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] leading-5 text-amber-900">
                                Este cliente no tiene una dirección validada. Puedes crearla aquí mismo antes de asignarlo al pedido.
                              </div>
                            )}

                          <CustomerAddressEditor
                            value={{
                              address:
                                replacementCustomer.addresses?.[0]?.address ||
                                "",
                              formattedAddress:
                                replacementAddressSelection?.formattedAddress ||
                                replacementCustomer.addresses?.[0]
                                  ?.formattedAddress ||
                                replacementCustomer.addresses?.[0]?.address ||
                                "",
                              placeId:
                                replacementAddressSelection?.placeId ||
                                replacementCustomer.addresses?.[0]?.placeId ||
                                null,
                              latitude:
                                replacementAddressSelection?.latitude ??
                                replacementCustomer.addresses?.[0]?.latitude ??
                                null,
                              longitude:
                                replacementAddressSelection?.longitude ??
                                replacementCustomer.addresses?.[0]?.longitude ??
                                null,
                              neighborhood:
                                replacementAddressSelection?.neighborhood ||
                                replacementCustomer.addresses?.[0]
                                  ?.neighborhood ||
                                "",
                              city:
                                replacementAddressSelection?.city ||
                                replacementCustomer.addresses?.[0]?.city ||
                                "Bogotá",
                              notes: replacementAddressNotes,
                              covered:
                                replacementAddressSelection?.covered,
                              deliveryFee:
                                replacementAddressSelection?.deliveryFee ??
                                null,
                              distanceMeters:
                                replacementAddressSelection?.distanceMeters ??
                                null,
                            }}
                            eyebrow="Ubicación del nuevo cliente"
                            title="Dirección para este domicilio"
                            description="Valida el punto exacto antes de asignar el cliente. La cobertura y la tarifa se calculan con esta ubicación."
                            onChange={(next) => {
                              setReplacementAddressNotes(next.notes ?? "");
                              setReplacementAddressSelection(
                                addressSelectionFromEditorValue(next),
                              );
                              setReplacementAddressId(null);
                              setCustomerError("");
                            }}
                          />
                        </div>
                      )}

                      {customerOrder.fulfillmentType !== "DELIVERY" && (
                        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-[11px] text-emerald-800">
                          Este pedido no necesita dirección. Puedes asignar el cliente directamente.
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {customerError && (
                <p className="mx-auto mt-4 max-w-[880px] rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                  {customerError}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 bg-white px-5 py-4 sm:px-7">
            <span className="hidden text-[11px] font-medium text-neutral-400 sm:block">
              {customerPanel === "PERSONAL"
                ? "Información personal"
                : customerPanel === "LOCATION"
                  ? "Ubicación y entrega"
                  : "Asignar otro cliente"}
            </span>
            <div className="ml-auto grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[360px]">
              <button
                type="button"
                onClick={() => setCustomerOrder(null)}
                disabled={customerSaving}
                className="h-11 rounded-xl border border-neutral-300 bg-white px-5 text-sm font-semibold text-neutral-700 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  customerPanel === "CHANGE"
                    ? void changeOrderCustomer()
                    : void saveCurrentCustomer()
                }
                disabled={
                  customerSaving ||
                  (customerPanel === "CHANGE" && !replacementCustomer) ||
                  (customerPanel !== "CHANGE" && !customerOrder.customer)
                }
                className="h-11 rounded-xl bg-[var(--brand-red)] px-6 text-sm font-black text-white shadow-[0_8px_20px_rgba(226,26,34,.20)] disabled:opacity-50"
              >
                {customerSaving
                  ? "Guardando..."
                  : customerPanel === "CHANGE"
                    ? "Asignar cliente"
                    : "Guardar cliente"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    <AdminDeliveryMapModal
      open={deliveryMapOpen}
      onClose={() => setDeliveryMapOpen(false)}
    />

    <DeliveryZoneAnalyticsModal
      open={deliveryZonesOpen}
      onClose={() => setDeliveryZonesOpen(false)}
    />

    {editing && (
      <div
        className="fixed inset-0 z-[105] flex items-center justify-center bg-black/70 p-2 backdrop-blur-[4px] sm:p-4"
        onClick={() => {
          if (!saving) setEditing(null);
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          className="flex max-h-[94dvh] w-[min(98vw,1320px)] max-w-none flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#f6f3ee] shadow-[0_34px_110px_rgba(0,0,0,.34)]"
        >
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[radial-gradient(circle_at_88%_12%,rgba(226,26,34,.20),transparent_30%),linear-gradient(135deg,#080809,#1a1718)] px-5 py-4 text-white sm:px-7 sm:py-5">
            <div className="min-w-0">
              <p className="alento-ui-label uppercase tracking-[0.18em] text-[#ff5a60]">
                Editar pedido
              </p>
              <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                <h3 className="text-[24px] font-black tracking-[-0.03em] sm:text-[28px]">
                  {displayOrderCode(editing)}
                </h3>
                <span className="mb-1 rounded-full border border-white/10 bg-white/[0.07] px-2.5 py-1 alento-ui-label font-bold uppercase tracking-[.06em] text-white/65">
                  {fulfillmentLabel(fulfillment)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-white/48">
                Ajusta modalidad, cantidades o agrega productos sin perder el contexto del pedido.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!saving) setEditing(null);
              }}
              disabled={saving}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] text-white/65 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
              aria-label="Cerrar edición"
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[340px_minmax(0,1fr)] lg:grid-cols-[390px_minmax(0,1fr)]">
            <aside className="alento-scroll min-h-0 overflow-y-auto border-b border-neutral-200 bg-[#faf9f7] p-4 sm:p-5 md:border-b-0 md:border-r">
              <section className="rounded-[22px] border border-neutral-200 bg-white p-4 shadow-[0_10px_26px_rgba(28,23,20,.045)]">
                <div className="mb-3">
                  <p className="alento-ui-label uppercase tracking-[.12em] text-neutral-400">
                    Modalidad
                  </p>
                  <h4 className="mt-1 text-[17px] font-black tracking-[-0.02em] text-neutral-950">
                    Tipo de pedido
                  </h4>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(["DELIVERY", "PICKUP", "STORE"] as FulfillmentType[]).map(
                    (type) => {
                      const active = fulfillment === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFulfillment(type)}
                          className={`min-h-[52px] rounded-2xl border px-2 text-[11px] font-bold transition ${
                            active
                              ? "border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)] shadow-[0_6px_16px_rgba(226,26,34,.08)]"
                              : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                          }`}
                        >
                          {fulfillmentLabel(type)}
                        </button>
                      );
                    },
                  )}
                </div>

                {fulfillment === "DELIVERY" && (
                  <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/75 px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-[13px]">
                        ✓
                      </span>
                      <div>
                        <p className="alento-ui-label uppercase tracking-[.1em] text-emerald-700">
                          Domicilio automático
                        </p>
                        <p className="mt-0.5 text-[10px] leading-4 text-emerald-800/80">
                          La tarifa y la ruta se recalculan al guardar.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="mt-4 rounded-[22px] border border-violet-200 bg-[linear-gradient(145deg,#ffffff,#faf7ff)] p-4 shadow-[0_10px_26px_rgba(28,23,20,.045)]">
                <div>
                  <p className="alento-ui-label uppercase tracking-[.12em] text-violet-500">
                    Horario
                  </p>
                  <h4 className="mt-1 text-[17px] font-black tracking-[-0.02em] text-neutral-950">
                    Preparación del pedido
                  </h4>
                  <p className="mt-1 text-[10px] leading-4 text-neutral-500">
                    Puedes cambiar un pedido ya creado entre inmediato y programado.
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditScheduleMode("ASAP");
                      setEditError("");
                    }}
                    className={`min-h-[50px] rounded-2xl border px-3 text-left transition ${
                      editScheduleMode === "ASAP"
                        ? "border-neutral-950 bg-neutral-950 text-white"
                        : "border-neutral-200 bg-white text-neutral-700"
                    }`}
                  >
                    <b className="block text-[11px]">Lo antes posible</b>
                    <span className="mt-1 block text-[9px] opacity-55">
                      Cocina ahora
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditScheduleMode("SCHEDULED");
                      if (!editScheduledForInput) {
                        const next = new Date(Date.now() + 60 * 60 * 1000);
                        setEditScheduledForInput(toDateTimeLocalValue(next));
                      }
                      setEditError("");
                    }}
                    className={`min-h-[50px] rounded-2xl border px-3 text-left transition ${
                      editScheduleMode === "SCHEDULED"
                        ? "border-violet-500 bg-violet-100 text-violet-950"
                        : "border-neutral-200 bg-white text-neutral-700"
                    }`}
                  >
                    <b className="block text-[11px]">Programar pedido</b>
                    <span className="mt-1 block text-[9px] opacity-55">
                      Aviso 30 min antes
                    </span>
                  </button>
                </div>

                {editScheduleMode === "SCHEDULED" && (
                  <div className="mt-3 rounded-2xl border border-violet-200 bg-white p-3">
                    <label className="alento-ui-label font-black uppercase tracking-[.08em] text-violet-600">
                      Fecha y hora solicitada
                    </label>
                    <input
                      type="datetime-local"
                      value={editScheduledForInput}
                      onChange={(event) => {
                        setEditScheduledForInput(event.target.value);
                        setEditError("");
                      }}
                      className="alento-input mt-2 h-11 w-full rounded-xl bg-white px-3 text-[12px] font-bold"
                    />
                    {editScheduledForInput &&
                    settings?.store?.serviceHours ? (
                      (() => {
                        const iso =
                          bogotaLocalInputToIso(editScheduledForInput);
                        const window = iso
                          ? scheduledServiceWindow(
                              new Date(iso),
                              settings.store!.serviceHours,
                            )
                          : null;

                        if (!window) {
                          return (
                            <p className="mt-2 text-[9px] leading-4 text-violet-700/70">
                              Selecciona una fecha y hora válida.
                            </p>
                          );
                        }

                        return (
                          <p
                            className={
                              "mt-2 text-[9px] font-semibold leading-4 " +
                              (window.valid
                                ? "text-emerald-700"
                                : "text-rose-700")
                            }
                          >
                            {window.valid
                              ? `Horario válido · ${formatServiceRange(
                                  window.schedule,
                                )}`
                              : window.schedule.enabled
                                ? `Fuera de horario · ${formatServiceRange(
                                    window.schedule,
                                  )}`
                                : `${window.dayLabel}: cerrado`}
                          </p>
                        );
                      })()
                    ) : (
                      <p className="mt-2 text-[9px] leading-4 text-violet-700/70">
                        Cocina lo mostrará y hará sonar la alerta al entrar en la ventana de 30 minutos.
                      </p>
                    )}
                    <p className="mt-1 text-[9px] leading-4 text-violet-700/60">
                      Solo se aceptan horas dentro del horario de servicio configurado.
                    </p>
                  </div>
                )}
              </section>

              <section className="mt-4 rounded-[22px] border border-neutral-200 bg-white p-4 shadow-[0_10px_26px_rgba(28,23,20,.045)]">
                <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3">
                  <div>
                    <p className="alento-ui-label uppercase tracking-[.12em] text-neutral-400">
                      Productos actuales
                    </p>
                    <h4 className="mt-1 text-[17px] font-black tracking-[-0.02em] text-neutral-950">
                      Contenido del pedido
                    </h4>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold text-neutral-500">
                    {editPreview.itemCount} uds.
                  </span>
                </div>

                <div className="mt-3 space-y-2.5">
                  {editing.items.map((item) => {
                    const currentQuantity =
                      quantities[item.id] ?? item.quantity;
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border p-3 transition ${
                          currentQuantity === 0
                            ? "border-red-100 bg-red-50/40 opacity-65"
                            : "border-neutral-200 bg-[#fcfbf9]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <b className="block truncate text-[13px] font-bold text-neutral-950">
                              {item.productName}
                            </b>
                            <p className="mt-0.5 text-[11px] font-medium text-neutral-400">
                              {money(existingPizzaEdits[item.id]?.estimatedUnitPrice ?? item.unitPrice)} c/u
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-1">
                            <button
                              type="button"
                              onClick={() =>
                                setQuantities((current) => ({
                                  ...current,
                                  [item.id]: Math.max(
                                    0,
                                    (current[item.id] ?? item.quantity) - 1,
                                  ),
                                }))
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-700 transition hover:bg-neutral-100"
                              aria-label={`Restar ${item.productName}`}
                            >
                              <Icon name="minus" />
                            </button>
                            <b className="w-6 text-center text-[13px] tabular-nums text-neutral-950">
                              {currentQuantity}
                            </b>
                            <button
                              type="button"
                              onClick={() =>
                                setQuantities((current) => ({
                                  ...current,
                                  [item.id]:
                                    (current[item.id] ?? item.quantity) + 1,
                                }))
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-700 transition hover:bg-neutral-100"
                              aria-label={`Sumar ${item.productName}`}
                            >
                              <Icon name="plus" />
                            </button>
                          </div>
                        </div>

                        {isTwoFlavorOrderItem(item) && currentQuantity > 0 && (
                          <div className="mt-3 border-t border-neutral-100 pt-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                setExistingPizzaEditRequest({
                                  requestId: Date.now(),
                                  itemId: item.id,
                                  productId: item.productId,
                                  productName: item.productName,
                                  configuration:
                                    existingPizzaEdits[item.id]?.configuration ??
                                    item.configuration,
                                  notes:
                                    itemNotes[item.id] ??
                                    item.notes ??
                                    "",
                                })
                              }
                              className="flex w-full items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-left transition hover:border-violet-300 hover:bg-violet-100"
                            >
                              <span>
                                <span className="alento-ui-label block uppercase tracking-[.08em] text-violet-600">
                                  Pizza 2 sabores
                                </span>
                                <b className="mt-0.5 block text-[12px] text-violet-950">
                                  {existingPizzaEdits[item.id]?.summary ||
                                    "Cambiar Sabor 1 y Sabor 2"}
                                </b>
                              </span>
                              <span className="shrink-0 rounded-lg bg-violet-700 px-2.5 py-1.5 alento-ui-micro font-black uppercase text-white">
                                Cambiar
                              </span>
                            </button>
                          </div>
                        )}

                        {isPizzaItem(item) && currentQuantity > 0 && (
                          <div className="mt-3 border-t border-neutral-100 pt-2.5">
                            <div className="mb-1.5 flex items-center justify-between">
                              <label className="alento-ui-label uppercase tracking-[.08em] text-neutral-400">
                                Nota para cocina
                              </label>
                              <span className="alento-ui-label text-neutral-400">
                                {(itemNotes[item.id] ?? "").length}/120
                              </span>
                            </div>
                            <input
                              value={itemNotes[item.id] ?? ""}
                              maxLength={120}
                              onChange={(event) =>
                                setItemNotes((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                              className="alento-input w-full rounded-xl bg-white px-3 py-2.5 text-xs"
                              placeholder="Ej. Ligera en salsa"
                            />
                          </div>
                        )}

                        {currentQuantity === 0 && (
                          <p className="mt-2 text-[10px] font-bold text-red-600">
                            Se eliminará del pedido al guardar.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="mt-4 rounded-[22px] border border-neutral-200 bg-neutral-950 p-4 text-white shadow-[0_10px_26px_rgba(0,0,0,.10)]">
                <p className="alento-ui-label uppercase tracking-[.12em] text-white/40">
                  Resumen de edición
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/[0.07] p-3">
                    <span className="block alento-ui-label uppercase text-white/40">
                      Nuevos
                    </span>
                    <b className="mt-1 block text-lg tabular-nums">
                      {editPreview.addedCount}
                    </b>
                  </div>
                  <div className="rounded-xl bg-white/[0.07] p-3">
                    <span className="block alento-ui-label uppercase text-white/40">
                      Productos
                    </span>
                    <b className="mt-1 block text-[15px] tracking-[-0.02em]">
                      {money(editPreview.productsSubtotal)}
                    </b>
                  </div>
                </div>
                <p className="mt-3 text-[10px] leading-4 text-white/45">
                  El total final, domicilio y saldos se recalculan al guardar los cambios.
                </p>
              </section>
            </aside>

            <section className="alento-scroll min-h-0 overflow-y-auto bg-[#f6f3ee] p-4 sm:p-5 lg:p-6">
              <div className="mx-auto max-w-[820px] space-y-4">
                <div className="rounded-[24px] border border-neutral-200 bg-white p-4 shadow-[0_10px_30px_rgba(20,18,16,.045)] sm:p-5">
                  <OrderEditStructuredAdder
                    additions={structuredAdditions}
                    onChange={setStructuredAdditions}
                    editRequest={existingPizzaEditRequest}
                    onEditCancel={() => setExistingPizzaEditRequest(null)}
                    onEditComplete={(update) => {
                      setExistingPizzaEdits((current) => ({
                        ...current,
                        [update.itemId]: update,
                      }));
                      setItemNotes((current) => ({
                        ...current,
                        [update.itemId]: update.notes ?? "",
                      }));
                      setExistingPizzaEditRequest(null);
                    }}
                  />
                </div>

                {snackProducts.length > 0 && (
                  <div className="rounded-[24px] border border-amber-100 bg-[linear-gradient(145deg,#ffffff,#fffaf0)] p-4 shadow-[0_10px_30px_rgba(20,18,16,.045)] sm:p-5">
                    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-amber-100 pb-4">
                      <div>
                        <p className="alento-ui-label uppercase tracking-[.12em] text-amber-600">
                          Antojos
                        </p>
                        <h4 className="mt-1 text-[18px] font-black tracking-[-0.02em] text-neutral-950">
                          Palitos, canelones y más
                        </h4>
                        <p className="mt-1 text-[11px] text-neutral-400">
                          Agrégalos directamente al pedido.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
                      {snackProducts.map((product) => {
                        const quantity = additions[product.id] ?? 0;
                        return (
                          <div
                            key={product.id}
                            className={`flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border p-3.5 transition ${
                              quantity > 0
                                ? "border-amber-200 bg-amber-50/70"
                                : "border-amber-100 bg-white"
                            }`}
                          >
                            <div className="min-w-0">
                              <b className="block truncate text-[13px] font-bold text-neutral-950">
                                {product.name}
                              </b>
                              <p className="mt-1 text-[11px] font-semibold text-neutral-400">
                                {money(product.basePrice)}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setAdditions((current) => ({
                                    ...current,
                                    [product.id]: Math.max(
                                      0,
                                      (current[product.id] ?? 0) - 1,
                                    ),
                                  }))
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-neutral-100"
                              >
                                <Icon name="minus" />
                              </button>
                              <b className="w-6 text-center text-[13px] tabular-nums">
                                {quantity}
                              </b>
                              <button
                                type="button"
                                onClick={() =>
                                  setAdditions((current) => ({
                                    ...current,
                                    [product.id]:
                                      (current[product.id] ?? 0) + 1,
                                  }))
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-neutral-100"
                              >
                                <Icon name="plus" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {quickProducts.length > 0 && (
                  <div className="rounded-[24px] border border-neutral-200 bg-white p-4 shadow-[0_10px_30px_rgba(20,18,16,.045)] sm:p-5">
                    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-100 pb-4">
                      <div>
                        <p className="alento-ui-label uppercase tracking-[.12em] text-neutral-400">
                          Bebidas y otros
                        </p>
                        <h4 className="mt-1 text-[18px] font-black tracking-[-0.02em] text-neutral-950">
                          Productos rápidos
                        </h4>
                        <p className="mt-1 text-[11px] text-neutral-400">
                          Se agregan directamente, sin configuración adicional.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
                      {quickProducts.map((product) => {
                        const quantity = additions[product.id] ?? 0;
                        return (
                          <div
                            key={product.id}
                            className={`flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border p-3.5 transition ${
                              quantity > 0
                                ? "border-red-100 bg-red-50/35"
                                : "border-neutral-200 bg-[#fcfbf9]"
                            }`}
                          >
                            <div className="min-w-0">
                              <b className="block truncate text-[13px] font-bold text-neutral-950">
                                {product.name}
                              </b>
                              <p className="mt-1 text-[11px] font-semibold text-neutral-400">
                                {money(product.basePrice)}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setAdditions((current) => ({
                                    ...current,
                                    [product.id]: Math.max(
                                      0,
                                      (current[product.id] ?? 0) - 1,
                                    ),
                                  }))
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-neutral-100"
                              >
                                <Icon name="minus" />
                              </button>
                              <b className="w-6 text-center text-[13px] tabular-nums">
                                {quantity}
                              </b>
                              <button
                                type="button"
                                onClick={() =>
                                  setAdditions((current) => ({
                                    ...current,
                                    [product.id]:
                                      (current[product.id] ?? 0) + 1,
                                  }))
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-neutral-100"
                              >
                                <Icon name="plus" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {editError && (
                  <p className="rounded-2xl border border-red-100 bg-red-50 p-3.5 text-xs font-bold text-red-700">
                    {editError}
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 bg-white px-4 py-3.5 sm:px-6">
            <div className="hidden min-w-0 sm:block">
              <p className="alento-ui-label uppercase tracking-[.1em] text-neutral-400">
                Cambios del pedido
              </p>
              <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                Revisa cantidades y productos antes de guardar.
              </p>
            </div>
            <div className="ml-auto grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[360px]">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={saving}
                className="h-11 rounded-xl border border-neutral-300 bg-white px-5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={saving}
                className="h-11 rounded-xl bg-[var(--brand-red)] px-6 text-sm font-black text-white shadow-[0_8px_20px_rgba(226,26,34,.20)] transition hover:brightness-105 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </main>;
}
