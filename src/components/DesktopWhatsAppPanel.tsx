"use client";

import { useCallback, useEffect, useRef } from "react";
import { Maximize2, Minimize2, MessageCircle, RefreshCw, X } from "lucide-react";

declare global {
  interface Window {
    alentoDesktop?: {
      isDesktop: true;
      setWhatsAppBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
      setWhatsAppVisible: (visible: boolean) => void;
      reloadWhatsApp: () => void;
    };
  }
}

type Props = {
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
};

export default function DesktopWhatsAppPanel({ expanded, onExpand, onClose }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const slot = slotRef.current;
    if (!slot || !window.alentoDesktop?.isDesktop) return;
    const rect = slot.getBoundingClientRect();
    if (rect.width < 360 || rect.height < 240) {
      window.alentoDesktop.setWhatsAppVisible(false);
      return;
    }
    window.alentoDesktop.setWhatsAppBounds({
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
    window.alentoDesktop.setWhatsAppVisible(true);
  }, []);

  useEffect(() => {
    if (!window.alentoDesktop?.isDesktop) return;
    const slot = slotRef.current;
    if (!slot) return;
    window.alentoDesktop.setWhatsAppVisible(true);
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    window.addEventListener("resize", measure);
    const frame = window.requestAnimationFrame(measure);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.alentoDesktop?.setWhatsAppVisible(false);
    };
  }, [measure, expanded]);

  return (
    <section className="sticky top-0 flex h-screen min-h-[620px] min-w-0 flex-col overflow-hidden border-l border-white/10 bg-[#0b0b0c]">
      <header className="flex h-[62px] shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-[#101112] to-[#171819] px-3 text-white">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#20c96b] text-white shadow-[0_0_18px_rgba(32,201,107,.2)]">
            <MessageCircle size={23} fill="white" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[15px] font-black tracking-tight">WhatsApp Web</h2>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">Sesión guardada</span>
            </div>
            <p className="mt-0.5 text-[10px] text-white/40">Mensajes de Alentó Pizza</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => window.alentoDesktop?.reloadWhatsApp()} title="Recargar WhatsApp" aria-label="Recargar WhatsApp" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white"><RefreshCw size={15}/></button>
          <button type="button" onClick={onExpand} title={expanded ? "Reducir panel" : "Ampliar panel"} aria-label={expanded ? "Reducir panel" : "Ampliar panel"} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white">{expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</button>
          <button type="button" onClick={onClose} title="Cerrar WhatsApp" aria-label="Cerrar WhatsApp" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200"><X size={18}/></button>
        </div>
      </header>
      <div ref={slotRef} className="min-h-0 flex-1 bg-[#f7f5f3]" />
    </section>
  );
}
