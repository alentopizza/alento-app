"use client";

import { useEffect, useState } from "react";
import { MessageCircle, ExternalLink, Minus, X } from "lucide-react";

const STORAGE_KEY = "alento-whatsapp-quick-access-v1";
const WHATSAPP_URL = "https://web.whatsapp.com/";

export default function WhatsAppQuickAccess() {
  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "hidden") setVisible(false);
      if (saved === "expanded") setExpanded(true);
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        visible ? (expanded ? "expanded" : "visible") : "hidden",
      );
    } catch {}
  }, [visible, expanded, ready]);

  function openWhatsApp() {
    const popup = window.open(
      WHATSAPP_URL,
      "alento-whatsapp-web",
      "popup=yes,width=1180,height=850,resizable=yes,scrollbars=yes",
    );
    if (!popup) window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");
  }

  if (!ready) return null;

  if (!visible) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        aria-label="Mostrar acceso a WhatsApp"
        title="WhatsApp"
        className="fixed bottom-5 right-5 z-[160] flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_28px_rgba(0,0,0,.24)] transition hover:scale-105"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <aside
      className="fixed bottom-5 right-5 z-[160] w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_16px_50px_rgba(0,0,0,.2)]"
      aria-label="Acceso rápido a WhatsApp"
    >
      <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-5">WhatsApp de Alentó</p>
          <p className="text-[11px] text-white/75">Acceso rápido para atención</p>
        </div>
        <button type="button" onClick={() => setExpanded(false)} aria-label="Minimizar WhatsApp" className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white">
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setVisible(false)} aria-label="Ocultar acceso a WhatsApp" className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      {expanded && (
        <div className="space-y-3 p-4">
          <p className="text-xs leading-5 text-neutral-600">
            Abre WhatsApp Web en una ventana independiente. Si es la primera vez, escanea el código QR con el teléfono de Alentó para iniciar sesión.
          </p>
          <button
            type="button"
            onClick={openWhatsApp}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-bold text-white transition hover:bg-[#1fbd5b] active:scale-[.99]"
          >
            <MessageCircle className="h-4 w-4" />
            Abrir WhatsApp Web
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <p className="text-[10px] leading-4 text-neutral-400">
            La sesión queda guardada por WhatsApp en el navegador donde se inicia.
          </p>
        </div>
      )}
      {!expanded && (
        <button type="button" onClick={() => setExpanded(true)} className="w-full px-4 py-2 text-left text-xs font-semibold text-neutral-600 hover:bg-neutral-50">
          Mostrar acceso a WhatsApp
        </button>
      )}
    </aside>
  );
}
