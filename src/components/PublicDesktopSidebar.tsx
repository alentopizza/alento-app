"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PUBLIC_CART_STORAGE_KEY } from "@/lib/publicCart";

type ActiveTab = "menu" | "cart" | "club" | "profile";

type Props = {
  active: ActiveTab;
  cartCount?: number;
};

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

const items = [
  { id: "menu" as const, href: "/menu", label: "Menú", icon: <PizzaIcon /> },
  { id: "cart" as const, href: "/cart", label: "Carrito", icon: <CartIcon /> },
  { id: "club" as const, href: "/club", label: "Club", icon: <ClubIcon /> },
  { id: "profile" as const, href: "/cuenta", label: "Perfil", icon: <ProfileIcon /> },
];

export default function PublicDesktopSidebar({ active, cartCount }: Props) {
  const [logoUrl, setLogoUrl] = useState("");
  const [resolvedCartCount, setResolvedCartCount] = useState(cartCount ?? 0);

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

  return (
    <aside className="fixed inset-y-0 left-0 z-[70] hidden w-[112px] flex-col border-r border-white/[0.08] bg-[#090909] text-white shadow-[14px_0_38px_rgba(0,0,0,.18)] md:flex">
      <Link
        href="/menu"
        className="flex h-[92px] shrink-0 items-center justify-center border-b border-white/[0.07] px-3"
        aria-label="Alentó Pizza"
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Alentó Pizza"
            className="h-[46px] w-[88px] object-contain object-center"
          />
        ) : (
          <span className="h-[46px] w-[88px]" aria-hidden="true" />
        )}
      </Link>

      <nav className="flex flex-1 flex-col items-center justify-center gap-3 px-2.5 py-5">
        {items.map((item) => {
          const selected = item.id === active;

          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={selected ? "page" : undefined}
              className={`group relative flex h-[72px] w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[22px] transition-all duration-300 ${selected ? "bg-white text-[#e21a22] shadow-[0_12px_28px_rgba(0,0,0,.28)]" : "text-white/42 hover:bg-white/[0.055] hover:text-white/75"}`}
            >
              {selected && (
                <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[#e21a22]" />
              )}

              <span className="relative flex h-7 w-7 items-center justify-center">
                {item.icon}

                {item.id === "cart" && resolvedCartCount > 0 && (
                  <span className={`absolute -right-2 -top-2 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-black leading-none ${selected ? "bg-[#e21a22] text-white" : "bg-[#e21a22] text-white"}`}>
                    {resolvedCartCount > 99 ? "99+" : resolvedCartCount}
                  </span>
                )}
              </span>

              <span className={`text-[10px] font-bold tracking-[-0.01em] ${selected ? "text-[#e21a22]" : "text-inherit"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex h-12 items-center justify-center border-t border-white/[0.06]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#e21a22] shadow-[0_0_12px_rgba(226,26,34,.7)]" />
      </div>
    </aside>
  );
}
