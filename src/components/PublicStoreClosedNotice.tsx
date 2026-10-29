"use client";

import { useEffect, useState } from "react";

type PublicStoreStatus = {
  open: boolean;
  currentDay: string;
  currentDayLabel: string;
  closesAt: string | null;
  nextOpening: {
    day: string;
    dayLabel: string;
    relativeLabel: string;
    time: string;
    timeLabel: string;
  } | null;
  address: string;
  whatsapp: string;
  whatsappHref: string;
  hours: Array<{
    day: string;
    dayLabel: string;
    enabled: boolean;
    open: string;
    close: string;
    rangeLabel: string;
  }>;
};

export default function PublicStoreClosedNotice() {
  const [status, setStatus] = useState<PublicStoreStatus | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/public-store-status", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!cancelled && response.ok) {
          setStatus(data as PublicStoreStatus);
        }
      } catch {
        // El aviso no debe bloquear la navegación si falla una consulta.
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!status || status.open) return null;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 z-[120] px-3 sm:px-4"
        style={{
          bottom:
            "calc(env(safe-area-inset-bottom, 0px) + 88px)",
        }}
      >
        <section className="pointer-events-auto mx-auto flex w-full max-w-[720px] items-center gap-3 rounded-[18px] border border-red-200 bg-white px-3.5 py-3 text-neutral-950 shadow-[0_16px_44px_rgba(0,0,0,.26)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-red-50 text-[18px] text-red-600">
            ◷
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#e21a22]" />
              <b className="truncate text-[11px] font-black uppercase tracking-[0.08em] text-[#d71920]">
                Local cerrado
              </b>
            </div>
            <p className="mt-0.5 truncate text-[10px] font-semibold text-neutral-500">
              {status.nextOpening
                ? `Abrimos ${status.nextOpening.relativeLabel.toLowerCase()} a las ${status.nextOpening.timeLabel}.`
                : "Pedidos pausados por horario."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="shrink-0 rounded-full bg-neutral-950 px-3.5 py-2 text-[9px] font-black text-white shadow-sm transition hover:bg-neutral-800"
          >
            Más información
          </button>
        </section>
      </div>

      {infoOpen && (
        <div
          className="fixed inset-0 z-[190] flex items-end justify-center bg-black/72 p-0 backdrop-blur-[5px] sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setInfoOpen(false);
          }}
        >
          <section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#f6f3ee] text-neutral-950 shadow-[0_30px_100px_rgba(0,0,0,.45)] sm:max-w-[620px] sm:rounded-[28px]">
            <header className="bg-[radial-gradient(circle_at_90%_0%,rgba(226,26,34,.22),transparent_30%),linear-gradient(135deg,#0b0b0c,#171315)] px-5 py-5 text-white sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.17em] text-[#ff565c]">
                    Alentó Pizza
                  </p>
                  <h2 className="mt-1 text-[24px] font-black tracking-[-0.035em]">
                    Horarios y contacto
                  </h2>
                  <p className="mt-1 text-[10px] leading-4 text-white/42">
                    Consulta cuándo atendemos y cómo encontrarnos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xl text-white/65"
                  aria-label="Cerrar información"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="space-y-4 p-4 sm:p-5">
              <section className="rounded-[20px] border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
                      Horario de servicio
                    </p>
                    <h3 className="mt-1 text-[16px] font-black">
                      Lunes a domingo
                    </h3>
                  </div>
                  <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-[9px] font-black uppercase text-red-700">
                    Hoy cerrado
                  </span>
                </div>

                <div className="mt-4 overflow-hidden rounded-[16px] border border-neutral-200">
                  {status.hours.map((schedule, index) => (
                    <div
                      key={schedule.day}
                      className={
                        "flex items-center justify-between gap-4 px-4 py-3 " +
                        (index > 0 ? "border-t border-neutral-100 " : "") +
                        (schedule.day === status.currentDay
                          ? "bg-red-50/65"
                          : "bg-white")
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={
                            "h-2 w-2 rounded-full " +
                            (schedule.enabled
                              ? "bg-emerald-500"
                              : "bg-neutral-300")
                          }
                        />
                        <b className="text-[11px] text-neutral-900">
                          {schedule.dayLabel}
                        </b>
                      </div>
                      <span
                        className={
                          "text-[10px] font-bold " +
                          (schedule.enabled
                            ? "text-neutral-600"
                            : "text-neutral-400")
                        }
                      >
                        {schedule.rangeLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <a
                  href={status.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[20px] border border-emerald-100 bg-emerald-50 p-4 transition hover:-translate-y-0.5"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-600">
                    WhatsApp
                  </p>
                  <b className="mt-2 block text-[17px] font-black text-emerald-800">
                    {status.whatsapp}
                  </b>
                  <span className="mt-1 block text-[9px] font-semibold text-emerald-700/55">
                    Escríbenos directamente
                  </span>
                </a>

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(status.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[20px] border border-sky-100 bg-sky-50 p-4 transition hover:-translate-y-0.5"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-600">
                    Ubicación
                  </p>
                  <b className="mt-2 block text-[12px] font-black leading-5 text-sky-900">
                    {status.address}
                  </b>
                  <span className="mt-1 block text-[9px] font-semibold text-sky-700/55">
                    Abrir en el mapa
                  </span>
                </a>
              </section>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
