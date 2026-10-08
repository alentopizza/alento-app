"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PublicProductConfigurator from "@/components/PublicProductConfigurator";
import PublicActiveOrderBanner from "@/components/PublicActiveOrderBanner";
import {
  PUBLIC_CART_STORAGE_KEY,
  type PublicCartItem,
} from "@/lib/publicCart";
import { readPublicCache, writePublicCache } from "@/lib/publicBrowserCache";
import type { StandardOrderConfiguration } from "@/lib/orderConfiguration";

type ProductType = "STANDARD" | "PIZZA_SINGLE" | "PIZZA_TWO_FLAVORS" | "COMBO" | "MODIFIER" | "INTERNAL";
type PizzaSize = { id: number; name: string; diameterCm: number; basePrice: number };
type Modifier = { id: number; name: string; description: string | null; imageUrl: string | null; basePrice: number };
type Crust = { id: number; name: string; prices: { sizeId: number; price: number }[] };
type CatalogProduct = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imageUrl2: string | null;
  type: ProductType;
  basePrice: number | null;
  featured: boolean;
  comboDiscount?: number;
  comboPizzaRules?: Array<{
    id: number;
    quantity: number;
    sizes: PizzaSize[];
    flavors: Array<{
      id: number;
      name: string;
      basePrice: number;
      imageUrl: string | null;
    }>;
  }>;
  comboGroups?: Array<{
    id: number;
    kind: string;
    name: string;
    minSelections: number;
    maxSelections: number;
    options: Array<{
      id: number;
      productId: number;
      productName: string;
      productType: ProductType;
      basePrice: number;
      imageUrl: string | null;
      quantity: number;
      priceDelta: number;
    }>;
  }>;
};
type CatalogCategory = {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  products: CatalogProduct[];
};
type CatalogResponse = {
  categories: CatalogCategory[];
  pizzaFlavors: CatalogProduct[];
  sizes: PizzaSize[];
  crusts: Crust[];
  modifiers: Modifier[];
};
type PublicHomeSettings = {
  menuHero?: { active: boolean; imageUrl: string };
};

type CartItem = PublicCartItem;

const DESKTOP_HERO_IMAGE = "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/Vyme6Gd1y8prrWS7X3wu.png";

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function isTwoFlavorPizza(product: CatalogProduct) {
  return product.type === "PIZZA_TWO_FLAVORS" || product.name.toLowerCase().includes("2 sabores");
}

function categoryEmoji(slug: string) {
  if (slug.includes("pizza")) return "🍕";
  if (slug.includes("combo")) return "🍱";
  if (slug.includes("antojo")) return "🥖";
  if (slug.includes("bebida")) return "🥤";
  if (slug.includes("postre")) return "🍰";
  if (slug.includes("destacado")) return "🔥";
  return "🍽️";
}

