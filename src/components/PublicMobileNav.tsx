"use client";

import Link from "next/link";

type ActiveTab = "menu" | "cart" | "club" | "profile";

type Props = {
  active: ActiveTab;
  cartCount?: number;
};

function PizzaIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M10 46 31 11c2-3 6-4 9-2 8 5 13 13 14 23 .4 3-2 6-5 7L15 51c-4 1-7-2-5-5Z" fill="currentColor" />
      <circle cx="37" cy="20" r="3.3" fill="var(--pizza-dot,#e21a22)" />
      <circle cx="45" cy="29" r="3.3" fill="var(--pizza-dot,#e21a22)" />
      <circle cx="29" cy="31" r="3.3" fill="var(--pizza-dot,#e21a22)" />
      <path d="M15 48c10-1 23-6 35-12" fill="none" stroke="var(--pizza-dot,#e21a22)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H7" />
      <circle cx="10" cy="19" r="1.2" />
      <circle cx="18" cy="19" r="1.2" />
    </svg>
  );
}

function ClubIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 2.7 5.4 6 .9-4.35 4.2 1.03 5.95L12 16.65l-5.38 2.8 1.03-5.95L3.3 9.3l6-.9L12 3Z" />
    </svg>
  );
}

function ProfileIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" />
    </svg>
  );
}

function ActiveBubble({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute -top-[24px] flex h-[62px] w-[62px] items-center justify-center rounded-full border-[6px] border-[#090909] bg-[#e21a22] text-white shadow-[0_10px_26px_rgba(226,26,34,.38)]">
      {children}
    </span>
  );
}

export default function PublicMobileNav({ active, cartCount = 0 }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] z-[75] px-3 md:hidden">
      <div className="relative mx-auto h-[68px] max-w-[430px] rounded-[18px] border border-black/10 bg-white shadow-[0_18px_45px_rgba(0,0,0,.30)]">
        <div className="grid h-full grid-cols-4 items-center">
          <Link href="/menu" className="relative flex h-full items-center justify-center text-[#8d8d8d] transition active:scale-95" aria-label="Menú">
            {active === "menu" ? (
              <ActiveBubble>
                <span style={{ "--pizza-dot": "#e21a22" } as React.CSSProperties}><PizzaIcon className="h-8 w-8" /></span>
              </ActiveBubble>
            ) : (
              <span style={{ "--pizza-dot": "#8d8d8d" } as React.CSSProperties}><PizzaIcon /></span>
            )}
          </Link>

          <Link href="/cart" className="relative flex h-full items-center justify-center text-[#8d8d8d] transition active:scale-95" aria-label={`Carrito con ${cartCount} productos`}>
            {active === "cart" ? <ActiveBubble><CartIcon className="h-7 w-7" /></ActiveBubble> : <CartIcon />}
            {cartCount > 0 && active !== "cart" && (
              <span className="absolute left-1/2 top-2 ml-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#e21a22] px-1 text-[9px] font-black text-white shadow-sm">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          <button type="button" className="relative flex h-full items-center justify-center text-[#8d8d8d]" aria-label="Club de la Pizza próximamente" title="Club de la Pizza próximamente">
            {active === "club" ? <ActiveBubble><ClubIcon className="h-7 w-7" /></ActiveBubble> : <ClubIcon />}
          </button>

          <Link href="/cuenta" className="relative flex h-full items-center justify-center text-[#8d8d8d] transition active:scale-95" aria-label="Perfil">
            {active === "profile" ? <ActiveBubble><ProfileIcon className="h-7 w-7" /></ActiveBubble> : <ProfileIcon />}
          </Link>
        </div>
      </div>
    </nav>
  );
}
