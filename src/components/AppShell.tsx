"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import PublicMobileNav from "@/components/PublicMobileNav";
import { PUBLIC_CART_STORAGE_KEY, type PublicCartItem } from "@/lib/publicCart";

const LOGO_DARK = "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

const items = [
  { href: "/interno", label: "Punto de venta", icon: "◉", roles: ["ADMIN", "POS", "CASHIER"] },
  { href: "/pedidos", label: "Pedidos", icon: "▤", roles: ["ADMIN", "POS", "CASHIER"] },
  { href: "/cocina", label: "Cocina", icon: "♨", roles: ["ADMIN", "KITCHEN"] },
  { href: "/masa", label: "Preparar masa", icon: "◒", roles: ["ADMIN", "KITCHEN"] },
  { href: "/clientes", label: "Clientes", icon: "◎", roles: ["ADMIN", "POS"] },
  { href: "/interno/menu", label: "Menú", icon: "▦", roles: ["ADMIN"] },
  { href: "/cupones", label: "Cupones", icon: "%", roles: ["ADMIN"] },
  { href: "/caja", label: "Caja", icon: "$", roles: ["ADMIN", "CASHIER"] },
  { href: "/personalizacion", label: "Personalización", icon: "✦", roles: ["ADMIN"] },
  { href: "/club-alento", label: "Club Alentó", icon: "★", roles: ["ADMIN"] },
  { href: "/notificaciones", label: "Notificaciones", icon: "✉", roles: ["ADMIN"] },
  { href: "/configuracion", label: "Configuración", icon: "⚙", roles: ["ADMIN"] },
  { href: "/usuarios", label: "Usuarios y Roles", icon: "♟", roles: ["ADMIN"] },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  POS: "Punto de venta",
  KITCHEN: "Cocina",
  CASHIER: "Caja",
  DRIVER: "Repartidor",
  DISPATCH: "Repartidor",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [roles, setRoles] = useState<string[]>([]);
  const [userName, setUserName] = useState("");
  const [publicCartCount, setPublicCartCount] = useState(0);

  const publicNavActive = useMemo(() => {
    if (pathname.startsWith("/menu")) return "menu" as const;
    if (pathname.startsWith("/cart")) return "cart" as const;
    if (pathname === "/club" || pathname.startsWith("/club/")) return "club" as const;
    if (pathname.startsWith("/cuenta")) return "profile" as const;
    return null;
  }, [pathname]);

  const publicSurface =
    pathname.startsWith("/login") ||
    pathname.startsWith("/setup/") ||
    pathname.startsWith("/cuenta") ||
    pathname === "/" ||
    pathname.startsWith("/menu") ||
    pathname.startsWith("/cart") ||
    pathname === "/club" ||
    pathname.startsWith("/club/") ||
    pathname.startsWith("/integraciones/chatwoot") ||
    pathname.startsWith("/seguimiento/") ||
    pathname.startsWith("/repartidor/pedido/") ||
    pathname.startsWith("/sin-acceso");

  useEffect(() => {
    if (!publicNavActive) return;

    const readCartCount = () => {
      try {
        const saved = window.localStorage.getItem(PUBLIC_CART_STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) as PublicCartItem[] : [];
        const count = Array.isArray(parsed)
          ? parsed.reduce((total, item) => total + Number(item?.quantity || 0), 0)
          : 0;
        setPublicCartCount(count);
      } catch {
        setPublicCartCount(0);
      }
    };

    readCartCount();
    window.addEventListener("storage", readCartCount);
    window.addEventListener("alento-cart-updated", readCartCount);

    return () => {
      window.removeEventListener("storage", readCartCount);
      window.removeEventListener("alento-cart-updated", readCartCount);
    };
  }, [publicNavActive]);

  useEffect(() => {
    if (publicSurface) return;
    fetch("/api/auth/staff/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (result?.authenticated) {
          setRoles(result.user?.roles ?? []);
          setUserName(result.user?.name ?? "");
        }
      })
      .catch(() => {});
  }, [publicSurface]);

  async function logout() {
    await fetch("/api/auth/staff/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (publicSurface) {
    if (publicNavActive) {
      return (
        <>
          {children}
          <PublicMobileNav active={publicNavActive} cartCount={publicCartCount} />
        </>
      );
    }

    return <>{children}</>;
  }

  const visibleItems = roles.length ? items.filter((item) => item.roles.some((role) => roles.includes(role))) : [];

  return (
    <div className="min-h-screen bg-[var(--background)] lg:grid lg:grid-cols-[212px_1fr]">
      <aside className="border-b border-white/10 bg-[#0b0b0c] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="flex items-center justify-between px-4 py-3.5 lg:block lg:px-4 lg:pb-3.5 lg:pt-4">
          <Link href="/interno" className="block">
            <div className="flex items-center gap-3 lg:items-start">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_10px_30px_rgba(0,0,0,.35)] lg:h-12 lg:w-12">
                <img src={LOGO_DARK} alt="Alentó Pizza" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-[16px] font-semibold leading-5 tracking-[-0.02em] text-white">Alentó Pizza</p>
                <p className="mt-1 max-w-[120px] text-[10px] font-normal leading-[14px] text-white/45">
                  Sabor Que Te Hace Volver.
                </p>
              </div>
            </div>
          </Link>
        </div>

        <div className="mx-4 hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent lg:block" />

        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 lg:mt-2.5 lg:block lg:min-h-0 lg:flex-1 lg:space-y-0.5 lg:overflow-y-auto lg:px-2.5 lg:pb-3">
          {visibleItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex min-w-fit items-center gap-2.5 overflow-hidden rounded-2xl px-3 py-2 transition-all lg:w-full ${
                  active
                    ? "bg-white text-black shadow-[0_10px_24px_rgba(0,0,0,.2)]"
                    : "text-white/72 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--brand-red)]" />}
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[13px] font-black transition ${
                    active
                      ? "bg-black text-white"
                      : "bg-white/[0.07] text-white/70 group-hover:bg-white/10 group-hover:text-white"
                  }`}
                >
                  {item.icon}
                </span>
                <span className="min-w-0 truncate text-[13px] font-bold leading-5">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 px-3 pb-3 lg:block">
          <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025))] shadow-[0_12px_30px_rgba(0,0,0,.18)] backdrop-blur">
            <div className="flex items-center gap-2.5 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] text-[12px] font-semibold text-white">
                {(userName || "A").trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[12px] font-semibold leading-4 text-white">{userName || "Alentó Pizza"}</p>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.75)]" />
                </div>
                <p className="mt-0.5 truncate text-[9px] font-medium leading-3 text-white/38">
                  {roles.map((role) => ROLE_LABELS[role] ?? role).join(" · ") || "Sesión interna"}
                </p>
              </div>
            </div>

            <div className="mx-3 h-px bg-white/[0.07]" />

            <button
              onClick={logout}
              className="group flex w-full items-center justify-between px-3 py-2.5 text-left transition hover:bg-white/[0.055]"
            >
              <span className="text-[10px] font-medium text-white/52 transition group-hover:text-white/80">Cerrar sesión</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.045] text-[13px] font-normal text-white/45 transition group-hover:border-red-400/20 group-hover:bg-red-500/10 group-hover:text-red-300">
                ↗
              </span>
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
