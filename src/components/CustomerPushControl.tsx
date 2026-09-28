"use client";

import { useEffect, useState } from "react";
import {
  disableWebPush,
  enableWebPush,
  loadWebPushState,
  type WebPushCapability,
} from "@/lib/webPushClient";

export default function CustomerPushControl() {
  const [state, setState] = useState<WebPushCapability>("loading");
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      const result = await loadWebPushState("/api/customer/push");
      setPublicKey(result.publicKey);
      setState(result.state);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible consultar las notificaciones.");
      setState("off");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (state === "on") {
        await disableWebPush("/api/customer/push");
        setState("off");
        setMessage("Notificaciones desactivadas en este dispositivo.");
      } else if (publicKey) {
        const result = await enableWebPush("/api/customer/push", publicKey);
        setState(result.enabled ? "on" : result.denied ? "denied" : "off");
        setMessage(result.enabled ? "Notificaciones activas." : "No se activaron las notificaciones.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible cambiar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  const active = state === "on";

  return (
    <section className="rounded-[24px] border border-white/10 bg-white p-5 text-neutral-950 shadow-[0_16px_40px_rgba(0,0,0,.20)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl " + (active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500")}>
            🔔
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#e21a22]">Notificaciones</p>
            <h2 className="mt-1 text-[16px] font-black tracking-[-0.02em]">
              {state === "loading" ? "Comprobando..." : active ? "Notificaciones activas" : state === "denied" ? "Notificaciones bloqueadas" : "Activa tus notificaciones"}
            </h2>
            <p className="mt-1 text-[10px] leading-4 text-neutral-500">
              Recibe novedades, promociones y avisos importantes de Alentó.
            </p>
          </div>
        </div>
        <span className={"h-3 w-3 shrink-0 rounded-full " + (active ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,.55)]" : "bg-neutral-200")} />
      </div>

      {message && <p className="mt-3 text-[9px] font-semibold text-neutral-500">{message}</p>}
      {state === "denied" && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[9px] font-semibold leading-4 text-amber-800">
          El navegador bloqueó el permiso. Debes habilitar las notificaciones para alentopizza.com desde los ajustes del navegador.
        </p>
      )}

      {(state === "off" || state === "on") && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggle()}
          className={"mt-4 h-11 w-full rounded-2xl text-[10px] font-black transition disabled:opacity-50 " + (active ? "border border-neutral-200 bg-neutral-50 text-neutral-600" : "bg-emerald-500 text-white shadow-[0_10px_24px_rgba(16,185,129,.22)]")}
        >
          {busy ? "Procesando..." : active ? "Desactivar notificaciones" : "Activar notificaciones"}
        </button>
      )}
    </section>
  );
}
