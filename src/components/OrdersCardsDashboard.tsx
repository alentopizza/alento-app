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

type OrderItem = {
  id: number;
  productName: string;
  quantity: number;
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
  deliveryZoneName: string | null;
  createdAt: string;
  customer: { id: number; name: string; countryCode: string; phone: string | null } | null;
  address: { id: number; address: string } | null;
  items: OrderItem[];
  payments: Payment[];
};

type Filter = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELED";

function formatCOP(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function orderCode(id: number) {
  return `ALT-${String(id).padStart(6, "0")}`;
}

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
  if (next === "OUT_FOR_DELIVERY") return "Marcar en camino";
  if (next === "ARRIVED") return "Marcar ha llegado";
  if (next === "DELIVERED") return "Marcar entregado";
  if (next === "COMPLETED") return "Finalizar pedido";
  return `Marcar ${statusLabel(next).toLowerCase()}`;
}

function Icon({ name }: { name: "search" | "refresh" | "print" | "info" | "close" | "arrow" }) {
  const common = "h-5 w-5";
  if (name === "search") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
  if (name === "refresh") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6.3 6.3L4 11M20 13l-2.3 4.7A7 7 0 0 1 5.5 15"/></svg>;
  if (name === "print") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>;
  if (name === "info") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>;
  if (name === "close") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}><path d="m6 6 12 12M18 6 6 18"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}><path d="m9 18 6-6-6-6"/></svg>;
}

function OrderProduct({ item }: { item: OrderItem }) {
  const details = presentOrderItemConfiguration(item.configuration);
  return (
    <div className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <b className="text-sm text-neutral-900">{item.quantity} × {item.productName}</b>
          {details.length > 0 && (
            <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {details.map((detail, index) => (
                <p key={`${detail.label}-${index}`} className="text-[11px] leading-4 text-neutral-600">
                  <span className="font-bold text-neutral-400">{detail.label}</span> · {detail.value}
                </p>
              ))}
            </div>
          )}
        </div>
        <b className="shrink-0 text-sm">{formatCOP(item.lineTotal)}</b>
      </div>
    </div>
  );
}

