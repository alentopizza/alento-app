"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PublicMobileNav from "@/components/PublicMobileNav";
import PublicBrandHeader from "@/components/PublicBrandHeader";
import {
  PUBLIC_CART_STORAGE_KEY,
  type PublicCartItem,
} from "@/lib/publicCart";

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CartPage() {
  const [cart, setCart] = useState<PublicCartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PUBLIC_CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {
      window.localStorage.removeItem(PUBLIC_CART_STORAGE_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(PUBLIC_CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart, ready]);

  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  );

  const subtotal = useMemo(
    () => cart.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
    [cart],
  );

  function changeQuantity(key: string, delta: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.key === key
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeItem(key: string) {
    setCart((current) => current.filter((item) => item.key !== key));
  }

  return (
    <main className="min-h-screen bg-[#090909] pb-28 text-white">
      <PublicBrandHeader />

      <section className="mx-auto w-full max-w-[980px] px-4 pb-6 pt-5 sm:px-6 md:pb-12 md:pt-[104px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#e21a22]">Tu pedido</p>
            <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.045em] md:text-[40px]">Carrito</h1>
            <p className="mt-1 text-[11px] text-white/38">
              {cartCount ? `${cartCount} producto${cartCount === 1 ? "" : "s"}` : "Aún no has agregado productos"}
            </p>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setCart([])}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold text-white/45"
            >
              Vaciar
            </button>
          )}
        </div>

        {!ready ? (
          <div className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.03] p-8 text-center text-[12px] text-white/35">
            Cargando carrito...
          </div>
        ) : cart.length === 0 ? (
          <div className="mt-6 flex min-h-[360px] flex-col items-center justify-center rounded-[24px] border border-white/10 bg-[#111] px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.05] text-white/30">
              <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H7" />
                <circle cx="10" cy="19" r="1.2" />
                <circle cx="18" cy="19" r="1.2" />
              </svg>
            </div>
            <h2 className="mt-5 text-[20px] font-semibold">Tu carrito está vacío</h2>
            <p className="mt-2 max-w-[300px] text-[12px] leading-5 text-white/38">
              Vuelve al menú, configura tu pizza y agrégala para comenzar el pedido.
            </p>
            <Link href="/menu" className="mt-5 rounded-full bg-[#e21a22] px-6 py-3 text-[12px] font-bold text-white">
              Ver menú
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              {cart.map((item) => (
                <article key={item.key} className="flex gap-3 rounded-[20px] border border-white/10 bg-[#141414] p-3.5 sm:p-4">
                  <div className="h-[84px] w-[84px] shrink-0 overflow-hidden rounded-[15px] bg-black sm:h-[96px] sm:w-[96px]">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl">🍕</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="text-[15px] font-semibold leading-5 sm:text-[17px]">{item.name}</h2>
                        {item.detail && (
                          <p className="mt-1 line-clamp-3 text-[10px] leading-4 text-white/38 sm:text-[11px]">{item.detail}</p>
                        )}
                        {item.notes && (
                          <p className="mt-1 text-[10px] text-white/28">Nota: {item.notes}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-[18px] text-white/35"
                        aria-label={`Eliminar ${item.name}`}
                      >
                        ×
                      </button>
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <span className="block text-[13px] font-bold text-[#ff3439]">{money(item.unitPrice)}</span>
                        {item.configuration?.kind === "PIZZA" && (
                          <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.08em] text-white/30">
                            Pizza configurada
                          </span>
                        )}
                      </div>

                      <div className="flex items-center rounded-full border border-white/10 bg-black/30">
                        <button type="button" onClick={() => changeQuantity(item.key, -1)} className="flex h-9 w-9 items-center justify-center text-white/65" aria-label="Disminuir cantidad">−</button>
                        <span className="min-w-8 text-center text-[12px] font-bold">{item.quantity}</span>
                        <button type="button" onClick={() => changeQuantity(item.key, 1)} className="flex h-9 w-9 items-center justify-center text-white/65" aria-label="Aumentar cantidad">+</button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3">
                      <span className="text-[10px] text-white/30">Total producto</span>
                      <b className="text-[14px]">{money(item.unitPrice * item.quantity)}</b>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <aside className="h-fit rounded-[22px] border border-white/10 bg-[#111] p-5 lg:sticky lg:top-[106px]">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/32">Resumen</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[12px] text-white/45">Subtotal</span>
                <b className="text-[22px]">{money(subtotal)}</b>
              </div>
              <p className="mt-2 text-[9px] leading-4 text-white/28">
                El checkout todavía no está activo. Esta pantalla ya usa el carrito persistente para pruebas.
              </p>
              <button
                type="button"
                disabled
                className="mt-5 h-12 w-full rounded-full bg-[#e21a22] text-[12px] font-bold text-white opacity-55"
              >
                Continuar pedido · Próximamente
              </button>
              <Link href="/menu" className="mt-2 flex h-10 w-full items-center justify-center text-[10px] font-semibold text-white/42">
                Agregar más productos
              </Link>
            </aside>
          </div>
        )}
      </section>

      <PublicMobileNav active="cart" cartCount={cartCount} />
    </main>
  );
}
