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
          <div className="absolute inset-x-0 top-[max(14px,env(safe-area-inset-top))] z-10 px-4 sm:px-6">
            <section className="mx-auto w-full max-w-[620px] overflow-hidden rounded-[22px] border border-white/15 bg-black/82 text-white shadow-[0_18px_55px_rgba(0,0,0,.34)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-3.5 sm:px-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#e21a22] shadow-[0_0_16px_rgba(226,26,34,.85)]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff454b]">
                      Local cerrado
                    </p>
                  </div>
                  <h2 className="mt-1.5 text-[19px] font-black tracking-[-0.03em] sm:text-[22px]">
                    En este momento no estamos recibiendo pedidos.
                  </h2>
                  <p className="mt-1 text-[10px] leading-4 text-white/48 sm:text-[11px]">
                    {storeStatus.nextOpening
                      ? `Abrimos ${storeStatus.nextOpening.relativeLabel.toLowerCase()} a las ${storeStatus.nextOpening.timeLabel}.`
                      : "Consulta nuestros horarios de servicio."}
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-red-200">
                  Cerrado
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 py-3 sm:grid-cols-4 sm:px-5">
                {storeStatus.hours.map((schedule) => (
                  <div
                    key={schedule.day}
                    className={
                      "flex min-w-0 items-center justify-between gap-2 rounded-lg px-2 py-1.5 " +
                      (schedule.day === storeStatus.currentDay
                        ? "bg-white/[0.08]"
                        : "bg-white/[0.025]")
                    }
                  >
                    <span className="truncate text-[9px] font-black text-white/65">
                      {schedule.dayLabel}
                    </span>
                    <span
                      className={
                        "shrink-0 text-[8px] font-semibold " +
                        (schedule.enabled ? "text-white/40" : "text-red-300/70")
                      }
                    >
                      {schedule.rangeLabel}
                    </span>
                  </div>
                ))}
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
