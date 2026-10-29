"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";
import { fulfillmentLabel, nextStatus, statusLabel, type FulfillmentType, type OrderStatus } from "@/lib/orderWorkflow";

type CustomerAddress = { id: number; address: string };
type OrderItem = { id: number; productName: string; quantity: number; unitPrice: number | string; lineTotal: number | string; configuration: unknown };
type Payment = { id: number; method: string; amount: number | string; cashReceived: number | string | null; changeDue: number | string | null; status: string; reference?: string | null; paidAt?: string | null };
type Order = {
  id: number; status: OrderStatus; fulfillmentType: FulfillmentType; subtotal: number | string; deliveryFee: number | string; discount: number | string; total: number | string;
  couponName: string | null; deliveryZoneId?: string | null; deliveryZoneName: string | null; createdAt: string;
  customer: { id: number; name: string; countryCode: string; phone: string | null; addresses?: CustomerAddress[] } | null;
  address: { id: number; address: string } | null; items: OrderItem[]; payments: Payment[];
};
type Settings = { deliveryBands: { id: string; name: string; fee: number; active: boolean }[]; paymentMethods: { id: string; name: string; active: boolean }[] };
type CatalogProduct = { id: number; name: string; type: string; basePrice: number | null };
type CatalogResponse = { categories: { products: CatalogProduct[] }[] };
type Filter = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELED";

const money = (value: number | string | null | undefined) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0,, maximumFractionDigits: 0 }).format(Number(value ?? 0));
const code = (id: number) => `ALT-${String(id).padStart(6, "0")}`;
const dateTime = (value: string) => new Date(value).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });
const paidAmount = (order: Order) => order.payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount), 0);
const balance = (order: Order) => Math.max(0, Number(order.total) - paidAmount(order));
const paidInFull = (order: Order) => balance(order) <= 0 && Number(order.total) > 0;
const paymentHint = (order: Order) => order.payments.find((p) => p.status === "PENDING" || p.status === "PARTIAL")?.method ?? order.payments[order.payments.length - 1]?.method ?? "Pago";

function statusTone(status: OrderStatus) {
  if (status === "PREPARING") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "PREPARED") return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "READY") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "OUT_FOR_DELIVERY") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "ARRIVED") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (status === "DELIVERED") return "border-teal-200 bg-teal-50 text-teal-700";
  if (status === "CANCELED") return "border-red-200 bg-red-50 text-red-700";
  return "border-neutral-200 bg-neutral-100 text-neutral-700";
}

function nextLabel(order: Order) {
  const next = nextStatus(order.status, order.fulfillmentType);
  if (!next) return null;
  if (next === "OUT_FOR_DELIVERY") return "En camino";
  if (next === "ARRIVED") return "Ha llegado";
  if (next === "DELIVERED") return "Entregado";
  if (next === "COMPLETED") return "Finalizar";
  return statusLabel(next);
}

function Icon({ name }: { name: "search" | "refresh" | "print" | "info" | "close" | "edit" | "trash" | "download" | "minus" | "plus" }) {
  const c = "h-[17px] w-[17px]";
  if (name === "search") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
  if (name === "refresh") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6.3 6.3L4 11M20 13l-2.3 4.7A7 7 0 0 1 5.5 15"/></svg>;
  if (name === "print") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>;
  if (name === "info") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>;
  if (name === "close") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="m6 6 12 12M18 6 6 18"/></svg>;
  if (name === "edit") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>;
  if (name === "trash") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>;
  if (name === "download") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>;
  if (name === "minus") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M5 12h14"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={c}><path d="M12 5v14M5 12h14"/></svg>;
}

function ProductRow({ item }: { item: OrderItem }) {
  const details = presentOrderItemConfiguration(item.configuration);
  return <div className="rounded-xl border border-neutral-200 bg-[#faf9f7] p-3"><div className="flex justify-between gap-3"><div className="min-w-0"><b className="text-sm">{item.quantity} × {item.productName}</b>{details.length > 0 && <div className="mt-1 grid gap-x-3 sm:grid-cols-2">{details.map((d, i) => <p key={`${d.label}-${i}`} className="text-[11px] text-neutral-600"><span className="font-bold text-neutral-400">{d.label}</span> · {d.value}</p>)}</div>}</div><b className="shrink-0 text-sm">{money(item.lineTotal)}</b></div></div>;
}

