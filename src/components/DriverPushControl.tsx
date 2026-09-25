"use client";

import { useEffect, useState } from "react";

type PushState =
  | "loading"
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "off"
  | "on";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

async function registration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Este navegador no soporta service workers.");
  }

  return navigator.serviceWorker.ready;
}

export default function DriverPushControl() {
  const [state, setState] = useState<PushState>("loading");
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let disposed = false;

    async function load() {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!disposed) setState("unsupported");
        return;
      }

      try {
        const response = await fetch("/api/repartidor/push", {
          cache: "no-store",
        });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(
            body.error || "No fue posible consultar las notificaciones.",
          );
        }

        if (!body.configured || !body.publicKey) {
          if (!disposed) setState("unconfigured");
          return;
        }

        const sw = await registration();
        const subscription = await sw.pushManager.getSubscription();

        if (disposed) return;

        setPublicKey(String(body.publicKey));
        if (Notification.permission === "denied") {
          setState("denied");
        } else {
          setState(subscription ? "on" : "off");
        }
      } catch (error) {
        if (!disposed) {
          setMessage(
            error instanceof Error
              ? error.message
              : "No fue posible cargar Web Push.",
          );
          setState("off");
        }
      }
    }

    void load();

    return () => {
      disposed = true;
    };
  }, []);

  async function enable() {
    if (busy || !publicKey) return;
    setBusy(true);
    setMessage("");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        setMessage(
          permission === "denied"
            ? "Las notificaciones están bloqueadas en este dispositivo."
            : "No se activaron las notificaciones.",
        );
        return;
      }

      const sw = await registration();
      let subscription = await sw.pushManager.getSubscription();

      if (!subscription) {
        subscription = await sw.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        });
      }

      const payload = subscription.toJSON();
      const response = await fetch("/api/repartidor/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          subscription: payload,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        await subscription.unsubscribe().catch(() => undefined);
        throw new Error(
          body.error || "No fue posible guardar este dispositivo.",
        );
      }

      setState("on");
      setMessage("Notificaciones activas en este dispositivo.");
    } catch (error) {
      setState("off");
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible activar las notificaciones.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    setMessage("");

    try {
      const sw = await registration();
      const subscription = await sw.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/repartidor/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "unsubscribe",
            endpoint: subscription.endpoint,
          }),
        });
        await subscription.unsubscribe();
      }

      setState("off");
      setMessage("Notificaciones desactivadas en este dispositivo.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible desactivar las notificaciones.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function testPush() {
    if (busy || state !== "on") return;
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/repartidor/push/test", {
        method: "POST",
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error || "No fue posible enviar la prueba.",
        );
      }

      setMessage("Prueba enviada. Debe aparecer en unos segundos.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible enviar la prueba.",
      );
    } finally {
      setBusy(false);
    }
  }

  const active = state === "on";

  return (
    <div className="mt-2.5 rounded-[18px] border border-white/[0.07] bg-white/[0.035] p-3.5">
      <div className="flex items-start gap-3">
        <span
          className={
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base " +
            (active
              ? "bg-emerald-400/12 text-emerald-300"
              : "bg-white/[0.055] text-white/55")
          }
        >
          🔔
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/28">
                Notificaciones
              </p>
              <b className="mt-0.5 block text-[10px] text-white/80">
                {state === "loading"
                  ? "Comprobando..."
                  : active
                    ? "Push activo"
                    : state === "unconfigured"
                      ? "Falta configurar servidor"
                      : state === "denied"
                        ? "Bloqueadas"
                        : state === "unsupported"
                          ? "No disponible"
                          : "Push desactivado"}
              </b>
            </div>

            <span
              className={
                "h-2.5 w-2.5 rounded-full " +
                (active
                  ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,.58)]"
                  : "bg-white/15")
              }
            />
          </div>

          {state === "unsupported" && (
            <p className="mt-2 text-[8px] leading-4 text-white/36">
              En iPhone abre Alentó desde la app añadida a la pantalla de inicio.
            </p>
          )}

          {state === "denied" && (
            <p className="mt-2 text-[8px] leading-4 text-[#ff8b8f]">
              Habilita notificaciones para Alentó desde los ajustes del navegador o del sistema.
            </p>
          )}

          {state === "unconfigured" && (
            <p className="mt-2 text-[8px] leading-4 text-amber-200/70">
              Agrega las claves VAPID en EasyPanel para activar Web Push.
            </p>
          )}

          {message && (
            <p className="mt-2 text-[8px] leading-4 text-white/45">
              {message}
            </p>
          )}
        </div>
      </div>

      {(state === "off" || state === "on") && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void (active ? disable() : enable())}
            className={
              "h-9 rounded-xl text-[9px] font-black transition disabled:opacity-50 " +
              (active
                ? "border border-white/10 bg-white/[0.055] text-white/55"
                : "bg-[#e21a22] text-white")
            }
          >
            {busy
              ? "Procesando..."
              : active
                ? "Desactivar"
                : "Activar push"}
          </button>

          <button
            type="button"
            disabled={busy || !active}
            onClick={() => void testPush()}
            className="h-9 rounded-xl border border-white/10 bg-white/[0.055] text-[9px] font-black text-white/70 transition disabled:opacity-30"
          >
            Enviar prueba
          </button>
        </div>
      )}
    </div>
  );
}