export default function OrdersCardsDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<Order | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function loadOrders(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar los pedidos.");
      const nextOrders = (data.orders ?? []) as Order[];
      setOrders(nextOrders);
      setSelected((current) => current ? nextOrders.find((order) => order.id === current.id) ?? null : null);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar los pedidos.");
    } finally {
      if (!silent) setLoading(false);
    }
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
      return [
        orderCode(order.id),
        order.customer?.name,
        order.customer?.phone,
        statusLabel(order.status),
        fulfillmentLabel(order.fulfillmentType),
      ].filter(Boolean).some((field) => String(field).toLowerCase().includes(value));
    });
  }, [orders, query, filter]);

  async function advance(order: Order) {
    const next = nextStatus(order.status, order.fulfillmentType);
    if (!next || ["PREPARING", "PREPARED", "CONFIRMED"].includes(order.status)) return;
    setBusyId(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible actualizar el estado.");
      await loadOrders(true);
    } catch (actionError) {
      window.alert(actionError instanceof Error ? actionError.message : "No fue posible actualizar el estado.");
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = orders.filter((order) => !["COMPLETED", "CANCELED"].includes(order.status)).length;

  return (
    <main className="p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <section className="overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_90%_30%,rgba(229,28,17,.18),transparent_28%),linear-gradient(135deg,#0b0b0c,#171718)] px-6 py-6 text-white shadow-[0_22px_55px_rgba(20,16,14,.12)] md:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">Operación</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.035em]">Pedidos</h1>
              <p className="mt-1 text-sm text-white/65">Una orden, un estado actual y una acción clara.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-white/80">{activeCount} activos</span>
              <button onClick={() => void loadOrders()} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] text-white transition hover:bg-white/[0.14]" aria-label="Actualizar pedidos"><Icon name="refresh" /></button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative min-w-0 flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"><Icon name="search" /></span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pedido, cliente, teléfono o estado" className="h-12 w-full rounded-2xl border border-neutral-200 bg-[#faf9f7] pl-12 pr-4 text-sm outline-none transition focus:border-neutral-400" />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {([
                ["ALL", "Todos"],
                ["ACTIVE", "Activos"],
                ["COMPLETED", "Finalizados"],
                ["CANCELED", "Cancelados"],
              ] as [Filter, string][]).map(([value, label]) => (
                <button key={value} onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold transition ${filter === value ? "bg-black text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}>{label}</button>
              ))}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">Cargando pedidos...</div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-400">No hay pedidos para mostrar con este filtro.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((order) => {
              const payment = order.payments[0];
              const kitchenManaged = ["CONFIRMED", "PREPARING", "PREPARED"].includes(order.status);
              const actionLabel = nextActionLabel(order);
              const productUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
              const busy = busyId === order.id;

              return (
                <article key={order.id} onClick={() => setSelected(order)} className="group cursor-pointer rounded-[24px] border border-neutral-200 bg-white p-4 shadow-[0_10px_28px_rgba(25,22,19,.045)] transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_16px_36px_rgba(25,22,19,.08)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-[0.04em] ${statusTone(order.status)}`}>{statusLabel(order.status)}</span>
                    <span className="rounded-xl border border-neutral-200 bg-[#faf9f7] px-3 py-2 text-[11px] font-black uppercase text-neutral-700">{fulfillmentLabel(order.fulfillmentType)}</span>
                  </div>

                  <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
                    <p className="text-xs text-neutral-500">{formatDate(order.createdAt)}</p>
                    <p className="mt-1 text-2xl font-black tracking-[-0.035em]">{orderCode(order.id)}</p>
                    <p className="mt-1 text-[11px] text-neutral-400">{order.items.length} línea{order.items.length === 1 ? "" : "s"} · {productUnits} producto{productUnits === 1 ? "" : "s"}</p>
                  </div>

                  <div className="mt-2 rounded-2xl border border-neutral-200 p-4">
                    <p className="truncate text-lg font-black tracking-[-0.02em]">{order.customer?.name || "Cliente ocasional"}</p>
                    <p className="mt-1 text-sm text-neutral-500">{order.customer?.phone ? `${order.customer.countryCode} ${order.customer.phone}` : "Sin teléfono registrado"}</p>
                    {order.fulfillmentType === "DELIVERY" && order.address?.address && <p className="mt-1 truncate text-xs text-neutral-400">{order.address.address}</p>}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-neutral-200 bg-[#faf9f7] px-3 py-3 text-center"><b className="text-sm">{formatCOP(order.total)}</b><p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-400">Total</p></div>
                    <div className="rounded-xl border border-neutral-200 bg-[#faf9f7] px-3 py-3 text-center"><b className="block truncate text-sm">{payment?.method || "Pendiente"}</b><p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-400">Pago</p></div>
                  </div>

                  <div className="mt-3 flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                    <Link href={`/pedidos/${order.id}/imprimir`} target="_blank" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-50" aria-label="Imprimir 80 mm"><Icon name="print" /></Link>
                    <button onClick={() => setSelected(order)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-50" aria-label="Ver detalle"><Icon name="info" /></button>
                    {kitchenManaged ? (
                      <Link href="/cocina" className="flex min-h-10 flex-1 items-center justify-center rounded-xl bg-black px-3 text-xs font-black text-white">Gestionar en Cocina</Link>
                    ) : actionLabel ? (
                      <button disabled={busy} onClick={() => void advance(order)} className="min-h-10 flex-1 rounded-xl bg-[var(--brand-red)] px-3 text-xs font-black text-white disabled:opacity-50">{busy ? "Actualizando..." : actionLabel}</button>
                    ) : (
                      <span className="flex min-h-10 flex-1 items-center justify-center rounded-xl bg-neutral-100 px-3 text-xs font-bold text-neutral-500">Sin acciones pendientes</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-[3px]" onClick={() => setSelected(null)}>
          <aside onClick={(event) => event.stopPropagation()} className="absolute inset-y-0 right-0 flex w-full max-w-[590px] flex-col overflow-hidden bg-[#f5f2ee] shadow-[-24px_0_70px_rgba(0,0,0,.24)]">
            <header className="flex items-start justify-between gap-4 border-b-2 border-[var(--brand-red)] bg-[radial-gradient(circle_at_90%_20%,rgba(229,28,17,.22),transparent_28%),linear-gradient(135deg,#0b0b0c,#171718)] px-5 py-5 text-white">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">Detalle del pedido</p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]">{orderCode(selected.id)}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase ${statusTone(selected.status)}`}>{statusLabel(selected.status)}</span>
                  <span className="rounded-lg border border-white/15 bg-white/[0.08] px-2.5 py-1 text-[10px] font-black uppercase text-white/80">{fulfillmentLabel(selected.fulfillmentType)}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] text-white"><Icon name="close" /></button>
            </header>

            <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <section className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-400">Fecha</p><b className="mt-1 block text-sm">{formatDate(selected.createdAt)}</b></div>
                  <div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-400">Estado actual</p><b className="mt-1 block text-sm">{statusLabel(selected.status)}</b></div>
                  <div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-400">Cliente</p><b className="mt-1 block text-base">{selected.customer?.name || "Cliente ocasional"}</b>{selected.customer?.phone && <p className="text-xs text-neutral-500">{selected.customer.countryCode} {selected.customer.phone}</p>}</div>
                  <div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-400">Tipo de pedido</p><b className="mt-1 block text-base">{fulfillmentLabel(selected.fulfillmentType)}</b></div>
                </div>
                {selected.address?.address && <div className="mt-4 border-t border-neutral-100 pt-4"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-400">Dirección</p><b className="mt-1 block text-sm">{selected.address.address}</b>{selected.deliveryZoneName && <p className="mt-1 text-xs text-neutral-500">{selected.deliveryZoneName}</p>}</div>}
              </section>

              <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-400">Productos</p><h3 className="mt-1 text-lg font-black">Detalle de la orden</h3></div><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold text-neutral-500">{selected.items.length} línea{selected.items.length === 1 ? "" : "s"}</span></div>
                <div className="mt-3 space-y-2">{selected.items.map((item) => <OrderProduct key={item.id} item={item} />)}</div>
              </section>

              <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-neutral-500">Subtotal</span><b>{formatCOP(selected.subtotal)}</b></div>
                  {Number(selected.deliveryFee) > 0 && <div className="flex justify-between gap-4"><span className="text-neutral-500">Domicilio</span><b>{formatCOP(selected.deliveryFee)}</b></div>}
                  {Number(selected.discount) > 0 && <div className="flex justify-between gap-4 text-emerald-700"><span>Descuento{selected.couponName ? ` · ${selected.couponName}` : ""}</span><b>− {formatCOP(selected.discount)}</b></div>}
                  <div className="mt-2 flex justify-between gap-4 border-t border-dashed pt-3"><b>Total</b><b className="text-xl text-[var(--brand-red)]">{formatCOP(selected.total)}</b></div>
                </div>
                {selected.payments[0] && <div className="mt-4 rounded-xl bg-[#faf9f7] p-3 text-sm"><div className="flex justify-between"><span className="text-neutral-500">Forma de pago</span><b>{selected.payments[0].method}</b></div>{selected.payments[0].cashReceived != null && <><div className="mt-1 flex justify-between"><span className="text-neutral-500">Paga con</span><b>{formatCOP(selected.payments[0].cashReceived)}</b></div><div className="mt-1 flex justify-between"><span className="text-neutral-500">Vueltas</span><b className="text-emerald-700">{formatCOP(selected.payments[0].changeDue)}</b></div></>}</div>}
              </section>
            </div>

            <footer className="border-t border-neutral-200 bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href={`/pedidos/${selected.id}/imprimir`} target="_blank" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 text-sm font-bold"><Icon name="print" /> Imprimir 80 mm</Link>
                {["CONFIRMED", "PREPARING", "PREPARED"].includes(selected.status) ? (
                  <Link href="/cocina" className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-black px-4 text-sm font-black text-white">Gestionar en Cocina</Link>
                ) : nextActionLabel(selected) ? (
                  <button disabled={busyId === selected.id} onClick={() => void advance(selected)} className="min-h-11 flex-1 rounded-xl bg-[var(--brand-red)] px-4 text-sm font-black text-white disabled:opacity-50">{busyId === selected.id ? "Actualizando..." : nextActionLabel(selected)}</button>
                ) : null}
              </div>
            </footer>
          </aside>
        </div>
      )}
    </main>
  );
}
