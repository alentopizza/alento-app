"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  Bell,
  BookOpen,
  CalendarClock,
  ChefHat,
  ClipboardList,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Star,
  Store,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import PublicMobileNav from "@/components/PublicMobileNav";
import PublicStoreClosedNotice from "@/components/PublicStoreClosedNotice";
import StaffStoreStatus from "@/components/StaffStoreStatus";
import {
  PUBLIC_CART_STORAGE_KEY,
  type PublicCartItem,
} from "@/lib/publicCart";

const LOGO_DARK =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

const items = [
  {
    href: "/interno",
    label: "Punto de venta",
    icon: Store,
    roles: ["ADMIN", "POS", "CASHIER"],
  },
  {
    href: "/pedidos",
    label: "Pedidos",
    icon: ClipboardList,
    roles: ["ADMIN", "POS", "CASHIER"],
  },
  {
    href: "/cocina",
    label: "Cocina",
    icon: ChefHat,
    roles: ["ADMIN", "KITCHEN"],
  },
  {
    href: "/clientes",
    label: "Clientes",
    icon: Users,
    roles: ["ADMIN", "POS"],
  },
  {
    href: "/interno/menu",
    label: "Menú",
    icon: BookOpen,
    roles: ["ADMIN"],
  },
  {
    href: "/cupones",
    label: "Cupones",
    icon: BadgePercent,
    roles: ["ADMIN"],
  },
  {
    href: "/caja",
    label: "Caja",
    icon: WalletCards,
    roles: ["ADMIN", "CASHIER"],
  },
  {
    href: "/turnos",
    label: "Turnos",
    icon: CalendarClock,
    roles: ["ADMIN"],
  },
  {
    href: "/club-alento",
    label: "Club Puntos",
    icon: Star,
    roles: ["ADMIN"],
  },
  {
    href: "/notificaciones",
    label: "Notificaciones",
    icon: Bell,
    roles: ["ADMIN"],
  },
  {
    href: "/configuracion",
    label: "Configuración",
    icon: Settings,
    roles: ["ADMIN"],
  },
  {
    href: "/usuarios",
    label: "Usuarios y Roles",
    icon: ShieldCheck,
    roles: ["ADMIN"],
  },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  POS: "Punto de venta",
  KITCHEN: "Cocina",
  CASHIER: "Caja",
  DRIVER: "Repartidor",
  DISPATCH: "Repartidor",
};

