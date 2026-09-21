"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

const ALENTO_ICON =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

function isPublicAppPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/app2") ||
    pathname.startsWith("/menu") ||
    pathname.startsWith("/pedir")
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true
  );
}

function isMobile() {
  return (
    window.matchMedia("(max-width: 900px)").matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

export default function PwaInstallPrompt() {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissedPath, setDismissedPath] = useState("");

  useEffect(() => {
    const standalone = isStandalone();
    setInstalled(standalone);

    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !standalone;

    setIsIos(ios);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (
      installed ||
      !isMobile() ||
      !isPublicAppPath(pathname) ||
      dismissedPath === pathname
    ) {
      setVisible(false);
      return;
    }

    if (!isIos && !installEvent) {
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(
      () => setVisible(true),
      isIos ? 900 : 550,
    );

    return () => window.clearTimeout(timer);
  }, [pathname, installEvent, isIos, installed, dismissedPath]);

  async function install() {
    if (!installEvent) return;

    await installEvent.prompt();
    const choice = await installEvent.userChoice;

    setVisible(false);
    setInstallEvent(null);

    if (choice.outcome === "dismissed") {
      setDismissedPath(pathname);
    }
  }

  function dismiss() {
    setDismissedPath(pathname);
    setVisible(false);
  }

  if (!visible || installed || !isPublicAppPath(pathname)) return null;
  if (!isIos && !installEvent) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:items-center">
      <div className="w-full max-w-[430px] overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_28px_80px_rgba(0,0,0,.30)]">
        <div className="bg-[linear-gradient(135deg,#090909,#241010)] px-5 py-5 text-white">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-black shadow-lg">
              <img
                src={ALENTO_ICON}
                alt="Alentó Pizza"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/45">
                Alentó Pizza
              </p>
              <h2 className="mt-1 text-[22px] font-black tracking-[-0.03em]">
                Instala Alentó en tu celular
              </h2>
              <p className="mt-2 text-[11px] leading-5 text-white/60">
                Accede más rápido al menú y pide como si fuera una app instalada.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {isIos ? (
            <div className="rounded-[18px] bg-[#f7f5f2] p-4">
              <p className="text-[12px] font-black text-neutral-900">
                En iPhone o iPad:
              </p>
              <p className="mt-2 text-[12px] leading-5 text-neutral-600">
                Toca <b>Compartir</b> en Safari y luego selecciona <b>Agregar a pantalla de inicio</b>.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void install()}
              className="h-12 w-full rounded-[16px] bg-[#d71920] text-[13px] font-black text-white shadow-[0_10px_26px_rgba(215,25,32,.22)]"
            >
              Instalar Alentó
            </button>
          )}

          <button
            type="button"
            onClick={dismiss}
            className="mt-2 h-10 w-full text-[11px] font-semibold text-neutral-400"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
