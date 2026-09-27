"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  disableWebPush,
  enableWebPush,
  loadWebPushState,
  type WebPushCapability,
} from "@/lib/webPushClient";

const PUSH_ENDPOINT = "/api/cocina/push";
const SOUND_KEY = "alento-kitchen-order-sound";

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function createAudioContext() {
  const AudioContextCtor =
    window.AudioContext ||
    (window as AudioWindow).webkitAudioContext;

  return AudioContextCtor ? new AudioContextCtor() : null;
}

export default function KitchenOrderAlerts({
  orderIds,
  onIncomingPush,
}: {
  orderIds: number[];
  onIncomingPush?: () => void;
}) {
  const [pushState, setPushState] =
    useState<WebPushCapability>("loading");
  const [publicKey, setPublicKey] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);
  const initializedOrdersRef = useRef(false);
  const knownOrderIdsRef = useRef<Set<number>>(new Set());
  const alertedOrderIdsRef = useRef<Set<number>>(new Set());

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

  const playAlert = useCallback(
    async (orderId?: number) => {
      if (orderId && alertedOrderIdsRef.current.has(orderId)) {
        return;
      }

      if (orderId) alertedOrderIdsRef.current.add(orderId);
      if (!soundEnabledRef.current) return;

      const context = await ensureAudioContext();
      if (!context || context.state !== "running") return;

      const now = context.currentTime;
      const sequence = [
        { at: 0, frequency: 880 },
        { at: 0.22, frequency: 1040 },
        { at: 0.44, frequency: 880 },
      ];

      sequence.forEach(({ at, frequency }) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(
          frequency,
          now + at,
        );

        gain.gain.setValueAtTime(0.0001, now + at);
        gain.gain.exponentialRampToValueAtTime(
          0.24,
          now + at + 0.025,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + at + 0.16,
        );

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start(now + at);
        oscillator.stop(now + at + 0.18);
      });
    },
    [ensureAudioContext],
  );

  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        const result = await loadWebPushState(PUSH_ENDPOINT);
        if (disposed) return;

        setPushState(result.state);
        setPublicKey(result.publicKey);

        const storedSound =
          window.localStorage.getItem(SOUND_KEY) === "1";
        soundEnabledRef.current = storedSound;
        setSoundEnabled(storedSound);
      } catch (error) {
        if (!disposed) {
          setPushState("off");
          setMessage(
            error instanceof Error
              ? error.message
              : "No fue posible consultar las alertas.",
          );
        }
      }
    }

    void load();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!soundEnabled) return;

    const unlock = () => {
      void ensureAudioContext();
    };

    window.addEventListener("pointerdown", unlock, {
      once: true,
    });
    window.addEventListener("keydown", unlock, {
      once: true,
    });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [ensureAudioContext, soundEnabled]);

  useEffect(() => {
    const nextIds = new Set(orderIds);

    if (!initializedOrdersRef.current) {
      initializedOrdersRef.current = true;
      knownOrderIdsRef.current = nextIds;
      return;
    }

    const newIds = orderIds.filter(
      (orderId) => !knownOrderIdsRef.current.has(orderId),
    );

    knownOrderIdsRef.current = nextIds;

    if (!newIds.length) return;

    const firstUnalerted = newIds.find(
      (orderId) => !alertedOrderIdsRef.current.has(orderId),
    );

    if (firstUnalerted) {
      void playAlert(firstUnalerted);
      newIds.forEach((orderId) =>
        alertedOrderIdsRef.current.add(orderId),
      );
    }
  }, [orderIds, playAlert]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        payload?: {
          kind?: string;
          orderId?: number;
        };
      };

      if (
        data?.type !== "ALENTO_PUSH" ||
        data.payload?.kind !== "KITCHEN_ORDER"
      ) {
        return;
      }

      onIncomingPush?.();

      const orderId = Number(data.payload.orderId);
      void playAlert(
        Number.isInteger(orderId) && orderId > 0
          ? orderId
          : undefined,
      );
    };

    navigator.serviceWorker.addEventListener(
      "message",
      onMessage,
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        "message",
        onMessage,
      );
    };
  }, [onIncomingPush, playAlert]);

  async function enableAlerts() {
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      soundEnabledRef.current = true;
      setSoundEnabled(true);
      window.localStorage.setItem(SOUND_KEY, "1");

      await ensureAudioContext();
      await playAlert();

      if (
        pushState === "unsupported" ||
        pushState === "unconfigured" ||
        pushState === "denied"
      ) {
        setMessage(
          pushState === "denied"
            ? "Sonido activo. El Push está bloqueado en este dispositivo."
            : pushState === "unconfigured"
              ? "Sonido activo. Falta configurar Web Push en el servidor."
              : "Sonido activo. Este dispositivo no soporta Web Push.",
        );
        return;
      }

      if (pushState !== "on") {
        const pushConfig = publicKey
          ? { state: pushState, publicKey }
          : await loadWebPushState(PUSH_ENDPOINT);

        if (pushConfig.publicKey) {
          setPublicKey(pushConfig.publicKey);

          const result = await enableWebPush(
            PUSH_ENDPOINT,
            pushConfig.publicKey,
          );

          if (!result.enabled) {
            setPushState(result.denied ? "denied" : "off");
            setMessage(
              result.denied
                ? "Sonido activo. Las notificaciones Push están bloqueadas."
                : "Sonido activo. No se activó Push.",
            );
            return;
          }

          setPushState("on");
        }
      }

      setMessage("Push y sonido activos para nuevos pedidos.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Sonido activado, pero hubo un problema: ${error.message}`
          : "Sonido activado, pero no fue posible activar Push.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disableAlerts() {
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      await disableWebPush(PUSH_ENDPOINT).catch(
        () => undefined,
      );
      setPushState("off");
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      window.localStorage.removeItem(SOUND_KEY);
      setMessage("Alertas desactivadas en este dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  const pushActive = pushState === "on";
  const active = soundEnabled || pushActive;

  return (
    <div
      className={
        "flex min-h-[68px] min-w-[180px] items-center gap-3 rounded-[19px] border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-sm " +
        (active
          ? "border-emerald-300/25 bg-emerald-400/[0.10]"
          : "border-white/14 bg-white/[0.08]")
      }
    >
      <span
        className={
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg " +
          (active
            ? "bg-emerald-400/15 text-emerald-300"
            : "bg-white/[0.08] text-white/70")
        }
      >
        🔔
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/45">
          Alertas cocina
        </p>
        <b
          className={
            "mt-0.5 block text-[11px] " +
            (active ? "text-emerald-300" : "text-white")
          }
        >
          {pushState === "loading"
            ? "Comprobando..."
            : pushActive && soundEnabled
              ? "Push + sonido activos"
              : soundEnabled
                ? pushState === "denied"
                  ? "Sonido activo · Push bloqueado"
                  : pushState === "unconfigured"
                    ? "Sonido activo · Push sin configurar"
                    : pushState === "unsupported"
                      ? "Sonido activo · sin Push"
                      : "Sonido activo"
                : pushActive
                  ? "Push activo · sonido apagado"
                  : pushState === "denied"
                    ? "Notificaciones bloqueadas"
                    : pushState === "unsupported"
                      ? "Push no disponible"
                      : pushState === "unconfigured"
                        ? "Push sin configurar"
                        : "Alertas desactivadas"}
        </b>

        {message && (
          <p className="mt-1 max-w-[230px] text-[8px] leading-3 text-white/42">
            {message}
          </p>
        )}

        <button
          type="button"
          disabled={busy || pushState === "loading"}
          onClick={() =>
            void (active ? disableAlerts() : enableAlerts())
          }
          className={
            "mt-2 h-7 rounded-lg px-3 text-[8px] font-black uppercase tracking-[0.06em] transition disabled:opacity-40 " +
            (active
              ? "border border-white/10 bg-white/[0.06] text-white/55"
              : "bg-[#e21a22] text-white")
          }
        >
          {busy
            ? "Procesando..."
            : active
              ? "Desactivar"
              : "Activar alertas"}
        </button>
      </div>
    </div>
  );
}
