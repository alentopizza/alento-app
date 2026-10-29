"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OrderStatusFlow from "@/components/OrderStatusFlow";
import {
  fulfillmentLabel,
  nextStatus,
  statusLabel,
  type FulfillmentType,
  type OrderStatus,
} from "@/lib/orderWorkflow";

type WorkflowOrder = {
  id: number;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  createdAt: string;
  total: string | number;
  customer: { name: string } | null;
};

function formatCOP(value: string | number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function orderCode(id: number) {
  return `ALT-${String(id).padStart(6, "0")}`;
}

export default function OrdersWorkflowManager() {
  const [orders, setOrders] = useState<WorkflowOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar el flujo de pedidos.");
      setOrders(data.orders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el flujo de pedidos.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const activeOrders = useMemo(
    () => orders
      .filter((order) => !["COMPLETED", "CANCELED", "DRAFT"].includes(order.status))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [orders],
  );

  async function advance(order: WorkflowOrder) {
    const normalizedStatus = order.status === "CONFIRMED" ? "PREPARING" : order.status;
    const next = nextStatus(order.status, order.fulfillmentType);
    if (!next || ["PREPARING", "PREPARED"].includes(normalizedStatus)) return;

    setBusyId(order.id);
    setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible avanzar el pedido.");
      await load(true);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No fue posible avanzar el pedido.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="px-5 pt-5 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-neutral-100 bg-[#0c0c0d] px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/45">Flujo operativo</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">Pedidos activos</h2>
            <p className="mt-1 text-xs text-white/50">Cocina controla En preparación → Preparado → Listo. Después continúa despacho y cierre.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black">{activeOrders.length} activos</span>
            <button onClick={() => void load()} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-black">Actualizar</button>
          </div>
        </div>

        {error && <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-xs font-bold text-red-700">{error}</div>}

        {loading ? (
          <div className="p-6 text-sm text-neutral-500">Cargando flujo...</div>
        ) : activeOrders.length === 0 ? (
          <div className="p-7 text-center">
            <p className="text-sm font-black">No hay pedidos activos</p>
            <p className="mt-1 text-xs text-neutral-500">Los nuevos pedidos aparecerán aquí y en Cocina.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {activeOrders.map((order) => {
              const normalizedStatus = order.status === "CONFIRMED" ? "PREPARING" : order.status;
              const next = nextStatus(order.status, order.fulfillmentType);
              const kitchenManaged = ["PREPARING", "PREPARED"].includes(normalizedStatus);
              const busy = busyId === order.id;

              return (
                <article key={order.id} className="p-4 sm:p-5">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-base font-black">{orderCode(order.id)}</b>
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[9px] font-black uppercase text-[var(--brand-red)]">{fulfillmentLabel(order.fulfillmentType)}</span>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-black uppercase text-neutral-600">{statusLabel(normalizedStatus)}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-neutral-500">{order.customer?.name || "Cliente local"} · {formatCOP(order.total)}</p>
                    </div>

                    {kitchenManaged ? (
                      <Link href="/cocina" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-black px-4 text-xs font-black text-white">
                        Ver en Cocina
                      </Link>
                    ) : next ? (
                      <button
                        type="button"
                        onClick={() => void advance(order)}
                        disabled={busy}
                        className="min-h-10 rounded-xl bg-[var(--brand-red)] px-4 text-xs font-black uppercase tracking-[0.035em] text-white disabled:opacity-50"
                      >
                        {busy ? "Actualizando..." : `Marcar ${statusLabel(next)}`}
                      </button>
                    ) : null}
                  </div>

                  <OrderStatusFlow status={order.status} fulfillmentType={order.fulfillmentType} compact />
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
