"use client";

import { useEffect, useMemo, useState } from "react";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";
import { orderCode } from "@/lib/orderCode";
import { fulfillmentLabel, statusLabel, type FulfillmentType, type OrderStatus } from "@/lib/orderWorkflow";

type KitchenOrderItem = {
  id: number;
  productName: string;
  quantity: number;
  preparedQuantity: number;
  configuration: unknown;
  product?: {
    id: number;
    type: string;
    category?: { name: string; slug: string } | null;
  } | null;
};

type KitchenOrder = {
  id: number;
  sequenceNumber: number | null;
  source: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  createdAt: string;
  customer: { name: string } | null;
  items: KitchenOrderItem[];
};

function displayOrderCode(order: KitchenOrder) {
  return orderCode(order.sequenceNumber ?? order.id, order.source);
}

function ageMinutes(createdAt: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
}

function isKitchenItem(item: KitchenOrderItem) {
  return item.product?.category?.slug !== "bebidas";
}

function kitchenPriority(item: KitchenOrderItem) {
  if (item.product?.type === "PIZZA_SINGLE" || item.product?.type === "PIZZA_TWO_FLAVORS") return 0;
  if (item.product?.category?.slug === "antojos") return 1;
  if (item.product?.type === "COMBO") return 2;
  return 3;
}

function kitchenItemsFor(order: KitchenOrder) {
  return order.items
    .filter(isKitchenItem)
    .sort((a, b) => kitchenPriority(a) - kitchenPriority(b) || a.id - b.id);
}