export default function OrdersCardsDashboardV2() {
  const [orders, setOrders] = useState<Order[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState<Filter>("ALL"); const [selected, setSelected] = useState<Order | null>(null); const [busy, setBusy] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null); const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null); const [paymentMethodId, setPaymentMethodId] = useState(""); const [cashReceived, setCashReceived] = useState(""); const [reference, setReference] = useState(""); const [paymentError, setPaymentError] = useState("");
  const [editing, setEditing] = useState<Order | null>(null); const [fulfillment, setFulfillment] = useState<FulfillmentType>("PICKUP"); const [zoneId, setZoneId] = useState(""); const [quantities, setQuantities] = useState<Record<number, number>>({}); const [additions, setAdditions] = useState<Record<number, number>>({}); const [editError, setEditError] = useState(""); const [saving, setSaving] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try { const r = await fetch("/api/orders", { cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "No fue posible cargar los pedidos."); const next = (d.orders ?? []) as Order[]; setOrders(next); setSelected((v) => v ? next.find((o) => o.id === v.id) ?? null : null); setPaymentOrder((v) => v ? next.find((o) => o.id === v.id) ?? null : null); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "No fue posible cargar los pedidos."); }
    finally { if (!silent) setLoading(false); }
  }

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(true), 15000); return () => window.clearInterval(timer); }, []);

  async function loadSettings() {
    if (settings) return settings;
    const r = await fetch("/api/settings", { cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "No fue posible cargar la configuración."); setSettings(d.settings); return d.settings as Settings;
  }

  const visible = useMemo(() => orders.filter((order) => {
    if (filter === "ACTIVE" && ["COMPLETED", "CANCELED"].includes(order.status)) return false;
    if (filter === "COMPLETED" && order.status !== "COMPLETED") return false;
    if (filter === "CANCELED" && order.status !== "CANCELED") return false;
    const q = query.trim().toLowerCase(); if (!q) return true;
    return [code(order.id), order.customer?.name, order.customer?.phone, statusLabel(order.status), fulfillmentLabel(order.fulfillmentType), paymentHint(order)].filter(Boolean).some((x) => String(x).toLowerCase().includes(q));
  }), [orders, filter, query]);

  const simpleProducts = useMemo(() => {
    const all = catalog?.categories.flatMap((c) => c.products) ?? []; const unique = new Map<number, CatalogProduct>();
    all.forEach((p) => { if (!["PIZZA_SINGLE", "PIZZA_TWO_FLAVORS", "COMBO", "MODIFIER", "INTERNAL"].includes(p.type) && p.basePrice != null) unique.set(p.id, p); });
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [catalog]);

  async function advance(order: Order) {
    const next = nextStatus(order.status, order.fulfillmentType); if (!next || ["PREPARING", "PREPARED", "CONFIRMED"].includes(order.status)) return;
    setBusy(order.id); try { const r = await fetch(`/api/orders/${order.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "No fue posible actualizar el estado."); await load(true); } catch (e) { window.alert(e instanceof Error ? e.message : "No fue posible actualizar el estado."); } finally { setBusy(null); }
  }

  function print(order: Order) { const f = document.createElement("iframe"); Object.assign(f.style, { position: "fixed", width: "1px", height: "1px", opacity: "0", pointerEvents: "none" }); f.src = `/pedidos/${order.id}/imprimir?autoprint=1&embedded=1`; document.body.appendChild(f); window.setTimeout(() => f.remove(), 30000); }
  function download(order: Order) { window.open(`/pedidos/${order.id}/imprimir`, "_blank", "noopener,noreferrer"); }

  async function removeTest(order: Order) {
    if (!window.confirm(`¿Eliminar ${code(order.id)} como prueba? Esta acción borra el pedido y no se puede deshacer.`)) return;
    setBusy(order.id); try { const r = await fetch(`/api/orders/${order.id}?test=1`, { method: "DELETE" }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "No fue posible eliminar el pedido."); if (selected?.id === order.id) setSelected(null); await load(true); } catch (e) { window.alert(e instanceof Error ? e.message : "No fue posible eliminar el pedido."); } finally { setBusy(null); }
  }

  async function openPayment(order: Order) {
    try { const cfg = await loadSettings(); const hint = paymentHint(order); const method = cfg.paymentMethods.find((m) => m.name === hint) ?? cfg.paymentMethods.find((m) => m.active); setPaymentOrder(order); setPaymentMethodId(method?.id ?? ""); setCashReceived(""); setReference(""); setPaymentError(""); } catch (e) { window.alert(e instanceof Error ? e.message : "No fue posible abrir el pago."); }
  }

  async function registerPayment() {
    if (!paymentOrder) return; setBusy(paymentOrder.id); setPaymentError("");
    try { const r = await fetch(`/api/orders/${paymentOrder.id}/payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentMethodId, cashReceived: cashReceived ? Number(cashReceived) : null, reference }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "No fue posible registrar el pago."); setPaymentOrder(null); await load(true); } catch (e) { setPaymentError(e instanceof Error ? e.message : "No fue posible registrar el pago."); } finally { setBusy(null); }
  }

  async function openEdit(order: Order) {
    try {
      const [or, sr, cr] = await Promise.all([fetch(`/api/orders/${order.id}`, { cache: "no-store" }), fetch("/api/settings", { cache: "no-store" }), fetch("/api/catalog", { cache: "no-store" })]);
      const od = await or.json(); const sd = await sr.json(); const cd = await cr.json(); if (!or.ok) throw new Error(od.error || "No fue posible cargar el pedido.");
      const full = od.order as Order; const cfg = sd.settings as Settings; setEditing(full); setSettings(cfg); setCatalog(cd); setFulfillment(full.fulfillmentType); setZoneId(full.deliveryZoneId || cfg.deliveryBands.find((b) => b.active)?.id || ""); setQuantities(Object.fromEntries(full.items.map((i) => [i.id, i.quantity]))); setAdditions({}); setEditError("");
    } catch (e) { window.alert(e instanceof Error ? e.message : "No fue posible abrir la edición."); }
  }

  async function saveEdit() {
    if (!editing) return; setSaving(true); setEditError("");
    try { const r = await fetch(`/api/orders/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fulfillmentType: fulfillment, addressId: fulfillment === "DELIVERY" ? editing.address?.id ?? editing.customer?.addresses?.[0]?.id ?? null : null, deliveryZoneId: fulfillment === "DELIVERY" ? zoneId : null, items: editing.items.map((i) => ({ id: i.id, quantity: quantities[i.id] ?? i.quantity })), additions: Object.entries(additions).filter(([, q]) => q > 0).map(([productId, q]) => ({ productId: Number(productId), quantity: q })) }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "No fue posible guardar los cambios."); setEditing(null); await load(true); } catch (e) { setEditError(e instanceof Error ? e.message : "No fue posible guardar los cambios."); } finally { setSaving(false); }
  }

  const activeCount = orders.filter((o) => !["COMPLETED", "CANCELED"].includes(o.status)).length;

  return <main className="p-4 md:p-6 xl:p-8"><div className="mx-auto max-w-[1600px] space-y-4">
    <section className="rounded-[26px] bg-[radial-gradient(circle_at_90%_30%,rgba(229,28,17,.18),transparent_28%),linear-gradient(135deg,#0b0b0c,#171718)] px-6 py-5 text-white"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Operación</p><h1 className="text-3xl font-black tracking-[-0.035em]">Pedidos</h1><p className="text-sm text-white/65">Una orden, un estado actual y una acción clara.</p></div><div className="flex items-center gap-2"><span className="rounded-full border border-white/10 bg-white/[.06] px-3 py-2 text-xs font-bold">{activeCount} activos</span><button onClick={() => void load()} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[.08]"><Icon name="refresh" /></button></div></div></section>
    <section className="rounded-2xl border border-neutral-200 bg-white p-2.5"><div className="flex flex-col gap-2 xl:flex-row"><div className="relative flex-1"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"><Icon name="search" /></span><input value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 w-full rounded-xl border border-neutral-200 bg-[#faf9f7] pl-11 pr-4 text-sm outline-none" placeholder="Buscar pedido, cliente, teléfono, pago o estado" /></div><div className="flex gap-1.5 overflow-x-auto">{([ ["ALL", "Todos"], ["ACTIVE", "Activos"], ["COMPLETED", "Finalizados"], ["CANCELED", "Cancelados"] ] as [Filter, string][]).map(([v, l]) => <button key={v} onClick={() => setFilter(v)} className={`rounded-lg px-3 py-2 text-[11px] font-bold ${filter === v ? "bg-black text-white" : "border border-neutral-200"}`}>{l}</button>)}</div></div></section>
    {loading ? <div className="rounded-2xl border bg-white p-8 text-center text-sm text-neutral-500">Cargando pedidos...</div> : error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visible.map((order) => {
      const fullPaid = paidInFull(order); const pending = balance(order); const kitchen = ["CONFIRMED", "PREPARING", "PREPARED"].includes(order.status); const action = nextLabel(order); const units = order.items.reduce((s, i) => s + i.quantity, 0);
      return <article key={order.id} onClick={() => setSelected(order)} className="cursor-pointer rounded-[20px] border border-neutral-200 bg-white p-3.5 shadow-[0_8px_24px_rgba(25,22,19,.04)] transition hover:-translate-y-0.5">
        <div className="flex items-center justify-between gap-2"><span className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-black uppercase ${statusTone(order.status)}`}>{statusLabel(order.status)}</span><span className="rounded-lg border border-neutral-200 bg-[#faf9f7] px-2.5 py-1.5 text-[10px] font-black uppercase">{fulfillmentLabel(order.fulfillmentType)}</span></div>
        <div className="mt-3 flex justify-between gap-3"><div className="min-w-0"><p className="text-[11px] text-neutral-400">{dateTime(order.createdAt)}</p><h2 className="text-xl font-black">{code(order.id)}</h2><p className="text-[10px] text-neutral-400">{order.items.length} líneas · {units} productos</p></div><b className="shrink-0 text-base text-[var(--brand-red)]">{money(order.total)}</b></div>
        <div className="mt-3 border-t border-neutral-100 pt-3"><p className="truncate text-base font-black">{order.customer?.name || "Cliente ocasional"}</p><p className="truncate text-xs text-neutral-500">{order.customer?.phone ? `${order.customer.countryCode} ${order.customer.phone}` : "Sin teléfono"}{order.fulfillmentType === "DELIVERY" && order.address?.address ? ` · ${order.address.address}` : ""}</p></div>
        <button onClick={(e) => { e.stopPropagation(); if (!fullPaid) void openPayment(order); }} className={`mt-3 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase ${fullPaid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{fullPaid ? `Pagado · ${paymentHint(order)}` : `${money(pending)} pendientes · ${paymentHint(order)}`}</button>
        <div className="mt-3 flex gap-1.5 border-t border-neutral-100 pt-3" onClick={(e) => e.stopPropagation()}><button onClick={() => setSelected(order)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"><Icon name="info" /></button><button onClick={() => void openEdit(order)} disabled={["COMPLETED", "CANCELED", "DELIVERED"].includes(order.status)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border disabled:opacity-30"><Icon name="edit" /></button><button onClick={() => print(order)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"><Icon name="print" /></button><button onClick={() => download(order)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"><Icon name="download" /></button>{!order.payments.some((p) => p.status === "PAID") && <button onClick={() => void removeTest(order)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-600"><Icon name="trash" /></button>}<div className="ml-auto flex-1">{kitchen ? <Link href="/cocina" className="flex h-9 items-center justify-center rounded-lg bg-black px-2 text-[10px] font-black text-white">Cocina</Link> : action ? <button disabled={busy === order.id} onClick={() => void advance(order)} className="h-9 w-full rounded-lg bg-[var(--brand-red)] px-2 text-[10px] font-black text-white">{busy === order.id ? "..." : action}</button> : <span className="flex h-9 items-center justify-center rounded-lg bg-neutral-100 text-[10px] font-bold text-neutral-400">Cerrado</span>}</div></div>
      </article>;
    })}</div>}
  </div>

  {selected && <div className="fixed inset-0 z-[90] bg-black/55" onClick={() => setSelected(null)}><aside onClick={(e) => e.stopPropagation()} className="absolute inset-y-0 right-0 flex w-full max-w-[590px] flex-col bg-[#f5f2ee]"><header className="flex items-start justify-between bg-black px-5 py-5 text-white"><div><p className="text-[9px] uppercase text-white/45">Detalle del pedido</p><h2 className="text-2xl font-black">{code(selected.id)}</h2></div><button onClick={() => setSelected(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10"><Icon name="close" /></button></header><div className="min-h-0 flex-1 overflow-y-auto p-4"><section className="rounded-2xl border bg-white p-4"><div className="grid gap-4 sm:grid-cols-2"><div><p className="text-[9px] uppercase text-neutral-400">Cliente</p><b>{selected.customer?.name || "Cliente ocasional"}</b><p className="text-xs text-neutral-500">{selected.customer?.phone ? `${selected.customer.countryCode} ${selected.customer.phone}` : ""}</p></div><div><p className="text-[9px] uppercase text-neutral-400">Estado</p><b>{statusLabel(selected.status)}</b></div></div>{selected.address?.address && <p className="mt-3 border-t pt-3 text-sm">{selected.address.address}</p>}</section><section className="mt-3 rounded-2xl border bg-white p-4"><h3 className="text-lg font-black">Productos</h3><div className="mt-3 space-y-2">{selected.items.map((i) => <ProductRow key={i.id} item={i} />)}</div></section><section className="mt-3 rounded-2xl border bg-white p-4"><div className="flex justify-between text-sm"><span>Total</span><b className="text-xl text-[var(--brand-red)]">{money(selected.total)}</b></div><div className={`mt-3 rounded-xl p-3 text-sm ${paidInFull(selected) ? "bg-emerald-50" : "bg-amber-50"}`}>{paidInFull(selected) ? `Pago completo · ${money(paidAmount(selected))}` : `Recibido ${money(paidAmount(selected))} · Pendiente ${money(balance(selected))}`}</div></section></div><footer className="grid grid-cols-2 gap-2 border-t bg-white p-4 sm:grid-cols-4"><button onClick={() => void openEdit(selected)} className="min-h-11 rounded-xl border font-bold">Editar</button><button onClick={() => print(selected)} className="min-h-11 rounded-xl border font-bold">Imprimir</button><button onClick={() => download(selected)} className="min-h-11 rounded-xl border font-bold">Comprobante</button>{paidInFull(selected) ? <Link href="/caja" className="flex min-h-11 items-center justify-center rounded-xl bg-black font-black text-white">Caja</Link> : <button onClick={() => void openPayment(selected)} className="min-h-11 rounded-xl bg-[var(--brand-red)] font-black text-white">Registrar pago</button>}</footer></aside></div>}

  {paymentOrder && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4" onClick={() => setPaymentOrder(null)}><div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-[24px] bg-white"><header className="bg-black px-5 py-4 text-white"><p className="text-[9px] uppercase text-white/45">Caja</p><h3 className="text-xl font-black">Registrar pago · {code(paymentOrder.id)}</h3></header><div className="p-5"><p className="text-sm text-neutral-500">Saldo pendiente</p><p className="text-3xl font-black text-[var(--brand-red)]">{money(balance(paymentOrder))}</p><div className="mt-4 grid grid-cols-2 gap-2">{settings?.paymentMethods.filter((m) => m.active).map((m) => <button key={m.id} onClick={() => setPaymentMethodId(m.id)} className={`rounded-xl border px-3 py-3 text-sm font-bold ${paymentMethodId === m.id ? "bg-black text-white" : ""}`}>{m.name}</button>)}</div>{settings?.paymentMethods.find((m) => m.id === paymentMethodId)?.name.toLowerCase() === "efectivo" && <input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="mt-4 h-12 w-full rounded-xl border px-3" placeholder="Paga con" />}<input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-3 h-12 w-full rounded-xl border px-3" placeholder="Referencia opcional" />{paymentError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{paymentError}</p>}</div><footer className="flex gap-2 border-t p-4"><button onClick={() => setPaymentOrder(null)} className="min-h-11 flex-1 rounded-xl border font-bold">Cancelar</button><button disabled={busy === paymentOrder.id || !paymentMethodId} onClick={() => void registerPayment()} className="min-h-11 flex-1 rounded-xl bg-[var(--brand-red)] font-black text-white disabled:opacity-40">Registrar ingreso</button></footer></div></div>}

  {editing && <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/55 p-3" onClick={() => setEditing(null)}><div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] bg-[#f5f2ee]"><header className="flex items-center justify-between bg-black px-5 py-4 text-white"><div><p className="text-[9px] uppercase text-white/45">Editar pedido</p><h3 className="text-xl font-black">{code(editing.id)}</h3></div><button onClick={() => setEditing(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10"><Icon name="close" /></button></header><div className="min-h-0 flex-1 overflow-y-auto p-4"><section className="rounded-2xl border bg-white p-4"><p className="text-xs font-black uppercase text-neutral-500">Tipo de pedido</p><div className="mt-2 grid grid-cols-3 gap-2">{(["DELIVERY", "PICKUP", "STORE"] as FulfillmentType[]).map((t) => <button key={t} onClick={() => setFulfillment(t)} className={`rounded-xl border px-3 py-3 text-xs font-black uppercase ${fulfillment === t ? "border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]" : ""}`}>{fulfillmentLabel(t)}</button>)}</div>{fulfillment === "DELIVERY" && <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="mt-3 h-11 w-full rounded-xl border px-3 text-sm">{settings?.deliveryBands.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name} · {money(b.fee)}</option>)}</select>}</section><section className="mt-3 rounded-2xl border bg-white p-4"><p className="text-xs font-black uppercase text-neutral-500">Productos actuales</p><p className="mt-1 text-xs text-neutral-400">Si cambias productos, la orden vuelve a En preparación para que Cocina vea el ajuste.</p><div className="mt-3 space-y-2">{editing.items.map((i) => <div key={i.id} className="flex items-center justify-between rounded-xl border bg-[#faf9f7] p-3"><div><b className="text-sm">{i.productName}</b><p className="text-xs text-neutral-400">{money(i.unitPrice)} c/u</p></div><div className="flex items-center gap-2"><button onClick={() => setQuantities((v) => ({ ...v, [i.id]: Math.max(0, (v[i.id] ?? i.quantity) - 1) }))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"><Icon name="minus" /></button><b className="w-5 text-center">{quantities[i.id] ?? i.quantity}</b><button onClick={() => setQuantities((v) => ({ ...v, [i.id]: (v[i.id] ?? i.quantity) + 1 }))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"><Icon name="plus" /></button></div></div>)}</div></section>{simpleProducts.length > 0 && <section className="mt-3 rounded-2xl border bg-white p-4"><p className="text-xs font-black uppercase text-neutral-500">Agregar bebida o producto simple</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{simpleProducts.map((p) => <div key={p.id} className="flex items-center justify-between rounded-xl border p-3"><div><b className="text-sm">{p.name}</b><p className="text-xs text-neutral-400">{money(p.basePrice)}</p></div><div className="flex items-center gap-2"><button onClick={() => setAdditions((v) => ({ ...v, [p.id]: Math.max(0, (v[p.id] ?? 0) - 1) }))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"><Icon name="minus" /></button><b>{additions[p.id] ?? 0}</b><button onClick={() => setAdditions((v) => ({ ...v, [p.id]: (v[p.id] ?? 0) + 1 }))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"><Icon name="plus" /></button></div></div>)}</div></section>}{editError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{editError}</p>}</div><footer className="flex gap-2 border-t bg-white p-4"><button onClick={() => setEditing(null)} className="min-h-11 flex-1 rounded-xl border font-bold">Cancelar</button><button disabled={saving} onClick={() => void saveEdit()} className="min-h-11 flex-1 rounded-xl bg-[var(--brand-red)] font-black text-white disabled:opacity-40">{saving ? "Guardando..." : "Guardar cambios"}</button></footer></div></div>}
  </main>;
}
