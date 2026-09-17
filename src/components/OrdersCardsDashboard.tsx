"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";
import {
  fulfillmentLabel,
  nextStatus,
  statusLabel,
  type FulfillmentType,
  type OrderStatus,
} from "@/lib/orderWorkflow";

type CustomerAddress = { id: number; address: string };
type OrderItem = {
  id: number;
  productId?: number | null;
  productName: string;
  quantity: number;
  preparedQuantity?: number;
  unitPrice: number | string;
  lineTotal: number | string;
  configuration: unknown;
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
};
type Order = {
  id: number;
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
type Settings = {
  deliveryBands: { id: string; name: string; fee: number; active: boolean }[];
  paymentMethods: { id: string; name: string; active: boolean }[];
};
type CatalogProduct = { id: number; name: string; type: string; basePrice: number | null };
type CatalogResponse = { categories: { products: CatalogProduct[] }[] };
type Filter = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELED";

function formatCOP(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}
function formatDate(value: string) {
  return new Date(value).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function orderCode(id: number) { return `ALT-${String(id).padStart(6, "0")}`; }
function isPaid(order: Order) { return order.payments[0]?.status === "PAID"; }
function statusTone(status: OrderStatus) {
  if (status === "PREPARING") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "PREPARED") return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "READY") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "OUT_FOR_DELIVERY") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "ARRIVED") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (status === "DELIVERED") return "border-teal-200 bg-teal-50 text-teal-700";
  if (status === "COMPLETED") return "border-neutral-200 bg-neutral-100 text-neutral-700";
  if (status === "CANCELED") return "border-red-200 bg-red-50 text-red-700";
  return "border-neutral-200 bg-neutral-50 text-neutral-700";
}
function nextActionLabel(order: Order) {
  const next = nextStatus(order.status, order.fulfillmentType);
  if (!next) return null;
  if (next === "OUT_FOR_DELIVERY") return "En camino";
  if (next === "ARRIVED") return "Ha llegado";
  if (next === "DELIVERED") return "Entregado";
  if (next === "COMPLETED") return "Finalizar";
  return statusLabel(next);
}
function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[char] ?? char));
}

function Icon({ name }: { name: "search" | "refresh" | "print" | "info" | "close" | "edit" | "money" | "trash" | "download" | "minus" | "plus" }) {
  const c = "h-[18px] w-[18px]";
  if (name === "search") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
  if (name === "refresh") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6.3 6.3L4 11M20 13l-2.3 4.7A7 7 0 0 1 5.5 15"/></svg>;
  if (name === "print") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>;
  if (name === "info") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>;
  if (name === "close") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="m6 6 12 12M18 6 6 18"/></svg>;
  if (name === "edit") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>;
  if (name === "money") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><circle cx="12" cy="12" r="9"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8M12 6v12"/></svg>;
  if (name === "trash") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>;
  if (name === "download") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>;
  if (name === "minus") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M5 12h14"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M12 5v14M5 12h14"/></svg>;
}

function OrderProduct({ item }: { item: OrderItem }) {
  const details = presentOrderItemConfiguration(item.configuration);
  return <div className="rounded-xl border border-neutral-200 bg-[#faf9f7] p-3">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="text-sm">{item.quantity} × {item.productName}</b>{details.length > 0 && <div className="mt-1.5 grid gap-x-3 gap-y-0.5 sm:grid-cols-2">{details.map((detail, index) => <p key={`${detail.label}-${index}`} className="text-[11px] leading-4 text-neutral-600"><span className="font-bold text-neutral-400">{detail.label}</span> · {detail.value}</p>)}</div>}</div><b className="shrink-0 text-sm">{formatCOP(item.lineTotal)}</b></div>
  </div>;
}

