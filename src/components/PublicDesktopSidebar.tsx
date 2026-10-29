"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PUBLIC_CART_STORAGE_KEY } from "@/lib/publicCart";

type ActiveTab = "menu" | "cart" | "club" | "profile";

type Props = {
  active: ActiveTab;
  cartCount?: number;
  contentMaxWidth: number;
};

const TABS: ActiveTab[] = ["menu", "cart", "club", "profile"];

function PizzaIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-6 w-6" aria-hidden="true">
      <path
        d="M10 46 31 11c2-3 6-4 9-2 8 5 13 13 14 23 .4 3-2 6-5 7L15 51c-4 1-7-2-5-5Z"
        fill="currentColor"
      />
      <circle cx="37" cy="20" r="3.3" fill="currentColor" />
      <circle cx="45" cy="29" r="3.3" fill="currentColor" />
      <circle cx="29" cy="31" r="3.3" fill="currentColor" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
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

function ClubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
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

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
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

function TabIcon({ tab }: { tab: ActiveTab }) {
  if (tab === "menu") return <PizzaIcon />;
  if (tab === "cart") return <CartIcon />;
  if (tab === "club") return <ClubIcon />;
  return <ProfileIcon />;
}

function tabLabel(tab: ActiveTab) {
  if (tab === "menu") return "Menú";
  if (tab === "cart") return "Carrito";
  if (tab === "club") return "Club";
  return "Perfil";
}

function tabHref(tab: ActiveTab) {
  if (tab === "menu") return "/menu";
  if (tab === "cart") return "/cart";
  if (tab === "club") return "/club";
  return "/cuenta";
}

function rememberOrigin(active: ActiveTab) {
  try {
    window.sessionStorage.setItem("alento-desktop-nav-from", active);
  } catch {
    // La navegación nunca debe depender de sessionStorage.
  }
}

export default function PublicDesktopSidebar({ active, cartCount, contentMaxWidth }: Props) {
  const [logoUrl, setLogoUrl] = useState("");
  const [resolvedCartCount, setResolvedCartCount] = useState(cartCount ?? 0);
  const [visualActive, setVisualActive] = useState<ActiveTab>(active);

  useEffect(() => {
    let mounted = true;

    fetch("/api/public-home", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!mounted) return;
        setLogoUrl(
          typeof data?.settings?.brand?.logoUrl === "string"
            ? data.settings.brand.logoUrl.trim()
            : "",
        );
      })
      .catch(() => {});

    if (cartCount == null) {
      try {
        const saved = window.localStorage.getItem(PUBLIC_CART_STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) {
          const count = parsed.reduce(
            (sum: number, item: { quantity?: unknown }) =>
              sum + Math.max(0, Number(item?.quantity ?? 0)),
            0,
          );
          setResolvedCartCount(count);
        }
      } catch {
        setResolvedCartCount(0);
      }
    }

    return () => {
      mounted = false;
    };
  }, [cartCount]);

  useEffect(() => {
    if (cartCount != null) setResolvedCartCount(cartCount);
  }, [cartCount]);

  useEffect(() => {
    let previous: ActiveTab | null = null;

    try {
      const saved = window.sessionStorage.getItem("alento-desktop-nav-from");
      if (saved && TABS.includes(saved as ActiveTab)) {
        previous = saved as ActiveTab;
      }
      window.sessionStorage.removeItem("alento-desktop-nav-from");
    } catch {
      previous = null;
    }

    if (previous && previous !== active) {
      setVisualActive(previous);

      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisualActive(active));
      });

      return () => window.cancelAnimationFrame(frame);
    }

    setVisualActive(active);
  }, [active]);

  return (
    <aside
      className="fixed top-1/2 z-[70] hidden -translate-y-1/2 flex-col items-center gap-2.5 md:flex"
      style={{ left: `max(12px, calc(50vw - ${contentMaxWidth / 2}px - 40px))` }}
    >
      <Link
        href="/menu"
        className="flex h-[58px] w-[72px] items-center justify-center rounded-[22px] border border-white/[0.08] bg-black/90 px-2 shadow-[0_16px_38px_rgba(0,0,0,.28)] backdrop-blur-xl"
        aria-label="Alentó Pizza"
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Alentó Pizza"
            className="h-[36px] w-[62px] object-contain object-center"
          />
        ) : (
          <span className="h-[36px] w-[62px]" aria-hidden="true" />
        )}
      </Link>

      <nav className="flex w-[72px] flex-col items-stretch rounded-[28px] border border-black/[0.06] bg-white p-[6px] shadow-[0_20px_52px_rgba(0,0,0,.30)]">
        {TABS.map((tab) => {
          const selected = visualActive === tab;
          const isDestination = active === tab;

          return (
            <Link
              key={tab}
              href={tabHref(tab)}
              onClick={() => rememberOrigin(active)}
              aria-current={isDestination ? "page" : undefined}
              aria-label={tabLabel(tab)}
              className={`relative flex w-full flex-col items-center justify-center overflow-visible rounded-[20px] transition-[height,background-color,color,transform] duration-300 ease-[cubic-bezier(.22,.8,.24,1)] active:scale-[.97] ${selected ? "h-[90px] bg-[#fff7f7] text-[#e21a22]" : "h-[62px] text-[#c5c8ce] hover:bg-neutral-50 hover:text-neutral-600"}`}
            >
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                <TabIcon tab={tab} />

                {tab === "cart" && resolvedCartCount > 0 && (
                  <span className="absolute -right-2 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#e21a22] px-1 text-[8px] font-black leading-none text-white">
                    {resolvedCartCount > 99 ? "99+" : resolvedCartCount}
                  </span>
                )}
              </span>

              <span
                className={`overflow-hidden whitespace-nowrap text-[10px] font-bold transition-all duration-300 ${selected ? "mt-1.5 max-h-4 translate-y-0 opacity-100" : "mt-0 max-h-0 -translate-y-1 opacity-0"}`}
              >
                {tabLabel(tab)}
              </span>

              <span
                className={`absolute bottom-[10px] h-[2px] rounded-full bg-[#e21a22] transition-all duration-300 ${selected ? "w-5 opacity-100" : "w-0 opacity-0"}`}
              />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
