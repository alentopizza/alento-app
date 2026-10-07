"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const FALLBACK_INTRO_IMAGE =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/CpQ55KIWphJs8CeomkY3.png";

type PublicHomeSettings = {
  landing?: {
    mobileImageUrl?: string;
    desktopImageUrl?: string;
  };
};

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

export default function PublicLandingPageClient() {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [home, setHome] = useState<PublicHomeSettings | null>(null);
  const [homeLoaded, setHomeLoaded] = useState(false);
  const [storeStatus, setStoreStatus] = useState<PublicStoreStatus | null>(null);
  const [storeStatusLoaded, setStoreStatusLoaded] = useState(false);
  const [storeInfoOpen, setStoreInfoOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLanding() {
      try {
        const [homeResponse, statusResponse] = await Promise.all([
          fetch("/api/public-home", { cache: "no-store" }),
          fetch("/api/public-store-status", { cache: "no-store" }),
        ]);

        const [homeData, statusData] = await Promise.all([
          homeResponse.json(),
          statusResponse.json(),
        ]);

        if (cancelled) return;
        if (homeResponse.ok) setHome(homeData?.settings ?? null);
        if (statusResponse.ok) {
          setStoreStatus(statusData as PublicStoreStatus);
        }
      } finally {
        if (!cancelled) {
          setHomeLoaded(true);
          setStoreStatusLoaded(true);
        }
      }
    }

    async function refreshStoreStatus() {
      try {
        const response = await fetch("/api/public-store-status", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!cancelled && response.ok) {
          setStoreStatus(data as PublicStoreStatus);
          setStoreStatusLoaded(true);
        }
      } catch {
        // Conserva el último estado conocido si falla una actualización puntual.
      }
    }

    void loadLanding();
    const timer = window.setInterval(() => {
      void refreshStoreStatus();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const orderingEnabled = storeStatusLoaded && storeStatus?.open === true;

  useEffect(() => {
    if (orderingEnabled) return;
    setProgress(0);
    setDragging(false);
  }, [orderingEnabled]);

  const mobileImage = home?.landing?.mobileImageUrl || FALLBACK_INTRO_IMAGE;
  const desktopImage =
    home?.landing?.desktopImageUrl ||
    home?.landing?.mobileImageUrl ||
    FALLBACK_INTRO_IMAGE;

  function updateFromPointer(clientX: number) {
    if (!orderingEnabled) return 0;
    const track = trackRef.current;
    if (!track) return 0;

    const rect = track.getBoundingClientRect();
    const knobSize = 54;
    const padding = 4;
    const usable = Math.max(1, rect.width - knobSize - padding * 2);
    const raw = (clientX - rect.left - padding - knobSize / 2) / usable;
    const next = Math.min(1, Math.max(0, raw));
    setProgress(next);
    return next;
  }

  function finish(nextProgress = progress) {
    setDragging(false);
    if (!orderingEnabled) {
      setProgress(0);
      return;
    }

    if (nextProgress >= 0.82) {
      setProgress(1);
      setLeaving(true);
      window.setTimeout(() => {
        router.push("/menu");
      }, 180);
      return;
    }

    setProgress(0);
  }

  return (
    <main className="min-h-[100dvh] bg-black">
      <div className="relative min-h-[100dvh] w-full overflow-hidden bg-white">
        {homeLoaded ? (
          <picture>
            <source media="(min-width: 900px)" srcSet={desktopImage} />
            <img
              src={mobileImage}
              alt="Alentó Pizza"
              className="absolute inset-0 h-full w-full object-cover object-center"
              draggable={false}
            />
          </picture>
        ) : (
          <div className="absolute inset-0 bg-black" aria-hidden="true" />
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[190px] bg-gradient-to-t from-black/30 via-black/5 to-transparent" />

        {storeStatusLoaded && storeStatus && !storeStatus.open && (
          <div className="absolute inset-x-0 top-[max(16px,env(safe-area-inset-top))] z-10 px-4 sm:px-6">
            <section className="mx-auto w-full max-w-[620px] overflow-hidden rounded-[24px] border border-red-200 bg-white text-neutral-950 shadow-[0_22px_70px_rgba(0,0,0,.32)]">
              <div className="h-1.5 w-full bg-[#e21a22]" />
              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#e21a22] shadow-[0_0_0_5px_rgba(226,26,34,.10)]" />
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d71920]">
                        Local cerrado
                      </p>
                    </div>
                    <h2 className="mt-2 text-[21px] font-black leading-tight tracking-[-0.035em] sm:text-[25px]">
                      En este momento no estamos recibiendo pedidos.
                    </h2>
                    <p className="mt-2 text-[11px] font-semibold leading-5 text-neutral-500 sm:text-[12px]">
                      {storeStatus.nextOpening
                        ? `Abrimos ${storeStatus.nextOpening.relativeLabel.toLowerCase()} a las ${storeStatus.nextOpening.timeLabel}.`
                        : "Consulta nuestros horarios de servicio."}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-red-700">
                    Cerrado
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setStoreInfoOpen(true)}
                  className="mt-4 flex h-11 w-full items-center justify-between rounded-[14px] bg-neutral-950 px-4 text-left text-white transition hover:bg-neutral-800"
                >
                  <span>
                    <b className="block text-[10px] font-black uppercase tracking-[0.1em]">
                      Más información
                    </b>
                    <span className="mt-0.5 block text-[9px] text-white/45">
                      Horarios, WhatsApp y ubicación
                    </span>
                  </span>
                  <span className="text-lg text-white/70">→</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {storeInfoOpen && storeStatus && (
          <div
            className="fixed inset-0 z-[180] flex items-end justify-center bg-black/72 p-0 backdrop-blur-[5px] sm:items-center sm:p-5"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setStoreInfoOpen(false);
              }
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
                    onClick={() => setStoreInfoOpen(false)}
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
                      Hoy {storeStatus.open ? "abierto" : "cerrado"}
                    </span>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[16px] border border-neutral-200">
                    {storeStatus.hours.map((schedule, index) => (
                      <div
                        key={schedule.day}
                        className={
                          "flex items-center justify-between gap-4 px-4 py-3 " +
                          (index > 0 ? "border-t border-neutral-100 " : "") +
                          (schedule.day === storeStatus.currentDay
                            ? "bg-red-50/65"
                            : "bg-white")
                        }
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={
                              "h-2 w-2 rounded-full " +
                              (schedule.enabled ? "bg-emerald-500" : "bg-neutral-300")
                            }
                          />
                          <b className="text-[11px] text-neutral-900">
                            {schedule.dayLabel}
                          </b>
                        </div>
                        <span
                          className={
                            "text-[10px] font-bold " +
                            (schedule.enabled ? "text-neutral-600" : "text-neutral-400")
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
                    href={storeStatus.whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[20px] border border-emerald-100 bg-emerald-50 p-4 transition hover:-translate-y-0.5"
                  >
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-600">
                      WhatsApp
                    </p>
                    <b className="mt-2 block text-[17px] font-black text-emerald-800">
                      {storeStatus.whatsapp}
                    </b>
                    <span className="mt-1 block text-[9px] font-semibold text-emerald-700/55">
                      Escríbenos directamente
                    </span>
                  </a>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeStatus.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[20px] border border-sky-100 bg-sky-50 p-4 transition hover:-translate-y-0.5"
                  >
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-600">
                      Ubicación
                    </p>
                    <b className="mt-2 block text-[12px] font-black leading-5 text-sky-900">
                      {storeStatus.address}
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

        <div
          className={`absolute inset-x-0 bottom-[max(22px,env(safe-area-inset-bottom))] px-5 transition-opacity duration-200 sm:px-7 ${leaving ? "opacity-0" : "opacity-100"}`}
        >
          <div
            ref={trackRef}
            className={
              "landing-menu-slider relative mx-auto h-[62px] w-full max-w-[520px] overflow-hidden rounded-full border shadow-[0_16px_44px_rgba(0,0,0,.20)] backdrop-blur-md transition " +
              (orderingEnabled
                ? "border-white/80 bg-white/95"
                : "border-white/45 bg-neutral-200/95")
            }
          >
            <div
              className={
                "absolute inset-y-1 left-1 z-[1] rounded-full " +
                (orderingEnabled ? "bg-[#df1f26]" : "bg-neutral-400")
              }
              style={{
                width: `calc(54px + (100% - 62px) * ${progress})`,
                transition: dragging ? "none" : "width 220ms cubic-bezier(.2,.8,.2,1)",
              }}
            />

            <div
              className="pointer-events-none absolute inset-y-0 left-[68px] right-3 z-[3] flex items-center justify-center text-center"
              style={{
                opacity: Math.max(0.18, 1 - progress * 1.15),
                transition: dragging ? "none" : "opacity 180ms ease",
              }}
            >
              <span className="landing-menu-slider-text whitespace-nowrap text-[10px] font-black uppercase tracking-[0.06em] text-black/75 min-[360px]:text-[11px] min-[430px]:text-[12px] min-[430px]:tracking-[0.08em]">
                {storeStatusLoaded
                  ? orderingEnabled
                    ? "Desliza y descubre el menú"
                    : "Local cerrado · pedidos pausados"
                  : "Consultando horario..."}
              </span>
            </div>

            <button
              type="button"
              disabled={!orderingEnabled}
              aria-label={
                orderingEnabled
                  ? "Desliza y descubre el menú"
                  : "Local cerrado. Los pedidos están pausados."
              }
              className={`landing-menu-slider-knob ${orderingEnabled && !dragging && progress === 0 ? "landing-menu-slider-knob-idle" : ""} absolute top-1 z-[4] flex h-[54px] w-[54px] touch-none select-none items-center justify-center rounded-full text-white shadow-[0_8px_18px_rgba(0,0,0,.28)] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[#e51c11] focus-visible:ring-offset-2 active:scale-[.98] disabled:cursor-not-allowed ${orderingEnabled ? "bg-black" : "bg-neutral-600"}`}
              style={{
                left: `calc(4px + (100% - 62px) * ${progress})`,
                transition: dragging ? "none" : "left 220ms cubic-bezier(.2,.8,.2,1)",
              }}
              onPointerDown={(event) => {
                if (leaving || !orderingEnabled) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging(true);
                updateFromPointer(event.clientX);
              }}
              onPointerMove={(event) => {
                if (!dragging || leaving || !orderingEnabled) return;
                updateFromPointer(event.clientX);
              }}
              onPointerUp={(event) => {
                if (!dragging || leaving || !orderingEnabled) return;
                const next = updateFromPointer(event.clientX);
                finish(next);
              }}
              onPointerCancel={() => {
                if (!leaving && orderingEnabled) finish(0);
              }}
              onKeyDown={(event) => {
                if (
                  orderingEnabled &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  setProgress(1);
                  setLeaving(true);
                  window.setTimeout(() => router.push("/menu"), 180);
                }
              }}
            >
              <svg
                viewBox="0 0 24 24"
                className="landing-menu-slider-arrow h-[22px] w-[22px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h13" />
                <path d="m14 7 5 5-5 5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
