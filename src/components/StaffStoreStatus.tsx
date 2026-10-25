"use client";

import {
  BellRing,
  Clock3,
  Store,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const SOUND_KEY = "alento-store-opening-sound-enabled";

type StoreStatus = {
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
    rangeLabel: string;
  }>;
};

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function createAudioContext() {
  const AudioContextCtor =
    window.AudioContext ||
    (window as AudioWindow).webkitAudioContext;

  return AudioContextCtor ? new AudioContextCtor() : null;
}

export default function StaffStoreStatus({
  sidebarCollapsed = false,
  mobileMenuOpen = false,
}: {
  sidebarCollapsed?: boolean;
  mobileMenuOpen?: boolean;
}) {
  const [status, setStatus] = useState<StoreStatus | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [openingToast, setOpeningToast] = useState(false);

  const previousOpenRef = useRef<boolean | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const pendingSoundRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const soundEnabledRef = useRef(true);

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = createAudioContext();
    }

    const context = audioContextRef.current;
    if (!context) return null;

    if (context.state === "suspended") {
      await context.resume().catch(() => undefined);
    }

    return context;
  }, []);

  const playOpeningChime = useCallback(async () => {
    if (!soundEnabledRef.current) return false;

    const context = await ensureAudioContext();
    if (!context || context.state !== "running") return false;

    const now = context.currentTime;
    const notes = [
      { at: 0, frequency: 523.25, duration: 0.34 },
      { at: 0.18, frequency: 659.25, duration: 0.34 },
      { at: 0.38, frequency: 783.99, duration: 0.42 },
      { at: 0.72, frequency: 1046.5, duration: 0.6 },
    ];

    notes.forEach(({ at, frequency, duration }) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, now + at);

      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.025);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + at + duration,
      );

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(now + at);
      oscillator.stop(now + at + duration + 0.03);
    });

    return true;
  }, [ensureAudioContext]);

  const showOpeningAlert = useCallback(async () => {
    setOpeningToast(true);

    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setOpeningToast(false);
      toastTimerRef.current = null;
    }, 8000);

    const played = await playOpeningChime();
    pendingSoundRef.current = !played && soundEnabledRef.current;
  }, [playOpeningChime]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SOUND_KEY);
    const enabled = stored !== "0";
    soundEnabledRef.current = enabled;
    setSoundEnabled(enabled);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await fetch("/api/public-store-status", {
          cache: "no-store",
        });
        const data = await response.json();

        if (cancelled || !response.ok) return;

        const next = data as StoreStatus;
        const previous = previousOpenRef.current;

        setStatus(next);
        previousOpenRef.current = next.open;

        if (previous === false && next.open) {
          void showOpeningAlert();
        }
      } catch {
        // El estado visual conserva el último valor conocido.
      }
    }

    void loadStatus();
    const timer = window.setInterval(() => {
      void loadStatus();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [showOpeningAlert]);

  useEffect(() => {
    const unlock = async () => {
      const context = await ensureAudioContext();
      if (
        context?.state === "running" &&
        pendingSoundRef.current &&
        soundEnabledRef.current
      ) {
        pendingSoundRef.current = false;
        await playOpeningChime();
      }
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [ensureAudioContext, playOpeningChime]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      setDetailsOpen(false);
    }
  }, [mobileMenuOpen]);

  function toggleSound() {
    const next = !soundEnabled;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
    window.localStorage.setItem(SOUND_KEY, next ? "1" : "0");

    if (next) {
      void ensureAudioContext().then(() => playOpeningChime());
    } else {
      pendingSoundRef.current = false;
    }
  }

  if (!status) return null;

  return (
    <>
      <div
        className={
          (mobileMenuOpen
            ? "fixed left-3 top-[150px] z-[225] w-[calc(88vw-24px)] max-w-[316px] translate-x-0 "
            : "hidden ") +
          "sm:fixed sm:left-1/2 sm:top-[74px] sm:z-[155] sm:block sm:w-auto sm:-translate-x-1/2 " +
          "lg:bottom-[126px] lg:left-0 lg:top-auto lg:translate-x-0 " +
          (sidebarCollapsed
            ? "lg:w-[84px] lg:px-3"
            : "lg:w-[212px] lg:px-3")
        }
      >
        <button
          type="button"
          onClick={() => setDetailsOpen((current) => !current)}
          className={
            "flex min-h-[42px] items-center gap-2 rounded-[14px] border border-white/55 bg-[#0b0b0c]/96 px-2.5 py-2 text-white shadow-[0_12px_30px_rgba(0,0,0,.32),0_0_0_1px_rgba(255,255,255,.08)] backdrop-blur-xl transition hover:border-white/75 hover:bg-[#111113] " +
            (mobileMenuOpen ? "w-full sm:w-auto " : "") +
            (sidebarCollapsed
              ? "lg:w-full lg:justify-center lg:px-0"
              : "lg:w-full")
          }
          title="Estado de servicio de la tienda"
          aria-expanded={detailsOpen}
        >
          <span
            className={
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border " +
              (status.open
                ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-300"
                : "border-red-400/15 bg-red-400/10 text-red-300")
            }
          >
            <Store className="h-[14px] w-[14px]" strokeWidth={2.2} />
          </span>

          <span
            className={
              "min-w-0 text-left leading-none " +
              (sidebarCollapsed ? "lg:hidden" : "")
            }
          >
            <span
              className={
                "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.10em] leading-none " +
                (status.open ? "text-emerald-300" : "text-red-300")
              }
            >
              <span
                className={
                  "h-1.5 w-1.5 rounded-full " +
                  (status.open
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]"
                    : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,.55)]")
                }
              />
              {status.open ? "ABIERTA" : "CERRADA"}
            </span>
            <span className="mt-1.5 block max-w-[150px] truncate text-[9px] font-medium leading-[12px] text-white/46">
              {status.open
                ? status.closesAt
                  ? `Cierra a las ${status.closesAt}`
                  : "Servicio activo"
                : status.nextOpening
                  ? `Abre ${status.nextOpening.relativeLabel.toLowerCase()} a las ${status.nextOpening.timeLabel}`
                  : "Fuera del horario"}
            </span>
          </span>

          <span className={sidebarCollapsed ? "lg:hidden" : ""}>
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5 shrink-0 text-white/35" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 shrink-0 text-white/20" />
            )}
          </span>
        </button>

        {detailsOpen && (
          <section
            className={
              (mobileMenuOpen
                ? "absolute left-0 mt-2 w-full translate-x-0 "
                : "absolute left-1/2 mt-2 w-[min(92vw,330px)] -translate-x-1/2 ") +
              "overflow-hidden rounded-[18px] border border-white/10 bg-[#0b0b0c] text-white shadow-[0_24px_70px_rgba(0,0,0,.42)] " +
              "sm:left-1/2 sm:w-[min(92vw,330px)] sm:-translate-x-1/2 " +
              "lg:bottom-0 lg:left-full lg:ml-2 lg:mt-0 lg:w-[330px] lg:translate-x-0"
            }
          >
            <div
              className={
                "border-b px-4 py-3.5 " +
                (status.open
                  ? "border-emerald-400/10 bg-emerald-400/[0.05]"
                  : "border-red-400/10 bg-red-400/[0.05]")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className={
                      "text-[9px] font-black uppercase tracking-[0.13em] " +
                      (status.open ? "text-emerald-300" : "text-red-300")
                    }
                  >
                    Estado de la tienda
                  </p>
                  <h3 className="mt-1 text-[16px] font-black text-white">
                    {status.open ? "Servicio abierto" : "Servicio cerrado"}
                  </h3>
                  <p className="mt-1 text-[9px] leading-4 text-white/42">
                    {status.open
                      ? status.closesAt
                        ? `Los clientes pueden pedir. Cierre programado: ${status.closesAt}.`
                        : "Los clientes pueden realizar pedidos."
                      : status.nextOpening
                        ? `Los pedidos se habilitan ${status.nextOpening.relativeLabel.toLowerCase()} a las ${status.nextOpening.timeLabel}.`
                        : "Los pedidos están pausados por horario."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailsOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-white/45"
                  aria-label="Cerrar estado"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-3">
              <div className="flex items-center justify-between gap-3 rounded-[13px] border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.05] text-white/65">
                    <BellRing className="h-4 w-4" />
                  </span>
                  <div>
                    <b className="block text-[10px] text-white">Aviso de apertura</b>
                    <span className="mt-0.5 block text-[8.5px] text-white/35">
                      Sonido especial cuando cambia a abierto
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleSound}
                  className={
                    "rounded-full px-3 py-1.5 text-[9px] font-black " +
                    (soundEnabled
                      ? "bg-emerald-600 text-white"
                      : "bg-white/[0.08] text-white/40")
                  }
                >
                  {soundEnabled ? "Activo" : "Apagado"}
                </button>
              </div>

              <div className="mt-3 overflow-hidden rounded-[13px] border border-white/10">
                {status.hours.map((schedule, index) => (
                  <div
                    key={schedule.day}
                    className={
                      "flex items-center justify-between gap-3 px-3 py-2.5 " +
                      (index > 0 ? "border-t border-white/[0.06] " : "") +
                      (schedule.day === status.currentDay
                        ? "bg-white/[0.06]"
                        : "bg-transparent")
                    }
                  >
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5 text-white/20" />
                      <b className="text-[10px] text-white/70">
                        {schedule.dayLabel}
                      </b>
                    </div>
                    <span
                      className={
                        "text-[9px] font-bold " +
                        (schedule.enabled
                          ? "text-white/42"
                          : "text-white/20")
                      }
                    >
                      {schedule.rangeLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {openingToast && (
        <div className="fixed left-1/2 top-[126px] z-[160] hidden w-[min(92vw,350px)] -translate-x-1/2 rounded-[18px] border border-emerald-400/20 bg-[#0b0b0c] p-3.5 text-white shadow-[0_24px_70px_rgba(0,0,0,.42)] sm:block lg:top-[66px]">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-emerald-400/15 bg-emerald-400/10 text-emerald-300">
              <BellRing className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.13em] text-emerald-300">
                Servicio iniciado
              </p>
              <b className="mt-1 block text-[14px] font-black text-white">
                La tienda acaba de abrir
              </b>
              <p className="mt-1 text-[9px] leading-4 text-white/40">
                Los clientes ya pueden enviar pedidos desde la aplicación.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpeningToast(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/35 hover:bg-white/[0.06]"
              aria-label="Cerrar aviso de apertura"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
