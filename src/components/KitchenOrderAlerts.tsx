"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  disableWebPush,
  enableWebPush,
  loadWebPushState,
  type WebPushCapability,
} from "@/lib/webPushClient";

const DEFAULT_PUSH_ENDPOINT = "/api/cocina/push";
const DEFAULT_SOUND_KEY = "alento-kitchen-order-sound";

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
  pushEndpoint = DEFAULT_PUSH_ENDPOINT,
  storageKey = DEFAULT_SOUND_KEY,
  notificationKind = "KITCHEN_ORDER",
  label = "Cocina",
}: {
  orderIds: number[];
  onIncomingPush?: () => void;
  pushEndpoint?: string;
  storageKey?: string;
  notificationKind?: string;
  label?: string;
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
      const alertBursts = [0, 1.5, 3, 4.5];
      const alertPattern = [
        { offset: 0, frequency: 880 },
        { offset: 0.22, frequency: 1040 },
        { offset: 0.44, frequency: 880 },
      ];
      const sequence = alertBursts.flatMap((burstAt) =>
        alertPattern.map(({ offset, frequency }) => ({
          at: burstAt + offset,
          frequency,
        })),
      );

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
        const result = await loadWebPushState(pushEndpoint);
        if (disposed) return;

        setPushState(result.state);
        setPublicKey(result.publicKey);

        const storedSound =
          window.localStorage.getItem(storageKey) === "1";
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
  }, [pushEndpoint, storageKey]);

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
        data.payload?.kind !== notificationKind
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
  }, [notificationKind, onIncomingPush, playAlert]);

  async function enableAlerts() {
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      soundEnabledRef.current = true;
      setSoundEnabled(true);
      window.localStorage.setItem(storageKey, "1");

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
          : await loadWebPushState(pushEndpoint);

        if (pushConfig.publicKey) {
          setPublicKey(pushConfig.publicKey);

          const result = await enableWebPush(
            pushEndpoint,
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

      setMessage(`Push y sonido activos para nuevos pedidos de ${label}.`);
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
      await disableWebPush(pushEndpoint).catch(
        () => undefined,
      );
      setPushState("off");
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      window.localStorage.removeItem(storageKey);
      setMessage("Alertas desactivadas en este dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  const pushActive = pushState === "on";
  const active = soundEnabled || pushActive;

  const controlTitle =
    pushState === "loading"
      ? `Comprobando alertas de ${label}`
      : active
        ? message || `Alertas de ${label} activas. Toca para desactivar.`
        : message || `Alertas de ${label} desactivadas. Toca para activar.`;

  return (
    <button
      type="button"
      disabled={busy || pushState === "loading"}
      onClick={() =>
        void (active ? disableAlerts() : enableAlerts())
      }
      aria-label={controlTitle}
      title={controlTitle}
      className={
        "group relative flex h-[68px] w-[92px] shrink-0 items-center justify-center rounded-[19px] border shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-sm transition hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-wait disabled:opacity-55 " +
        (active
          ? "border-emerald-300/30 bg-emerald-400/[0.12] hover:bg-emerald-400/[0.16]"
          : "border-white/14 bg-white/[0.08] hover:bg-white/[0.12]")
      }
    >
      <span
        className={
          "flex h-11 w-11 items-center justify-center rounded-[14px] border transition " +
          (active
            ? "border-emerald-300/20 bg-emerald-400/[0.13] text-emerald-300"
            : "border-white/10 bg-white/[0.07] text-white/75")
        }
      >
        <Bell
          className="h-[24px] w-[24px]"
          strokeWidth={2.15}
        />
      </span>

      <span
        aria-hidden="true"
        className={
          "absolute right-3 top-3 h-2.5 w-2.5 rounded-full border border-[#151516] " +
          (pushState === "loading" || busy
            ? "animate-pulse bg-amber-300"
            : active
              ? "bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,.72)]"
              : pushState === "denied"
                ? "bg-red-400"
                : "bg-white/25")
        }
      />
    </button>
  );
}
