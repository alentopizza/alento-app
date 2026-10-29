"use client";

import { useEffect, useState } from "react";
import {
  disableWebPush,
  enableWebPush,
  loadWebPushState,
  type WebPushCapability,
} from "@/lib/webPushClient";

type PushState = WebPushCapability;

export default function DriverPushControl() {
  const [state, setState] = useState<PushState>("loading");
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        const result = await loadWebPushState(
          "/api/push?scope=staff",
        );

        if (disposed) return;

        setPublicKey(result.publicKey);
        setState(result.state);
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
      const result = await enableWebPush(
        "/api/push?scope=staff",
        publicKey,
      );

      if (!result.enabled) {
        setState(result.denied ? "denied" : "off");
        setMessage(
          result.denied
            ? "Las notificaciones están bloqueadas en este dispositivo."
            : "No se activaron las notificaciones.",
        );
        return;
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
      await disableWebPush("/api/push?scope=staff");
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
        <div className="mt-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void (active ? disable() : enable())}
            className={
              "h-9 w-full rounded-xl text-[9px] font-black transition disabled:opacity-50 " +
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
        </div>
      )}
    </div>
  );
}