export default function PublicMenuPage() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [home, setHome] = useState<PublicHomeSettings | null>(null);
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [configurableProduct, setConfigurableProduct] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [homeLoaded, setHomeLoaded] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [cartFeedback, setCartFeedback] = useState("");
  const cartFeedbackTimer = useRef<number | null>(null);

  useEffect(() => {
    function applyCatalog(catalogData: CatalogResponse) {
      setCatalog(catalogData);
    }

    const cachedCatalog = readPublicCache<CatalogResponse>("catalog");
    const cachedHome = readPublicCache<PublicHomeSettings>("home");

    if (cachedCatalog) {
      applyCatalog(cachedCatalog);
      setLoading(false);
    }
    if (cachedHome) {
      setHome(cachedHome);
      setHomeLoaded(true);
    }

    async function loadFresh() {
      try {
        const [catalogResponse, homeResponse] = await Promise.all([
          fetch("/api/catalog"),
          fetch("/api/public-home"),
        ]);

        if (catalogResponse.ok) {
          const catalogData = (await catalogResponse.json()) as CatalogResponse;
          applyCatalog(catalogData);
          writePublicCache("catalog", catalogData);
        }

        if (homeResponse.ok) {
          const homeData = await homeResponse.json();
          const settings = (homeData?.settings ?? null) as PublicHomeSettings | null;
          setHome(settings);
          if (settings) writePublicCache("home", settings);
        }
      } finally {
        setHomeLoaded(true);
        setLoading(false);
      }
    }

    void loadFresh();
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 520);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      setCartReady(true);
    }
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    window.localStorage.setItem(PUBLIC_CART_STORAGE_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event("alento-cart-updated"));
  }, [cart, cartReady]);

  const categories = useMemo(
    () =>
      (catalog?.categories ?? []).filter(
        (category) =>
          category.slug !== "ingredientes" && category.products.length > 0,
      ),
    [catalog],
  );

  const catalogCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.slug !== "destacados",
      ),
    [categories],
  );

  const allProducts = useMemo(() => {
    const map = new Map<number, CatalogProduct>();

    for (const category of catalogCategories) {
      for (const product of category.products) {
        if (!map.has(product.id)) map.set(product.id, product);
      }
    }

    return [...map.values()];
  }, [catalogCategories]);

  const searchResults = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("es");
    if (!value) return [];

    return allProducts.filter((product) =>
      `${product.name} ${product.description ?? ""}`
        .toLocaleLowerCase("es")
        .includes(value),
    );
  }, [allProducts, query]);

  const featuredProducts = useMemo(() => {
    const featuredCategory = categories.find(
      (category) => category.slug === "destacados",
    );

    if (featuredCategory?.products.length) {
      return featuredCategory.products.slice(0, 4);
    }

    const highlighted = allProducts.filter((product) => product.featured);
    return (highlighted.length ? highlighted : allProducts).slice(0, 4);
  }, [allProducts, categories]);

  useEffect(() => {
    if (loading) return;

    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".alento-public-menu .alento-product-card",
      ),
    );

    cards.forEach((card, index) => {
      card.style.setProperty(
        "--alento-card-delay",
        `${Math.min(index % 4, 3) * 55}ms`,
      );
    });

    if (!("IntersectionObserver" in window)) {
      cards.forEach((card) => card.classList.add("alento-card-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("alento-card-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -6% 0px" },
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [loading, query, featuredProducts.length, catalogCategories.length]);

  function productPriceValue(product: CatalogProduct): number | null {
    const minSize = catalog?.sizes.length
      ? Math.min(...catalog.sizes.map((size) => size.basePrice))
      : 0;

    if (isTwoFlavorPizza(product)) {
      const flavorPrices =
        catalog?.pizzaFlavors.map((flavor) => flavor.basePrice ?? 0) ?? [];
      return minSize + (flavorPrices.length ? Math.min(...flavorPrices) : 0);
    }

    if (product.type === "PIZZA_SINGLE") {
      return minSize + (product.basePrice ?? 0);
    }

    return product.basePrice;
  }

  function displayPrice(product: CatalogProduct) {
    const value = productPriceValue(product);
    if (value == null) {
      return product.type === "COMBO" ? "Configurable" : "Consultar";
    }
    return money(value);
  }

  function triggerCartFeedback(productName: string) {
    setCartFeedback(productName);

    if (cartFeedbackTimer.current != null) {
      window.clearTimeout(cartFeedbackTimer.current);
    }

    cartFeedbackTimer.current = window.setTimeout(() => {
      setCartFeedback("");
      cartFeedbackTimer.current = null;
    }, 2200);

    window.dispatchEvent(new Event("alento-cart-added"));

    try {
      navigator.vibrate?.(35);
    } catch {}

    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

      if (AudioContextClass) {
        const audio = new AudioContextClass();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const now = audio.currentTime;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(720, now);
        oscillator.frequency.exponentialRampToValueAtTime(980, now + 0.08);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.055, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.12);
        oscillator.addEventListener("ended", () => {
          void audio.close();
        });
      }
    } catch {}
  }

  function addItemToCart(item: CartItem) {
    setCart((current) => [...current, item]);
    triggerCartFeedback(item.name);
  }

  function addSimpleProduct(product: CatalogProduct) {
    const unitPrice = product.basePrice;
    if (unitPrice == null) {
      setSelectedProduct(product);
      return;
    }

    const configuration: StandardOrderConfiguration = {
      schemaVersion: 1,
      kind: "STANDARD",
      productId: product.id,
      productName: product.name,
    };
    const key = `standard-${product.id}`;

    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) {
        return current.map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [
        ...current,
        {
          key,
          productId: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          detail: "Producto",
          unitPrice,
          quantity: 1,
          configuration,
        },
      ];
    });

    triggerCartFeedback(product.name);
    setSelectedProduct(null);
  }

  function startAdd(product: CatalogProduct) {
    if (
      product.type === "PIZZA_SINGLE" ||
      isTwoFlavorPizza(product) ||
      product.type === "COMBO"
    ) {
      setSelectedProduct(null);
      setConfigurableProduct(product);
      return;
    }

    addSimpleProduct(product);
  }



  return (
    <main className="alento-public-menu min-h-screen bg-[#090909] pb-24 text-white">
      <section className="min-h-screen bg-[#090909]">
        <section id="inicio-menu" className="relative overflow-hidden border-b border-white/10 bg-black">
          <div className="mx-auto w-full max-w-[1080px] overflow-hidden">
            {homeLoaded ? (
              <div className="aspect-video w-full overflow-hidden bg-black">
                <img
                  src={home?.menuHero?.active && home.menuHero.imageUrl ? home.menuHero.imageUrl : DESKTOP_HERO_IMAGE}
                  alt="Alentó Pizza"
                  className="h-full w-full object-contain object-center"
                />
              </div>
            ) : (
              <div className="aspect-video w-full bg-black" aria-hidden="true" />
            )}
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-3 pt-3 sm:px-4 sm:pt-4 lg:px-7">
          <PublicActiveOrderBanner />
        </section>

        <section id="destacados-menu" className="mx-auto max-w-[1320px] px-3 pb-10 pt-6 sm:px-5 sm:pb-12 lg:px-8 lg:pb-14 lg:pt-5">
          <div className="text-center">
            <h2 className="text-[27px] font-extrabold uppercase leading-[.98] tracking-[-0.035em] text-white sm:text-[32px] lg:text-[38px]">
              Nuestros <span className="text-[#e21a22]">más vendidos</span>
            </h2>
            <p className="mx-auto mt-2 max-w-[520px] text-[10px] font-medium uppercase tracking-[0.14em] text-white/28 sm:text-[11px] lg:text-[10px] lg:tracking-[0.16em]">
              Favoritos de quienes siempre vuelven
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-4">
            {featuredProducts.map((product, index) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelectedProduct(product)}
                className="alento-product-card alento-product-card-featured group text-left"
              >
                <div className="alento-product-card-media">
                  {index < 2 && (
                    <span className="alento-product-card-badge">
                      Favorita
                    </span>
                  )}
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="alento-product-card-image"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl lg:text-7xl">🍕</div>
                  )}
                </div>

                <div className="alento-product-card-body antialiased">
                  <h3 className="alento-product-card-title">
                    {product.name}
                  </h3>
                  <div className="alento-product-card-footer">
                    <span className="alento-product-card-price">
                      {displayPrice(product)}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedProduct(product);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedProduct(product);
                        }
                      }}
                      className="alento-product-card-action"
                      aria-label={`Agregar ${product.name} al carrito`}
                    >
                      +
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section id="catalogo-menu" className="mx-auto max-w-[1320px] px-3 pb-32 sm:px-5 md:pb-16 lg:px-8">
          <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-[25px] font-black leading-none tracking-[-0.04em] text-white sm:text-[28px] lg:text-[31px]">
                Menú
              </h2>
              <p className="mt-2 max-w-[560px] text-[10px] leading-4 text-white/32">
                Pizzas, antojos y bebidas
              </p>
            </div>

            <div className="flex h-10 w-full items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.05] px-3.5 md:w-[310px]">
              <span className="text-white/45">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar en todo el menú..."
                className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-white/25"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-white/40"
                  aria-label="Limpiar búsqueda"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-10 text-center text-white/40">
              Cargando menú...
            </div>
          ) : query.trim() ? (
            searchResults.length ? (
              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#ff454b]">
                      Resultados
                    </p>
                    <h3 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-white">
                      {searchResults.length} producto{searchResults.length === 1 ? "" : "s"}
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="alento-product-card group text-left"
                    >
                      <div className="alento-product-card-media">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="alento-product-card-image"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-5xl lg:text-7xl">
                            🍕
                          </div>
                        )}
                      </div>

                      <div className="alento-product-card-body antialiased">
                        <h3 className="alento-product-card-title">
                          {product.name}
                        </h3>
                        <div className="alento-product-card-footer">
                          <span className="alento-product-card-price">
                            {displayPrice(product)}
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedProduct(product);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                setSelectedProduct(product);
                              }
                            }}
                            className="alento-product-card-action"
                            aria-label={`Agregar ${product.name} al carrito`}
                          >
                            +
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-10 text-center text-white/45">
                No encontramos productos con esa búsqueda.
              </div>
            )
          ) : catalogCategories.length ? (
            <div className="space-y-10 sm:space-y-12">
              {catalogCategories.map((category) => (
                <section
                  key={category.id}
                  id={`categoria-${category.slug}`}
                  className="scroll-mt-24"
                >
                  <div className="mb-3 flex items-end justify-between gap-3 sm:mb-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[13px] border border-white/10 bg-white/[0.06] text-[20px]">
                        {category.imageUrl ? (
                          <img
                            src={category.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{categoryEmoji(category.slug)}</span>
                        )}
                      </span>
                      <h3 className="text-[23px] font-black leading-none tracking-[-0.035em] text-white sm:text-[26px]">
                        {category.name}
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    {category.products.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setSelectedProduct(product)}
                        className="alento-product-card group text-left"
                      >
                        <div className="alento-product-card-media">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="alento-product-card-image"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-5xl lg:text-7xl">
                              {categoryEmoji(category.slug)}
                            </div>
                          )}
                        </div>

                        <div className="alento-product-card-body antialiased">
                          <h3 className="alento-product-card-title">
                            {product.name}
                          </h3>
                          <div className="alento-product-card-footer">
                            <span className="alento-product-card-price">
                              {displayPrice(product)}
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedProduct(product);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setSelectedProduct(product);
                                }
                              }}
                              className="alento-product-card-action"
                              aria-label={`Agregar ${product.name} al carrito`}
                            >
                              +
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-10 text-center text-white/45">
              No hay productos disponibles en este momento.
            </div>
          )}
        </section>
      </section>


      {cartFeedback && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[92px] z-[130] flex justify-center px-4 sm:bottom-7">
          <div className="flex max-w-[420px] items-center gap-3 rounded-full border border-emerald-400/20 bg-[#111]/96 px-4 py-3 text-white shadow-[0_18px_50px_rgba(0,0,0,.38)] backdrop-blur-xl">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[15px] font-black text-black">
              ✓
            </span>
            <div className="min-w-0">
              <p className="alento-ui-micro font-bold uppercase tracking-[0.1em] text-emerald-300">
                Buenísima elección · al carrito
              </p>
              <p className="truncate text-[11px] font-semibold text-white/70">
                {cartFeedback}
              </p>
            </div>
          </div>
        </div>
      )}

      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-[92px] right-4 z-[80] flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#111] text-white shadow-[0_12px_30px_rgba(0,0,0,.42)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#e21a22] sm:bottom-6 sm:right-5 lg:bottom-7 lg:right-7 lg:h-12 lg:w-12"
          aria-label="Volver arriba"
          title="Volver arriba"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 14 6-6 6 6" />
          </svg>
        </button>
      )}

      {configurableProduct && catalog && (
        <PublicProductConfigurator
          product={configurableProduct}
          catalog={catalog}
          onClose={() => setConfigurableProduct(null)}
          onAdd={(item) => {
            addItemToCart(item);
            setConfigurableProduct(null);
          }}
        />
      )}

      {selectedProduct && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProduct(null);
          }}
        >
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-[26px] border border-white/10 bg-[#121212] text-white shadow-2xl sm:max-w-[560px] sm:rounded-[26px]">
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/15 sm:hidden" />

            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#e21a22]">Producto</p>
                <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.035em] text-white">{selectedProduct.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="alento-product-spotlight-media relative mx-5 overflow-hidden rounded-[20px] bg-[#0b0b0b]">
              <div className="aspect-square">
                {selectedProduct.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="alento-product-spotlight-image h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-7xl">🍕</div>
                )}
              </div>
            </div>

            <div className="px-5 pb-6 pt-4">
              {selectedProduct.description && (
                <p className="text-[12px] leading-5 text-white/45">{selectedProduct.description}</p>
              )}

              <div className={`flex items-center justify-between gap-3 ${selectedProduct.description ? "mt-4 border-t border-white/10 pt-4" : ""}`}>
                <b className="text-[20px] text-[#ff3439]">{displayPrice(selectedProduct)}</b>
                {selectedProduct.type === "PIZZA_SINGLE" || isTwoFlavorPizza(selectedProduct) || selectedProduct.type === "COMBO" ? (
                  <button
                    type="button"
                    onClick={() => startAdd(selectedProduct)}
                    className="rounded-full bg-[#e21a22] px-4 py-2.5 text-[10px] font-bold text-white transition hover:bg-[#ef1c25]"
                  >
                    Agregar al carrito
                  </button>
                ) : productPriceValue(selectedProduct) != null ? (
                  <button
                    type="button"
                    onClick={() => startAdd(selectedProduct)}
                    className="rounded-full bg-[#e21a22] px-4 py-2.5 text-[10px] font-bold text-white transition hover:bg-[#ef1c25]"
                  >
                    Agregar al carrito
                  </button>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[10px] font-bold text-white/45">
                    Requiere configuración
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
