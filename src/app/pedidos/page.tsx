"use client";

import { useEffect, useMemo, useState } from "react";

type OrderItem = {
  id: number;
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

type Order = {
  id: number;
  status: string;
  fulfillmentType: string;
  subtotal: string | number;
  deliveryFee: string | number;
  discount: string | number;
  total: string | number;
  couponName: string | null;
  deliveryZoneName: string | null;
  discountSource: string;
  createdAt: string;
  customer: { id: number; name: string; countryCode: string; phone: string | null } | null;
  address: { id: number; address: string } | null;
  items: OrderItem[];
  payments: Payment[];
};

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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

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

  useEffect(() => {
    void loadOrders();
  }, []);

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

  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">Operación</p>
            <h1 className="text-3xl font-black tracking-tight">Pedidos</h1>
            <p className="mt-1 text-sm text-neutral-500">Órdenes creadas y guardadas desde el POS.</p>
          </div>
          <button onClick={() => void loadOrders()} className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-black">Actualizar</button>
        </header>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none focus:border-black focus:bg-white" placeholder="Buscar por número, cliente, teléfono o estado" />
        </section>

        {loading ? <div className="rounded-3xl bg-white p-8 text-sm text-neutral-500 shadow-sm ring-1 ring-neutral-200">Cargando pedidos...</div> : error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</div> : filtered.length === 0 ? <div className="rounded-3xl bg-white p-8 text-center text-sm text-neutral-500 shadow-sm ring-1 ring-neutral-200">No hay pedidos para mostrar.</div> : <div className="space-y-3">
          {filtered.map((order) => {
            const payment = order.payments[0];
            const code = `ALT-${String(order.id).padStart(6, "0")}`;
            return <article key={order.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black">{code}</h2>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-black uppercase text-neutral-600">{statusLabel(order.status)}</span>
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black text-[var(--brand-red)]">{fulfillmentLabel(order.fulfillmentType)}</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-400">{new Date(order.createdAt).toLocaleString("es-CO")}</p>
                  <p className="mt-3 text-sm font-black">{order.customer?.name || "Cliente ocasional"}</p>
                  {order.customer?.phone && <p className="text-xs text-neutral-500">{order.customer.countryCode} {order.customer.phone}</p>}
                  {order.address?.address && <p className="mt-1 text-xs text-neutral-500">{order.address.address}{order.deliveryZoneName ? ` · ${order.deliveryZoneName}` : ""}</p>}
                </div>

                <div className="grid min-w-[260px] grid-cols-2 gap-x-5 gap-y-1 text-xs">
                  <span className="text-neutral-500">Subtotal</span><b className="text-right">{formatCOP(order.subtotal)}</b>
                  {Number(order.deliveryFee) > 0 && <><span className="text-neutral-500">Domicilio</span><b className="text-right">{formatCOP(order.deliveryFee)}</b></>}
                  {Number(order.discount) > 0 && <><span className="text-emerald-700">Descuento</span><b className="text-right text-emerald-700">− {formatCOP(order.discount)}</b></>}
                  <span className="border-t border-dashed pt-2 font-black">Total</span><b className="border-t border-dashed pt-2 text-right text-lg text-[var(--brand-red)]">{formatCOP(order.total)}</b>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_280px]">
                <div className="space-y-1.5">
                  {order.items.map((item) => <div key={item.id} className="flex justify-between gap-3 rounded-xl bg-[#faf9f7] px-3 py-2 text-xs"><span><b>{item.quantity} × {item.productName}</b></span><b>{formatCOP(item.lineTotal)}</b></div>)}
                </div>
                <div className="rounded-xl border p-3 text-xs">
                  <div className="flex justify-between"><span className="text-neutral-500">Pago</span><b>{payment?.method || "Pendiente"}</b></div>
                  {payment?.cashReceived != null && <><div className="mt-1 flex justify-between"><span className="text-neutral-500">Paga con</span><b>{formatCOP(payment.cashReceived)}</b></div><div className="mt-1 flex justify-between"><span className="text-neutral-500">Vueltas</span><b className="text-emerald-700">{formatCOP(payment.changeDue)}</b></div></>}
                  {order.couponName && <div className="mt-1 flex justify-between"><span className="text-neutral-500">Cupón</span><b>{order.couponName}</b></div>}
                </div>
              </div>
            </article>;
          })}
        </div>}
      </div>
    </main>
  );
}
