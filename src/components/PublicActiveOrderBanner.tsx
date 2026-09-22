"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  { label: "Listo" },
  { label: "En camino" },
  { label: "Entregado" },
];

const PICKUP_STAGES: Stage[] = [
  { label: "Preparando" },
  { label: "Preparado" },
  { label: "Listo para recoger" },
  { label: "Finalizando" },
];

function stageIndex(order: ActiveOrder) {
  const status = order.status;

  if (order.fulfillmentType === "DELIVERY") {
    if (["DRAFT", "CONFIRMED", "PREPARING", "PREPARED"].includes(status)) return 0;
    if (status === "READY") return 1;
    if (status === "OUT_FOR_DELIVERY") return 2;
    if (["ARRIVED", "DELIVERED"].includes(status)) return 3;
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
    PREPARED: "Tu pedido ya está preparado",
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

export default function PublicActiveOrderBanner({
  className = "",
}: {
  className?: string;
}) {
  const [order, setOrder] = useState<ActiveOrder | null>(null);

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
          setOrder(data?.authenticated ? data.order ?? null : null);
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

  if (!order) return null;

  const stages =
    order.fulfillmentType === "DELIVERY" ? DELIVERY_STAGES : PICKUP_STAGES;
  const current = stageIndex(order);

  return (
    <section
      className={
        "overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,#171717,#101010)] p-4 text-white shadow-[0_14px_38px_rgba(0,0,0,.24)] " +
        className
      }
    >
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
        <div className="absolute left-[12.5%] right-[12.5%] top-[10px] grid grid-cols-3">
          {stages.slice(0, -1).map((_, index) => {
            const completed = index < current;
            const activeSegment = index === current && current < stages.length - 1;

            return (
              <div
                key={index}
                className="relative h-[2px] overflow-hidden bg-white/10"
              >
                {completed && (
                  <div className="absolute inset-0 bg-[#e21a22]" />
                )}

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

        <div className="relative grid grid-cols-4 gap-1">
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

        <style jsx>{`
          @keyframes alentoProgressRunner {
            0% {
              transform: scaleX(0.08);
              opacity: 0.45;
            }
            68% {
              transform: scaleX(0.82);
              opacity: 1;
            }
            86% {
              transform: scaleX(0.96);
              opacity: 1;
            }
            100% {
              transform: scaleX(0.96);
              opacity: 0;
            }
          }

          @keyframes alentoProgressPulse {
            0%,
            100% {
              transform: scale(0.88);
              opacity: 0.25;
            }
            50% {
              transform: scale(1.2);
              opacity: 0.8;
            }
          }

          .alento-progress-runner {
            animation: alentoProgressRunner 2.4s ease-in-out infinite;
          }

          .alento-progress-pulse {
            animation: alentoProgressPulse 1.8s ease-in-out infinite;
          }

          @media (prefers-reduced-motion: reduce) {
            .alento-progress-runner,
            .alento-progress-pulse {
              animation: none;
            }

            .alento-progress-runner {
              transform: scaleX(0.55);
              opacity: 0.85;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