function itemIsActive(pathname: string, href: string) {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/configuracion" &&
      pathname.startsWith("/personalizacion"))
  );
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [roles, setRoles] = useState<string[]>([]);
  const [userName, setUserName] = useState("");
  const [publicCartCount, setPublicCartCount] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const publicNavActive = useMemo(() => {
    if (pathname.startsWith("/menu")) return "menu" as const;
    if (pathname.startsWith("/cart")) return "cart" as const;
    if (
      pathname === "/club" ||
      pathname.startsWith("/club/")
    ) {
      return "club" as const;
    }
    if (pathname.startsWith("/cuenta")) {
      return "profile" as const;
    }
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
    pathname.startsWith("/repartidor") ||
    pathname.startsWith("/sin-acceso");

  useEffect(() => {
    try {
      setSidebarCollapsed(
        window.localStorage.getItem(
          "alento-admin-sidebar-collapsed",
        ) === "1",
      );
    } catch {
      setSidebarCollapsed(false);
    }
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(
          "alento-admin-sidebar-collapsed",
          next ? "1" : "0",
        );
      } catch {}

      return next;
    });
  }

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!publicNavActive) return;

    const readCartCount = () => {
      try {
        const saved = window.localStorage.getItem(
          PUBLIC_CART_STORAGE_KEY,
        );
        const parsed = saved
          ? (JSON.parse(saved) as PublicCartItem[])
          : [];
        const count = Array.isArray(parsed)
          ? parsed.reduce(
              (total, item) =>
                total + Number(item?.quantity || 0),
              0,
            )
          : 0;

        setPublicCartCount(count);
      } catch {
        setPublicCartCount(0);
      }
    };

    readCartCount();
    window.addEventListener("storage", readCartCount);
    window.addEventListener(
      "alento-cart-updated",
      readCartCount,
    );

    return () => {
      window.removeEventListener("storage", readCartCount);
      window.removeEventListener(
        "alento-cart-updated",
        readCartCount,
      );
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
    if (loggingOut) return;

    setLoggingOut(true);
    setMobileMenuOpen(false);

    try {
      await fetch("/api/auth/staff/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  if (publicSurface) {
    if (publicNavActive) {
      return (
        <>
          {children}
          <PublicStoreClosedNotice />
          <PublicMobileNav
            active={publicNavActive}
            cartCount={publicCartCount}
          />
        </>
      );
    }

    return <>{children}</>;
  }

  const visibleItems = roles.length
    ? items.filter((item) =>
        item.roles.some((role) => roles.includes(role)),
      )
    : [];

  const currentItem =
    visibleItems.find((item) =>
      itemIsActive(pathname, item.href),
    ) ?? null;

  const staffHomeHref =
    visibleItems[0]?.href ?? "/sin-acceso";

  const roleText =
    roles
      .map((role) => ROLE_LABELS[role] ?? role)
      .join(" · ") || "Sesión interna";

  return (
    <div
      className={`min-h-screen bg-[var(--background)] lg:grid lg:transition-[grid-template-columns] lg:duration-300 lg:ease-out ${
        sidebarCollapsed
          ? "lg:grid-cols-[84px_1fr]"
          : "lg:grid-cols-[212px_1fr]"
      }`}
    >
      <header className="sticky top-0 z-[145] flex h-[66px] items-center justify-between border-b border-white/10 bg-[#0b0b0c]/96 px-3 text-white shadow-[0_8px_24px_rgba(0,0,0,.22)] backdrop-blur-xl lg:hidden">
        <Link
          href={staffHomeHref}
          className="flex min-w-0 items-center gap-2.5"
          aria-label="Ir al inicio interno"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[13px] border border-white/10 bg-black">
            <img
              src={LOGO_DARK}
              alt="Alentó Pizza"
              className="h-full w-full object-cover"
            />
          </span>

          <span className="min-w-0">
            <span className="alento-ui-status block truncate text-white">
              {currentItem?.label || "Alentó Pizza"}
            </span>
            <span className="alento-ui-micro mt-0.5 block truncate text-white/38">
              {userName || "Sesión interna"}
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.07] text-white transition active:scale-[.97]"
          aria-label="Abrir menú de colaboradores"
          title="Abrir menú"
        >
          <Menu className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[210] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de colaboradores"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/68 backdrop-blur-[2px]"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
          />

          <aside className="absolute inset-y-0 left-0 flex w-[min(88vw,340px)] flex-col overflow-hidden border-r border-white/10 bg-[#0b0b0c] text-white shadow-[18px_0_60px_rgba(0,0,0,.42)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <Link
                href={staffHomeHref}
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-w-0 items-center gap-3"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-white/10 bg-black">
                  <img
                    src={LOGO_DARK}
                    alt="Alentó Pizza"
                    className="h-full w-full object-cover"
                  />
                </span>

                <span className="min-w-0">
                  <span className="alento-ui-status block truncate text-white">
                    Alentó Pizza
                  </span>
                  <span className="alento-ui-micro mt-0.5 block truncate text-white/40">
                    Sabor Que Te Hace Volver.
                  </span>
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-white/10 bg-white/[0.06] text-white/70 transition active:scale-[.97]"
                aria-label="Cerrar menú"
              >
                <X
                  className="h-[19px] w-[19px]"
                  strokeWidth={2.1}
                />
              </button>
            </div>

            <div className="border-b border-white/[0.07] px-4 py-3">
              <div className="flex items-center gap-3 rounded-[16px] border border-white/[0.08] bg-white/[0.045] px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] alento-ui-control font-bold text-white">
                  {(userName || "A")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="alento-ui-control block truncate font-bold text-white">
                    {userName || "Alentó Pizza"}
                  </span>
                  <span className="alento-ui-micro mt-0.5 block truncate text-white/38">
                    {roleText}
                  </span>
                </span>

                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.7)]" />
              </div>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <p className="alento-ui-label mb-2 px-2 uppercase tracking-[0.14em] text-white/28">
                Módulos disponibles
              </p>

              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const active = itemIsActive(
                    pathname,
                    item.href,
                  );

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() =>
                        setMobileMenuOpen(false)
                      }
                      className={`group relative flex min-h-[52px] items-center gap-3 overflow-hidden rounded-[15px] px-2.5 transition ${
                        active
                          ? "bg-white text-black shadow-[0_8px_20px_rgba(0,0,0,.18)]"
                          : "text-white/72 active:bg-white/[0.07]"
                      }`}
                    >
                      {active && (
                        <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--brand-red)]" />
                      )}

                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          active
                            ? "bg-black text-white"
                            : "bg-white/[0.07] text-white/80"
                        }`}
                      >
                        <item.icon
                          className="h-[18px] w-[18px]"
                          strokeWidth={2.3}
                          aria-hidden="true"
                        />
                      </span>

                      <span className="alento-ui-control min-w-0 flex-1 truncate font-bold">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="shrink-0 border-t border-white/10 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => void logout()}
                disabled={loggingOut}
                className="flex h-12 w-full items-center justify-between rounded-[15px] border border-red-400/15 bg-red-500/[0.08] px-3 text-left text-red-200 transition active:bg-red-500/[0.14] disabled:opacity-50"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-red-500/10">
                    <LogOut
                      className="h-4 w-4"
                      strokeWidth={2.1}
                    />
                  </span>
                  <span className="alento-ui-control font-bold">
                    {loggingOut
                      ? "Cerrando..."
                      : "Cerrar sesión"}
                  </span>
                </span>
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className="relative hidden border-r border-white/10 bg-[#0b0b0c] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div
          className={`relative flex min-h-[82px] items-start justify-between py-3.5 pb-3.5 pt-4 ${
            sidebarCollapsed ? "px-[18px]" : "px-4"
          }`}
        >
          <Link href={staffHomeHref} className="block min-w-0">
            <div
              className={`flex items-start gap-3 ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_10px_30px_rgba(0,0,0,.35)]">
                <img
                  src={LOGO_DARK}
                  alt="Alentó Pizza"
                  className="h-full w-full object-cover"
                />
              </div>

              <div
                className={`min-w-0 pt-0.5 transition-all duration-200 ${
                  sidebarCollapsed
                    ? "pointer-events-none w-0 overflow-hidden opacity-0"
                    : "w-auto opacity-100"
                }`}
              >
                <p className="whitespace-nowrap text-[16px] font-semibold leading-5 tracking-[-0.02em] text-white">
                  Alentó Pizza
                </p>
                <p className="mt-1 max-w-[120px] whitespace-nowrap text-[10px] font-normal leading-[14px] text-white/45">
                  Sabor Que Te Hace Volver.
                </p>
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={toggleSidebar}
            title={
              sidebarCollapsed
                ? "Expandir menú"
                : "Recoger menú"
            }
            aria-label={
              sidebarCollapsed
                ? "Expandir menú lateral"
                : "Recoger menú lateral"
            }
            className="absolute right-[-24px] top-[18px] z-50 flex h-8 w-6 items-center justify-center rounded-r-lg border border-l-0 border-white/10 bg-[var(--brand-red)] text-sm font-black text-white shadow-[5px_0_16px_rgba(0,0,0,.22)] transition hover:brightness-110"
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <nav
          className={`mt-2.5 min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-3 ${
            sidebarCollapsed ? "px-2.5" : "px-2.5"
          }`}
        >
          {visibleItems.map((item) => {
            const active = itemIsActive(
              pathname,
              item.href,
            );

            return (
              <Link
                key={item.href}
                href={item.href}
                title={
                  sidebarCollapsed
                    ? item.label
                    : undefined
                }
                aria-label={
                  sidebarCollapsed
                    ? item.label
                    : undefined
                }
                className={`group relative flex w-full items-center overflow-hidden rounded-2xl py-2 transition-all ${
                  sidebarCollapsed
                    ? "justify-center px-2 py-2.5"
                    : "gap-2.5 px-3"
                } ${
                  active
                    ? "bg-white text-black shadow-[0_10px_24px_rgba(0,0,0,.2)]"
                    : "text-white/72 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {active && !sidebarCollapsed && (
                  <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--brand-red)]" />
                )}

                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
                    active
                      ? "bg-black text-white shadow-[0_4px_14px_rgba(0,0,0,.18)]"
                      : "bg-white/[0.07] text-white/80 group-hover:bg-white/10 group-hover:text-white"
                  }`}
                >
                  <item.icon
                    className="h-[18px] w-[18px]"
                    strokeWidth={2.35}
                    aria-hidden="true"
                  />
                </span>

                <span
                  className={`min-w-0 truncate text-[13px] font-bold leading-5 transition-all duration-200 ${
                    sidebarCollapsed
                      ? "pointer-events-none w-0 opacity-0"
                      : "w-auto opacity-100"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div
          className={`shrink-0 pb-3 ${
            sidebarCollapsed ? "px-2" : "px-3"
          }`}
        >
          <div
            className={`overflow-hidden border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025))] shadow-[0_12px_30px_rgba(0,0,0,.18)] backdrop-blur ${
              sidebarCollapsed
                ? "rounded-2xl"
                : "rounded-[18px]"
            }`}
          >
            <div
              className={`flex items-center p-3 ${
                sidebarCollapsed
                  ? "justify-center"
                  : "gap-2.5"
              }`}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] text-[12px] font-semibold text-white"
                title={
                  sidebarCollapsed
                    ? userName || "Alentó Pizza"
                    : undefined
                }
              >
                {(userName || "A")
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div
                className={`min-w-0 flex-1 transition-all duration-200 ${
                  sidebarCollapsed
                    ? "pointer-events-none w-0 flex-none overflow-hidden opacity-0"
                    : "opacity-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="truncate text-[12px] font-semibold leading-4 text-white">
                    {userName || "Alentó Pizza"}
                  </p>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.75)]" />
                </div>

                <p className="mt-0.5 truncate text-[9px] font-medium leading-3 text-white/38">
                  {roleText}
                </p>
              </div>
            </div>

            <div
              className={`h-px bg-white/[0.07] ${
                sidebarCollapsed ? "mx-2" : "mx-3"
              }`}
            />

            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              title={
                sidebarCollapsed
                  ? "Cerrar sesión"
                  : undefined
              }
              aria-label={
                sidebarCollapsed
                  ? "Cerrar sesión"
                  : undefined
              }
              className={`group flex w-full items-center py-2.5 text-left transition hover:bg-white/[0.055] disabled:opacity-50 ${
                sidebarCollapsed
                  ? "justify-center px-2"
                  : "justify-between px-3"
              }`}
            >
              <span
                className={`text-[10px] font-medium text-white/52 transition-all duration-200 group-hover:text-white/80 ${
                  sidebarCollapsed
                    ? "pointer-events-none w-0 overflow-hidden opacity-0"
                    : "opacity-100"
                }`}
              >
                {loggingOut
                  ? "Cerrando..."
                  : "Cerrar sesión"}
              </span>

              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.045] text-white/45 transition group-hover:border-red-400/20 group-hover:bg-red-500/10 group-hover:text-red-300">
                <LogOut
                  className="h-3.5 w-3.5"
                  strokeWidth={2}
                />
              </span>
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
      <StaffStoreStatus />
    </div>
  );
}
