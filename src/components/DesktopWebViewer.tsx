"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Globe2,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
  ChevronDown,
  ArrowRight,
} from "lucide-react";

const PAGES = [
  { label: "WhatsApp Web", url: "https://web.whatsapp.com/" },
  { label: "Chatwoot", url: "https://chat.operadoranordecolombia.com/" },
];

type Props = {
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
};

function normalizeHttpsUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || !parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export default function DesktopWebViewer({ expanded, onExpand, onClose }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [selectedPage, setSelectedPage] = useState(PAGES[0].label);
  const [address, setAddress] = useState(PAGES[0].url);
  const [addressDraft, setAddressDraft] = useState(PAGES[0].url);
  const [addressError, setAddressError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const measure = useCallback(() => {
    const slot = slotRef.current;
    if (!slot || !window.alentoDesktop?.isDesktop) return;
    const rect = slot.getBoundingClientRect();
    if (rect.width < 360 || rect.height < 240) {
      window.alentoDesktop.setWebViewVisible(false);
      return;
    }
    window.alentoDesktop.setWebViewBounds({
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
    window.alentoDesktop.setWebViewVisible(true);
  }, []);

  useEffect(() => {
    if (!window.alentoDesktop?.isDesktop) return;
    const slot = slotRef.current;
    if (!slot) return;
    window.alentoDesktop.navigateWebView(PAGES[0].url);
    window.alentoDesktop.setWebViewVisible(true);
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    window.addEventListener("resize", measure);
    const frame = window.requestAnimationFrame(measure);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.alentoDesktop?.setWebViewVisible(false);
    };
  }, [measure, expanded]);

  function navigate(urlValue: string, label = "Página personalizada") {
    const safeUrl = normalizeHttpsUrl(urlValue);
    if (!safeUrl) {
      setAddressError("Introduce una dirección HTTPS válida.");
      return;
    }
    setAddressError("");
    setAddress(safeUrl);
    setAddressDraft(safeUrl);
    setSelectedPage(label);
    window.alentoDesktop?.navigateWebView(safeUrl);
    setMenuOpen(false);
  }

  function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(addressDraft);
  }

  return (
    <section className="sticky top-0 flex h-screen min-h-[620px] min-w-0 flex-col overflow-hidden border-l border-white/10 bg-[#0b0b0c]">
      <header className="flex min-h-[62px] shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-[#101112] to-[#171819] px-3 text-white">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white"><Globe2 size={21}/></span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-black tracking-tight">Visor web</h2>
            <p className="mt-0.5 truncate text-[10px] text-white/40">Navegación integrada en el POS</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((value) => !value)} className="flex h-9 max-w-[150px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[11px] font-bold text-white/85 hover:bg-white/10">
              <span className="truncate">{selectedPage}</span><ChevronDown size={13}/>
            </button>
            {menuOpen && <div className="absolute right-0 top-11 z-[220] min-w-[190px] overflow-hidden rounded-xl border border-white/10 bg-[#191a1d] p-1.5 shadow-2xl">
              {PAGES.map((page) => <button key={page.label} type="button" onClick={() => navigate(page.url, page.label)} className="block w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-white/80 hover:bg-white/10">{page.label}</button>)}
              <button type="button" onClick={() => { setSelectedPage("Página personalizada"); setMenuOpen(false); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-white/80 hover:bg-white/10">Página personalizada</button>
            </div>}
          </div>
          <button type="button" onClick={() => window.alentoDesktop?.reloadWebView()} title="Recargar página" aria-label="Recargar página" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white"><RefreshCw size={15}/></button>
          <button type="button" onClick={onExpand} title={expanded ? "Reducir visor" : "Ampliar visor"} aria-label={expanded ? "Reducir visor" : "Ampliar visor"} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white">{expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</button>
          <button type="button" onClick={onClose} title="Ocultar visor" aria-label="Ocultar visor" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200"><X size={18}/></button>
        </div>
      </header>
      <form onSubmit={submitAddress} className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#141518] px-3 py-2">
        <div className="flex h-8 min-w-0 flex-1 items-center rounded-lg border border-white/10 bg-black/25 px-2.5">
          <Globe2 size={13} className="mr-2 shrink-0 text-white/35"/>
          <input value={addressDraft} onChange={(event) => setAddressDraft(event.target.value)} aria-label="Dirección web" placeholder="https://..." className="min-w-0 flex-1 bg-transparent text-[11px] text-white/80 outline-none placeholder:text-white/25"/>
        </div>
        <button type="submit" aria-label="Ir a la dirección" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e91c24] text-white hover:bg-red-500"><ArrowRight size={15}/></button>
        <button type="button" onClick={() => { const safeUrl = normalizeHttpsUrl(address); if (safeUrl) window.open(safeUrl, "_blank", "noopener,noreferrer"); }} title="Abrir en navegador externo" aria-label="Abrir en navegador externo" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/60 hover:bg-white/10"><ExternalLink size={14}/></button>
      </form>
      {addressError && <p className="shrink-0 bg-red-950/70 px-3 py-1.5 text-[11px] text-red-200">{addressError}</p>}
      <div ref={slotRef} className="min-h-0 flex-1 bg-white" />
      <div className="flex shrink-0 items-center justify-between border-t border-white/10 bg-[#111214] px-3 py-1.5 text-[9px] text-white/35">
        <span>Solo direcciones HTTPS</span>
        <span className="truncate">{address}</span>
      </div>
    </section>
  );
}