function KitchenItem({
  item,
  busy,
  onChangePrepared,
}: {
  item: KitchenOrderItem;
  busy: boolean;
  onChangePrepared: (value: number) => void;
}) {
  const details = presentOrderItemConfiguration(item.configuration);
  const complete = item.preparedQuantity >= item.quantity;

  return (
    <div className={`rounded-2xl border p-2.5 transition ${complete ? "border-emerald-200 bg-emerald-50/70" : "border-neutral-200 bg-[#faf9f7]"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[11px] font-black ${complete ? "bg-emerald-600 text-white" : "bg-black text-white"}`}>{item.quantity}×</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="block text-[13px] font-black leading-5 text-neutral-950">{item.productName}</b>
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${complete ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-600"}`}>
              {item.preparedQuantity}/{item.quantity} preparados
            </span>
          </div>

          {details.length > 0 && (
            <div className="mt-1.5 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
              {details.map((detail, index) => (
                <p key={`${detail.label}-${index}`} className="text-[10.5px] leading-4 text-neutral-700">
                  <span className="font-black text-neutral-500">{detail.label}:</span> {detail.value}
                </p>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between gap-3 border-t border-black/5 pt-2">
            <span className="text-[10px] font-black uppercase tracking-[0.08em] text-neutral-400">Preparación</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy || item.preparedQuantity <= 0}
                onClick={() => onChangePrepared(Math.max(0, item.preparedQuantity - 1))}
                className="h-8 w-8 rounded-xl border border-neutral-200 bg-white text-lg font-black disabled:opacity-30"
              >
                −
              </button>
              <b className="min-w-9 text-center text-xs">{item.preparedQuantity}/{item.quantity}</b>
              <button
                type="button"
                disabled={busy || item.preparedQuantity >= item.quantity}
                onClick={() => onChangePrepared(Math.min(item.quantity, item.preparedQuantity + 1))}
                className="h-8 w-8 rounded-xl bg-[var(--brand-red)] text-lg font-black text-white disabled:bg-neutral-200 disabled:text-neutral-400"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

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

  const kitchenOrders = useMemo(
    () => orders
      .filter((order) => ["PREPARING", "PREPARED", "CONFIRMED"].includes(order.status))
      .filter((order) => kitchenItemsFor(order).length > 0)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [orders],
  );

  async function changePrepared(order: KitchenOrder, item: KitchenOrderItem, preparedQuantity: number) {
    const key = `${order.id}:${item.id}`;
    setBusyKey(key);
    setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}/items/${item.id}/prepared`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preparedQuantity }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible actualizar el producto.");
      await loadOrders(true);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No fue posible actualizar el producto.");
    } finally {
      setBusyKey(null);
    }
  }

  async function markReady(order: KitchenOrder) {
    setBusyOrderId(order.id);
    setError("");
    try {
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
      setBusyOrderId(null);
    }
  }

  return (
    <main className="p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <section className="rounded-[28px] bg-[radial-gradient(circle_at_88%_20%,rgba(229,28,17,.24),transparent_28%),linear-gradient(135deg,#09090a,#181516)] px-6 py-5 text-white shadow-[0_20px_55px_rgba(20,16,14,.12)] md:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Producción</p>
              <h1 className="mt-0.5 text-3xl font-black tracking-[-0.035em]">Cocina</h1>
              <p className="mt-0.5 text-sm text-white/65">Primero pizzas, luego antojos. Las bebidas quedan fuera de preparación.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">En cocina</p>
              <b className="text-2xl">{kitchenOrders.length}</b>
            </div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-sm text-neutral-500 shadow-sm ring-1 ring-neutral-200">Cargando pedidos...</div>
        ) : kitchenOrders.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-neutral-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-2xl">✓</div>
            <h2 className="mt-4 text-xl font-black">Cocina al día</h2>
            <p className="mt-1 text-sm text-neutral-500">No hay pedidos pendientes de preparación.</p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {kitchenOrders.map((order) => {
              const minutes = ageMinutes(order.createdAt);
              const prepared = order.status === "PREPARED";
              const kitchenItems = kitchenItemsFor(order);
              const completedUnits = kitchenItems.reduce((sum, item) => sum + Math.min(item.preparedQuantity ?? 0, item.quantity), 0);
              const totalUnits = kitchenItems.reduce((sum, item) => sum + item.quantity, 0);
              const percent = totalUnits ? Math.round((completedUnits / totalUnits) * 100) : 0;
              const orderBusy = busyOrderId === order.id;

              return (
                <article key={order.id} className="overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-[0_12px_32px_rgba(28,23,20,.055)]">
                  <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[18px] font-black tracking-[-0.025em]">{displayOrderCode(order)}</h2>
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[9px] font-black uppercase text-[var(--brand-red)]">{fulfillmentLabel(order.fulfillmentType)}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${prepared ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{statusLabel(order.status === "CONFIRMED" ? "PREPARING" : order.status)}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-neutral-500">{order.customer?.name || "Cliente local"}</p>
                    </div>
                    <div className={`rounded-xl px-3 py-2 text-center ${minutes >= 20 ? "bg-red-50 text-red-700" : minutes >= 10 ? "bg-amber-50 text-amber-700" : "bg-neutral-100 text-neutral-700"}`}>
                      <b className="block text-lg leading-none">{minutes}</b>
                      <span className="text-[9px] font-black uppercase">min</span>
                    </div>
                  </div>

                  <div className="px-4 pt-3">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.06em] text-neutral-500">
                      <span>Progreso de preparación</span>
                      <span>{completedUnits}/{totalUnits} · {percent}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full rounded-full bg-[var(--brand-red)] transition-all" style={{ width: `${percent}%` }} />
                    </div>
                  </div>

                  <div className="space-y-2 p-4">
                    {kitchenItems.map((item) => (
                      <KitchenItem
                        key={item.id}
                        item={{ ...item, preparedQuantity: Number(item.preparedQuantity ?? 0) }}
                        busy={busyKey === `${order.id}:${item.id}` || prepared}
                        onChangePrepared={(value) => void changePrepared(order, item, value)}
                      />
                    ))}
                  </div>

                  <div className="border-t border-neutral-100 bg-[#faf9f7] p-3.5">
                    {prepared ? (
                      <button
                        type="button"
                        onClick={() => void markReady(order)}
                        disabled={orderBusy}
                        className="w-full rounded-2xl bg-[var(--brand-red)] px-5 py-3.5 text-sm font-black uppercase tracking-[0.05em] text-white shadow-sm disabled:opacity-50"
                      >
                        {orderBusy ? "Actualizando..." : "Marcar como listo"}
                      </button>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center text-[11px] font-bold text-amber-800">
                        Completa todos los productos para pasar el pedido a PREPARADO.
                      </div>
                    )}
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
