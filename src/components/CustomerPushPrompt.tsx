"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { enableWebPush, loadWebPushState } from "@/lib/webPushClient";

const DISMISSED_KEY = "alento-customer-push-prompt-dismissed";

export default function CustomerPushPrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const internalPrefixes = [
      "/interno",
      "/repartidor",
      "/cocina",
      "/notificaciones",
      "/pedidos",
      "/caja",
      "/usuarios",
      "/clientes",
      "/preparacion",
    ];
    if (internalPrefixes.some((prefix) => pathname.startsWith(prefix))) {
      setVisible(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        if (window.localStorage.getItem(DISMISSED_KEY) === "1") return;
        const result = await loadWebPushState("/api/push");
        if (cancelled) return;
        setPublicKey(result.publicKey);
        if (result.state === "off") setVisible(true);
      } catch {
        // El permiso push nunca debe interrumpir la navegación.
      }
    }, 1400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pathname]);

  async function enable() {
    if (!publicKey || busy) return;
    setBusy(true);
    try {
      const result = await enableWebPush("/api/push", publicKey);
      if (result.enabled || result.denied) setVisible(false);
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-[120] mx-auto max-w-[460px] rounded-[24px] border border-white/10 bg-[#111] p-4 text-white shadow-[0_20px_55px_rgba(0,0,0,.38)]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-xl shadow-[0_8px_22px_rgba(16,185,129,.28)]">🔔</span>
        <div className="min-w-0 flex-1">
          <b className="block text-[13px] font-black">Activa las notificaciones de Alentó</b>
          <p className="mt-1 text-[10px] leading-4 text-white/60">
            Recibe promociones, novedades y avisos importantes directamente en tu dispositivo.
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button type="button" disabled={busy} onClick={() => void enable()} className="h-10 rounded-xl bg-emerald-500 px-4 text-[10px] font-black text-white disabled:opacity-50">
          {busy ? "Activando..." : "Activar notificaciones"}
        </button>
        <button type="button" onClick={dismiss} className="h-10 rounded-xl border border-white/10 px-4 text-[10px] font-black text-white/55">
          Ahora no
        </button>
      </div>
    </div>
  );
}
