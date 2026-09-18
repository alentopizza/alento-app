"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ActionConfirmModal from "@/components/ActionConfirmModal";
import OrderEditStructuredAdder, { type StructuredEditAddition } from "@/components/OrderEditStructuredAdder";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";
import { orderCode } from "@/lib/orderCode";
import { isCurrentOperationalDay } from "@/lib/operationalDate";
import { fulfillmentLabel, nextStatus, statusLabel, type FulfillmentType, type OrderStatus } from "@/lib/orderWorkflow";

type CustomerAddress = { id: number; address: string };
type CustomerSearchResult = {
  id: number;
  name: string;
  countryCode: string;
  phone: string | null;
  email?: string | null;
  addresses: CustomerAddress[];
};
type OrderItem = { id: number; productName: string; quantity: number; unitPrice: number | string; lineTotal: number | string; configuration: unknown; notes?: string | null };
type Payment = { id: number; method: string; amount: number | string; cashReceived: number | string | null; changeDue: number | string | null; status: string; reference?: string | null; paidAt?: string | null; createdAt?: string };
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
  customer: { id: number; name: string; countryCode: string; phone: string | null; addresses?: CustomerAddress[] } | null;
  address: { id: number; address: string } | null;
  items: OrderItem[];
  payments: Payment[];
};
type Settings = { deliveryBands: { id: string; name: string; fee: number; active: boolean }[]; paymentMethods: { id: string; name: string; active: boolean }[] };
type CatalogProduct = { id: number; name: string; type: string; basePrice: number | null };
type CatalogResponse = { categories: { products: CatalogProduct[] }[] };
type Filter = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELED";
type ConfirmAction =
  | { kind: "cancel-order"; order: Order }
  | { kind: "delete-order"; order: Order }
  | { kind: "delete-payment"; order: Order; payment: Payment }
  | null;

const money = (value: number | string | null | undefined) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value ?? 0));
const dateTime = (value: string) => new Date(value).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });
const displayOrderCode = (order: Order) => orderCode(order.sequenceNumber ?? order.id, order.source);
const activePayments = (order: Order) => order.payments.filter((payment) => payment.status !== "CANCELED");
const paidPayments = (order: Order) => order.payments.filter((payment) => payment.status === "PAID");
const paidAmount = (order: Order) => paidPayments(order).reduce((sum, payment) => sum + Number(payment.amount), 0);
const balance = (order: Order) => Math.max(0, Number(order.total) - paidAmount(order));
const paidInFull = (order: Order) => balance(order) <= 0 && Number(order.total) > 0;
const paymentHint = (order: Order) => activePayments(order).find((payment) => payment.status === "PENDING" || payment.status === "PARTIAL")?.method ?? paidPayments(order).at(-1)?.method ?? "Pago";
const isPizzaItem = (item: OrderItem) => Boolean(
  item.configuration
  && typeof item.configuration === "object"
  && !Array.isArray(item.configuration)
  && String((item.configuration as { kind?: unknown }).kind).toUpperCase() === "PIZZA"
);

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

function nextLabel(order: Order) {
  const next = nextStatus(order.status, order.fulfillmentType);
  if (!next) return null;
  if (next === "OUT_FOR_DELIVERY") return "EN CAMINO";
  if (next === "ARRIVED") return "HA LLEGADO";
  if (next === "DELIVERED") return "ENTREGADO";
  if (next === "COMPLETED") return "FINALIZAR";
  return statusLabel(next).toUpperCase();
}

