"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ActiveTab = "menu" | "cart" | "club" | "profile";

type Props = {
  active: ActiveTab;
  cartCount?: number;
};

const TABS: ActiveTab[] = ["menu", "cart", "club", "profile"];

function PizzaIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
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

function rememberOrigin(active: ActiveTab) {
  try {
    window.sessionStorage.setItem("alento-mobile-nav-from", active);
  } catch {
    // La navegación no debe depender de sessionStorage.
  }
}

function ItemContent({
  tab,
  visualActive,
  cartCount,
  cartPulse,
}: {
  tab: ActiveTab;
  visualActive: ActiveTab;
  cartCount: number;
  cartPulse: boolean;
}) {
  const selected = visualActive === tab;

  return (
    <span
      className={`relative flex h-full w-full items-center justify-center gap-2 overflow-visible transition-all duration-300 ease-[cubic-bezier(.22,.8,.24,1)] ${selected ? "text-[#e21a22]" : "text-[#c8cbd0]"}`}
    >
      <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center md:h-6 md:w-6 ${tab === "cart" && cartPulse ? "scale-125 text-[#e21a22] transition-transform duration-200" : "transition-transform duration-200"}`}>
        <TabIcon tab={tab} />

        {tab === "cart" && cartCount > 0 && !selected && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e21a22] px-1 text-[8px] font-black leading-none text-white md:-right-1.5 md:-top-1.5 md:h-[17px] md:min-w-[17px] md:px-1 md:text-[8px]">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        )}
      </span>

      <span
        className={`whitespace-nowrap text-[12px] font-semibold transition-all md:text-[11px] duration-300 ease-[cubic-bezier(.22,.8,.24,1)] ${selected ? "max-w-[72px] translate-x-0 opacity-100" : "max-w-0 -translate-x-1 overflow-hidden opacity-0"}`}
      >
        {tabLabel(tab)}
      </span>

      <span
        className={`absolute bottom-[9px] h-[2px] rounded-full md:bottom-[6px] bg-[#e21a22] transition-all duration-300 ${selected ? "w-5 opacity-100" : "w-0 opacity-0"}`}
      />
    </span>
  );
}

export default function PublicMobileNav({ active, cartCount = 0 }: Props) {
  const router = useRouter();
  const [visualActive, setVisualActive] = useState<ActiveTab>(active);
  const [cartPulse, setCartPulse] = useState(false);
  const [clubEnabled, setClubEnabled] = useState(true);

  useEffect(() => {
    let timer: number | null = null;

    const onCartAdded = () => {
      setCartPulse(false);
      window.requestAnimationFrame(() => setCartPulse(true));

      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setCartPulse(false);
        timer = null;
      }, 650);
    };

    window.addEventListener("alento-cart-added", onCartAdded);
    return () => {
      window.removeEventListener("alento-cart-added", onCartAdded);
      if (timer != null) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    router.prefetch("/menu");
    router.prefetch("/cart");
    router.prefetch("/cuenta");
    if (clubEnabled) router.prefetch("/club");
  }, [clubEnabled, router]);

  useEffect(() => {
    let cancelled = false;

    try {
      const cached = window.localStorage.getItem("alento-club-enabled");
      if (cached === "0") setClubEnabled(false);
      if (cached === "1") setClubEnabled(true);
    } catch {}

    void fetch("/api/club-settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const enabled = data?.settings?.enabled !== false;
        setClubEnabled(enabled);
        try {
          window.localStorage.setItem(
            "alento-club-enabled",
            enabled ? "1" : "0",
          );
        } catch {}
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

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

      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisualActive(active));
      });

      return () => window.cancelAnimationFrame(frame);
    }

    setVisualActive(active);
  }, [active]);

  function itemClass(tab: ActiveTab) {
    const selected = visualActive === tab;

    return `relative h-full min-w-0 transition-[flex-grow] duration-300 ease-[cubic-bezier(.22,.8,.24,1)] active:scale-[.98] ${selected ? "grow-[1.75]" : "grow"}`;
  }

  function beginNavigation(tab: ActiveTab, href: string) {
    setVisualActive(tab);
    router.prefetch(href);
  }

  function commitNavigation() {
    rememberOrigin(active);
  }

  return (
    <nav className="alento-public-mobile-nav fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] z-[75] px-3 md:px-6">
      <div className="mx-auto h-[66px] max-w-[430px] rounded-full border border-black/5 bg-white px-3 shadow-[0_16px_40px_rgba(0,0,0,.24)] md:h-[50px] md:max-w-[580px] md:border-white/80 md:bg-white/95 md:px-4 md:shadow-[0_4px_0_rgba(0,0,0,.30),0_14px_34px_rgba(0,0,0,.24),inset_0_-1px_0_rgba(0,0,0,.08)] md:backdrop-blur-xl lg:h-[52px] lg:max-w-[640px]">
        <div className="flex h-full items-stretch">
          <Link
            href="/menu"
            prefetch
            onPointerDown={() => beginNavigation("menu", "/menu")}
            onPointerCancel={() => setVisualActive(active)}
            onClick={commitNavigation}
            className={itemClass("menu")}
            aria-label="Menú"
          >
            <ItemContent tab="menu" visualActive={visualActive} cartCount={cartCount} cartPulse={cartPulse} />
          </Link>

          <Link
            href="/cart"
            prefetch
            onPointerDown={() => beginNavigation("cart", "/cart")}
            onPointerCancel={() => setVisualActive(active)}
            onClick={commitNavigation}
            className={itemClass("cart")}
            aria-label={`Carrito con ${cartCount} productos`}
          >
            <ItemContent tab="cart" visualActive={visualActive} cartCount={cartCount} cartPulse={cartPulse} />
          </Link>

          {clubEnabled && (
            <Link
              href="/club"
              prefetch
              onPointerDown={() => beginNavigation("club", "/club")}
              onPointerCancel={() => setVisualActive(active)}
              onClick={commitNavigation}
              className={itemClass("club")}
              aria-label="Club Alentó"
            >
              <ItemContent tab="club" visualActive={visualActive} cartCount={cartCount} cartPulse={cartPulse} />
            </Link>
          )}

          <Link
            href="/cuenta"
            prefetch
            onPointerDown={() => beginNavigation("profile", "/cuenta")}
            onPointerCancel={() => setVisualActive(active)}
            onClick={commitNavigation}
            className={itemClass("profile")}
            aria-label="Perfil"
          >
            <ItemContent tab="profile" visualActive={visualActive} cartCount={cartCount} cartPulse={cartPulse} />
          </Link>
        </div>
      </div>
    </nav>
  );
}
