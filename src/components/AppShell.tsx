"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Punto de venta", icon: "◉" },
  { href: "/pedidos", label: "Pedidos", icon: "▤" },
  { href: "/cocina", label: "Cocina", icon: "♨" },
  { href: "/clientes", label: "Clientes", icon: "◎" },
  { href: "/menu", label: "Menú", subtitle: "Categorías y productos", icon: "▦" },
  { href: "/caja", label: "Caja", icon: "$" },
  { href: "/configuracion", label: "Configuración", icon: "⚙" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--background)] lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-[var(--border)] bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4 lg:block lg:px-5 lg:py-6">
          <Link href="/" className="block">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-400">Alentó Pizza</p>
            <p className="mt-1 text-xl font-black tracking-tight">ALENTÓ APP</p>
          </Link>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-500 lg:mt-3 lg:inline-block">Interno</span>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-visible lg:px-3 lg:pb-0">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-fit items-center gap-3 rounded-xl px-3 py-2.5 transition lg:w-full ${
                  active ? "bg-black text-white" : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${active ? "bg-white/15" : "bg-neutral-100"}`}>
                  {item.icon}
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  {item.subtitle && <span className={`hidden text-[10px] lg:block ${active ? "text-white/60" : "text-neutral-400"}`}>{item.subtitle}</span>}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden px-5 lg:absolute lg:bottom-6 lg:block lg:w-[240px]">
          <div className="rounded-2xl bg-neutral-100 p-3 text-xs text-neutral-500">
            <p className="font-semibold text-neutral-800">Alentó Pizza</p>
            <p className="mt-1">POS · Cocina · Clientes</p>
          </div>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
