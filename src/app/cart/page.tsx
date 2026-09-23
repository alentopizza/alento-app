"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PublicBrandHeader from "@/components/PublicBrandHeader";
import PublicActiveOrderBanner from "@/components/PublicActiveOrderBanner";
import PublicCheckoutCustomer from "@/components/PublicCheckoutCustomer";
import PublicCheckoutDelivery, {
  type PublicCheckoutSelection,
} from "@/components/PublicCheckoutDelivery";
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
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "delivery" | "customer">("cart");
  const [checkoutSelection, setCheckoutSelection] =
    useState<PublicCheckoutSelection | null>(null);
  const [createdOrder, setCreatedOrder] = useState<{
    id: number;
    code: string;
    status: string;
    fulfillmentType: "DELIVERY" | "PICKUP";
    subtotal: number;
    deliveryFee: number;
    total: number;
    paymentMethod: string;
    trackingPath?: string | null;
    authenticatedCustomer?: boolean;
  } | null>(null);

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
    window.dispatchEvent(new Event("alento-cart-updated"));
  }, [cart, ready]);

  useEffect(() => {
    document.body.classList.toggle(
      "alento-checkout-flow",
      checkoutStep !== "cart",
    );

    return () => {
      document.body.classList.remove("alento-checkout-flow");
    };
  }, [checkoutStep]);

  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  );

  const subtotal = useMemo(
    () => cart.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
    [cart],
  );

  const deliveryFee =
    checkoutSelection?.fulfillmentType === "DELIVERY"
      ? checkoutSelection.deliveryFee
      : 0;

  const checkoutTotal = subtotal + deliveryFee;

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
    <main
      className={
        "min-h-screen bg-[#090909] text-white " +
        (checkoutStep === "cart" ? "pb-28" : "pb-0")
      }
    >
      <PublicBrandHeader />

      {checkoutStep === "cart" && (
      <section className="mx-auto w-full max-w-[1040px] px-4 pb-8 pt-5 sm:px-6 md:pb-14 md:pt-6">
        <PublicActiveOrderBanner className="mb-4" />

        <div className="rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_90%_10%,rgba(226,26,34,.16),transparent_28%),linear-gradient(135deg,#151515,#0d0d0d)] p-4 shadow-[0_16px_44px_rgba(0,0,0,.22)] sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e21a22] text-white shadow-[0_10px_24px_rgba(226,26,34,.24)]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H7" />
                  <circle cx="10" cy="19" r="1.2" />
                  <circle cx="18" cy="19" r="1.2" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#e21a22]">Tu selección</p>
                <p className="mt-1 text-[13px] font-semibold text-white/72">
                  {cartCount ? `${cartCount} producto${cartCount === 1 ? "" : "s"} en tu pedido` : "Tu carrito está listo para empezar"}
                </p>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCart([]);
                  setCheckoutSelection(null);
                  setCheckoutStep("cart");
                  setCreatedOrder(null);
                }}
                className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[10px] font-semibold text-white/45 transition hover:border-red-400/20 hover:bg-red-500/10 hover:text-red-200"
              >
                Vaciar
              </button>
            )}
          </div>
        </div>

        {!ready ? (
          <div className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.03] p-8 text-center text-[12px] text-white/35">
            Cargando carrito...
          </div>
        ) : cart.length === 0 ? (
          <div className="mt-5 flex min-h-[340px] flex-col items-center justify-center rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(226,26,34,.10),transparent_30%),linear-gradient(145deg,#141414,#0d0d0d)] px-6 text-center shadow-[0_20px_60px_rgba(0,0,0,.20)]">
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
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-3 pb-[230px] lg:pb-0">
              {cart.map((item) => (
                <article key={item.key} className="flex gap-3 rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,#171717,#111)] p-3.5 shadow-[0_14px_34px_rgba(0,0,0,.16)] transition hover:border-white/15 sm:p-4">
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
                          <span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-white/30">
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

            <aside className="fixed inset-x-3 bottom-[92px] z-[70] mx-auto max-w-[470px] rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_90%_5%,rgba(226,26,34,.14),transparent_30%),linear-gradient(145deg,#161616,#0f0f0f)] p-4 shadow-[0_20px_50px_rgba(0,0,0,.42)] backdrop-blur-xl lg:sticky lg:inset-auto lg:top-6 lg:z-auto lg:mx-0 lg:max-w-none lg:rounded-[24px] lg:p-5 lg:shadow-[0_18px_46px_rgba(0,0,0,.20)]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/32">Resumen</p>

                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className="text-[11px] text-white/45">Subtotal</span>
                  <b className="text-[16px]">{money(subtotal)}</b>
                </div>

                {checkoutSelection && (
                  <div className="mt-1.5 flex items-center justify-between gap-4">
                    <span className="text-[10px] text-white/35">
                      {checkoutSelection.fulfillmentType === "DELIVERY"
                        ? "Domicilio"
                        : "Recoger"}
                    </span>
                    <b className="text-[12px] text-white/65">
                      {checkoutSelection.fulfillmentType === "DELIVERY"
                        ? money(deliveryFee)
                        : "$ 0"}
                    </b>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between gap-4 border-t border-white/[0.07] pt-2">
                  <span className="text-[10px] font-semibold text-white/55">
                    Total
                  </span>
                  <b className="text-[24px] tracking-[-0.03em] lg:text-[22px]">
                    {money(checkoutTotal)}
                  </b>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCheckoutStep(checkoutSelection ? "customer" : "delivery");
                }}
                className="mt-3 h-11 w-full rounded-full bg-[#e21a22] text-[11px] font-bold text-white transition hover:bg-[#ef1c25] lg:mt-5 lg:h-12 lg:text-[12px]"
              >
                {checkoutSelection
                  ? "Continuar compra"
                  : "Continuar pedido"}
              </button>

            </aside>
          </div>
        )}
      </section>
      )}

      {checkoutStep === "delivery" && (
        <PublicCheckoutDelivery
          subtotal={subtotal}
          initialSelection={checkoutSelection}
          fullPage
          onClose={() => setCheckoutStep("cart")}
          onConfirm={(selection) => {
            setCheckoutSelection(selection);
            setCheckoutStep("customer");
          }}
        />
      )}

      {checkoutStep === "customer" && checkoutSelection && !createdOrder && (
        <PublicCheckoutCustomer
          cart={cart}
          selection={checkoutSelection}
          fullPage
          onBack={() => setCheckoutStep("delivery")}
          onComplete={(order) => {
            setCreatedOrder(order);
            setCheckoutStep("cart");
            setCart([]);
            setCheckoutSelection(null);
          }}
        />
      )}

      {createdOrder && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[430px] overflow-hidden rounded-[30px] border border-white/10 bg-[#111] text-white shadow-[0_30px_90px_rgba(0,0,0,.6)]">
            <div className="bg-[radial-gradient(circle_at_85%_15%,rgba(34,197,94,.18),transparent_28%),linear-gradient(145deg,#151515,#0c0c0c)] p-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-2xl text-emerald-300">
                ✓
              </div>
              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                Pedido recibido
              </p>
              <h2 className="mt-1 text-[34px] font-black tracking-[-0.04em]">
                {createdOrder.code}
              </h2>
              <p className="mt-2 text-[11px] leading-5 text-white/45">
                {createdOrder.authenticatedCustomer
                  ? "Tu pedido ya entró a Alentó. Puedes seguir su estado desde la app mientras esté en proceso."
                  : "Tu pedido ya entró a Alentó. Te enviaremos un mensaje con el enlace para seguirlo. Si inicias sesión con este número, también podrás verlo dentro de la app."}
              </p>

              <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.04]">
                <div className="p-3">
                  <span className="text-[10px] uppercase tracking-[0.12em] text-white/30">
                    Tipo
                  </span>
                  <b className="mt-1 block text-[11px]">
                    {createdOrder.fulfillmentType === "DELIVERY"
                      ? "Domicilio"
                      : "Recoger"}
                  </b>
                </div>
                <div className="border-l border-white/10 p-3 text-right">
                  <span className="text-[10px] uppercase tracking-[0.12em] text-white/30">
                    Total
                  </span>
                  <b className="mt-1 block text-[16px] text-[#ff454b]">
                    {money(createdOrder.total)}
                  </b>
                </div>
              </div>

              {createdOrder.trackingPath && (
                <Link
                  href={createdOrder.trackingPath}
                  className="mt-5 flex h-12 items-center justify-center rounded-full bg-[#e21a22] text-[11px] font-bold text-white"
                >
                  Ver seguimiento
                </Link>
              )}

              {!createdOrder.authenticatedCustomer && (
                <Link
                  href="/login"
                  className="mt-2 flex h-11 items-center justify-center rounded-full border border-[#e21a22]/25 bg-[#e21a22]/10 text-[10px] font-semibold text-[#ff666b]"
                >
                  Iniciar sesión para verlo en la app
                </Link>
              )}

              <Link
                href="/menu"
                className="mt-2 flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[10px] font-semibold text-white/55"
              >
                Volver al menú
              </Link>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
