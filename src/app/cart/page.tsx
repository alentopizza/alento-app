"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { trackCatalogEvent } from "@/lib/publicAnalytics";

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

type UpsellKind = "snack" | "drink";

type UpsellProduct = {
  id: number;
  name: string;
  imageUrl: string | null;
  basePrice: number;
  categoryLabel: string;
  kind: UpsellKind;
};

type CatalogResponse = {
  categories?: Array<{
    id: number;
    name: string;
    slug: string;
    products: Array<{
      id: number;
      name: string;
      imageUrl: string | null;
      type: string;
      basePrice: number | null;
    }>;
  }>;
};

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

  const [upsellProducts, setUpsellProducts] = useState<UpsellProduct[]>([]);
  const [upsellCategoryProductIds, setUpsellCategoryProductIds] = useState<{
    snack: number[];
    drink: number[];
  }>({ snack: [], drink: [] });
  const [upsellReviewed, setUpsellReviewed] = useState(false);
  const [upsellPrompted, setUpsellPrompted] = useState(false);
  const [addedUpsellId, setAddedUpsellId] = useState<number | null>(null);
  const upsellRef = useRef<HTMLDivElement | null>(null);
  const cartViewTrackedRef = useRef(false);
  const previousCartLengthRef = useRef(0);

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
    let cancelled = false;

    async function loadUpsellProducts() {
      try {
        const response = await fetch("/api/catalog", { cache: "no-store" });
        const data = (await response.json()) as CatalogResponse;
        if (cancelled || !response.ok) return;

        const normalized = (value: string) =>
          value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("es");

        const snackCategories = (data.categories ?? []).filter((category) => {
          const key = normalized(category.slug + " " + category.name);
          return (
            key.includes("antojo") ||
            key.includes("acompan") ||
            key.includes("snack")
          );
        });

        const drinkCategories = (data.categories ?? []).filter((category) => {
          const key = normalized(category.slug + " " + category.name);
          return key.includes("bebida") || key.includes("drink");
        });

        const collectProductIds = (
          categories: NonNullable<CatalogResponse["categories"]>,
        ) =>
          Array.from(
            new Set(
              categories.flatMap((category) =>
                category.products.map((product) => product.id),
              ),
            ),
          );

        setUpsellCategoryProductIds({
          snack: collectProductIds(snackCategories),
          drink: collectProductIds(drinkCategories),
        });

        const pick = (
          categories: NonNullable<CatalogResponse["categories"]>,
          limit: number,
          kind: UpsellKind,
        ) =>
          categories
            .flatMap((category) =>
              category.products.map((product) => ({
                product,
                categoryLabel: category.name,
              })),
            )
            .filter(
              ({ product }) =>
                product.type === "STANDARD" &&
                product.basePrice != null &&
                product.basePrice > 0,
            )
            .slice(0, limit)
            .map(({ product, categoryLabel }) => ({
              id: product.id,
              name: product.name,
              imageUrl: product.imageUrl,
              basePrice: Number(product.basePrice),
              categoryLabel,
              kind,
            }));

        const recommendations = [
          ...pick(snackCategories, 3, "snack"),
          ...pick(drinkCategories, 3, "drink"),
        ];

        const unique = new Map<number, UpsellProduct>();
        recommendations.forEach((product) => unique.set(product.id, product));

        setUpsellProducts([...unique.values()]);
      } catch {
        // La recomendación no debe impedir usar el carrito.
      }
    }

    void loadUpsellProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(PUBLIC_CART_STORAGE_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event("alento-cart-updated"));

    const itemCount = cart.reduce(
      (total, item) => total + item.quantity,
      0,
    );
    const cartValue = cart.reduce(
      (total, item) => total + item.unitPrice * item.quantity,
      0,
    );

    if (cart.length > 0 && !cartViewTrackedRef.current) {
      cartViewTrackedRef.current = true;
      trackCatalogEvent("CART_VIEW", {
        value: cartValue,
        itemCount,
        items: cart.map((item) => ({
          productId: item.productId,
          productName: item.name,
          value: item.unitPrice,
          quantity: item.quantity,
        })),
      });
    }

    if (
      previousCartLengthRef.current > 0 &&
      cart.length === 0
    ) {
      cartViewTrackedRef.current = false;
      trackCatalogEvent("CART_EMPTIED");
    }

    previousCartLengthRef.current = cart.length;

    if (cart.length === 0) {
      setUpsellReviewed(false);
      setUpsellPrompted(false);
    }
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

  const subtotal = useMemo(
    () => cart.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
    [cart],
  );

  const cartProductPresence = useMemo(() => {
    const snackIds = new Set(upsellCategoryProductIds.snack);
    const drinkIds = new Set(upsellCategoryProductIds.drink);

    const hasKind = (ids: Set<number>) =>
      cart.some((item) => {
        if (ids.has(item.productId)) return true;

        if (item.configuration?.kind === "COMBO") {
          return item.configuration.groups.some((group) =>
            group.selections.some((selection) => ids.has(selection.productId)),
          );
        }

        return false;
      });

    return {
      snack: hasKind(snackIds),
      drink: hasKind(drinkIds),
    };
  }, [cart, upsellCategoryProductIds]);

  const visibleUpsellProducts = useMemo(() => {
    const cartProductIds = new Set(cart.map((item) => item.productId));

    return upsellProducts
      .filter((product) => !cartProductIds.has(product.id))
      .filter(
        (product) =>
          (product.kind === "snack" && !cartProductPresence.snack) ||
          (product.kind === "drink" && !cartProductPresence.drink),
      )
      .slice(0, 6);
  }, [cart, cartProductPresence, upsellProducts]);

  const upsellTitle = useMemo(() => {
    if (!cartProductPresence.snack && !cartProductPresence.drink) {
      return "Antojos y bebidas";
    }

    if (!cartProductPresence.snack) {
      return "¿Un antojo para acompañar?";
    }

    return "¿Algo para tomar?";
  }, [cartProductPresence]);

  function addUpsellProduct(product: UpsellProduct) {
    setCart((current) => {
      const existing = current.find(
        (item) =>
          item.productId === product.id &&
          !item.configuration &&
          !item.notes,
      );

      if (existing) {
        return current.map((item) =>
          item.key === existing.key
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [
        ...current,
        {
          key:
            "upsell-" +
            String(product.id) +
            "-" +
            String(Date.now()),
          productId: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          unitPrice: product.basePrice,
          quantity: 1,
        },
      ];
    });

    setUpsellReviewed(false);
    setUpsellPrompted(false);
    setAddedUpsellId(product.id);
    trackCatalogEvent("ADD_TO_CART", {
      productId: product.id,
      productName: product.name,
      value: product.basePrice,
      quantity: 1,
      itemCount:
        cart.reduce((total, item) => total + item.quantity, 0) + 1,
    });
    window.dispatchEvent(new Event("alento-cart-added"));

    window.setTimeout(() => {
      setAddedUpsellId((current) =>
        current === product.id ? null : current,
      );
    }, 1200);
  }

  function startCheckout() {
    trackCatalogEvent("CHECKOUT_STARTED", {
      value: subtotal,
      itemCount: cart.reduce(
        (total, item) => total + item.quantity,
        0,
      ),
      items: cart.map((item) => ({
        productId: item.productId,
        productName: item.name,
        value: item.unitPrice,
        quantity: item.quantity,
      })),
    });
    setCheckoutStep("delivery");
  }

  function continueOrder() {
    if (visibleUpsellProducts.length > 0 && !upsellReviewed) {
      if (upsellPrompted) {
        setUpsellReviewed(true);
        setUpsellPrompted(false);
        startCheckout();
        return;
      }

      setUpsellPrompted(true);
      window.requestAnimationFrame(() => {
        upsellRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      return;
    }

    startCheckout();
  }

  function canAdjustQuantity(item: PublicCartItem) {
    const snackIds = new Set(upsellCategoryProductIds.snack);
    const drinkIds = new Set(upsellCategoryProductIds.drink);
    return snackIds.has(item.productId) || drinkIds.has(item.productId);
  }

  function changeQuantity(key: string, delta: number) {
    const target = cart.find((item) => item.key === key);

    if (delta > 0 && target && canAdjustQuantity(target)) {
      trackCatalogEvent("ADD_TO_CART", {
        productId: target.productId,
        productName: target.name,
        value: target.unitPrice,
        quantity: 1,
        itemCount:
          cart.reduce((total, item) => total + item.quantity, 0) + 1,
      });
    }

    setCart((current) =>
      current
        .map((item) =>
          item.key === key && canAdjustQuantity(item)
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
        "min-h-screen w-full max-w-full overflow-x-hidden bg-[#090909] text-white " +
        (checkoutStep === "cart" ? "pb-28" : "pb-0")
      }
    >
      <PublicBrandHeader />

      {checkoutStep === "cart" && (
      <section className="mx-auto w-full min-w-0 max-w-[1040px] overflow-x-hidden px-4 pb-8 pt-5 sm:px-6 md:pb-14 md:pt-6">
        <PublicActiveOrderBanner className="mb-4" />

        {!ready ? (
          <div className="mt-2 rounded-[22px] border border-white/10 bg-white/[0.03] p-8 text-center text-[12px] text-white/35">
            Cargando carrito...
          </div>
        ) : cart.length === 0 ? (
          <div className="mt-2 flex min-h-[340px] flex-col items-center justify-center rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(226,26,34,.10),transparent_30%),linear-gradient(145deg,#141414,#0d0d0d)] px-6 text-center shadow-[0_20px_60px_rgba(0,0,0,.20)]">
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
          <div className="mt-2 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-3 pb-[250px] lg:pb-0">
              {cart.map((item) => {
                const adjustableQuantity = canAdjustQuantity(item);
                const totalPrice = item.unitPrice * item.quantity;

                return (
                  <article
                    key={item.key}
                    className="flex gap-3 rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,#171717,#111)] p-3.5 shadow-[0_14px_34px_rgba(0,0,0,.16)] transition hover:border-white/15 sm:p-4"
                  >
                    <div className="h-[84px] w-[84px] shrink-0 overflow-hidden rounded-[15px] bg-black sm:h-[96px] sm:w-[96px]">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl">
                          🍕
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="text-[15px] font-semibold leading-5 sm:text-[17px]">
                            {item.name}
                          </h2>
                          {item.detail && (
                            <p className="mt-1 line-clamp-3 text-[10px] leading-4 text-white/38 sm:text-[11px]">
                              {item.detail}
                            </p>
                          )}
                          {item.notes && (
                            <p className="mt-1 text-[10px] text-white/28">
                              Nota: {item.notes}
                            </p>
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

                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <b className="text-[14px] font-bold text-[#ff3439] sm:text-[15px]">
                          {money(totalPrice)}
                        </b>

                        {adjustableQuantity ? (
                          <div className="flex items-center rounded-full border border-white/10 bg-black/30">
                            <button
                              type="button"
                              onClick={() => changeQuantity(item.key, -1)}
                              className="flex h-9 w-9 items-center justify-center text-white/65"
                              aria-label="Disminuir cantidad"
                            >
                              −
                            </button>
                            <span className="min-w-8 text-center text-[12px] font-bold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => changeQuantity(item.key, 1)}
                              className="flex h-9 w-9 items-center justify-center text-white/65"
                              aria-label="Aumentar cantidad"
                            >
                              +
                            </button>
                          </div>
                        ) : item.quantity > 1 ? (
                          <span className="alento-ui-micro text-white/30">
                            × {item.quantity}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}

              {visibleUpsellProducts.length > 0 && (
                <section
                  ref={upsellRef}
                  className={
                    "mt-5 w-full min-w-0 max-w-full overflow-hidden rounded-[22px] border bg-[linear-gradient(145deg,#151515,#101010)] transition-all duration-300 " +
                    (upsellPrompted
                      ? "border-red-400/35 shadow-[0_0_0_1px_rgba(226,26,34,.18),0_16px_40px_rgba(0,0,0,.22)]"
                      : "border-white/[0.08]")
                  }
                >
                  <div className="px-4 pb-3 pt-4">
                    <h3 className="text-[16px] font-extrabold tracking-[-0.02em] text-white">
                      {upsellTitle}
                    </h3>
                  </div>

                  <div className="alento-scroll flex w-full min-w-0 max-w-full gap-2.5 overflow-x-auto overscroll-x-contain px-4 pb-4">
                    {visibleUpsellProducts.map((product) => (
                      <article
                        key={product.id}
                        className={
                          "alento-upsell-card w-[142px] shrink-0 overflow-hidden rounded-[17px] border border-white/[0.08] bg-white/[0.035] " +
                          (addedUpsellId === product.id ? "alento-upsell-added" : "")
                        }
                      >
                        <div className="alento-upsell-media relative aspect-square overflow-hidden bg-black/25">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="alento-upsell-image h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-3xl">
                              {product.categoryLabel
                                .toLocaleLowerCase("es")
                                .includes("bebida")
                                ? "🥤"
                                : "🍟"}
                            </div>
                          )}
                        </div>

                        <div className="p-2.5">
                          <h4 className="line-clamp-1 text-[11px] font-bold leading-[15px] text-white">
                            {product.name}
                          </h4>
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <b className="text-[10px] text-[#ff454b]">
                              {money(product.basePrice)}
                            </b>
                            <button
                              type="button"
                              onClick={() => addUpsellProduct(product)}
                              className={
                                "flex h-8 w-8 items-center justify-center rounded-full border text-[16px] font-black transition " +
                                (addedUpsellId === product.id
                                  ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-300"
                                  : "border-red-400/20 bg-[#e21a22] text-white hover:bg-[#ef1c25]")
                              }
                              aria-label={`Agregar ${product.name}`}
                            >
                              {addedUpsellId === product.id ? "✓" : "+"}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                </section>
              )}
            </div>

            <aside className="fixed inset-x-3 bottom-[92px] z-[70] mx-auto max-w-[470px] rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_90%_5%,rgba(226,26,34,.14),transparent_30%),linear-gradient(145deg,#161616,#0f0f0f)] p-4 shadow-[0_20px_50px_rgba(0,0,0,.42)] backdrop-blur-xl lg:sticky lg:inset-auto lg:top-6 lg:z-auto lg:mx-0 lg:max-w-none lg:rounded-[24px] lg:p-5 lg:shadow-[0_18px_46px_rgba(0,0,0,.20)]">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/32">
                    Resumen
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCart([]);
                      setCheckoutSelection(null);
                      setCheckoutStep("cart");
                      setCreatedOrder(null);
                    }}
                    className="text-[9px] font-semibold text-white/30 transition hover:text-red-300"
                  >
                    Vaciar carrito
                  </button>
                </div>

                <div className="mt-3 flex items-end justify-between gap-4">
                  <span className="text-[11px] font-semibold text-white/48">
                    Subtotal
                  </span>
                  <b className="text-[24px] tracking-[-0.03em] text-white lg:text-[22px]">
                    {money(subtotal)}
                  </b>
                </div>
              </div>

              <button
                type="button"
                onClick={continueOrder}
                className="mt-3 h-11 w-full rounded-full bg-[#e21a22] text-[11px] font-bold text-white transition hover:bg-[#ef1c25] lg:mt-5 lg:h-12 lg:text-[12px]"
              >
                Continuar pedido
              </button>

            </aside>
          </div>
        )}
      </section>
      )}

      {checkoutStep === "delivery" && (
        <PublicCheckoutDelivery
          cart={cart}
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
            trackCatalogEvent("ORDER_CREATED", {
              orderId: order.id,
              value: order.total,
              itemCount: cart.reduce(
                (total, item) => total + item.quantity,
                0,
              ),
              items: cart.map((item) => ({
                productId: item.productId,
                productName: item.name,
                value: item.unitPrice,
                quantity: item.quantity,
              })),
              metadata: {
                fulfillmentType: order.fulfillmentType,
                paymentMethod: order.paymentMethod,
              },
            });
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
