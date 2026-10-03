"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const FALLBACK_INTRO_IMAGE =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/CpQ55KIWphJs8CeomkY3.png";

type PublicHomeSettings = {
  landing?: {
    mobileImageUrl?: string;
    desktopImageUrl?: string;
  };
};

export default function PublicLandingPageClient() {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [home, setHome] = useState<PublicHomeSettings | null>(null);
  const [homeLoaded, setHomeLoaded] = useState(false);

  useEffect(() => {
    async function loadHome() {
      try {
        const response = await fetch("/api/public-home", { cache: "no-store" });
        const data = await response.json();
        if (response.ok) setHome(data?.settings ?? null);
      } finally {
        setHomeLoaded(true);
      }
    }

    void loadHome();
  }, []);

  const mobileImage = home?.landing?.mobileImageUrl || FALLBACK_INTRO_IMAGE;
  const desktopImage =
    home?.landing?.desktopImageUrl ||
    home?.landing?.mobileImageUrl ||
    FALLBACK_INTRO_IMAGE;

  function updateFromPointer(clientX: number) {
    const track = trackRef.current;
    if (!track) return 0;

    const rect = track.getBoundingClientRect();
    const knobSize = 54;
    const padding = 4;
    const usable = Math.max(1, rect.width - knobSize - padding * 2);
    const raw = (clientX - rect.left - padding - knobSize / 2) / usable;
    const next = Math.min(1, Math.max(0, raw));
    setProgress(next);
    return next;
  }

  function finish(nextProgress = progress) {
    setDragging(false);

    if (nextProgress >= 0.82) {
      setProgress(1);
      setLeaving(true);
      window.setTimeout(() => {
        router.push("/menu");
      }, 180);
      return;
    }

    setProgress(0);
  }

  return (
    <main className="min-h-[100dvh] bg-black">
      <div className="relative min-h-[100dvh] w-full overflow-hidden bg-white">
        {homeLoaded ? (
          <picture>
            <source media="(min-width: 900px)" srcSet={desktopImage} />
            <img
              src={mobileImage}
              alt="Alentó Pizza"
              className="absolute inset-0 h-full w-full object-cover object-center"
              draggable={false}
            />
          </picture>
        ) : (
          <div className="absolute inset-0 bg-black" aria-hidden="true" />
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[190px] bg-gradient-to-t from-black/30 via-black/5 to-transparent" />

        <div
          className={`absolute inset-x-0 bottom-[max(22px,env(safe-area-inset-bottom))] px-5 transition-opacity duration-200 sm:px-7 ${leaving ? "opacity-0" : "opacity-100"}`}
        >
          <div
            ref={trackRef}
            className="landing-menu-slider relative mx-auto h-[62px] w-full max-w-[520px] overflow-hidden rounded-full border border-white/80 bg-white/95 shadow-[0_16px_44px_rgba(0,0,0,.20)] backdrop-blur-md"
          >
            <div
              className="absolute inset-y-1 left-1 z-[1] rounded-full bg-[#df1f26]"
              style={{
                width: `calc(54px + (100% - 62px) * ${progress})`,
                transition: dragging ? "none" : "width 220ms cubic-bezier(.2,.8,.2,1)",
              }}
            />

            <div
              className="pointer-events-none absolute inset-y-0 left-[68px] right-3 z-[3] flex items-center justify-center text-center"
              style={{
                opacity: Math.max(0.18, 1 - progress * 1.15),
                transition: dragging ? "none" : "opacity 180ms ease",
              }}
            >
              <span className="landing-menu-slider-text whitespace-nowrap text-[10px] font-black uppercase tracking-[0.06em] text-black/75 min-[360px]:text-[11px] min-[430px]:text-[12px] min-[430px]:tracking-[0.08em]">
                Desliza y descubre el menú
              </span>
            </div>

            <button
              type="button"
              aria-label="Desliza y descubre el menú"
              className={`landing-menu-slider-knob ${!dragging && progress === 0 ? "landing-menu-slider-knob-idle" : ""} absolute top-1 z-[4] flex h-[54px] w-[54px] touch-none select-none items-center justify-center rounded-full bg-black text-white shadow-[0_8px_18px_rgba(0,0,0,.28)] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[#e51c11] focus-visible:ring-offset-2 active:scale-[.98]`}
              style={{
                left: `calc(4px + (100% - 62px) * ${progress})`,
                transition: dragging ? "none" : "left 220ms cubic-bezier(.2,.8,.2,1)",
              }}
              onPointerDown={(event) => {
                if (leaving) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging(true);
                updateFromPointer(event.clientX);
              }}
              onPointerMove={(event) => {
                if (!dragging || leaving) return;
                updateFromPointer(event.clientX);
              }}
              onPointerUp={(event) => {
                if (!dragging || leaving) return;
                const next = updateFromPointer(event.clientX);
                finish(next);
              }}
              onPointerCancel={() => {
                if (!leaving) finish(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setProgress(1);
                  setLeaving(true);
                  window.setTimeout(() => router.push("/menu"), 180);
                }
              }}
            >
              <svg
                viewBox="0 0 24 24"
                className="landing-menu-slider-arrow h-[22px] w-[22px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h13" />
                <path d="m14 7 5 5-5 5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
