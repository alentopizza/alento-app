"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Globe2,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
} from "lucide-react";

const CHATWOOT_URL = "https://chat.operadoranordecolombia.com";
const WHATSAPP_URL = "https://web.whatsapp.com/";

type Preset = { label: string; url: string; mode: "embed" | "external" };

const PRESETS: Preset[] = [
  { label: "Chatwoot", url: CHATWOOT_URL, mode: "embed" },
  { label: "WhatsApp Web", url: WHATSAPP_URL, mode: "external" },
];

type Props = {
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
};

function normalizeHttpsUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^https:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || !parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function isWhatsAppUrl(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "web.whatsapp.com" || host.endsWith(".whatsapp.com");
  } catch {
    return false;
  }
}

export default function PosWebViewer({ expanded, onExpand, onClose }: Props) {
  const [url, setUrl] = useState(CHATWOOT_URL);
  const [addressDraft, setAddressDraft] = useState(CHATWOOT_URL);
  const [selectedLabel, setSelectedLabel] = useState("Chatwoot");
  const [menuOpen, setMenuOpen] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [frameFailed, setFrameFailed] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("alento-pos-web-viewer-v2");
      if (!saved) return;
      const parsed = JSON.parse(saved) as { url?: string; label?: string };
      const safeUrl = parsed.url ? normalizeHttpsUrl(parsed.url) : null;
      if (!safeUrl) return;
      setUrl(safeUrl);
      setAddressDraft(safeUrl);
      setSelectedLabel(parsed.label || "Página personalizada");
    } catch {}
  }, []);

  const whatsappBlocked = useMemo(() => isWhatsAppUrl(url), [url]);

  function navigate(nextValue: string, label = "Página personalizada") {
    const safeUrl = normalizeHttpsUrl(nextValue);
    if (!safeUrl) {
      setAddressError("Escribe una dirección HTTPS válida.");
      return;
    }
    setAddressError("");
    setFrameFailed(false);
    setUrl(safeUrl);
    setAddressDraft(safeUrl);
    setSelectedLabel(label);
    setMenuOpen(false);
    try {
      window.localStorage.setItem(
        "alento-pos-web-viewer-v2",
        JSON.stringify({ url: safeUrl, label }),
      );
    } catch {}
  }

  function submitAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(addressDraft);
  }

  function openExternal() {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <aside className="flex min-h-[560px] min-w-0 flex-col overflow-hidden border-l border-black/10 bg-[#101114] text-white lg:sticky lg:top-0 lg:h-screen">
      <header className="flex min-h-[66px] shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-[#111214] to-[#2a0b0e] px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white">
            <Globe2 size={21} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-black">Visor web</h2>
            <p className="truncate text-[10px] text-white/45">Herramientas junto al pedido</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex h-9 max-w-[130px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 text-[11px] font-bold text-white/85 hover:bg-white/10"
              aria-expanded={menuOpen}
            >
              <span className="truncate">{selectedLabel}</span>
              <ChevronDown size={13} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 z-[220] min-w-[190px] overflow-hidden rounded-xl border border-white/10 bg-[#1b1c20] p-1.5 shadow-2xl">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => navigate(preset.url, preset.label)}
                    className="block w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-white/85 hover:bg-white/10"
                  >
                    {preset.label}
                    {preset.mode === "external" ? " · nueva pestaña" : ""}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLabel("Página personalizada");
                    setMenuOpen(false);
                  }}
                  className="block w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-white/85 hover:bg-white/10"
                >
                  Página personalizada
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            title="Recargar página"
            aria-label="Recargar página"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/75 hover:bg-white/10"
          >
            <RefreshCw size={15} />
          </button>
          <button
            type="button"
            onClick={onExpand}
            title={expanded ? "Reducir visor" : "Ampliar visor"}
            aria-label={expanded ? "Reducir visor" : "Ampliar visor"}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/75 hover:bg-white/10"
          >
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Ocultar visor"
            aria-label="Ocultar visor"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/75 hover:border-red-400/30 hover:bg-red-500/15"
          >
            <X size={17} />
          </button>
        </div>
      </header>

      <form
        onSubmit={submitAddress}
        className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#17181b] px-3 py-2"
      >
        <div className="flex h-9 min-w-0 flex-1 items-center rounded-lg border border-white/10 bg-black/25 px-2.5">
          <Globe2 size={13} className="mr-2 shrink-0 text-white/40" />
          <input
            value={addressDraft}
            onChange={(event) => setAddressDraft(event.target.value)}
            aria-label="Dirección web"
            placeholder="https://..."
            className="min-w-0 flex-1 bg-transparent text-[11px] text-white/85 outline-none placeholder:text-white/30"
          />
        </div>
        <button
          type="submit"
          aria-label="Ir a la dirección"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e91c24] text-white hover:bg-red-500"
        >
          <ArrowRight size={15} />
        </button>
        <button
          type="button"
          onClick={openExternal}
          title="Abrir en otra pestaña"
          aria-label="Abrir en otra pestaña"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/65 hover:bg-white/10"
        >
          <ExternalLink size={14} />
        </button>
      </form>

      {addressError && (
        <p className="shrink-0 bg-red-950/80 px-3 py-2 text-[11px] text-red-100">
          {addressError}
        </p>
      )}

      <div className="relative min-h-[460px] flex-1 bg-white">
        {whatsappBlocked ? (
          <div className="flex h-full min-h-[460px] flex-col items-center justify-center bg-[#f7f7f7] px-6 py-10 text-center text-[#171717]">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#25d366] text-white">
              <Globe2 size={31} />
            </div>
            <h3 className="text-lg font-extrabold">WhatsApp Web</h3>
            <p className="mt-2 max-w-xs text-sm leading-6 text-black/60">
              WhatsApp no permite mostrar su aplicación dentro de un visor incrustado en otra página. Puedes abrirlo en una pestaña nueva sin perder el pedido en Alentó.
            </p>
            <button
              type="button"
              onClick={openExternal}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#20c76a] px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-[#16b85c]"
            >
              Abrir WhatsApp Web <ExternalLink size={15} />
            </button>
          </div>
        ) : (
          <>
            {frameFailed ? (
              <div className="flex h-full min-h-[460px] flex-col items-center justify-center px-6 text-center text-[#222]">
                <Globe2 size={34} className="text-black/35" />
                <h3 className="mt-3 font-bold">No se pudo mostrar esta página</h3>
                <p className="mt-1 max-w-xs text-xs leading-5 text-black/55">
                  Es posible que el sitio no permita ser incrustado. Prueba abrirlo en otra pestaña.
                </p>
                <button type="button" onClick={openExternal} className="mt-4 rounded-lg bg-black px-4 py-2 text-xs font-bold text-white">
                  Abrir fuera del POS
                </button>
              </div>
            ) : (
              <iframe
                key={`${url}-${reloadKey}`}
                src={url}
                title={`Visor web: ${selectedLabel}`}
                className="h-full min-h-[460px] w-full border-0 bg-white"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="clipboard-read; clipboard-write; fullscreen"
                onError={() => setFrameFailed(true)}
              />
            )}
          </>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-[#111214] px-3 py-2 text-[9px] text-white/40">
        <span className="shrink-0">{whatsappBlocked ? "Requiere pestaña externa" : "Visor HTTPS"}</span>
        <span className="truncate text-right">{url}</span>
      </footer>
    </aside>
  );
}