export default function OrdersCardsDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<Order | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [editing, setEditing] = useState<Order | null>(null);
  const [editFulfillment, setEditFulfillment] = useState<FulfillmentType>("PICKUP");
  const [editZoneId, setEditZoneId] = useState("");
  const [editQuantities, setEditQuantities] = useState<Record<number, number>>({});
  const [additions, setAdditions] = useState<Record<number, number>>({});
  const [editPaymentMethodId, setEditPaymentMethodId] = useState("");
  const [editCashReceived, setEditCashReceived] = useState("");
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentError, setPaymentError] = useState("");

  async function loadOrders(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar los pedidos.");
      const nextOrders = (data.orders ?? []) as Order[];
      setOrders(nextOrders);
      setSelected((current) => current ? nextOrders.find((order) => order.id === current.id) ?? null : null);
      setPaymentOrder((current) => current ? nextOrders.find((order) => order.id === current.id) ?? null : null);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar los pedidos.");
    } finally { if (!silent) setLoading(false); }
  }

  async function ensureSettings() {
    if (settings) return settings;
    const response = await fetch("/api/settings", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No fue posible cargar la configuración.");
    setSettings(data.settings);
    return data.settings as Settings;
  }

  useEffect(() => {
    void loadOrders();
    const timer = window.setInterval(() => void loadOrders(true), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (filter === "ACTIVE" && ["COMPLETED", "CANCELED"].includes(order.status)) return false;
      if (filter === "COMPLETED" && order.status !== "COMPLETED") return false;
      if (filter === "CANCELED" && order.status !== "CANCELED") return false;
      if (!value) return true;
      return [orderCode(order.id), order.customer?.name, order.customer?.phone, statusLabel(order.status), fulfillmentLabel(order.fulfillmentType), order.payments[0]?.method].filter(Boolean).some((field) => String(field).toLowerCase().includes(value));
    });
  }, [orders, query, filter]);

  const simpleProducts = useMemo(() => {
    const all = catalog?.categories.flatMap((category) => category.products) ?? [];
    const unique = new Map<number, CatalogProduct>();
    all.forEach((product) => { if (!["PIZZA_SINGLE", "PIZZA_TWO_FLAVORS", "COMBO", "MODIFIER", "INTERNAL"].includes(product.type) && product.basePrice != null) unique.set(product.id, product); });
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [catalog]);

  async function advance(order: Order) {
    const next = nextStatus(order.status, order.fulfillmentType);
    if (!next || ["PREPARING", "PREPARED", "CONFIRMED"].includes(order.status)) return;
    setBusyId(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible actualizar el estado.");
      await loadOrders(true);
    } catch (actionError) { window.alert(actionError instanceof Error ? actionError.message : "No fue posible actualizar el estado."); }
    finally { setBusyId(null); }
  }

  function printOrder(order: Order) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.src = `/pedidos/${order.id}/imprimir?autoprint=1&embedded=1`;
    document.body.appendChild(iframe);
    window.setTimeout(() => iframe.remove(), 30000);
  }

  function downloadReceipt(order: Order) {
    const payment = order.payments[0];
    const productRows = order.items.map((item) => {
      const details = presentOrderItemConfiguration(item.configuration).map((detail) => `${escapeHtml(detail.label)}: ${escapeHtml(detail.value)}`).join(" · ");
      return `<div class="item"><b>${item.quantity} × ${escapeHtml(item.productName)}</b><span>${formatCOP(item.lineTotal)}</span>${details ? `<small>${details}</small>` : ""}</div>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${orderCode(order.id)}</title><style>body{font-family:Arial,sans-serif;max-width:80mm;margin:0 auto;padding:8mm;color:#111}.center{text-align:center}.rule{border-top:1px dashed #222;margin:12px 0}.item{display:grid;grid-template-columns:1fr auto;gap:4px;margin:10px 0}.item small{grid-column:1/-1;color:#555}.row{display:flex;justify-content:space-between;margin:5px 0}h1{font-size:22px}h2{font-size:28px;margin:8px 0}.total{font-size:20px;font-weight:800}</style></head><body><div class="center"><h1>ALENTÓ PIZZA</h1><div>${formatDate(order.createdAt)}</div><h2>${orderCode(order.id)}</h2><b>${escapeHtml(fulfillmentLabel(order.fulfillmentType))}</b><p>${escapeHtml(order.customer?.name || "Cliente ocasional")}</p>${order.address?.address ? `<p>${escapeHtml(order.address.address)}</p>` : ""}</div><div class="rule"></div>${productRows}<div class="rule"></div><div class="row"><span>Subtotal</span><b>${formatCOP(order.subtotal)}</b></div><div class="row"><span>Domicilio</span><b>${formatCOP(order.deliveryFee)}</b></div><div class="row"><span>Descuento</span><b>-${formatCOP(order.discount)}</b></div><div class="row total"><span>Total</span><span>${formatCOP(order.total)}</span></div><div class="rule"></div><div class="center"><b>${payment?.status === "PAID" ? "PAGADO" : "PAGO PENDIENTE"}</b><p>${escapeHtml(payment?.method || "Sin medio")}</p></div></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${orderCode(order.id)}-comprobante.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function deleteTestOrder(order: Order) {
    if (!window.confirm(`¿Eliminar ${orderCode(order.id)} como pedido de prueba? Se borrarán la orden, productos y pago pendiente. Esta acción no se puede deshacer.`)) return;
    setBusyId(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}?test=1`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible eliminar el pedido.");
      if (selected?.id === order.id) setSelected(null);
      await loadOrders(true);
    } catch (actionError) { window.alert(actionError instanceof Error ? actionError.message : "No fue posible eliminar el pedido."); }
    finally { setBusyId(null); }
  }

  async function openPayment(order: Order) {
    try {
      const cfg = await ensureSettings();
      const current = order.payments[0];
      const matching = cfg.paymentMethods.find((method) => method.name === current?.method) ?? cfg.paymentMethods.find((method) => method.active);
      setPaymentOrder(order);
      setPaymentMethodId(matching?.id ?? "");
      setCashReceived(current?.cashReceived == null ? "" : String(current.cashReceived));
      setPaymentReference(current?.reference ?? "");
      setPaymentError("");
    } catch (openError) { window.alert(openError instanceof Error ? openError.message : "No fue posible abrir el pago."); }
  }

  async function registerPayment() {
    if (!paymentOrder) return;
    setBusyId(paymentOrder.id);
    setPaymentError("");
    try {
      const response = await fetch(`/api/orders/${paymentOrder.id}/payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentMethodId, cashReceived: cashReceived ? Number(cashReceived) : null, reference: paymentReference }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible registrar el pago.");
      setPaymentOrder(null);
      await loadOrders(true);
    } catch (saveError) { setPaymentError(saveError instanceof Error ? saveError.message : "No fue posible registrar el pago."); }
    finally { setBusyId(null); }
  }

  async function openEdit(order: Order) {
    try {
      const [orderResponse, settingsResponse, catalogResponse] = await Promise.all([fetch(`/api/orders/${order.id}`, { cache: "no-store" }), fetch("/api/settings", { cache: "no-store" }), fetch("/api/catalog", { cache: "no-store" })]);
      const orderData = await orderResponse.json();
      const settingsData = await settingsResponse.json();
      const catalogData = await catalogResponse.json();
      if (!orderResponse.ok) throw new Error(orderData.error || "No fue posible cargar el pedido.");
      const fullOrder = orderData.order as Order;
      setSettings(settingsData.settings);
      setCatalog(catalogData);
      setEditing(fullOrder);
      setEditFulfillment(fullOrder.fulfillmentType);
      setEditZoneId(fullOrder.deliveryZoneId || settingsData.settings.deliveryBands?.find((item: { active: boolean }) => item.active)?.id || "");
      setEditQuantities(Object.fromEntries(fullOrder.items.map((item) => [item.id, item.quantity])));
      setAdditions({});
      const currentMethod = settingsData.settings.paymentMethods?.find((method: { name: string }) => method.name === fullOrder.payments[0]?.method);
      setEditPaymentMethodId(currentMethod?.id || "");
      setEditCashReceived(fullOrder.payments[0]?.cashReceived == null ? "" : String(fullOrder.payments[0].cashReceived));
      setEditError("");
    } catch (openError) { window.alert(openError instanceof Error ? openError.message : "No fue posible abrir la edición."); }
  }

  async function saveEdit() {
    if (!editing) return;
    setSavingEdit(true); setEditError("");
    try {
      const response = await fetch(`/api/orders/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fulfillmentType: editFulfillment, addressId: editFulfillment === "DELIVERY" ? editing.address?.id ?? editing.customer?.addresses?.[0]?.id ?? null : null, deliveryZoneId: editFulfillment === "DELIVERY" ? editZoneId : null, paymentMethodId: editPaymentMethodId || null, cashReceived: editCashReceived ? Number(editCashReceived) : null, items: editing.items.map((item) => ({ id: item.id, quantity: editQuantities[item.id] ?? item.quantity })), additions: Object.entries(additions).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId: Number(productId), quantity })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible guardar los cambios.");
      setEditing(null);
      await loadOrders(true);
    } catch (saveError) { setEditError(saveError instanceof Error ? saveError.message : "No fue posible guardar los cambios."); }
    finally { setSavingEdit(false); }
  }

  const activeCount = orders.filter((order) => !["COMPLETED", "CANCELED"].includes(order.status)).length;

  return <main className="p-4 md:p-6 xl:p-8">
    <div className="mx-auto max-w-[1600px] space-y-4">
      <section className="rounded-[26px] bg-[radial-gradient(circle_at_90%_30%,rgba(229,28,17,.18),transparent_28%),linear-gradient(135deg,#0b0b0c,#171718)] px-6 py-5 text-white shadow-[0_18px_48px_rgba(20,16,14,.1)] md:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Operación</p><h1 className="mt-0.5 text-3xl font-black tracking-[-0.035em]">Pedidos</h1><p className="mt-0.5 text-sm text-white/65">Una orden, un estado actual y una acción clara.</p></div><div className="flex items-center gap-2"><span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold">{activeCount} activos</span><button onClick={() => void loadOrders()} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08]" aria-label="Actualizar"><Icon name="refresh" /></button></div></div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-sm"><div className="flex flex-col gap-2 xl:flex-row xl:items-center"><div className="relative min-w-0 flex-1"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"><Icon name="search" /></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pedido, cliente, teléfono, pago o estado" className="h-11 w-full rounded-xl border border-neutral-200 bg-[#faf9f7] pl-11 pr-4 text-sm outline-none focus:border-neutral-400" /></div><div className="flex gap-1.5 overflow-x-auto">{([ ["ALL", "Todos"], ["ACTIVE", "Activos"], ["COMPLETED", "Finalizados"], ["CANCELED", "Cancelados"] ] as [Filter, string][]).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold ${filter === value ? "bg-black text-white" : "border border-neutral-200 bg-white text-neutral-600"}`}>{label}</button>)}</div></div></section>

      {loading ? <div className="rounded-2xl border bg-white p-8 text-center text-sm text-neutral-500">Cargando pedidos...</div> : error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : filtered.length === 0 ? <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-neutral-400">No hay pedidos para mostrar.</div> :
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filtered.map((order) => {
          const payment = order.payments[0]; const paid = isPaid(order); const busy = busyId === order.id; const kitchenManaged = ["CONFIRMED", "PREPARING", "PREPARED"].includes(order.status); const actionLabel = nextActionLabel(order); const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
          return <article key={order.id} onClick={() => setSelected(order)} className="group cursor-pointer rounded-[20px] border border-neutral-200 bg-white p-3.5 shadow-[0_8px_24px_rgba(25,22,19,.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(25,22,19,.08)]">
            <div className="flex items-center justify-between gap-2"><span className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-black uppercase ${statusTone(order.status)}`}>{statusLabel(order.status)}</span><span className="rounded-lg border border-neutral-200 bg-[#faf9f7] px-2.5 py-1.5 text-[10px] font-black uppercase">{fulfillmentLabel(order.fulfillmentType)}</span></div>
            <div className="mt-3 flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] text-neutral-400">{formatDate(order.createdAt)}</p><h2 className="mt-0.5 text-xl font-black tracking-[-0.035em]">{orderCode(order.id)}</h2><p className="mt-0.5 text-[10px] text-neutral-400">{order.items.length} línea{order.items.length === 1 ? "" : "s"} · {units} producto{units === 1 ? "" : "s"}</p></div><b className="shrink-0 text-base text-[var(--brand-red)]">{formatCOP(order.total)}</b></div>
            <div className="mt-3 border-t border-neutral-100 pt-3"><p className="truncate text-base font-black">{order.customer?.name || "Cliente ocasional"}</p><p className="mt-0.5 truncate text-xs text-neutral-500">{order.customer?.phone ? `${order.customer.countryCode} ${order.customer.phone}` : "Sin teléfono"}{order.fulfillmentType === "DELIVERY" && order.address?.address ? ` · ${order.address.address}` : ""}</p></div>
            <div className="mt-3 flex items-center justify-between gap-2"><button onClick={(event) => { event.stopPropagation(); if (!paid) void openPayment(order); }} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase ${paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{paid ? `Pagado · ${payment?.method}` : `Pendiente · ${payment?.method || "pago"}`}</button><span className="text-[10px] font-bold text-neutral-400">{paid && payment?.paidAt ? new Date(payment.paidAt).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) : ""}</span></div>
            <div className="mt-3 flex items-center gap-1.5 border-t border-neutral-100 pt-3" onClick={(event) => event.stopPropagation()}>
              <button onClick={() => setSelected(order)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200" title="Ver detalle"><Icon name="info" /></button>
              <button onClick={() => void openEdit(order)} disabled={["COMPLETED", "CANCELED", "DELIVERED"].includes(order.status)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 disabled:opacity-30" title="Editar pedido"><Icon name="edit" /></button>
              <button onClick={() => printOrder(order)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200" title="Imprimir 80 mm"><Icon name="print" /></button>
              <button onClick={() => downloadReceipt(order)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200" title="Descargar comprobante"><Icon name="download" /></button>
              {!paid && <button onClick={() => void deleteTestOrder(order)} disabled={busy} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 disabled:opacity-30" title="Eliminar pedido de prueba"><Icon name="trash" /></button>}
              <div className="ml-auto min-w-0 flex-1">{kitchenManaged ? <Link href="/cocina" className="flex h-9 items-center justify-center rounded-lg bg-black px-2 text-[10px] font-black text-white">Cocina</Link> : actionLabel ? <button disabled={busy} onClick={() => void advance(order)} className="h-9 w-full rounded-lg bg-[var(--brand-red)] px-2 text-[10px] font-black text-white disabled:opacity-50">{busy ? "..." : actionLabel}</button> : <span className="flex h-9 items-center justify-center rounded-lg bg-neutral-100 px-2 text-[10px] font-bold text-neutral-400">Cerrado</span>}</div>
            </div>
          </article>;
        })}</div>}
    </div>

    {selected && <div className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-[3px]" onClick={() => setSelected(null)}><aside onClick={(event) => event.stopPropagation()} className="absolute inset-y-0 right-0 flex w-full max-w-[590px] flex-col overflow-hidden bg-[#f5f2ee] shadow-[-24px_0_70px_rgba(0,0,0,.24)]">
      <header className="flex items-start justify-between gap-4 border-b-2 border-[var(--brand-red)] bg-[radial-gradient(circle_at_90%_20%,rgba(229,28,17,.22),transparent_28%),linear-gradient(135deg,#0b0b0c,#171718)] px-5 py-5 text-white"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">Detalle del pedido</p><h2 className="mt-1 text-2xl font-black">{orderCode(selected.id)}</h2><div className="mt-3 flex gap-2"><span className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase ${statusTone(selected.status)}`}>{statusLabel(selected.status)}</span><span className="rounded-lg border border-white/15 bg-white/[0.08] px-2.5 py-1 text-[10px] font-black uppercase">{fulfillmentLabel(selected.fulfillmentType)}</span></div></div><button onClick={() => setSelected(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08]"><Icon name="close" /></button></header>
      <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5"><section className="rounded-2xl border border-neutral-200 bg-white p-4"><div className="grid gap-4 sm:grid-cols-2"><div><p className="text-[9px] font-bold uppercase text-neutral-400">Fecha</p><b className="mt-1 block text-sm">{formatDate(selected.createdAt)}</b></div><div><p className="text-[9px] font-bold uppercase text-neutral-400">Cliente</p><b className="mt-1 block text-sm">{selected.customer?.name || "Cliente ocasional"}</b>{selected.customer?.phone && <p className="text-xs text-neutral-500">{selected.customer.countryCode} {selected.customer.phone}</p>}</div></div>{selected.address?.address && <div className="mt-4 border-t pt-3"><p className="text-[9px] font-bold uppercase text-neutral-400">Dirección</p><b className="mt-1 block text-sm">{selected.address.address}</b></div>}</section><section className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4"><div className="flex items-center justify-between"><h3 className="text-lg font-black">Productos</h3><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold text-neutral-500">{selected.items.length} líneas</span></div><div className="mt-3 space-y-2">{selected.items.map((item) => <OrderProduct key={item.id} item={item} />)}</div></section><section className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4"><div className="grid gap-2 text-sm"><div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><b>{formatCOP(selected.subtotal)}</b></div><div className="flex justify-between"><span className="text-neutral-500">Domicilio</span><b>{formatCOP(selected.deliveryFee)}</b></div>{Number(selected.discount) > 0 && <div className="flex justify-between text-emerald-700"><span>Descuento</span><b>− {formatCOP(selected.discount)}</b></div>}<div className="mt-2 flex justify-between border-t border-dashed pt-3"><b>Total</b><b className="text-xl text-[var(--brand-red)]">{formatCOP(selected.total)}</b></div></div><div className={`mt-4 rounded-xl p-3 text-sm ${isPaid(selected) ? "bg-emerald-50" : "bg-amber-50"}`}><div className="flex justify-between"><span>{isPaid(selected) ? "Pago recibido" : "Pago pendiente"}</span><b>{selected.payments[0]?.method || "Sin medio"}</b></div>{selected.payments[0]?.reference && <p className="mt-1 text-xs">Ref. {selected.payments[0].reference}</p>}</div></section></div>
      <footer className="border-t bg-white p-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><button onClick={() => void openEdit(selected)} disabled={["COMPLETED", "CANCELED", "DELIVERED"].includes(selected.status)} className="min-h-11 rounded-xl border text-sm font-bold disabled:opacity-30">Editar</button><button onClick={() => printOrder(selected)} className="min-h-11 rounded-xl border text-sm font-bold">Imprimir</button><button onClick={() => downloadReceipt(selected)} className="min-h-11 rounded-xl border text-sm font-bold">Descargar</button>{!isPaid(selected) ? <button onClick={() => void openPayment(selected)} className="min-h-11 rounded-xl bg-[var(--brand-red)] text-sm font-black text-white">Registrar pago</button> : <Link href="/caja" className="flex min-h-11 items-center justify-center rounded-xl bg-black text-sm font-black text-white">Ver en Caja</Link>}</div></footer>
    </aside></div>}

    {paymentOrder && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4" onClick={() => setPaymentOrder(null)}><div onClick={(event) => event.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl"><header className="bg-black px-5 py-4 text-white"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">Caja</p><h3 className="mt-1 text-xl font-black">Registrar pago · {orderCode(paymentOrder.id)}</h3></header><div className="p-5"><p className="text-sm text-neutral-500">Total a recibir</p><p className="mt-1 text-3xl font-black text-[var(--brand-red)]">{formatCOP(paymentOrder.total)}</p><label className="mt-5 block text-xs font-black uppercase text-neutral-500">Medio recibido</label><div className="mt-2 grid grid-cols-2 gap-2">{settings?.paymentMethods.filter((method) => method.active).map((method) => <button key={method.id} onClick={() => setPaymentMethodId(method.id)} className={`rounded-xl border px-3 py-3 text-sm font-bold ${paymentMethodId === method.id ? "border-black bg-black text-white" : "border-neutral-200"}`}>{method.name}</button>)}</div>{settings?.paymentMethods.find((method) => method.id === paymentMethodId)?.name.toLowerCase() === "efectivo" && <><label className="mt-4 block text-xs font-black uppercase text-neutral-500">Paga con</label><input type="number" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} className="mt-2 h-12 w-full rounded-xl border px-3" placeholder={String(paymentOrder.total)} /></>}<label className="mt-4 block text-xs font-black uppercase text-neutral-500">Referencia / comprobante <span className="font-normal text-neutral-400">opcional</span></label><input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className="mt-2 h-12 w-full rounded-xl border px-3" placeholder="Ej. referencia Nequi" />{paymentError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{paymentError}</p>}</div><footer className="flex gap-2 border-t p-4"><button onClick={() => setPaymentOrder(null)} className="min-h-11 flex-1 rounded-xl border font-bold">Cancelar</button><button disabled={busyId === paymentOrder.id || !paymentMethodId} onClick={() => void registerPayment()} className="min-h-11 flex-1 rounded-xl bg-[var(--brand-red)] font-black text-white disabled:opacity-40">Registrar ingreso</button></footer></div></div>}

    {editing && <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/55 p-3" onClick={() => setEditing(null)}><div onClick={(event) => event.stopPropagation()} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] bg-[#f5f2ee] shadow-2xl"><header className="flex items-center justify-between bg-black px-5 py-4 text-white"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">Editar pedido</p><h3 className="mt-1 text-xl font-black">{orderCode(editing.id)}</h3></div><button onClick={() => setEditing(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10"><Icon name="close" /></button></header><div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5"><section className="rounded-2xl border bg-white p-4"><p className="text-xs font-black uppercase text-neutral-500">Tipo de pedido</p><div className="mt-2 grid grid-cols-3 gap-2">{(["DELIVERY", "PICKUP", "STORE"] as FulfillmentType[]).map((type) => <button key={type} onClick={() => setEditFulfillment(type)} className={`rounded-xl border px-3 py-3 text-xs font-black uppercase ${editFulfillment === type ? "border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]" : "border-neutral-200"}`}>{fulfillmentLabel(type)}</button>)}</div>{editFulfillment === "DELIVERY" && <div className="mt-3"><p className="text-xs font-black uppercase text-neutral-500">Tarifa de domicilio</p><select value={editZoneId} onChange={(event) => setEditZoneId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm">{settings?.deliveryBands.filter((band) => band.active).map((band) => <option key={band.id} value={band.id}>{band.name} · {formatCOP(band.fee)}</option>)}</select></div>}</section><section className="mt-3 rounded-2xl border bg-white p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase text-neutral-500">Productos actuales</p><p className="mt-1 text-xs text-neutral-400">Cambiar productos hace que el pedido vuelva a Cocina en preparación.</p></div></div><div className="mt-3 space-y-2">{editing.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border bg-[#faf9f7] p-3"><div className="min-w-0"><b className="text-sm">{item.productName}</b><p className="text-xs text-neutral-400">{formatCOP(item.unitPrice)} c/u</p></div><div className="flex items-center gap-2"><button onClick={() => setEditQuantities((current) => ({ ...current, [item.id]: Math.max(0, (current[item.id] ?? item.quantity) - 1) }))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white"><Icon name="minus" /></button><b className="w-5 text-center text-sm">{editQuantities[item.id] ?? item.quantity}</b><button onClick={() => setEditQuantities((current) => ({ ...current, [item.id]: (current[item.id] ?? item.quantity) + 1 }))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white"><Icon name="plus" /></button></div></div>)}</div></section>{simpleProducts.length > 0 && <section className="mt-3 rounded-2xl border bg-white p-4"><p className="text-xs font-black uppercase text-neutral-500">Agregar producto simple</p><p className="mt-1 text-xs text-neutral-400">Bebidas, antojos y otros productos sin configuración especial.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{simpleProducts.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><b className="text-sm">{product.name}</b><p className="text-xs text-neutral-400">{formatCOP(product.basePrice)}</p></div><div className="flex items-center gap-2"><button onClick={() => setAdditions((current) => ({ ...current, [product.id]: Math.max(0, (current[product.id] ?? 0) - 1) }))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"><Icon name="minus" /></button><b className="w-4 text-center text-sm">{additions[product.id] ?? 0}</b><button onClick={() => setAdditions((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"><Icon name="plus" /></button></div></div>)}</div></section>}<section className="mt-3 rounded-2xl border bg-white p-4"><p className="text-xs font-black uppercase text-neutral-500">Medio previsto de pago</p><select value={editPaymentMethodId} onChange={(event) => setEditPaymentMethodId(event.target.value)} disabled={editing.payments[0]?.status === "PAID"} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm disabled:bg-neutral-100">{settings?.paymentMethods.filter((method) => method.active).map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select>{editing.payments[0]?.status === "PAID" && <p className="mt-2 text-xs text-emerald-700">El pago ya fue recibido; el medio queda bloqueado para conservar trazabilidad.</p>}</section>{editError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{editError}</p>}</div><footer className="flex gap-2 border-t bg-white p-4"><button onClick={() => setEditing(null)} className="min-h-11 flex-1 rounded-xl border font-bold">Cancelar</button><button disabled={savingEdit} onClick={() => void saveEdit()} className="min-h-11 flex-1 rounded-xl bg-[var(--brand-red)] font-black text-white disabled:opacity-40">{savingEdit ? "Guardando..." : "Guardar cambios"}</button></footer></div></div>}
  </main>;
}
