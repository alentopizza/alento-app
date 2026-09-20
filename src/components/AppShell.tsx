"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LOGO_DARK = "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

const items = [
  { href: "/", label: "Punto de venta", icon: "◉" },
  { href: "/pedidos", label: "Pedidos", icon: "▤" },
  { href: "/cocina", label: "Cocina", icon: "♨" },
  { href: "/clientes", label: "Clientes", icon: "◎" },
  { href: "/menu", label: "Menú", icon: "▦" },
  { href: "/cupones", label: "Cupones", subtitle: "Descuentos del POS", icon: "%" },
  { href: "/caja", label: "Caja", icon: "$" },
  { href: "/configuracion", label: "Configuración", icon: "⚙" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--background)] lg:grid lg:grid-cols-[224px_1fr]">
      <aside className="border-b border-white/10 bg-[#0b0b0c] text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="flex items-center justify-between px-4 py-4 lg:block lg:px-4 lg:py-5">
          <Link href="/" className="block">
            <div className="flex items-center gap-3 lg:block">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_10px_30px_rgba(0,0,0,.35)] lg:h-16 lg:w-16">
                <img src={LOGO_DARK} alt="Alentó Pizza" className="h-full w-full object-cover" />
              </div>
              <div className="lg:mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40">Alentó Pizza</p>
                <p className="mt-1 text-xl font-black tracking-[-0.03em]">ALENTÓ APP</p>
              </div>
            </div>
          </Link>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50 lg:mt-3 lg:inline-block">Interno</span>
        </div>

        <div className="mx-4 hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent lg:block" />

        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 lg:mt-4 lg:block lg:space-y-1.5 lg:overflow-visible lg:px-2.5 lg:pb-0">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex min-w-fit items-center gap-3 overflow-hidden rounded-2xl px-3 py-3 transition-all lg:w-full ${
                  active
                    ? "bg-white text-black shadow-[0_12px_30px_rgba(0,0,0,.22)]"
                    : "text-white/68 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--brand-red)]" />}
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black transition ${
                    active ? "bg-black text-white" : "bg-white/[0.07] text-white/70 group-hover:bg-white/10 group-hover:text-white"
                  }`}
                >
                  {item.icon}
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-bold">{item.label}</span>
                  {item.subtitle && (
                    <span className={`hidden text-[10px] lg:block ${active ? "text-neutral-500" : "text-white/30"}`}>{item.subtitle}</span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden px-4 lg:absolute lg:bottom-5 lg:block lg:w-[224px]">
          <div className="rounded-[22px] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.03] p-4 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white">Alentó Pizza</p>
                <p className="mt-1 text-[11px] leading-4 text-white/38">POS · Cocina · Clientes · Menú</p>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-red)] shadow-[0_0_16px_rgba(229,28,17,.75)]" />
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
