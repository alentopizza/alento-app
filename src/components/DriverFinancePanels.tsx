"use client";

import { useCallback, useEffect, useState } from "react";

type PeriodSummary = {
  deliveries: number;
  earnings: number;
};

type FinancePayload = {
  performance: {
    today: PeriodSummary;
    week: PeriodSummary;
    month: PeriodSummary;
  };
  wallet: {
    available: number;
    earnedTotal: number;
    paidTotal: number;
  };
  recentDeliveries: Array<{
    id: number;
    code: string;
    customerName: string;
    neighborhood: string;
    deliveryFee: number;
    earning: number | null;
    earningKind: string | null;
    deliveredAt: string | null;
  }>;
  movements: Array<{
    id: string;
    kind: "EARNING" | "PAYOUT";
    amount: number;
    occurredAt: string;
    title: string;
    detail: string;
  }>;
};

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PerformanceCard({
  label,
  summary,
  featured = false,
}: {
  label: string;
  summary: PeriodSummary;
  featured?: boolean;
}) {
  return (
    <div
      className={
        "rounded-[20px] border p-4 " +
        (featured
          ? "border-[#e21a22]/25 bg-[#e21a22]/10"
          : "border-white/10 bg-white/[0.045]")
      }
    >
      <span
        className={
          "text-[8px] font-black uppercase tracking-[0.12em] " +
          (featured ? "text-[#ff6267]" : "text-white/32")
        }
      >
        {label}
      </span>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <b className="block text-[28px] font-black leading-none tracking-[-0.04em]">
            {summary.deliveries}
          </b>
          <span className="mt-1 block text-[9px] font-semibold text-white/38">
            entregas realizadas
          </span>
        </div>
        <div className="text-right">
          <b
            className={
              "block text-[15px] font-black " +
              (featured ? "text-[#ff6267]" : "text-emerald-300")
            }
          >
            {money(summary.earnings)}
          </b>
          <span className="mt-1 block text-[8px] text-white/30">
            generado
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DriverFinancePanels({
  tab,
}: {
  tab: "performance" | "wallet";
}) {
  const [data, setData] = useState<FinancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/repartidor/finances", {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "No fue posible cargar tus movimientos.",
        );
      }

      setData(payload);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar tus movimientos.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load();

    const timer = window.setInterval(() => {
      void load();
    }, 15_000);

    return () => window.clearInterval(timer);
  }, [load, tab]);

  if (loading && !data) {
    return (
      <div className="mx-auto mt-8 w-full max-w-[760px] rounded-[24px] border border-white/10 bg-[#111] p-6 text-center text-[11px] font-bold text-white/45">
        Cargando tus datos…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto mt-8 w-full max-w-[760px] rounded-[24px] border border-[#e21a22]/25 bg-[#210b0d] p-5 text-center text-[11px] font-semibold text-[#ff8b8f]">
        {error}
      </div>
    );
  }

  if (!data) return null;

  if (tab === "performance") {
    return (
      <div className="mx-auto w-full max-w-[760px] space-y-4">
        <section className="overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_88%_12%,rgba(226,26,34,.30),transparent_34%),linear-gradient(145deg,#111,#171112)] p-5 shadow-[0_20px_60px_rgba(0,0,0,.28)]">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ff5a60]">
            Mi desempeño
          </p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <b className="block text-[38px] font-black leading-none tracking-[-0.05em]">
                {data.performance.today.deliveries}
              </b>
              <span className="mt-1 block text-[10px] font-semibold text-white/42">
                entregas hoy
              </span>
            </div>
            <div className="text-right">
              <span className="block text-[8px] font-black uppercase tracking-[0.1em] text-white/35">
                Ganado hoy
              </span>
              <b className="mt-1 block text-[24px] font-black text-emerald-300">
                {money(data.performance.today.earnings)}
              </b>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <PerformanceCard
            label="Hoy"
            summary={data.performance.today}
            featured
          />
          <PerformanceCard
            label="Esta semana"
            summary={data.performance.week}
          />
          <PerformanceCard
            label="Este mes"
            summary={data.performance.month}
          />
        </div>

        <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.13em] text-[#ff5a60]">
                Actividad reciente
              </p>
              <b className="mt-0.5 block text-[13px]">
                Últimas entregas
              </b>
            </div>
            <span className="rounded-full bg-white/[0.055] px-2.5 py-1 text-[8px] font-bold text-white/38">
              {data.recentDeliveries.length}
            </span>
          </div>

          <div className="divide-y divide-white/[0.07]">
            {data.recentDeliveries.length ? (
              data.recentDeliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-400/10 text-lg">
                    ✓
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <b className="text-[11px]">{delivery.code}</b>
                      {delivery.earningKind === "FREE_DELIVERY" && (
                        <span className="rounded-full border border-amber-300/15 bg-amber-300/10 px-2 py-0.5 text-[7px] font-black uppercase text-amber-200">
                          Incentivo
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[9px] font-semibold text-white/48">
                      {delivery.customerName} · {delivery.neighborhood}
                    </p>
                    <span className="mt-0.5 block text-[8px] text-white/25">
                      {dateLabel(delivery.deliveredAt)}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <b className="block text-[11px] text-emerald-300">
                      {delivery.earning == null
                        ? "Histórico"
                        : "+ " + money(delivery.earning)}
                    </b>
                    <span className="mt-0.5 block text-[7px] text-white/26">
                      domicilio {money(delivery.deliveryFee)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-[10px] font-semibold text-white/32">
                Tus entregas realizadas aparecerán aquí.
              </div>
            )}
          </div>
        </section>

        {data.recentDeliveries.some(
          (delivery) => delivery.earning == null,
        ) && (
          <div className="rounded-[16px] border border-white/10 bg-white/[0.035] px-4 py-3 text-[8px] leading-4 text-white/35">
            Las entregas marcadas como Histórico ocurrieron antes de activar la cartera de repartidores. Cuentan en desempeño, pero no crean un saldo retroactivo.
          </div>
        )}

        {error && (
          <div className="rounded-[16px] border border-[#e21a22]/20 bg-[#210b0d] px-4 py-3 text-[9px] font-semibold text-[#ff8b8f]">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_85%_10%,rgba(226,26,34,.28),transparent_34%),linear-gradient(145deg,#0e0e0f,#181112)] p-5 shadow-[0_22px_70px_rgba(0,0,0,.34)]">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ff5a60]">
          Mi cartera
        </p>
        <span className="mt-4 block text-[9px] font-black uppercase tracking-[0.1em] text-white/35">
          Saldo disponible
        </span>
        <b className="mt-1 block text-[40px] font-black leading-none tracking-[-0.05em]">
          {money(data.wallet.available)}
        </b>
        <p className="mt-3 max-w-md text-[9px] leading-4 text-white/36">
          Este es el saldo acumulado por domicilios entregados menos los pagos que Alentó ya te ha realizado.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[20px] border border-emerald-300/10 bg-emerald-400/[0.07] p-4">
          <span className="text-[8px] font-black uppercase tracking-[0.1em] text-emerald-300/65">
            Generado
          </span>
          <b className="mt-2 block text-[18px] font-black text-emerald-300">
            {money(data.wallet.earnedTotal)}
          </b>
          <span className="mt-1 block text-[8px] text-white/28">
            domicilios liquidados
          </span>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-white/[0.045] p-4">
          <span className="text-[8px] font-black uppercase tracking-[0.1em] text-white/36">
            Pagado
          </span>
          <b className="mt-2 block text-[18px] font-black text-white/80">
            {money(data.wallet.paidTotal)}
          </b>
          <span className="mt-1 block text-[8px] text-white/28">
            pagos registrados
          </span>
        </div>
      </div>

      <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111]">
        <div className="border-b border-white/10 px-4 py-3.5">
          <p className="text-[8px] font-black uppercase tracking-[0.13em] text-[#ff5a60]">
            Historial
          </p>
          <b className="mt-0.5 block text-[13px]">Movimientos de cartera</b>
        </div>

        <div className="divide-y divide-white/[0.07]">
          {data.movements.length ? (
            data.movements.map((movement) => {
              const earning = movement.kind === "EARNING";
              return (
                <div
                  key={movement.id}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <div
                    className={
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-base " +
                      (earning
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-white/[0.055] text-white/55")
                    }
                  >
                    {earning ? "↗" : "↙"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <b className="block text-[10px]">
                      {movement.title}
                    </b>
                    <p className="mt-0.5 truncate text-[8px] text-white/34">
                      {movement.detail}
                    </p>
                    <span className="mt-0.5 block text-[7px] text-white/22">
                      {dateLabel(movement.occurredAt)}
                    </span>
                  </div>
                  <b
                    className={
                      "shrink-0 text-[11px] " +
                      (earning ? "text-emerald-300" : "text-[#ff7075]")
                    }
                  >
                    {earning ? "+" : "−"} {money(movement.amount)}
                  </b>
                </div>
              );
            })
          ) : (
            <div className="px-4 py-8 text-center text-[10px] font-semibold text-white/32">
              Aún no tienes movimientos de cartera.
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-[16px] border border-[#e21a22]/20 bg-[#210b0d] px-4 py-3 text-[9px] font-semibold text-[#ff8b8f]">
          {error}
        </div>
      )}
    </div>
  );
}