function Icon({ name }: { name: "search" | "refresh" | "print" | "info" | "close" | "edit" | "trash" | "cancel" | "minus" | "plus" | "wallet" }) {
  const c = "h-[17px] w-[17px]";
  if (name === "search") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
  if (name === "refresh") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6.3 6.3L4 11M20 13l-2.3 4.7A7 7 0 0 1 5.5 15"/></svg>;
  if (name === "print") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>;
  if (name === "info") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>;
  if (name === "close") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="m6 6 12 12M18 6 6 18"/></svg>;
  if (name === "edit") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>;
  if (name === "trash") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>;
  if (name === "cancel") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><circle cx="12" cy="12" r="9"/><path d="m8.5 8.5 7 7M15.5 8.5l-7 7"/></svg>;
  if (name === "minus") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M5 12h14"/></svg>;
  if (name === "wallet") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M3 7h16a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2Z"/><path d="M3 7V5a2 2 0 0 1 2-2h13v4M16 12h5"/></svg>;
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
              <span className="mr-1 text-[9px] font-black uppercase tracking-[.08em] text-amber-600">Nota cocina</span>{item.notes}
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
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
  const [editing, setEditing] = useState<Order | null>(null);
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("PICKUP");
  const [zoneId, setZoneId] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({});
  const [additions, setAdditions] = useState<Record<number, number>>({});
  const [structuredAdditions, setStructuredAdditions] = useState<StructuredEditAddition[]>([]);
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [customerOrder, setCustomerOrder] = useState<Order | null>(null);
  const [customerMode, setCustomerMode] = useState<"EDIT" | "CHANGE">("EDIT");
  const [customerName, setCustomerName] = useState("");
  const [customerCountryCode, setCustomerCountryCode] = useState("+57");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerMatches, setCustomerMatches] = useState<CustomerSearchResult[]>([]);
  const [replacementCustomer, setReplacementCustomer] = useState<CustomerSearchResult | null>(null);
  const [replacementAddressId, setReplacementAddressId] = useState<number | null>(null);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerError, setCustomerError] = useState("");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar los pedidos.");
      const next = (data.orders ?? []) as Order[];
      setOrders(next);
      setSelected((current) => current ? next.find((order) => order.id === current.id) ?? null : null);
      setPaymentOrder((current) => current ? next.find((order) => order.id === current.id) ?? null : null);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar los pedidos.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15000);
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
    return [displayOrderCode(order), order.customer?.name, order.customer?.phone, statusLabel(order.status), fulfillmentLabel(order.fulfillmentType), paymentHint(order)].filter(Boolean).some((field) => String(field).toLowerCase().includes(value));
  }), [orders, filter, query]);

  const simpleProducts = useMemo(() => {
    const all = catalog?.categories.flatMap((category) => category.products) ?? [];
    const unique = new Map<number, CatalogProduct>();
    all.forEach((product) => {
      if (!["PIZZA_SINGLE", "PIZZA_TWO_FLAVORS", "COMBO", "MODIFIER", "INTERNAL"].includes(product.type) && product.basePrice != null) unique.set(product.id, product);
    });
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [catalog]);

  async function advance(order: Order) {
    const next = nextStatus(order.status, order.fulfillmentType);
    if (!next || ["PREPARING", "PREPARED", "CONFIRMED"].includes(order.status)) return;
    setBusy(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible actualizar el estado.");
      await load(true);
    } catch (actionError) {
      window.alert(actionError instanceof Error ? actionError.message : "No fue posible actualizar el estado.");
    } finally {
      setBusy(null);
    }
  }

  function print(order: Order) {
    const frame = document.createElement("iframe");
    Object.assign(frame.style, { position: "fixed", width: "1px", height: "1px", opacity: "0", pointerEvents: "none" });
    frame.src = `/pedidos/${order.id}/imprimir?autoprint=1&embedded=1`;
    document.body.appendChild(frame);
    window.setTimeout(() => frame.remove(), 30000);
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
    } catch (actionError) {
      window.alert(actionError instanceof Error ? actionError.message : "No fue posible cancelar el pedido.");
    } finally {
      setBusy(null);
    }
  }

  async function removeTest(order: Order) {
    setBusy(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}?test=1`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible eliminar el pedido.");
      if (selected?.id === order.id) setSelected(null);
      await load(true);
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
    } catch (actionError) {
      window.alert(actionError instanceof Error ? actionError.message : "No fue posible eliminar el pago.");
    } finally {
      setBusy(null);
    }
  }

  async function executeConfirmedAction() {
    if (!confirmAction) return;
    const action = confirmAction;
    try {
      if (action.kind === "cancel-order") await cancelOrder(action.order);
      if (action.kind === "delete-order") await removeTest(action.order);
      if (action.kind === "delete-payment") await voidPayment(action.order, action.payment);
    } finally {
      setConfirmAction(null);
    }
  }

  async function openPayment(order: Order) {
    try {
      const cfg = await loadSettings();
      const hint = paymentHint(order);
      const method = cfg.paymentMethods.find((item) => item.name === hint) ?? cfg.paymentMethods.find((item) => item.active);
      const currentBalance = Math.round(balance(order));
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
      const response = await fetch(`/api/orders/${paymentOrder.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodId,
          amount,
          cashReceived: cashReceived ? Number(cashReceived) : null,
          reference,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible registrar el pago.");
      setPaymentOrder(null);
      setPaymentAmount("");
      setCashReceived("");
      setReference("");
      await load(true);
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
      setZoneId(full.deliveryZoneId || settingsData.settings.deliveryBands?.find((item: { active: boolean }) => item.active)?.id || "");
      setQuantities(Object.fromEntries(full.items.map((item) => [item.id, item.quantity])));
      setItemNotes(Object.fromEntries(full.items.map((item) => [item.id, item.notes ?? ""])));
      setAdditions({});
      setStructuredAdditions([]);
      setEditError("");
    } catch (openError) {
      window.alert(openError instanceof Error ? openError.message : "No fue posible abrir la edición.");
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setEditError("");
    try {
      const response = await fetch(`/api/orders/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillmentType: fulfillment,
          addressId: fulfillment === "DELIVERY" ? editing.address?.id ?? editing.customer?.addresses?.[0]?.id ?? null : null,
          deliveryZoneId: fulfillment === "DELIVERY" ? zoneId : null,
          items: editing.items.map((item) => ({ id: item.id, quantity: quantities[item.id] ?? item.quantity, notes: isPizzaItem(item) ? (itemNotes[item.id] ?? "").trim().slice(0, 120) : item.notes ?? null })),
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
      await load(true);
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : "No fue posible guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }


  function openCustomerManager(order: Order) {
    setCustomerOrder(order);
    setCustomerMode(order.customer ? "EDIT" : "CHANGE");
    setCustomerName(order.customer?.name ?? "");
    setCustomerCountryCode(order.customer?.countryCode || "+57");
    setCustomerPhone(order.customer?.phone ?? "");
    setCustomerQuery("");
    setCustomerMatches([]);
    setReplacementCustomer(null);
    setReplacementAddressId(null);
    setCustomerError("");
  }

  async function searchReplacementCustomers(value: string) {
    setCustomerQuery(value);
    setReplacementCustomer(null);
    setReplacementAddressId(null);
    const term = value.trim();
    if (term.length < 2) {
      setCustomerMatches([]);
      return;
    }
    try {
      const response = await fetch(`/api/customers?q=${encodeURIComponent(term)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible buscar clientes.");
      setCustomerMatches((data.customers ?? []) as CustomerSearchResult[]);
    } catch (searchError) {
      setCustomerError(searchError instanceof Error ? searchError.message : "No fue posible buscar clientes.");
    }
  }

  async function saveCurrentCustomer() {
    if (!customerOrder?.customer) return;
    if (!customerName.trim() || !customerPhone.replace(/\D/g, "")) {
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
      if (!response.ok) throw new Error(data.error || "No fue posible actualizar el cliente.");
      await load(true);
      setCustomerOrder(null);
    } catch (saveError) {
      setCustomerError(saveError instanceof Error ? saveError.message : "No fue posible actualizar el cliente.");
    } finally {
      setCustomerSaving(false);
    }
  }

  async function changeOrderCustomer() {
    if (!customerOrder || !replacementCustomer) {
      setCustomerError("Selecciona el cliente que deseas asignar al pedido.");
      return;
    }
    if (customerOrder.fulfillmentType === "DELIVERY" && !replacementAddressId) {
      setCustomerError("Selecciona una dirección del nuevo cliente para este domicilio.");
      return;
    }
    setCustomerSaving(true);
    setCustomerError("");
    try {
      const response = await fetch(`/api/orders/${customerOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change-customer",
          customerId: replacementCustomer.id,
          addressId: customerOrder.fulfillmentType === "DELIVERY" ? replacementAddressId : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cambiar el cliente del pedido.");
      await load(true);
      setCustomerOrder(null);
    } catch (saveError) {
      setCustomerError(saveError instanceof Error ? saveError.message : "No fue posible cambiar el cliente del pedido.");
    } finally {
      setCustomerSaving(false);
    }
  }

  const activeCount = orders.filter((order) => !["COMPLETED", "CANCELED"].includes(order.status)).length;

  return <main className="p-4 md:p-6 xl:p-8">
    <div className="mx-auto max-w-[1600px] space-y-4">
      <section className="rounded-[28px] bg-[radial-gradient(circle_at_88%_20%,rgba(229,28,17,.24),transparent_28%),linear-gradient(135deg,#09090a,#181516)] px-6 py-5 text-white shadow-[0_20px_55px_rgba(20,16,14,.12)] md:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Operación</p>
            <h1 className="mt-0.5 text-3xl font-black tracking-[-0.035em]">Pedidos</h1>
            <p className="mt-0.5 text-sm text-white/65">Todo el flujo de tus órdenes, en un solo lugar.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2.5 text-center shadow-inner">
            <span className="block text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">Activos</span>
            <b className="mt-0.5 block text-[28px] font-black leading-none tabular-nums text-white">{activeCount}</b>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-sm">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"><Icon name="search" /></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pedido, cliente, teléfono, pago o estado" className="h-11 w-full rounded-xl border border-neutral-200 bg-[#faf9f7] pl-11 pr-4 text-sm outline-none focus:border-neutral-400" /></div>
          <div className="flex gap-1.5 overflow-x-auto">{([ ["ALL", "Todos"], ["ACTIVE", "Activos"], ["COMPLETED", "Finalizados"], ["CANCELED", "Cancelados"] ] as [Filter, string][]).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold ${filter === value ? "bg-black text-white" : "border border-neutral-200 bg-white text-neutral-600"}`}>{label}</button>)}</div>
        </div>
      </section>

      {loading ? <div className="rounded-2xl border bg-white p-8 text-center text-sm text-neutral-500">Cargando pedidos...</div> : error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : visible.length === 0 ? <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-neutral-400">No hay pedidos para mostrar.</div> :
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visible.map((order) => {
          const fullyPaid = paidInFull(order);
          const busyOrder = busy === order.id;
          const kitchenManaged = ["CONFIRMED", "PREPARING", "PREPARED"].includes(order.status);
          const actionLabel = nextLabel(order);
          const receivedTotal = paidAmount(order);
          const pendingTotal = balance(order);
          const plannedMethod = paymentHint(order).toUpperCase();
          const sameOperationalDay = isCurrentOperationalDay(order.createdAt);
          return <article key={order.id} onClick={() => setSelected(order)} className={`group cursor-pointer overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-[0_12px_32px_rgba(28,23,20,.055)] transition hover:-translate-y-1 hover:border-neutral-300 hover:shadow-[0_20px_42px_rgba(28,23,20,.10)] ${order.status === "CANCELED" ? "order-card-canceled" : ""}`}>
            <div className={`${statusTone(order.status)} flex items-center justify-between gap-3 px-4 py-2.5 text-white`}><span className="text-[10px] font-black uppercase tracking-[0.08em]">{statusLabel(order.status)}</span><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase shadow-sm ${fulfillmentTone(order.fulfillmentType)}`}>{fulfillmentLabel(order.fulfillmentType)}</span></div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold text-neutral-400">{dateTime(order.createdAt)}</p><h2 className="mt-0.5 text-[21px] font-black tracking-[-0.04em] text-neutral-950">{displayOrderCode(order)}</h2></div><b className="shrink-0 text-[19px] font-extrabold tracking-[-0.025em] text-[var(--brand-red)]">{money(order.total)}</b></div>
              <div className="order-customer-card mt-4 flex items-center gap-4 rounded-2xl border border-neutral-200 bg-[#f8f7f5] p-4"><div className="order-customer-avatar flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-base font-bold shadow-sm">{(order.customer?.name || "C").trim().charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="order-customer-name truncate">{order.customer?.name || "Cliente ocasional"}</p><div className="order-customer-meta"><p className="order-customer-line">{order.customer?.phone ? `${order.customer.countryCode} ${order.customer.phone}` : "Sin teléfono"}</p>{order.fulfillmentType === "DELIVERY" && order.address?.address && <p className="order-customer-line order-customer-address">{order.address.address}</p>}</div></div></div>
              <div className="mt-3" onClick={(event) => event.stopPropagation()}>
                {fullyPaid ? (
                  <div className="flex min-h-10 items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                    <div className="min-w-0 flex items-baseline gap-2">
                      <span className="shrink-0 text-[8px] font-black uppercase tracking-[0.08em] text-emerald-600">Pagado</span>
                      <b className="truncate text-[13px] font-extrabold text-emerald-800">{money(receivedTotal)}</b>
                    </div>
                    <span className="max-w-[105px] truncate rounded-full border border-emerald-100 bg-white/80 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.055em] text-neutral-600" title={`Medio recibido: ${plannedMethod}`}>{plannedMethod}</span>
                  </div>
                ) : (
                  <button onClick={() => void openPayment(order)} className="flex min-h-10 w-full items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-left transition hover:border-amber-200 hover:bg-amber-50/80">
                    <div className="min-w-0 flex items-baseline gap-2">
                      <span className="shrink-0 text-[8px] font-black uppercase tracking-[0.08em] text-amber-600">Pago pendiente</span>
                      <b className="truncate text-[13px] font-extrabold text-amber-800">{money(pendingTotal)}</b>
                    </div>
                    <span className="max-w-[105px] truncate rounded-full border border-amber-100 bg-white/80 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.055em] text-neutral-600" title={`Medio previsto: ${plannedMethod}`}>{plannedMethod}</span>
                  </button>
                )}
              </div>
              <div className="mt-4 flex items-center gap-1.5 border-t border-neutral-100 pt-3" onClick={(event) => event.stopPropagation()}>
                <button onClick={() => setSelected(order)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600" title="Detalle"><Icon name="info" /></button>
                <button onClick={() => void openEdit(order)} disabled={["COMPLETED", "CANCELED", "DELIVERED"].includes(order.status)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 disabled:opacity-30" title="Editar"><Icon name="edit" /></button>
                <button onClick={() => print(order)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600" title="Imprimir"><Icon name="print" /></button>
                {order.status === "CANCELED" ? (
                  <button
                    onClick={() => setConfirmAction({ kind: "delete-order", order })}
                    disabled={busyOrder || !sameOperationalDay}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:opacity-60"
                    title={sameOperationalDay ? "Eliminar pedido definitivamente" : "Solo se pueden eliminar pedidos cancelados del día actual"}
                    aria-label={sameOperationalDay ? "Eliminar pedido definitivamente" : "Eliminación bloqueada por cierre diario"}
                  ><Icon name="trash" /></button>
                ) : order.status !== "COMPLETED" ? (
                  <button
                    onClick={() => setConfirmAction({ kind: "cancel-order", order })}
                    disabled={busyOrder || !sameOperationalDay}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:opacity-60"
                    title={sameOperationalDay ? "Cancelar pedido" : "No se puede cancelar un pedido de un día anterior"}
                    aria-label={sameOperationalDay ? "Cancelar pedido" : "Cancelación bloqueada por cierre diario"}
                  ><Icon name="cancel" /></button>
                ) : null}
                <div className="ml-auto min-w-0 flex-1">{kitchenManaged ? <Link href="/cocina" className="flex h-9 items-center justify-center rounded-lg bg-black px-2 text-[10px] font-black text-white">COCINA</Link> : actionLabel ? <button disabled={busyOrder} onClick={() => void advance(order)} className="h-9 w-full rounded-lg bg-[var(--brand-red)] px-2 text-[10px] font-black text-white disabled:opacity-50">{busyOrder ? "..." : actionLabel}</button> : <span className="flex h-9 items-center justify-center rounded-lg bg-neutral-100 px-2 text-[10px] font-bold text-neutral-400">CERRADO</span>}</div>
              </div>
            </div>
          </article>;
        })}</div>}
    </div>

    {selected && <div className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-[3px]" onClick={() => setSelected(null)}><aside onClick={(event) => event.stopPropagation()} className="order-detail-drawer absolute inset-y-0 right-0 flex w-full max-w-[620px] flex-col overflow-hidden bg-[#f5f2ee] shadow-[-24px_0_70px_rgba(0,0,0,.24)]">
      <header className="flex items-start justify-between gap-4 border-b-2 border-[var(--brand-red)] bg-[radial-gradient(circle_at_90%_20%,rgba(229,28,17,.22),transparent_28%),linear-gradient(135deg,#0b0b0c,#171718)] px-5 py-5 text-white"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">Detalle del pedido</p><h2 className="mt-1 text-2xl font-black">{displayOrderCode(selected)}</h2><div className="mt-2 flex flex-wrap items-center gap-2"><span className="order-detail-date text-xs text-white/55">{dateTime(selected.createdAt)}</span><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${fulfillmentTone(selected.fulfillmentType)}`}>{fulfillmentLabel(selected.fulfillmentType)}</span>{selected.fulfillmentType === "DELIVERY" && <span className="order-detail-delivery-fee">{selected.deliveryZoneName || (Number(selected.deliveryFee) > 0 ? money(selected.deliveryFee) : "Sin costo")}</span>}</div></div><button onClick={() => setSelected(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08]"><Icon name="close" /></button></header>
      <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <section className="order-customer-detail rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.1em] text-neutral-400">Cliente</p><h3 className="order-customer-detail-name mt-1">{selected.customer?.name || "Cliente ocasional"}</h3><div className="order-customer-detail-meta"><p>{selected.customer?.phone ? `${selected.customer.countryCode} ${selected.customer.phone}` : "Sin teléfono"}</p>{selected.address?.address && <p>{selected.address.address}</p>}</div></div><div className="flex shrink-0 flex-col items-end gap-2"><span className={`${statusTone(selected.status)} rounded-xl px-3 py-2 text-[10px] font-black uppercase text-white`}>{statusLabel(selected.status)}</span><button
  onClick={() => openCustomerManager(selected)}
  disabled={["COMPLETED", "CANCELED", "DELIVERED"].includes(selected.status)}
  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 text-[11px] font-bold text-neutral-700 shadow-[0_6px_18px_rgba(28,23,20,.08)] transition-all duration-150 hover:-translate-y-[1px] hover:border-[var(--brand-red)] hover:text-[var(--brand-red)] hover:shadow-[0_10px_24px_rgba(28,23,20,.12)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:border-neutral-200 disabled:hover:text-neutral-700"
>
  <Icon name="edit" />
  <span>Editar cliente</span>
</button></div></div></section>
        <section className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4"><div><p className="text-[9px] font-black uppercase tracking-[.1em] text-neutral-400">Productos</p><h3 className="mt-1 text-lg font-black">Detalle de la orden</h3></div><div className="mt-3 space-y-2">{selected.items.map((item) => <ProductRow key={item.id} item={item} />)}</div></section>
        <section className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4"><p className="text-[9px] font-black uppercase tracking-[.1em] text-neutral-400">Totales</p><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><b>{money(selected.subtotal)}</b></div>{Number(selected.deliveryFee) > 0 && <div className="flex justify-between"><span className="text-neutral-500">Domicilio</span><b>{money(selected.deliveryFee)}</b></div>}{Number(selected.discount) > 0 && <div className="flex justify-between text-emerald-700"><span>Descuento</span><b>- {money(selected.discount)}</b></div>}<div className="flex justify-between border-t border-dashed pt-3"><b>Total</b><b className="text-xl text-[var(--brand-red)]">{money(selected.total)}</b></div></div></section>
        <section className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.1em] text-neutral-400">Movimientos de pago</p><h3 className="mt-1 text-lg font-black">Pagos registrados</h3></div>{balance(selected) > 0 && <button onClick={() => void openPayment(selected)} className="rounded-xl bg-black px-3 py-2 text-[10px] font-black uppercase text-white">Registrar pago</button>}</div>
          <div className="mt-3 space-y-2">{selected.payments.filter((payment) => payment.status !== "CANCELED").length === 0 ? <p className="text-sm text-neutral-400">Sin movimientos.</p> : selected.payments.filter((payment) => payment.status !== "CANCELED").map((payment) => { const received = payment.status === "PAID"; return <div key={payment.id} className={`rounded-xl border p-3 ${received ? "border-emerald-100 bg-emerald-50/50" : "border-amber-100 bg-amber-50/50"}`}><div className="flex items-center justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{payment.method}</b><span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${received ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{received ? "Recibido" : "Medio previsto"}</span></div><p className="mt-1 text-xs text-neutral-500">{received && payment.paidAt ? `Recibido ${dateTime(payment.paidAt)}` : "Indicado desde POS · aún no ingresado a Caja"}{payment.reference ? ` · Ref. ${payment.reference}` : ""}</p>{received && payment.cashReceived != null && <p className="mt-1 text-[11px] text-neutral-400">Efectivo recibido {money(payment.cashReceived)}{payment.changeDue != null ? ` · Cambio ${money(payment.changeDue)}` : ""}</p>}</div><div className="flex items-center gap-2"><b className="text-sm">{money(payment.amount)}</b><button onClick={() => setConfirmAction({ kind: "delete-payment", order: selected, payment })} disabled={busy === selected.id} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-white text-red-600" title={received ? "Eliminar pago" : "Eliminar medio previsto"}><Icon name="trash" /></button></div></div></div>; })}</div>
          <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-emerald-50 px-3 py-2"><span className="block text-[10px] font-bold uppercase text-emerald-600">Recibido</span><b className="text-sm text-emerald-800">{money(paidAmount(selected))}</b></div><div className="rounded-xl bg-[#f7f5f2] px-3 py-2"><span className="block text-[10px] font-bold uppercase text-neutral-400">Saldo pendiente</span><b className={balance(selected) > 0 ? "text-sm text-amber-700" : "text-sm text-emerald-700"}>{money(balance(selected))}</b></div></div>
        </section>
      </div>
      <footer className="border-t border-neutral-200 bg-white p-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><button onClick={() => void openEdit(selected)} disabled={["COMPLETED", "CANCELED", "DELIVERED"].includes(selected.status)} className="flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold disabled:opacity-30"><Icon name="edit" /> Editar</button><button onClick={() => print(selected)} className="flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold"><Icon name="print" /> Imprimir</button>{["CONFIRMED", "PREPARING", "PREPARED"].includes(selected.status) ? <Link href="/cocina" className="flex h-11 items-center justify-center rounded-xl bg-black text-sm font-black text-white">Cocina</Link> : nextLabel(selected) ? <button onClick={() => void advance(selected)} className="h-11 rounded-xl bg-[var(--brand-red)] text-sm font-black text-white">{nextLabel(selected)}</button> : <span className="flex h-11 items-center justify-center rounded-xl bg-neutral-100 text-sm font-bold text-neutral-400">Cerrado</span>}</div></footer>
    </aside></div>}

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
            ? "Se borrarán definitivamente el pedido, sus productos y pagos relacionados. Esta acción no se puede deshacer."
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

    {paymentOrder && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-3" onClick={() => setPaymentOrder(null)}><div onClick={(event) => event.stopPropagation()} className="w-full max-w-[420px] overflow-hidden rounded-[22px] bg-white shadow-2xl"><div className="bg-black px-5 py-3.5 text-white"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/50">Registrar ingreso</p><div className="mt-0.5 flex items-end justify-between gap-3"><h3 className="text-[19px] font-black">Saldo {money(balance(paymentOrder))}</h3><span className="pb-0.5 text-[10px] text-white/50">Total o parcial</span></div></div><div className="space-y-2.5 p-4"><div><label className="mb-1 block text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Monto de este pago</label><input value={paymentAmount} onChange={(event) => { setPaymentAmount(event.target.value.replace(/\D/g, "")); setPaymentError(""); }} placeholder="Monto a registrar" inputMode="numeric" className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-base font-bold outline-none focus:border-neutral-400"/><div className="mt-1.5 flex items-center justify-between text-[11px]"><span className="text-neutral-500">Saldo después</span><b className="text-amber-700">{money(Math.max(0, balance(paymentOrder) - Number(paymentAmount || 0)))}</b></div></div><div><p className="mb-1 block text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Medio recibido</p><div className="grid grid-cols-2 gap-1.5">{settings?.paymentMethods.filter((method) => method.active).map((method) => <button key={method.id} onClick={() => { setPaymentMethodId(method.id); setCashReceived(""); setPaymentError(""); }} className={`h-10 rounded-xl border px-3 text-sm font-semibold ${paymentMethodId === method.id ? "border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]" : "border-neutral-200"}`}>{method.name}</button>)}</div></div>{settings?.paymentMethods.find((method) => method.id === paymentMethodId)?.name.toLowerCase() === "efectivo" && <div><label className="mb-1 block text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Efectivo entregado <span className="font-medium normal-case tracking-normal text-neutral-400">(opcional)</span></label><input value={cashReceived} onChange={(event) => { setCashReceived(event.target.value.replace(/\D/g, "")); setPaymentError(""); }} placeholder="Solo si deseas calcular cambio" inputMode="numeric" className="h-10 w-full rounded-xl border px-3 text-sm"/>{cashReceived && Number(cashReceived) >= Number(paymentAmount || 0) && <p className="mt-1 text-[11px] text-neutral-500">Cambio: <b>{money(Number(cashReceived) - Number(paymentAmount || 0))}</b></p>}</div>}<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Referencia (opcional)" className="h-10 w-full rounded-xl border px-3 text-sm" />{paymentError && <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">{paymentError}</p>}<div className="grid grid-cols-2 gap-2 pt-0.5"><button onClick={() => setPaymentOrder(null)} className="h-10 rounded-xl border text-sm font-semibold">Cancelar</button><button onClick={() => void registerPayment()} disabled={!paymentMethodId || !paymentAmount || Number(paymentAmount) <= 0 || Number(paymentAmount) > balance(paymentOrder) || busy === paymentOrder.id} className="h-10 rounded-xl bg-[var(--brand-red)] text-sm font-bold text-white disabled:opacity-50">Registrar pago</button></div></div></div></div>}

    {customerOrder && <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/65 p-4" onClick={() => { if (!customerSaving) setCustomerOrder(null); }}><div onClick={(event) => event.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl"><div className="flex items-center justify-between bg-black px-5 py-4 text-white"><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/50">Cliente del pedido</p><h3 className="text-xl font-black">{displayOrderCode(customerOrder)}</h3></div><button onClick={() => { if (!customerSaving) setCustomerOrder(null); }} className="h-9 w-9 rounded-xl bg-white/10"><Icon name="close" /></button></div><div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-5"><div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f7f5f2] p-1.5"><button onClick={() => { setCustomerMode("EDIT"); setCustomerError(""); }} disabled={!customerOrder.customer} className={`rounded-xl px-3 py-2.5 text-xs font-black ${customerMode === "EDIT" ? "bg-white shadow-sm" : "text-neutral-500"} disabled:opacity-40`}>Actualizar datos</button><button onClick={() => { setCustomerMode("CHANGE"); setCustomerError(""); }} className={`rounded-xl px-3 py-2.5 text-xs font-black ${customerMode === "CHANGE" ? "bg-white shadow-sm" : "text-neutral-500"}`}>Cambiar cliente</button></div>{customerMode === "EDIT" && customerOrder.customer ? <div className="mt-5 space-y-4"><div><p className="text-[10px] font-black uppercase tracking-[.1em] text-neutral-400">Mantiene el mismo historial</p><p className="mt-1 text-xs text-neutral-500">Úsalo cuando la misma persona cambió de número o necesitas corregir su nombre.</p></div><div><label className="mb-1.5 block text-xs font-black">Nombre</label><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="alento-input w-full rounded-xl px-4 py-3" /></div><div className="grid gap-3 sm:grid-cols-[110px_1fr]"><div><label className="mb-1.5 block text-xs font-black">Indicativo</label><select value={customerCountryCode} onChange={(event) => setCustomerCountryCode(event.target.value)} className="alento-input w-full rounded-xl px-3 py-3"><option>+57</option><option>+1</option><option>+34</option><option>+52</option><option>+51</option><option>+593</option></select></div><div><label className="mb-1.5 block text-xs font-black">Teléfono</label><input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} inputMode="tel" className="alento-input w-full rounded-xl px-4 py-3" /></div></div><div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">El cliente conserva sus pedidos anteriores y futuros porque se actualiza el mismo registro.</div></div> : <div className="mt-5"><div><p className="text-[10px] font-black uppercase tracking-[.1em] text-neutral-400">Buscar otro cliente</p><p className="mt-1 text-xs text-neutral-500">Busca por nombre, teléfono o correo y asígnalo únicamente a este pedido.</p></div><input value={customerQuery} onChange={(event) => void searchReplacementCustomers(event.target.value)} placeholder="Ej. Ivan, 3243755611..." className="alento-input mt-3 w-full rounded-xl px-4 py-3" />{customerMatches.length > 0 && <div className="mt-3 space-y-2">{customerMatches.map((customer) => <button key={customer.id} onClick={() => { setReplacementCustomer(customer); setReplacementAddressId(customer.addresses?.[0]?.id ?? null); setCustomerError(""); }} className={`w-full rounded-xl border p-3 text-left ${replacementCustomer?.id === customer.id ? "border-[var(--brand-red)] bg-red-50" : "border-neutral-200 bg-white"}`}><div className="flex items-center justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm">{customer.name}</b><p className="mt-0.5 text-xs text-neutral-500">{customer.countryCode} {customer.phone || "Sin teléfono"}</p></div>{replacementCustomer?.id === customer.id && <span className="rounded-full bg-[var(--brand-red)] px-2 py-1 text-[9px] font-black uppercase text-white">Seleccionado</span>}</div></button>)}</div>}{replacementCustomer && customerOrder.fulfillmentType === "DELIVERY" && <div className="mt-4 rounded-2xl border border-neutral-200 bg-[#faf9f7] p-4"><p className="text-[10px] font-black uppercase tracking-[.1em] text-neutral-400">Dirección para este domicilio</p>{replacementCustomer.addresses.length === 0 ? <p className="mt-2 text-xs font-semibold text-red-600">Este cliente no tiene una dirección registrada.</p> : <div className="mt-2 space-y-2">{replacementCustomer.addresses.map((address) => <button key={address.id} onClick={() => setReplacementAddressId(address.id)} className={`w-full rounded-xl border bg-white p-3 text-left text-sm ${replacementAddressId === address.id ? "border-[var(--brand-red)] ring-1 ring-[var(--brand-red)]" : "border-neutral-200"}`}>{address.address}</button>)}</div>}</div>}</div>}{customerError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{customerError}</p>}</div><div className="grid grid-cols-2 gap-2 border-t p-4"><button onClick={() => setCustomerOrder(null)} disabled={customerSaving} className="h-11 rounded-xl border font-bold disabled:opacity-50">Cancelar</button><button onClick={() => customerMode === "EDIT" ? void saveCurrentCustomer() : void changeOrderCustomer()} disabled={customerSaving || (customerMode === "CHANGE" && !replacementCustomer)} className="h-11 rounded-xl bg-[var(--brand-red)] font-black text-white disabled:opacity-50">{customerSaving ? "Guardando..." : customerMode === "EDIT" ? "Guardar cliente" : "Asignar cliente"}</button></div></div></div>}

    {editing && <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}><div onClick={(event) => event.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl"><div className="flex items-center justify-between bg-black px-5 py-4 text-white"><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/50">Editar pedido</p><h3 className="text-xl font-black">{displayOrderCode(editing)}</h3></div><button onClick={() => setEditing(null)} className="h-9 w-9 rounded-xl bg-white/10"><Icon name="close" /></button></div><div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-5"><p className="text-[10px] font-black uppercase tracking-[.1em] text-neutral-400">Modalidad</p><div className="mt-2 grid grid-cols-3 gap-2">{(["DELIVERY", "PICKUP", "STORE"] as FulfillmentType[]).map((type) => <button key={type} onClick={() => setFulfillment(type)} className={`rounded-xl border px-2 py-3 text-xs font-black ${fulfillment === type ? "border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]" : "border-neutral-200"}`}>{fulfillmentLabel(type)}</button>)}</div>{fulfillment === "DELIVERY" && <div className="mt-4"><p className="text-[10px] font-black uppercase tracking-[.1em] text-neutral-400">Tarifa domicilio</p><div className="mt-2 grid grid-cols-2 gap-2">{settings?.deliveryBands.filter((zone) => zone.active).map((zone) => <button key={zone.id} onClick={() => setZoneId(zone.id)} className={`rounded-xl border p-3 text-left ${zoneId === zone.id ? "border-[var(--brand-red)] bg-red-50" : "border-neutral-200"}`}><b className="text-sm">{zone.name}</b><p className="text-xs text-neutral-500">{money(zone.fee)}</p></button>)}</div></div>}<div className="mt-5 rounded-2xl border border-neutral-200 bg-[#faf9f7] p-4"><p className="text-[10px] font-black uppercase tracking-[.1em] text-neutral-400">Productos actuales</p><div className="mt-2 space-y-2">{editing.items.map((item) => <div key={item.id} className="rounded-xl border bg-white p-3"><div className="flex items-center justify-between gap-3"><div><b className="text-sm">{item.productName}</b><p className="text-xs text-neutral-500">{money(item.unitPrice)} c/u</p></div><div className="flex items-center gap-2"><button onClick={() => setQuantities((current) => ({ ...current, [item.id]: Math.max(0, (current[item.id] ?? item.quantity) - 1) }))} className="h-8 w-8 rounded-lg border"><Icon name="minus" /></button><b className="w-5 text-center text-sm">{quantities[item.id] ?? item.quantity}</b><button onClick={() => setQuantities((current) => ({ ...current, [item.id]: (current[item.id] ?? item.quantity) + 1 }))} className="h-8 w-8 rounded-lg border"><Icon name="plus" /></button></div></div>{isPizzaItem(item) && <div className="mt-2"><div className="mb-1 flex items-center justify-between"><label className="text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Nota para cocina</label><span className="text-[9px] text-neutral-400">{(itemNotes[item.id] ?? "").length}/120</span></div><input value={itemNotes[item.id] ?? ""} maxLength={120} onChange={(event) => setItemNotes((current) => ({ ...current, [item.id]: event.target.value }))} className="alento-input w-full rounded-lg px-3 py-2 text-xs" placeholder="Ej. Ligera en salsa" /></div>}</div>)}</div></div><div className="mt-5 rounded-2xl border border-neutral-200 p-4"><OrderEditStructuredAdder additions={structuredAdditions} onChange={setStructuredAdditions} /></div><div className="mt-5 rounded-2xl border border-neutral-200 bg-[#faf9f7] p-4"><p className="text-[10px] font-black uppercase tracking-[.1em] text-neutral-400">Agregar bebidas y otros</p><p className="mt-1 text-[11px] text-neutral-400">Productos simples que no necesitan configuración.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{simpleProducts.map((product) => <div key={product.id} className="flex items-center justify-between rounded-xl border bg-white p-3"><div className="min-w-0"><b className="block truncate text-sm">{product.name}</b><p className="text-xs text-neutral-500">{money(product.basePrice)}</p></div><div className="flex items-center gap-2"><button onClick={() => setAdditions((current) => ({ ...current, [product.id]: Math.max(0, (current[product.id] ?? 0) - 1) }))} className="h-8 w-8 rounded-lg border"><Icon name="minus" /></button><b className="w-4 text-center text-sm">{additions[product.id] ?? 0}</b><button onClick={() => setAdditions((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }))} className="h-8 w-8 rounded-lg border"><Icon name="plus" /></button></div></div>)}</div></div>{editError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{editError}</p>}</div><div className="grid grid-cols-2 gap-2 border-t p-4"><button onClick={() => setEditing(null)} className="h-11 rounded-xl border font-bold">Cancelar</button><button onClick={() => void saveEdit()} disabled={saving} className="h-11 rounded-xl bg-[var(--brand-red)] font-black text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar cambios"}</button></div></div></div>}
  </main>;
}
