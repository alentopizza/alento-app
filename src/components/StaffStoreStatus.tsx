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

export default function StaffStoreStatus() {
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
      <div className="fixed right-3 top-[76px] z-[155] lg:right-5 lg:top-4">
        <button
          type="button"
          onClick={() => setDetailsOpen((current) => !current)}
          className={
            "flex min-h-[48px] items-center gap-3 rounded-[16px] border px-3.5 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,.18)] backdrop-blur-xl transition hover:-translate-y-0.5 " +
            (status.open
              ? "border-emerald-200 bg-white text-neutral-950"
              : "border-red-200 bg-white text-neutral-950")
          }
          title="Estado de servicio de la tienda"
          aria-expanded={detailsOpen}
        >
          <span
            className={
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] " +
              (status.open
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700")
            }
          >
            <Store className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>

          <span className="min-w-0 text-left">
            <span
              className={
                "flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.11em] " +
                (status.open ? "text-emerald-700" : "text-red-700")
              }
            >
              <span
                className={
                  "h-2 w-2 rounded-full " +
                  (status.open
                    ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,.65)]"
                    : "bg-red-500")
                }
              />
              {status.open ? "Tienda abierta" : "Tienda cerrada"}
            </span>
            <span className="mt-0.5 block max-w-[190px] truncate text-[9px] font-semibold text-neutral-500">
              {status.open
                ? status.closesAt
                  ? `Cierra a las ${status.closesAt}`
                  : "Servicio activo"
                : status.nextOpening
                  ? `Abre ${status.nextOpening.relativeLabel.toLowerCase()} a las ${status.nextOpening.timeLabel}`
                  : "Fuera del horario de servicio"}
            </span>
          </span>

          {soundEnabled ? (
            <Volume2 className="h-4 w-4 shrink-0 text-neutral-400" />
          ) : (
            <VolumeX className="h-4 w-4 shrink-0 text-neutral-300" />
          )}
        </button>

        {detailsOpen && (
          <section className="absolute right-0 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-[20px] border border-neutral-200 bg-white text-neutral-950 shadow-[0_24px_70px_rgba(0,0,0,.24)]">
            <div
              className={
                "border-b px-4 py-4 " +
                (status.open
                  ? "border-emerald-100 bg-emerald-50/65"
                  : "border-red-100 bg-red-50/65")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className={
                      "text-[9px] font-black uppercase tracking-[0.13em] " +
                      (status.open ? "text-emerald-700" : "text-red-700")
                    }
                  >
                    Estado de la tienda
                  </p>
                  <h3 className="mt-1 text-[18px] font-black">
                    {status.open ? "Servicio abierto" : "Servicio cerrado"}
                  </h3>
                  <p className="mt-1 text-[10px] leading-4 text-neutral-500">
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
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-400"
                  aria-label="Cerrar estado"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-3.5">
              <div className="flex items-center justify-between gap-3 rounded-[14px] border border-neutral-200 bg-[#faf9f7] p-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-neutral-700 shadow-sm">
                    <BellRing className="h-4 w-4" />
                  </span>
                  <div>
                    <b className="block text-[10px]">Aviso de apertura</b>
                    <span className="mt-0.5 block text-[9px] text-neutral-400">
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
                      : "bg-neutral-200 text-neutral-500")
                  }
                >
                  {soundEnabled ? "Activo" : "Apagado"}
                </button>
              </div>

              <div className="mt-3 overflow-hidden rounded-[14px] border border-neutral-200">
                {status.hours.map((schedule, index) => (
                  <div
                    key={schedule.day}
                    className={
                      "flex items-center justify-between gap-3 px-3 py-2.5 " +
                      (index > 0 ? "border-t border-neutral-100 " : "") +
                      (schedule.day === status.currentDay
                        ? "bg-neutral-50"
                        : "bg-white")
                    }
                  >
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5 text-neutral-300" />
                      <b className="text-[10px] text-neutral-700">
                        {schedule.dayLabel}
                      </b>
                    </div>
                    <span
                      className={
                        "text-[9px] font-bold " +
                        (schedule.enabled
                          ? "text-neutral-500"
                          : "text-neutral-300")
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
        <div className="fixed right-3 top-[136px] z-[160] w-[min(92vw,390px)] rounded-[20px] border border-emerald-200 bg-white p-4 text-neutral-950 shadow-[0_24px_70px_rgba(0,0,0,.25)] lg:right-5 lg:top-[76px]">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-emerald-50 text-emerald-700">
              <BellRing className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.13em] text-emerald-700">
                Servicio iniciado
              </p>
              <b className="mt-1 block text-[15px] font-black">
                La tienda acaba de abrir
              </b>
              <p className="mt-1 text-[10px] leading-4 text-neutral-500">
                Los clientes ya pueden enviar pedidos desde la aplicación.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpeningToast(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100"
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
