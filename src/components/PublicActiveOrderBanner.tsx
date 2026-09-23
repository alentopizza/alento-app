"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type ActiveOrder = {
  id: number;
  code: string;
  status: string;
  fulfillmentType: "DELIVERY" | "PICKUP" | "STORE";
  total: number;
  trackingPath: string | null;
};

type Stage = {
  label: string;
};

const DELIVERY_STAGES: Stage[] = [
  { label: "Preparando" },
  { label: "Horneando" },
  { label: "Listo" },
  { label: "En camino" },
  { label: "Entregado" },
];

const PICKUP_STAGES: Stage[] = [
  { label: "Preparando" },
  { label: "Horneando" },
  { label: "Listo para recoger" },
  { label: "Finalizado" },
];

function stageIndex(order: ActiveOrder) {
  const status = order.status;

  if (order.fulfillmentType === "DELIVERY") {
    if (["DRAFT", "CONFIRMED", "PREPARING"].includes(status)) return 0;
    if (status === "PREPARED") return 1;
    if (status === "READY") return 2;
    if (status === "OUT_FOR_DELIVERY") return 3;
    if (["ARRIVED", "DELIVERED"].includes(status)) return 4;
    return 0;
  }

  if (["DRAFT", "CONFIRMED", "PREPARING"].includes(status)) return 0;
  if (status === "PREPARED") return 1;
  if (status === "READY") return 2;
  return 3;
}

function statusTitle(order: ActiveOrder) {
  const labels: Record<string, string> = {
    DRAFT: "Recibimos tu pedido",
    CONFIRMED: "Pedido confirmado",
    PREPARING: "Estamos preparando tu pedido",
    PREPARED: "Tu pedido está horneándose",
    READY:
      order.fulfillmentType === "DELIVERY"
        ? "Tu pedido está listo para salir"
        : "Tu pedido está listo para recoger",
    OUT_FOR_DELIVERY: "Tu pedido va en camino",
    ARRIVED: "Tu pedido ya llegó",
    DELIVERED: "Pedido entregado",
  };

  return labels[order.status] ?? "Tu pedido está en proceso";
}

function OrderCard({ order }: { order: ActiveOrder }) {
  const stages =
    order.fulfillmentType === "DELIVERY" ? DELIVERY_STAGES : PICKUP_STAGES;
  const current = stageIndex(order);

  return (
    <article className="min-w-full snap-center">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#ff3439]">
            Pedido en proceso · {order.code}
          </p>
          <h2 className="mt-1 text-[15px] font-bold tracking-[-0.02em]">
            {statusTitle(order)}
          </h2>
        </div>

        {order.trackingPath && (
          <Link
            href={order.trackingPath}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-[8px] font-bold text-white/70"
          >
            Ver pedido
          </Link>
        )}
      </div>

      <div className="relative mt-4">
        <div
          className="absolute top-[10px] grid"
          style={{
            left: `${100 / (stages.length * 2)}%`,
            right: `${100 / (stages.length * 2)}%`,
            gridTemplateColumns: `repeat(${Math.max(1, stages.length - 1)}, minmax(0, 1fr))`,
          }}
        >
          {stages.slice(0, -1).map((_, index) => {
            const completed = index < current;
            const activeSegment = index === current && current < stages.length - 1;

            return (
              <div
                key={index}
                className="relative h-[2px] overflow-hidden bg-white/10"
              >
                {completed && <div className="absolute inset-0 bg-[#e21a22]" />}

                {activeSegment && (
                  <>
                    <div className="absolute inset-0 bg-[#e21a22]/18" />
                    <div className="alento-progress-runner absolute inset-y-0 left-0 w-full origin-left bg-[linear-gradient(90deg,rgba(226,26,34,.22),#ff3439_55%,#ff7a7e)] shadow-[0_0_10px_rgba(255,52,57,.55)]" />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="relative grid gap-1"
          style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
        >
          {stages.map((stage, index) => {
            const completed = index < current;
            const active = index === current;

            return (
              <div key={stage.label} className="min-w-0 text-center">
                <div
                  className={
                    "relative mx-auto flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-black transition " +
                    (completed
                      ? "border-[#e21a22] bg-[#e21a22] text-white"
                      : active
                        ? "border-[#ff454b] bg-[#ff454b]/20 text-[#ff454b] ring-4 ring-[#e21a22]/10"
                        : "border-white/20 bg-[#111] text-white/30")
                  }
                >
                  {active && current < stages.length - 1 && (
                    <span className="alento-progress-pulse absolute inset-[-5px] rounded-full border border-[#ff454b]/30" />
                  )}
                  <span className="relative z-10">{completed ? "✓" : index + 1}</span>
                </div>
                <span
                  className={
                    "mt-2 block truncate text-[7px] font-semibold sm:text-[8px] " +
                    (active ? "text-white" : completed ? "text-white/60" : "text-white/25")
                  }
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

export default function PublicActiveOrderBanner({
  className = "",
}: {
  className?: string;
}) {
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/auth/customer/active-order", {
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled) {
          const nextOrders: ActiveOrder[] = data?.authenticated
            ? Array.isArray(data.orders)
              ? data.orders
              : data.order
                ? [data.order]
                : []
            : [];

          setOrders(nextOrders);
          setActiveIndex((current) =>
            nextOrders.length ? Math.min(current, nextOrders.length - 1) : 0,
          );
        }
      } catch {
        // Este indicador no debe bloquear la navegación pública.
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 8000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  function goTo(index: number) {
    const rail = railRef.current;
    if (!rail || !orders.length) return;

    const target = Math.max(0, Math.min(index, orders.length - 1));
    rail.scrollTo({
      left: rail.clientWidth * target,
      behavior: "smooth",
    });
    setActiveIndex(target);
  }

  function handleScroll() {
    const rail = railRef.current;
    if (!rail || !rail.clientWidth) return;
    const index = Math.round(rail.scrollLeft / rail.clientWidth);
    setActiveIndex(Math.max(0, Math.min(index, orders.length - 1)));
  }

  if (!orders.length) return null;

  return (
    <section
      className={
        "overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,#171717,#101010)] p-4 text-white shadow-[0_14px_38px_rgba(0,0,0,.24)] " +
        className
      }
    >
      {orders.length > 1 && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.13em] text-white/35">
              {orders.length} pedidos activos
            </p>
            <p className="mt-0.5 text-[8px] text-white/25">
              Desliza para ver los demás
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              disabled={activeIndex === 0}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[14px] text-white/60 disabled:opacity-20"
              aria-label="Pedido anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              disabled={activeIndex === orders.length - 1}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[14px] text-white/60 disabled:opacity-20"
              aria-label="Pedido siguiente"
            >
              ›
            </button>
          </div>
        </div>
      )}

      <div
        ref={railRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>

      {orders.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {orders.map((order, index) => (
            <button
              key={order.id}
              type="button"
              onClick={() => goTo(index)}
              className={
                "h-1.5 rounded-full transition-all " +
                (index === activeIndex
                  ? "w-5 bg-[#e21a22]"
                  : "w-1.5 bg-white/20")
              }
              aria-label={`Ver ${order.code}`}
            />
          ))}
        </div>
      )}


    </section>
  );
}
