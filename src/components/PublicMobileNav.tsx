"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ActiveTab = "menu" | "cart" | "club" | "profile";

type Props = {
  active: ActiveTab;
  cartCount?: number;
};

const TABS: ActiveTab[] = ["menu", "cart", "club", "profile"];

function PizzaIcon({
  className = "h-7 w-7",
  active = false,
}: {
  className?: string;
  active?: boolean;
}) {
  const dot = active ? "#e21a22" : "#8d8d8d";

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M10 46 31 11c2-3 6-4 9-2 8 5 13 13 14 23 .4 3-2 6-5 7L15 51c-4 1-7-2-5-5Z"
        fill="currentColor"
      />
      <circle cx="37" cy="20" r="3.3" fill={dot} />
      <circle cx="45" cy="29" r="3.3" fill={dot} />
      <circle cx="29" cy="31" r="3.3" fill={dot} />
      <path
        d="M15 48c10-1 23-6 35-12"
        fill="none"
        stroke={dot}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CartIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H7" />
      <circle cx="10" cy="19" r="1.2" />
      <circle cx="18" cy="19" r="1.2" />
    </svg>
  );
}

function ClubIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 2.7 5.4 6 .9-4.35 4.2 1.03 5.95L12 16.65l-5.38 2.8 1.03-5.95L3.3 9.3l6-.9L12 3Z" />
    </svg>
  );
}

function ProfileIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" />
    </svg>
  );
}

function ActiveIcon({ tab }: { tab: ActiveTab }) {
  if (tab === "menu") return <PizzaIcon className="h-8 w-8" active />;
  if (tab === "cart") return <CartIcon className="h-7 w-7" />;
  if (tab === "club") return <ClubIcon className="h-7 w-7" />;
  return <ProfileIcon className="h-7 w-7" />;
}

function rememberOrigin(active: ActiveTab) {
  try {
    window.sessionStorage.setItem("alento-mobile-nav-from", active);
  } catch {
    // La navegación nunca debe bloquearse por sessionStorage.
  }
}

export default function PublicMobileNav({ active, cartCount = 0 }: Props) {
  const [visualActive, setVisualActive] = useState<ActiveTab>(active);

  useEffect(() => {
    let previous: ActiveTab | null = null;

    try {
      const saved = window.sessionStorage.getItem("alento-mobile-nav-from");
      if (saved && TABS.includes(saved as ActiveTab)) {
        previous = saved as ActiveTab;
      }
      window.sessionStorage.removeItem("alento-mobile-nav-from");
    } catch {
      previous = null;
    }

    if (previous && previous !== active) {
      setVisualActive(previous);

      const firstFrame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisualActive(active));
      });

      return () => window.cancelAnimationFrame(firstFrame);
    }

    setVisualActive(active);
  }, [active]);

  const activeIndex = TABS.indexOf(visualActive);
  const activeLeft = `${(activeIndex + 0.5) * 25}%`;

  return (
    <nav className="fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] z-[75] px-3 md:hidden">
      <div className="relative mx-auto h-[66px] max-w-[430px]">
        <div className="absolute inset-x-0 bottom-0 h-[58px] rounded-[15px] border border-black/10 bg-[#f4f4f4] shadow-[0_18px_45px_rgba(0,0,0,.30)]" />

        <div
          className="pointer-events-none absolute bottom-0 z-10 h-[82px] w-[92px] -translate-x-1/2 transition-[left] duration-[360ms] ease-[cubic-bezier(.22,.8,.24,1)]"
          style={{ left: activeLeft }}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 92 50"
            className="absolute left-0 top-[6px] h-[50px] w-[92px]"
            preserveAspectRatio="none"
          >
            <path
              d="M0 50V33h13c9.5 0 12-6.8 14-16C29.1 6.8 36.8 0 46 0s16.9 6.8 19 17c2 9.2 4.5 16 14 16h13v17H0Z"
              fill="#f4f4f4"
            />
          </svg>

          <span className="absolute left-1/2 top-0 flex h-[56px] w-[56px] -translate-x-1/2 items-center justify-center rounded-full border-[5px] border-[#f4f4f4] bg-[#e21a22] text-white shadow-[0_7px_18px_rgba(226,26,34,.34)]">
            <ActiveIcon tab={visualActive} />
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 grid h-[58px] grid-cols-4 items-center">
          <Link
            href="/menu"
            onClick={() => rememberOrigin(active)}
            className={`relative flex h-full items-center justify-center transition active:scale-95 ${active === "menu" ? "text-transparent" : "text-[#343434]"}`}
            aria-label="Menú"
          >
            <PizzaIcon className="h-6 w-6" />
          </Link>

          <Link
            href="/cart"
            onClick={() => rememberOrigin(active)}
            className={`relative flex h-full items-center justify-center transition active:scale-95 ${active === "cart" ? "text-transparent" : "text-[#343434]"}`}
            aria-label={`Carrito con ${cartCount} productos`}
          >
            <CartIcon />

            {cartCount > 0 && active !== "cart" && (
              <span className="absolute left-1/2 top-1 ml-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#e21a22] px-1 text-[9px] font-black text-white shadow-sm">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          <button
            type="button"
            className={`relative flex h-full items-center justify-center ${active === "club" ? "text-transparent" : "text-[#343434]"}`}
            aria-label="Club de la Pizza próximamente"
            title="Club de la Pizza próximamente"
          >
            <ClubIcon />
          </button>

          <Link
            href="/cuenta"
            onClick={() => rememberOrigin(active)}
            className={`relative flex h-full items-center justify-center transition active:scale-95 ${active === "profile" ? "text-transparent" : "text-[#343434]"}`}
            aria-label="Perfil"
          >
            <ProfileIcon />
          </Link>
        </div>
      </div>
    </nav>
  );
}
