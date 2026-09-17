"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";
import {
  nextStatus,
  statusLabel,
  fulfillmentLabel,
  type FulfillmentType,
  type OrderStatus,
} from "@/lib/orderWorkflow";

type OrderItem = {
  id: number;
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: string | number;
  lineTotal: string | number;
  configuration: unknown;
};

type Payment = {
  id: number;
  method: string;
  amount: string | number;
  cashReceived: string | number | null;
  changeDue: string | number | null;
  status: string;
};

type CustomerAddress = { id: number; address: string };
type Order = {
  id: number;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  subtotal: string | number;
  deliveryFee: string | number;
  discount: string | number;
  total: string | number;
  couponName: string | null;
  deliveryZoneId: string | null;
  deliveryZoneName: string | null;
  discountSource: string;
  createdAt: string;
  customer: { id: number; name: string; countryCode: string; phone: string | null; addresses?: CustomerAddress[] } | null;
  address: { id: number; address: string } | null;
  items: OrderItem[];
  payments: Payment[];
};

type Settings = { deliveryBands: { id: string; name: string; fee: number; active: boolean }[] };
type CatalogProduct = { id: number; name: string; type: string; basePrice: number | null };
type CatalogResponse = { categories: { products: CatalogProduct[] }[] };

function formatCOP(value: string | number | null | undefined) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function OrderItemDetails({ item }: { item: OrderItem }) {
  const details = presentOrderItemConfiguration(item.configuration);
  return (
    <div className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black">{item.quantity} × {item.productName}</p>
          {details.length > 0 && (
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {details.map((detail, index) => (
                <p key={`${detail.label}-${index}`} className="text-[11px] leading-4">
                  <span className="font-black text-neutral-500">{detail.label}:</span> {detail.value}
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Order | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [editFulfillment, setEditFulfillment] = useState<FulfillmentType>("PICKUP");
  const [editZoneId, setEditZoneId] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [additions, setAdditions] = useState<Record<number, number>>({});
  const [cashReceived, setCashReceived] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  async function loadOrders(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar los pedidos.");
      setOrders(data.orders ?? []);
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
    if (!value) return orders;
    return orders.filter((order) => [
      `ALT-${String(order.id).padStart(6, "0")}`,
      order.customer?.name,
      order.customer?.phone,
      order.status,
      statusLabel(order.status),
      order.fulfillmentType,
      fulfillmentLabel(order.fulfillmentType),
    ].filter(Boolean).some((field) => String(field).toLowerCase().includes(value)));
  }, [orders, query]);

  const simpleProducts = useMemo(() => {
    const all = catalog?.categories.flatMap((category) => category.products) ?? [];
    const unique = new Map<number, CatalogProduct>();
    all.forEach((product) => {
      if (!["PIZZA_SINGLE", "PIZZA_TWO_FLAVORS", "COMBO", "MODIFIER", "INTERNAL"].includes(product.type) && product.basePrice != null) unique.set(product.id, product);
    });
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [catalog]);

  async function advanceOrder(order: Order) {
    const next = nextStatus(order.status, order.fulfillmentType);
    if (!next || ["PREPARING", "PREPARED", "CONFIRMED"].includes(order.status)) return;
    setBusyOrderId(order.id);
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
      setBusyOrderId(null);
    }
  }

  async function cancelOrder(order: Order) {
    if (!window.confirm(`¿Cancelar ALT-${String(order.id).padStart(6, "0")}? El pedido conservará su historial pero saldrá del flujo operativo.`)) return;
    setBusyOrderId(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cancelar el pedido.");
      await loadOrders(true);
    } catch (actionError) {
      window.alert(actionError instanceof Error ? actionError.message : "No fue posible cancelar el pedido.");
    } finally { setBusyOrderId(null); }
  }

  async function deleteOrder(order: Order) {
    if (!window.confirm(`Eliminar definitivamente ALT-${String(order.id).padStart(6, "0")}? Esta acción borra Order, OrderItem y Payment y no se puede deshacer.`)) return;
    setBusyOrderId(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible eliminar el pedido.");
      await loadOrders(true);
    } catch (actionError) {
      window.alert(actionError instanceof Error ? actionError.message : "No fue posible eliminar el pedido.");
    } finally { setBusyOrderId(null); }
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
      const fullOrder = orderData.order as Order;
      setEditing(fullOrder);
      setSettings(settingsData.settings);
      setCatalog(catalogData);
      setEditFulfillment(fullOrder.fulfillmentType);
      setEditZoneId(fullOrder.deliveryZoneId || "");
      setQuantities(Object.fromEntries(fullOrder.items.map((item) => [item.id, item.quantity])));
      setAdditions({});
      setCashReceived(fullOrder.payments[0]?.cashReceived == null ? "" : String(fullOrder.payments[0].cashReceived));
      setEditError("");
    } catch (openError) {
      window.alert(openError instanceof Error ? openError.message : "No fue posible abrir el pedido.");
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true); setEditError("");
    try {
      const response = await fetch(`/api/orders/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillmentType: editFulfillment,
          addressId: editFulfillment === "DELIVERY" ? editing.customer?.addresses?.[0]?.id ?? editing.address?.id ?? null : null,
          deliveryZoneId: editFulfillment === "DELIVERY" ? editZoneId : null,
          cashReceived: cashReceived ? Number(cashReceived) : null,
          items: editing.items.map((item) => ({ id: item.id, quantity: quantities[item.id] ?? item.quantity })),
          additions: Object.entries(additions).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId: Number(productId), quantity })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible actualizar el pedido.");
      setEditing(null);
      await loadOrders(true);
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : "No fue posible actualizar el pedido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">Operación</p>
            <h1 className="text-3xl font-black">Pedidos</h1>
            <p className="mt-1 text-sm text-neutral-500">Una orden, un estado actual y una acción clara.</p>
          </div>
          <button onClick={() => void loadOrders()} className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-black">Actualizar</button>
        </header>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-2xl border bg-neutral-50 px-4 py-3" placeholder="Buscar por número, cliente, teléfono o estado" />
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-8">Cargando pedidos...</div>
        ) : error ? (
          <div className="rounded-3xl bg-red-50 p-5 text-red-700">{error}</div>
        ) : (
          <div className="space-y-4">
            {filtered.map((order) => {
              const payment = order.payments[0];
              const code = `ALT-${String(order.id).padStart(6, "0")}`;
              const busy = busyOrderId === order.id;
              const kitchenManaged = ["CONFIRMED", "PREPARING", "PREPARED"].includes(order.status);
              const next = nextStatus(order.status, order.fulfillmentType);
              const editable = ["CONFIRMED", "PREPARING"].includes(order.status);

              return (
                <article key={order.id} className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 ${order.status === "CANCELED" ? "opacity-75" : ""}`}>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black">{code}</h2>
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase text-[var(--brand-red)]">{fulfillmentLabel(order.fulfillmentType)}</span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-400">{new Date(order.createdAt).toLocaleString("es-CO")}</p>
                      <p className="mt-3 text-sm font-black">{order.customer?.name || "Cliente ocasional"}</p>
                      {order.customer?.phone && <p className="text-xs text-neutral-500">{order.customer.countryCode} {order.customer.phone}</p>}
                      {order.address?.address && <p className="mt-1 text-xs text-neutral-500">{order.address.address}{order.deliveryZoneName ? ` · ${order.deliveryZoneName}` : ""}</p>}
                    </div>

                    <div className="min-w-[260px] rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">Estado actual</p>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <b className={`text-base ${order.status === "CANCELED" ? "text-red-700" : "text-neutral-900"}`}>{statusLabel(order.status)}</b>
                        <span className={`h-2.5 w-2.5 rounded-full ${order.status === "CANCELED" ? "bg-red-500" : order.status === "COMPLETED" ? "bg-emerald-500" : "bg-[var(--brand-red)]"}`} />
                      </div>

                      {kitchenManaged ? (
                        <Link href="/cocina" className="mt-3 flex min-h-10 items-center justify-center rounded-xl bg-black px-4 text-xs font-black text-white">
                          Gestionar en Cocina
                        </Link>
                      ) : next ? (
                        <button
                          type="button"
                          onClick={() => void advanceOrder(order)}
                          disabled={busy}
                          className="mt-3 min-h-10 w-full rounded-xl bg-[var(--brand-red)] px-4 text-xs font-black uppercase tracking-[0.035em] text-white disabled:opacity-50"
                        >
                          {busy ? "Actualizando..." : `Marcar ${statusLabel(next)}`}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_300px]">
                    <div className="space-y-2">{order.items.map((item) => <OrderItemDetails key={item.id} item={item} />)}</div>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-neutral-200 p-3 text-xs">
                        <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><b>{formatCOP(order.subtotal)}</b></div>
                        {Number(order.deliveryFee) > 0 && <div className="mt-1 flex justify-between"><span className="text-neutral-500">Domicilio</span><b>{formatCOP(order.deliveryFee)}</b></div>}
                        {Number(order.discount) > 0 && <div className="mt-1 flex justify-between text-emerald-700"><span>Descuento</span><b>− {formatCOP(order.discount)}</b></div>}
                        <div className="mt-2 flex justify-between border-t border-dashed pt-2"><b>Total</b><b className="text-lg text-[var(--brand-red)]">{formatCOP(order.total)}</b></div>
                      </div>

                      <div className="rounded-2xl border border-neutral-200 p-3 text-xs">
                        <div className="flex justify-between"><span>Pago</span><b>{payment?.method || "Pendiente"}</b></div>
                        {payment?.cashReceived != null && <>
                          <div className="mt-1 flex justify-between"><span>Paga con</span><b>{formatCOP(payment.cashReceived)}</b></div>
                          <div className="mt-1 flex justify-between"><span>Vueltas</span><b className="text-emerald-700">{formatCOP(payment.changeDue)}</b></div>
                        </>}
                        {order.couponName && <div className="mt-1 flex justify-between"><span>Cupón</span><b>{order.couponName}</b></div>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                    <button onClick={() => void openEdit(order)} disabled={!editable || busy} className="rounded-xl border px-3 py-2 text-xs font-black disabled:text-neutral-300">Editar</button>
                    <Link href={`/pedidos/${order.id}/imprimir`} target="_blank" className="rounded-xl bg-black px-3 py-2 text-xs font-black text-white">Imprimir 80 mm</Link>
                    {["DRAFT", "CONFIRMED", "PREPARING"].includes(order.status) && (
                      <button onClick={() => void cancelOrder(order)} disabled={busy} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">Cancelar pedido</button>
                    )}
                    {order.status === "CANCELED" && (
                      <button onClick={() => void deleteOrder(order)} disabled={busy} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700">Eliminar definitivamente</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-3">
          <div className="alento-card flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px]">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase text-neutral-400">Editar pedido</p>
                <h2 className="text-2xl font-black">ALT-{String(editing.id).padStart(6, "0")}</h2>
                <p className="text-xs text-neutral-500">Editable mientras esté en preparación.</p>
              </div>
              <button onClick={() => setEditing(null)} className="rounded-full bg-neutral-100 px-3 py-2 text-xs font-black">Cerrar</button>
            </div>

            <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border p-4">
                  <h3 className="font-black">Modalidad</h3>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {([[
                      "DELIVERY", "Domicilio"], ["PICKUP", "Recoger"], ["STORE", "Local"]] as [FulfillmentType, string][]).map(([value, label]) => (
                      <button key={value} onClick={() => setEditFulfillment(value)} className={`rounded-xl border px-3 py-2 text-xs font-black ${editFulfillment === value ? "bg-black text-white" : ""}`}>{label}</button>
                    ))}
                  </div>
                  {editFulfillment === "DELIVERY" && (
                    <div className="mt-3">
                      <label className="text-xs font-black">Tarifa</label>
                      <select value={editZoneId} onChange={(event) => setEditZoneId(event.target.value)} className="alento-input mt-1 w-full rounded-xl px-3 py-2">
                        <option value="">Selecciona</option>
                        {settings?.deliveryBands.filter((zone) => zone.active).map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {formatCOP(zone.fee)}</option>)}
                      </select>
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border p-4">
                  <h3 className="font-black">Productos actuales</h3>
                  <div className="mt-3 space-y-2">
                    {editing.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 p-2">
                        <div className="min-w-0"><b className="block truncate text-xs">{item.productName}</b><span className="text-[10px] text-neutral-400">{formatCOP(item.unitPrice)}</span></div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setQuantities({ ...quantities, [item.id]: Math.max(0, (quantities[item.id] ?? item.quantity) - 1) })} className="h-7 w-7 rounded-lg bg-white">−</button>
                          <b className="w-6 text-center text-xs">{quantities[item.id] ?? item.quantity}</b>
                          <button onClick={() => setQuantities({ ...quantities, [item.id]: (quantities[item.id] ?? item.quantity) + 1 })} className="h-7 w-7 rounded-lg bg-white">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border p-4 lg:col-span-2">
                  <h3 className="font-black">Agregar producto simple</h3>
                  <p className="mt-1 text-xs text-neutral-400">Para pizzas y combos se reutilizará después el constructor estructurado del POS.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {simpleProducts.map((product) => (
                      <div key={product.id} className="flex items-center justify-between rounded-xl border p-2">
                        <div><b className="block text-xs">{product.name}</b><span className="text-[10px] text-neutral-400">{formatCOP(product.basePrice)}</span></div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setAdditions({ ...additions, [product.id]: Math.max(0, (additions[product.id] ?? 0) - 1) })} className="h-7 w-7 rounded-lg bg-neutral-100">−</button>
                          <b className="w-5 text-center text-xs">{additions[product.id] ?? 0}</b>
                          <button onClick={() => setAdditions({ ...additions, [product.id]: (additions[product.id] ?? 0) + 1 })} className="h-7 w-7 rounded-lg bg-neutral-100">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {editing.payments[0]?.method?.toLowerCase() === "efectivo" && (
                  <section className="rounded-2xl border p-4 lg:col-span-2">
                    <label className="text-xs font-black">Paga con</label>
                    <input value={cashReceived} onChange={(event) => setCashReceived(event.target.value.replace(/\D/g, ""))} className="alento-input mt-1 w-full rounded-xl px-3 py-2" inputMode="numeric" />
                  </section>
                )}
                {editError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 lg:col-span-2">{editError}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t p-4">
              <button onClick={() => setEditing(null)} className="rounded-xl border px-4 py-2.5 text-xs font-black">Cancelar</button>
              <button onClick={() => void saveEdit()} disabled={saving} className="rounded-xl bg-[var(--brand-red)] px-5 py-2.5 text-xs font-black text-white">{saving ? "Guardando..." : "Guardar cambios"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
