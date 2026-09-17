"use client";

import { useEffect, useMemo, useState } from "react";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";
import { fulfillmentLabel, statusLabel, type FulfillmentType, type OrderStatus } from "@/lib/orderWorkflow";

type KitchenOrderItem = {
  id: number;
  productName: string;
  quantity: number;
  configuration: unknown;
};

type KitchenOrder = {
  id: number;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  createdAt: string;
  customer: { name: string } | null;
  items: KitchenOrderItem[];
};

function orderCode(id: number) {
  return `ALT-${String(id).padStart(6, "0")}`;
}

function ageMinutes(createdAt: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
}

function KitchenItem({ item }: { item: KitchenOrderItem }) {
  const details = presentOrderItemConfiguration(item.configuration);
  return (
    <div className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3">
      <div className="flex items-start gap-2">
        <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-black px-2 text-xs font-black text-white">{item.quantity}×</span>
        <div className="min-w-0 flex-1">
          <b className="block text-sm font-black leading-5 text-neutral-950">{item.productName}</b>
          {details.length > 0 && (
            <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {details.map((detail, index) => (
                <p key={`${detail.label}-${index}`} className="text-[11px] leading-4 text-neutral-700">
                  <span className="font-black text-neutral-500">{detail.label}:</span> {detail.value}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function loadOrders(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar Cocina.");
      setOrders(data.orders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar Cocina.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
    const timer = window.setInterval(() => void loadOrders(true), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const preparing = useMemo(
    () => orders
      .filter((order) => order.status === "PREPARING" || order.status === "CONFIRMED")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [orders],
  );

  async function markReady(order: KitchenOrder) {
    setBusyId(order.id);
    setError("");
    try {
      // Compatibilidad con órdenes antiguas que todavía estén CONFIRMED.
      if (order.status === "CONFIRMED") {
        const prepareResponse = await fetch(`/api/orders/${order.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "PREPARING" }),
        });
        const prepareData = await prepareResponse.json();
        if (!prepareResponse.ok) throw new Error(prepareData.error || "No fue posible iniciar preparación.");
      }

      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "READY" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible marcar el pedido como listo.");
      await loadOrders(true);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No fue posible actualizar el pedido.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="alento-dark rounded-[28px] px-6 py-5 text-white shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Producción</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Cocina</h1>
              <p className="mt-1 text-sm text-white/60">Pedidos en preparación ordenados por hora de llegada.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/45">En cocina</p>
              <b className="text-2xl">{preparing.length}</b>
            </div>
          </div>
        </header>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-sm text-neutral-500 shadow-sm ring-1 ring-neutral-200">Cargando pedidos...</div>
        ) : preparing.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-neutral-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-2xl">✓</div>
            <h2 className="mt-4 text-xl font-black">Cocina al día</h2>
            <p className="mt-1 text-sm text-neutral-500">No hay pedidos pendientes de preparación.</p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {preparing.map((order) => {
              const minutes = ageMinutes(order.createdAt);
              const busy = busyId === order.id;
              return (
                <article key={order.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200">
                  <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black">{orderCode(order.id)}</h2>
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[9px] font-black uppercase text-[var(--brand-red)]">{fulfillmentLabel(order.fulfillmentType)}</span>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-black uppercase text-neutral-700">{statusLabel(order.status)}</span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">{order.customer?.name || "Cliente local"}</p>
                    </div>
                    <div className={`rounded-xl px-3 py-2 text-center ${minutes >= 20 ? "bg-red-50 text-red-700" : minutes >= 10 ? "bg-amber-50 text-amber-700" : "bg-neutral-100 text-neutral-700"}`}>
                      <b className="block text-lg leading-none">{minutes}</b>
                      <span className="text-[9px] font-black uppercase">min</span>
                    </div>
                  </div>

                  <div className="space-y-2 p-5">
                    {order.items.map((item) => <KitchenItem key={item.id} item={item} />)}
                  </div>

                  <div className="border-t border-neutral-100 bg-[#faf9f7] p-4">
                    <button
                      type="button"
                      onClick={() => void markReady(order)}
                      disabled={busy}
                      className="w-full rounded-2xl bg-[var(--brand-red)] px-5 py-3.5 text-sm font-black uppercase tracking-[0.05em] text-white shadow-sm disabled:opacity-50"
                    >
                      {busy ? "Actualizando..." : "Marcar como listo"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
