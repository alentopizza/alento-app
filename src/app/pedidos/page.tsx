"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";

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
  status: string;
  fulfillmentType: string;
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

type Settings = {
  deliveryBands: { id: string; name: string; fee: number; active: boolean }[];
};

type CatalogProduct = { id: number; name: string; type: string; basePrice: number | null };
type CatalogResponse = { categories: { products: CatalogProduct[] }[] };

function formatCOP(value: string | number | null | undefined) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function fulfillmentLabel(value: string) {
  if (value === "DELIVERY") return "Domicilio";
  if (value === "PICKUP") return "Recoger en tienda";
  if (value === "STORE") return "Local";
  return value;
}

function statusLabel(value: string) {
  if (value === "CONFIRMED") return "Confirmado";
  if (value === "PREPARING") return "En preparación";
  if (value === "READY") return "Listo";
  if (value === "OUT_FOR_DELIVERY") return "En domicilio";
  if (value === "COMPLETED") return "Completado";
  if (value === "CANCELED") return "Cancelado";
  return value;
}

function OrderItemDetails({ item }: { item: OrderItem }) {
  const details = presentOrderItemConfiguration(item.configuration);
  return (
    <div className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black">{item.quantity} × {item.productName}</p>
          {details.length > 0 && <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {details.map((detail, index) => <p key={`${detail.label}-${index}`} className="text-[11px] leading-4"><span className="font-black text-neutral-500">{detail.label}:</span> {detail.value}</p>)}
          </div>}
        </div>
        <div className="shrink-0 text-right"><b className="text-sm">{formatCOP(item.lineTotal)}</b><p className="text-[10px] text-neutral-400">c/u {formatCOP(item.unitPrice)}</p></div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Order | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [editFulfillment, setEditFulfillment] = useState("PICKUP");
  const [editZoneId, setEditZoneId] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [additions, setAdditions] = useState<Record<number, number>>({});
  const [cashReceived, setCashReceived] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar los pedidos.");
      setOrders(data.orders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadOrders(); }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return orders;
    return orders.filter((order) => {
      const code = `ALT-${String(order.id).padStart(6, "0")}`.toLowerCase();
      return [code, order.customer?.name, order.customer?.phone, order.status, order.fulfillmentType]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    });
  }, [orders, query]);

  const simpleProducts = useMemo(() => {
    const all = catalog?.categories.flatMap((category) => category.products) ?? [];
    const unique = new Map<number, CatalogProduct>();
    all.forEach((product) => {
      if (!["PIZZA_SINGLE", "PIZZA_TWO_FLAVORS", "COMBO", "MODIFIER", "INTERNAL"].includes(product.type) && product.basePrice != null) unique.set(product.id, product);
    });
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [catalog]);

  async function openEdit(order: Order) {
    setEditError("");
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
      if (!settingsResponse.ok) throw new Error(settingsData.error || "No fue posible cargar Configuración.");
      if (!catalogResponse.ok) throw new Error(catalogData.error || "No fue posible cargar el catálogo.");
      const fullOrder = orderData.order as Order;
      setEditing(fullOrder);
      setSettings(settingsData.settings);
      setCatalog(catalogData);
      setEditFulfillment(fullOrder.fulfillmentType);
      setEditZoneId(fullOrder.deliveryZoneId || "");
      setQuantities(Object.fromEntries(fullOrder.items.map((item) => [item.id, item.quantity])));
      setAdditions({});
      setCashReceived(fullOrder.payments[0]?.cashReceived == null ? "" : String(fullOrder.payments[0].cashReceived));
    } catch (openError) {
      window.alert(openError instanceof Error ? openError.message : "No fue posible abrir el pedido.");
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
      await loadOrders();
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
          <div><p className="text-sm font-medium text-neutral-500">Operación</p><h1 className="text-3xl font-black tracking-tight">Pedidos</h1><p className="mt-1 text-sm text-neutral-500">Detalle, edición e impresión de órdenes creadas desde el POS.</p></div>
          <button onClick={() => void loadOrders()} className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-black">Actualizar</button>
        </header>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200"><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none focus:border-black focus:bg-white" placeholder="Buscar por número, cliente, teléfono o estado" /></section>

        {loading ? <div className="rounded-3xl bg-white p-8 text-sm text-neutral-500 shadow-sm ring-1 ring-neutral-200">Cargando pedidos...</div> : error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</div> : filtered.length === 0 ? <div className="rounded-3xl bg-white p-8 text-center text-sm text-neutral-500 shadow-sm ring-1 ring-neutral-200">No hay pedidos para mostrar.</div> : <div className="space-y-4">
          {filtered.map((order) => {
            const payment = order.payments[0];
            const code = `ALT-${String(order.id).padStart(6, "0")}`;
            return <article key={order.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">{code}</h2><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-black uppercase text-neutral-600">{statusLabel(order.status)}</span><span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black text-[var(--brand-red)]">{fulfillmentLabel(order.fulfillmentType)}</span></div>
                  <p className="mt-1 text-xs text-neutral-400">{new Date(order.createdAt).toLocaleString("es-CO")}</p>
                  <p className="mt-3 text-sm font-black">{order.customer?.name || "Cliente ocasional"}</p>
                  {order.customer?.phone && <p className="text-xs text-neutral-500">{order.customer.countryCode} {order.customer.phone}</p>}
                  {order.address?.address && <p className="mt-1 text-xs text-neutral-500">{order.address.address}{order.deliveryZoneName ? ` · ${order.deliveryZoneName}` : ""}</p>}
                  <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void openEdit(order)} disabled={order.status !== "CONFIRMED"} className="rounded-xl border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:text-neutral-300">Editar pedido</button><Link href={`/pedidos/${order.id}/imprimir`} target="_blank" className="rounded-xl bg-black px-3 py-2 text-xs font-black text-white">Imprimir 80 mm</Link></div>
                </div>
                <div className="grid min-w-[260px] grid-cols-2 gap-x-5 gap-y-1 text-xs"><span className="text-neutral-500">Subtotal</span><b className="text-right">{formatCOP(order.subtotal)}</b>{Number(order.deliveryFee) > 0 && <><span className="text-neutral-500">Domicilio</span><b className="text-right">{formatCOP(order.deliveryFee)}</b></>}{Number(order.discount) > 0 && <><span className="text-emerald-700">Descuento</span><b className="text-right text-emerald-700">− {formatCOP(order.discount)}</b></>}<span className="border-t border-dashed pt-2 font-black">Total</span><b className="border-t border-dashed pt-2 text-right text-lg text-[var(--brand-red)]">{formatCOP(order.total)}</b></div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_280px]"><div className="space-y-2">{order.items.map((item) => <OrderItemDetails key={item.id} item={item} />)}</div><div className="h-fit rounded-xl border p-3 text-xs"><div className="flex justify-between"><span className="text-neutral-500">Pago</span><b>{payment?.method || "Pendiente"}</b></div>{payment?.cashReceived != null && <><div className="mt-1 flex justify-between"><span className="text-neutral-500">Paga con</span><b>{formatCOP(payment.cashReceived)}</b></div><div className="mt-1 flex justify-between"><span className="text-neutral-500">Vueltas</span><b className="text-emerald-700">{formatCOP(payment.changeDue)}</b></div></>}{order.couponName && <div className="mt-1 flex justify-between"><span className="text-neutral-500">Cupón</span><b>{order.couponName}</b></div>}</div></div>
            </article>;
          })}
        </div>}
      </div>

      {editing && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-3"><div className="alento-card flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px]">
        <div className="flex items-start justify-between border-b px-5 py-4"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">Editar pedido</p><h2 className="text-2xl font-black">ALT-{String(editing.id).padStart(6, "0")}</h2><p className="text-xs text-neutral-500">Solo editable mientras siga Confirmado.</p></div><button onClick={() => setEditing(null)} disabled={saving} className="rounded-full bg-neutral-100 px-3 py-2 text-xs font-black">Cerrar</button></div>
        <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-5"><div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border p-4"><h3 className="font-black">Modalidad</h3><div className="mt-3 grid grid-cols-3 gap-2">{[["DELIVERY","Domicilio"],["PICKUP","Recoger"],["STORE","Local"]].map(([value,label]) => <button key={value} onClick={() => setEditFulfillment(value)} className={`rounded-xl border-2 px-2 py-2 text-xs font-black ${editFulfillment === value ? "border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]" : "border-neutral-200"}`}>{label}</button>)}</div>{editFulfillment === "DELIVERY" && <div className="mt-3"><p className="text-xs font-black">Tarifa de domicilio</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{settings?.deliveryBands.filter((zone) => zone.active).map((zone) => <button key={zone.id} onClick={() => setEditZoneId(zone.id)} className={`rounded-xl border-2 px-3 py-2 text-left text-xs ${editZoneId === zone.id ? "border-[var(--brand-red)] bg-red-50" : "border-neutral-200"}`}><b>{zone.name}</b><span className="block text-neutral-500">{formatCOP(zone.fee)}</span></button>)}</div></div>}</section>

          <section className="rounded-2xl border p-4"><h3 className="font-black">Productos actuales</h3><div className="mt-3 space-y-2">{editing.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#faf9f7] px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-black">{item.productName}</p><p className="text-[10px] text-neutral-400">{formatCOP(item.unitPrice)} c/u</p></div><div className="flex items-center gap-2"><button onClick={() => setQuantities((current) => ({ ...current, [item.id]: Math.max(0, (current[item.id] ?? item.quantity) - 1) }))} className="h-7 w-7 rounded-lg bg-white">−</button><b className="w-5 text-center text-xs">{quantities[item.id] ?? item.quantity}</b><button onClick={() => setQuantities((current) => ({ ...current, [item.id]: (current[item.id] ?? item.quantity) + 1 }))} className="h-7 w-7 rounded-lg bg-white">+</button></div></div>)}</div></section>

          <section className="rounded-2xl border p-4 lg:col-span-2"><h3 className="font-black">Agregar producto simple</h3><p className="mt-1 text-[10px] text-neutral-400">Ideal para bebidas, antojos y productos sin configuración. Pizzas y combos se agregan desde el POS.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{simpleProducts.map((product) => <div key={product.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-black">{product.name}</p><p className="text-[10px] text-neutral-400">{formatCOP(product.basePrice)}</p></div><div className="flex items-center gap-1"><button onClick={() => setAdditions((current) => ({ ...current, [product.id]: Math.max(0, (current[product.id] ?? 0) - 1) }))} className="h-7 w-7 rounded-lg bg-neutral-100">−</button><b className="w-4 text-center text-xs">{additions[product.id] ?? 0}</b><button onClick={() => setAdditions((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }))} className="h-7 w-7 rounded-lg bg-neutral-100">+</button></div></div>)}</div></section>

          {editing.payments[0]?.method?.toLowerCase() === "efectivo" && <section className="rounded-2xl border p-4 lg:col-span-2"><h3 className="font-black">Efectivo</h3><p className="mt-1 text-[10px] text-neutral-400">Si el total aumenta, actualiza el valor con el que paga el cliente.</p><div className="mt-3 relative max-w-xs"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-400">$</span><input value={cashReceived} onChange={(event) => setCashReceived(event.target.value.replace(/\D/g, ""))} className="alento-input w-full rounded-xl py-2 pl-7 pr-3 text-sm font-black" inputMode="numeric" /></div></section>}
        </div>{editError && <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{editError}</div>}</div>
        <div className="flex justify-end gap-2 border-t bg-white p-4"><button onClick={() => setEditing(null)} className="rounded-xl border px-4 py-2.5 text-xs font-black">Cancelar</button><button onClick={() => void saveEdit()} disabled={saving} className="rounded-xl bg-[var(--brand-red)] px-5 py-2.5 text-xs font-black text-white disabled:bg-neutral-300">{saving ? "Guardando..." : "Guardar cambios"}</button></div>
      </div></div>}
    </main>
  );
}
