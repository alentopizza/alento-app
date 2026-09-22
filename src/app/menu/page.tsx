"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PublicBrandHeader from "@/components/PublicBrandHeader";
import {
  PUBLIC_CART_STORAGE_KEY,
  type PublicCartItem,
} from "@/lib/publicCart";
import { readPublicCache, writePublicCache } from "@/lib/publicBrowserCache";
import type {
  OrderLineConfiguration,
  PizzaOrderConfiguration,
  StandardOrderConfiguration,
} from "@/lib/orderConfiguration";

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
  brand: { logoUrl: string };
  menuHero?: { active: boolean; imageUrl: string };
};

type CartItem = PublicCartItem;

type PizzaConfig = {
  product: CatalogProduct;
  sizeId: number | null;
  firstFlavorId: number | null;
  secondFlavorId: number | null;
  crustId: number | null;
  modifierIds: number[];
  note: string;
};

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

function crustPriceForSize(crust: Crust, sizeId: number | null) {
  if (!sizeId) return null;
  return crust.prices.find((price) => price.sizeId === sizeId)?.price ?? null;
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
  const [activeCategory, setActiveCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [homeLoaded, setHomeLoaded] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [pizzaConfig, setPizzaConfig] = useState<PizzaConfig | null>(null);
  const [editingCartKey, setEditingCartKey] = useState<string | null>(null);
  const [configError, setConfigError] = useState("");

  useEffect(() => {
    function applyCatalog(catalogData: CatalogResponse) {
      setCatalog(catalogData);
      const first =
        catalogData.categories?.find(
          (category: CatalogCategory) =>
            category.slug === "pizzas" && category.products.length > 0,
        ) ??
        catalogData.categories?.find(
          (category: CatalogCategory) =>
            category.slug.includes("pizza") && category.products.length > 0,
        ) ??
        catalogData.categories?.find(
          (category: CatalogCategory) => category.products.length > 0,
        );

      if (first) {
        setActiveCategory((current) => current || first.slug);
      }
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

  const allProducts = useMemo(() => {
    const map = new Map<number, CatalogProduct>();

    for (const category of categories) {
      for (const product of category.products) {
        if (!map.has(product.id)) map.set(product.id, product);
      }
    }

    return [...map.values()];
  }, [categories]);

  const activeProducts = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("es");

    if (value) {
      return allProducts.filter((product) =>
        `${product.name} ${product.description ?? ""}`
          .toLocaleLowerCase("es")
          .includes(value),
      );
    }

    return (
      categories.find((category) => category.slug === activeCategory)?.products ??
      allProducts
    );
  }, [activeCategory, allProducts, categories, query]);

  const featuredProducts = useMemo(() => {
    const highlighted = allProducts.filter((product) => product.featured);
    return (highlighted.length ? highlighted : allProducts).slice(0, 4);
  }, [allProducts]);

  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  );

  const cartSubtotal = useMemo(
    () => cart.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
    [cart],
  );

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

    setSelectedProduct(null);
  }

  function startPizzaConfiguration(product: CatalogProduct) {
    if (!catalog) return;

    const defaultSize = catalog.sizes[0] ?? null;
    const defaultCrust =
      catalog.crusts.find(
        (crust) =>
          crust.name.toLowerCase().includes("tradicional") &&
          crustPriceForSize(crust, defaultSize?.id ?? null) != null,
      ) ??
      catalog.crusts.find(
        (crust) => crustPriceForSize(crust, defaultSize?.id ?? null) != null,
      ) ??
      null;

    setSelectedProduct(null);
    setEditingCartKey(null);
    setConfigError("");
    setPizzaConfig({
      product,
      sizeId: defaultSize?.id ?? null,
      firstFlavorId: isTwoFlavorPizza(product) ? null : product.id,
      secondFlavorId: null,
      crustId: defaultCrust?.id ?? null,
      modifierIds: [],
      note: "",
    });
  }

  function startAdd(product: CatalogProduct) {
    if (product.type === "PIZZA_SINGLE" || isTwoFlavorPizza(product)) {
      startPizzaConfiguration(product);
      return;
    }

    addSimpleProduct(product);
  }

  function closePizzaConfiguration() {
    setPizzaConfig(null);
    setEditingCartKey(null);
    setConfigError("");
  }

  function updatePizzaSize(sizeId: number) {
    if (!pizzaConfig || !catalog) return;

    const currentCrust = catalog.crusts.find(
      (crust) => crust.id === pizzaConfig.crustId,
    );
    const currentAvailable =
      currentCrust && crustPriceForSize(currentCrust, sizeId) != null;

    const nextCrustId = currentAvailable
      ? pizzaConfig.crustId
      : catalog.crusts.find(
          (crust) => crustPriceForSize(crust, sizeId) != null,
        )?.id ?? null;

    setPizzaConfig({ ...pizzaConfig, sizeId, crustId: nextCrustId });
  }

  function pizzaPrice(config: PizzaConfig) {
    if (!catalog || !config.sizeId) return 0;

    const size = catalog.sizes.find((item) => item.id === config.sizeId);
    if (!size) return 0;

    const flavorPrices = isTwoFlavorPizza(config.product)
      ? [config.firstFlavorId, config.secondFlavorId].map(
          (id) =>
            catalog.pizzaFlavors.find((flavor) => flavor.id === id)?.basePrice ??
            0,
        )
      : [config.product.basePrice ?? 0];

    const crust = catalog.crusts.find((item) => item.id === config.crustId);
    const crustPrice =
      crust?.prices.find((price) => price.sizeId === size.id)?.price ?? 0;

    const modifiersPrice = isTwoFlavorPizza(config.product)
      ? 0
      : catalog.modifiers
          .filter((item) => config.modifierIds.includes(item.id))
          .reduce((sum, item) => sum + item.basePrice, 0);

    return (
      size.basePrice +
      Math.max(0, ...flavorPrices) +
      crustPrice +
      modifiersPrice
    );
  }

  function confirmPizza() {
    if (
      !pizzaConfig ||
      !catalog ||
      !pizzaConfig.sizeId ||
      !pizzaConfig.crustId
    ) {
      setConfigError("Completa el tamaño y el borde.");
      return;
    }

    const size = catalog.sizes.find((item) => item.id === pizzaConfig.sizeId);
    const crust = catalog.crusts.find((item) => item.id === pizzaConfig.crustId);
    if (!size || !crust) {
      setConfigError("La configuración seleccionada ya no está disponible.");
      return;
    }

    const twoFlavors = isTwoFlavorPizza(pizzaConfig.product);
    if (
      twoFlavors &&
      (!pizzaConfig.firstFlavorId || !pizzaConfig.secondFlavorId)
    ) {
      setConfigError("Selecciona los dos sabores.");
      return;
    }
    if (
      twoFlavors &&
      pizzaConfig.firstFlavorId === pizzaConfig.secondFlavorId
    ) {
      setConfigError("Los dos sabores deben ser diferentes.");
      return;
    }

    const flavorIds = twoFlavors
      ? [pizzaConfig.firstFlavorId!, pizzaConfig.secondFlavorId!]
      : [pizzaConfig.product.id];

    const flavors = flavorIds
      .map((id) => catalog.pizzaFlavors.find((item) => item.id === id))
      .filter((item): item is CatalogProduct => Boolean(item));

    if (flavors.length !== flavorIds.length) {
      setConfigError("Uno de los sabores ya no está disponible.");
      return;
    }

    const selectedCrustPrice = crustPriceForSize(crust, size.id);
    if (selectedCrustPrice == null) {
      setConfigError("Ese borde no está disponible para este tamaño.");
      return;
    }

    const modifiers = twoFlavors
      ? []
      : catalog.modifiers.filter((modifier) =>
          pizzaConfig.modifierIds.includes(modifier.id),
        );

    const configuration: PizzaOrderConfiguration = {
      schemaVersion: 1,
      kind: "PIZZA",
      productId: pizzaConfig.product.id,
      productName: pizzaConfig.product.name,
      size: {
        id: size.id,
        name: size.name,
        diameterCm: size.diameterCm,
        basePrice: size.basePrice,
      },
      flavors: flavors.map((flavor) => ({
        productId: flavor.id,
        name: flavor.name,
        portion: twoFlavors ? 0.5 : 1,
        basePrice: flavor.basePrice ?? 0,
      })),
      crust: {
        id: crust.id,
        name: crust.name,
        price: selectedCrustPrice,
      },
      modifiers: modifiers.map((modifier) => ({
        productId: modifier.id,
        name: modifier.name,
        quantity: 1,
        unitPrice: modifier.basePrice,
      })),
    };

    const detail = [
      size.name,
      twoFlavors
        ? flavors.map((flavor) => `½ ${flavor.name}`).join(" + ")
        : flavors[0]?.name,
      `Borde ${crust.name}`,
      ...modifiers.map((modifier) => `+ ${modifier.name}`),
    ]
      .filter(Boolean)
      .join(" · ");

    const item: CartItem = {
      key:
        editingCartKey ??
        `pizza-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      productId: pizzaConfig.product.id,
      name: pizzaConfig.product.name,
      imageUrl: pizzaConfig.product.imageUrl,
      detail,
      unitPrice: pizzaPrice(pizzaConfig),
      quantity: 1,
      configuration,
      notes: pizzaConfig.note.trim().slice(0, 120) || undefined,
    };

    setCart((current) =>
      editingCartKey
        ? current.map((cartItem) =>
            cartItem.key === editingCartKey
              ? { ...item, quantity: cartItem.quantity }
              : cartItem,
          )
        : [...current, item],
    );

    closePizzaConfiguration();
  }

  function editCartPizza(item: CartItem) {
    if (!catalog || item.configuration?.kind !== "PIZZA") return;

    const product =
      allProducts.find((candidate) => candidate.id === item.productId) ??
      catalog.pizzaFlavors.find((candidate) => candidate.id === item.productId);

    if (!product) return;

    setEditingCartKey(item.key);
    setConfigError("");
    setPizzaConfig({
      product,
      sizeId: item.configuration.size.id,
      firstFlavorId: item.configuration.flavors[0]?.productId ?? null,
      secondFlavorId: item.configuration.flavors[1]?.productId ?? null,
      crustId: item.configuration.crust.id,
      modifierIds: item.configuration.modifiers.map(
        (modifier) => modifier.productId,
      ),
      note: item.notes ?? "",
    });
  }



  return (
    <main className="min-h-screen bg-[#090909] pb-24 text-white">
      <section className="min-h-screen bg-[#090909]">
        <PublicBrandHeader />

        <section id="inicio-menu" className="relative overflow-hidden border-b border-white/10 bg-black">
          <div className="mx-auto w-full max-w-[1320px] overflow-hidden">
            {homeLoaded ? (
              <>
                <img
                  src={home?.menuHero?.active && home.menuHero.imageUrl ? home.menuHero.imageUrl : DESKTOP_HERO_IMAGE}
                  alt="Alentó Pizza"
                  className="block h-auto w-full object-contain md:hidden"
                />
                <img
                  src={home?.menuHero?.active && home.menuHero.imageUrl ? home.menuHero.imageUrl : DESKTOP_HERO_IMAGE}
                  alt="Alentó Pizza"
                  className="hidden aspect-[2/1] w-full object-cover object-center md:block lg:aspect-[1920/730]"
                />
              </>
            ) : (
              <>
                <div className="aspect-[1920/730] w-full bg-black md:hidden" aria-hidden="true" />
                <div className="hidden aspect-[2/1] w-full bg-black md:block lg:aspect-[1920/730]" aria-hidden="true" />
              </>
            )}
          </div>
        </section>

        <section id="categorias-menu" className="relative z-20 mx-auto -mt-5 max-w-[1180px] px-2 sm:-mt-7 sm:px-4 lg:-mt-10 lg:px-7">
          <div
            className="grid overflow-hidden rounded-[16px] border border-black/10 bg-white text-[#111] shadow-[0_18px_44px_rgba(0,0,0,.24)] sm:rounded-[18px] lg:rounded-[22px]"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, categories.length)}, minmax(0, 1fr))`,
            }}
          >
            {categories.map((category) => {
              const active = activeCategory === category.slug;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(category.slug);
                    setQuery("");
                    document.getElementById("catalogo-menu")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={`group relative flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-0.5 border-r border-neutral-200 px-1 text-center transition last:border-r-0 sm:min-h-[68px] sm:px-2 lg:min-h-[82px] lg:gap-1 lg:px-3 ${active ? "bg-[linear-gradient(180deg,#fff7f7,#ffeded)]" : "bg-white hover:bg-neutral-50"}`}
                >
                  {active && <span className="absolute inset-x-0 top-0 h-[3px] bg-[#d71920]" />}

                  <div className={`flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-[16px] transition sm:h-9 sm:w-9 sm:text-[20px] lg:h-11 lg:w-11 lg:text-[24px] ${active ? "bg-white shadow-[0_5px_16px_rgba(215,25,32,.13)] ring-1 ring-red-100" : "bg-neutral-50"}`}>
                    {category.imageUrl ? (
                      <img src={category.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span>{categoryEmoji(category.slug)}</span>
                    )}
                  </div>

                  <span className={`block w-full truncate text-[7px] font-extrabold uppercase leading-none tracking-[-0.01em] sm:text-[9px] lg:text-[11px] ${active ? "text-[#c6161c]" : "text-neutral-900"}`}>
                    {category.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section id="destacados-menu" className="mx-auto max-w-[1320px] px-3 pb-10 pt-6 sm:px-5 sm:pb-12 lg:px-8 lg:pb-14 lg:pt-5">
          <div className="text-center">
            <h2 className="text-[27px] font-extrabold uppercase leading-[.98] tracking-[-0.035em] text-white sm:text-[32px] lg:text-[38px]">
              Nuestros <span className="text-[#e21a22]">más vendidos</span>
            </h2>
            <p className="mx-auto mt-2 max-w-[520px] text-[8px] font-medium uppercase tracking-[0.14em] text-white/28 sm:text-[9px] lg:text-[10px] lg:tracking-[0.16em]">
              Favoritos de quienes siempre vuelven
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelectedProduct(product)}
                className="group overflow-hidden rounded-[16px] border border-white/18 bg-[#151515] text-left transition hover:-translate-y-1 hover:border-[#d71920]/70 lg:rounded-[18px]"
              >
                <div className="relative aspect-square overflow-hidden bg-[#101010]">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl lg:text-7xl">🍕</div>
                  )}
                </div>

                <div className="px-3 pb-2.5 pt-2 antialiased lg:px-4">
                  <h3 className="line-clamp-1 text-[14px] font-semibold leading-[18px] tracking-[-0.012em] text-white sm:text-[16px] sm:leading-[20px] lg:text-[20px] lg:leading-[23px]">
                    {product.name}
                  </h3>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-bold leading-none text-[#ff3439] sm:text-[16px] lg:text-[18px]">
                      {displayPrice(product)}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        startAdd(product);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          startAdd(product);
                        }
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e21a22] text-[17px] font-semibold leading-none text-white shadow-[0_6px_16px_rgba(226,26,34,.24)] lg:h-9 lg:w-9 lg:text-[18px]"
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
          <div className="mb-3 flex flex-col gap-2.5 sm:mb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/35 lg:text-[9px]">Catálogo</p>
              <h2 className="mt-0.5 text-[23px] font-black leading-none tracking-[-0.035em] text-white sm:text-[25px] lg:text-[27px]">
                {categories.find((category) => category.slug === activeCategory)?.name || "Menú"}
              </h2>
            </div>

            <div className="flex h-10 w-full items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.05] px-3.5 md:w-[310px]">
              <span className="text-white/45">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar en el menú..."
                className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-white/25"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="text-white/40" aria-label="Limpiar búsqueda">
                  ×
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-10 text-center text-white/40">
              Cargando menú...
            </div>
          ) : activeProducts.length ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {activeProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSelectedProduct(product)}
                  className="group overflow-hidden rounded-[16px] border border-white/18 bg-[#151515] text-left transition hover:-translate-y-1 hover:border-[#d71920]/70 lg:rounded-[18px]"
                >
                  <div className="relative aspect-square overflow-hidden bg-[#101010]">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-5xl lg:text-7xl">🍕</div>
                    )}
                  </div>

                  <div className="px-3 pb-2.5 pt-2 antialiased lg:px-4">
                    <h3 className="line-clamp-1 text-[14px] font-semibold leading-[18px] tracking-[-0.012em] text-white sm:text-[16px] sm:leading-[20px] lg:text-[20px] lg:leading-[23px]">
                      {product.name}
                    </h3>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[14px] font-bold leading-none text-[#ff3439] sm:text-[16px] lg:text-[18px]">
                        {displayPrice(product)}
                      </span>
                      <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        startAdd(product);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          startAdd(product);
                        }
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e21a22] text-[17px] font-semibold leading-none text-white shadow-[0_6px_16px_rgba(226,26,34,.24)] lg:h-9 lg:w-9 lg:text-[18px]"
                      aria-label={`Agregar ${product.name} al carrito`}
                    >
                      +
                    </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-10 text-center text-white/45">
              No encontramos productos con esa búsqueda.
            </div>
          )}
        </section>
      </section>


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

      {pizzaConfig && catalog && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm md:items-center md:p-5">
          <div className="flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#111] text-white shadow-2xl md:max-w-[760px] md:rounded-[28px]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#e21a22]">
                  {editingCartKey ? "Editar pizza" : "Configura tu pizza"}
                </p>
                <h2 className="mt-1 truncate text-[22px] font-semibold tracking-[-0.03em]">
                  {pizzaConfig.product.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={closePizzaConfiguration}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70"
              >
                ×
              </button>
            </div>

            <div className="alento-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold">Tamaño</h3>
                    <p className="mt-0.5 text-[10px] text-white/35">Misma estructura y precios del POS</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {catalog.sizes.map((size) => {
                    const selected = pizzaConfig.sizeId === size.id;
                    return (
                      <button
                        key={size.id}
                        type="button"
                        onClick={() => updatePizzaSize(size.id)}
                        className={`rounded-[14px] border p-3 text-left transition ${selected ? "border-[#e21a22] bg-[#e21a22] text-white" : "border-white/10 bg-black/25 text-white/70"}`}
                      >
                        <b className="block text-[13px]">{size.name}</b>
                        <span className="mt-1 block text-[10px] opacity-65">{size.diameterCm} cm</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {isTwoFlavorPizza(pizzaConfig.product) && (
                <>
                  <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                    <h3 className="mb-3 text-[15px] font-semibold">Primer sabor</h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {catalog.pizzaFlavors.map((flavor) => {
                        const selected = pizzaConfig.firstFlavorId === flavor.id;
                        return (
                          <button
                            key={flavor.id}
                            type="button"
                            onClick={() =>
                              setPizzaConfig({
                                ...pizzaConfig,
                                firstFlavorId: flavor.id,
                                secondFlavorId:
                                  pizzaConfig.secondFlavorId === flavor.id
                                    ? null
                                    : pizzaConfig.secondFlavorId,
                              })
                            }
                            className={`rounded-[14px] border px-3 py-3 text-left text-[12px] transition ${selected ? "border-[#e21a22] bg-red-500/12 text-white" : "border-white/10 bg-black/25 text-white/65"}`}
                          >
                            {flavor.name}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                    <h3 className="mb-3 text-[15px] font-semibold">Segundo sabor</h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {catalog.pizzaFlavors.map((flavor) => {
                        const disabled = pizzaConfig.firstFlavorId === flavor.id;
                        const selected = pizzaConfig.secondFlavorId === flavor.id;
                        return (
                          <button
                            key={flavor.id}
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              setPizzaConfig({ ...pizzaConfig, secondFlavorId: flavor.id })
                            }
                            className={`rounded-[14px] border px-3 py-3 text-left text-[12px] transition ${selected ? "border-[#e21a22] bg-red-500/12 text-white" : disabled ? "border-white/5 bg-white/[0.02] text-white/15" : "border-white/10 bg-black/25 text-white/65"}`}
                          >
                            {flavor.name}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </>
              )}

              <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3">
                  <h3 className="text-[15px] font-semibold">Borde</h3>
                  <p className="mt-0.5 text-[10px] text-white/35">
                    Disponibilidad y precio según el tamaño seleccionado
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {catalog.crusts.map((crust) => {
                    const price = crustPriceForSize(crust, pizzaConfig.sizeId);
                    const selected = pizzaConfig.crustId === crust.id;
                    const unavailable = price == null;
                    return (
                      <button
                        key={crust.id}
                        type="button"
                        disabled={unavailable}
                        onClick={() => setPizzaConfig({ ...pizzaConfig, crustId: crust.id })}
                        className={`flex min-h-[58px] items-center justify-between rounded-[14px] border px-3 py-2.5 text-left transition ${selected ? "border-[#e21a22] bg-[#e21a22] text-white" : unavailable ? "border-white/5 bg-white/[0.02] text-white/15" : "border-white/10 bg-black/25 text-white/70"}`}
                      >
                        <div>
                          <b className="block text-[12px]">{crust.name}</b>
                          <span className="mt-1 block text-[10px] opacity-65">
                            {unavailable ? "No disponible" : price === 0 ? "Incluido" : `+ ${money(price)}`}
                          </span>
                        </div>
                        {selected && <span className="text-[12px]">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </section>

              {!isTwoFlavorPizza(pizzaConfig.product) && (
                <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-[15px] font-semibold">Ingredientes extra</h3>
                      <p className="mt-0.5 text-[10px] text-white/35">Opcional</p>
                    </div>
                    <span className="text-[10px] text-white/35">
                      {pizzaConfig.modifierIds.length} seleccionados
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {catalog.modifiers.map((modifier) => {
                      const selected = pizzaConfig.modifierIds.includes(modifier.id);
                      return (
                        <button
                          key={modifier.id}
                          type="button"
                          onClick={() =>
                            setPizzaConfig({
                              ...pizzaConfig,
                              modifierIds: selected
                                ? pizzaConfig.modifierIds.filter((id) => id !== modifier.id)
                                : [...pizzaConfig.modifierIds, modifier.id],
                            })
                          }
                          className={`flex min-h-[58px] items-center justify-between gap-2 rounded-[14px] border px-3 py-2.5 text-left transition ${selected ? "border-[#e21a22] bg-red-500/12 text-white" : "border-white/10 bg-black/25 text-white/65"}`}
                        >
                          <div className="min-w-0">
                            <b className="block truncate text-[11px]">{modifier.name}</b>
                            <span className="mt-1 block text-[10px] text-[#ff3439]">+ {money(modifier.basePrice)}</span>
                          </div>
                          <span>{selected ? "✓" : "+"}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[15px] font-semibold">Nota para cocina</h3>
                    <p className="mt-0.5 text-[10px] text-white/35">Opcional · máximo 120 caracteres</p>
                  </div>
                  <span className="text-[10px] text-white/30">{pizzaConfig.note.length}/120</span>
                </div>
                <input
                  value={pizzaConfig.note}
                  maxLength={120}
                  onChange={(event) =>
                    setPizzaConfig({ ...pizzaConfig, note: event.target.value })
                  }
                  placeholder="Ej. Ligera en salsa"
                  className="mt-3 h-11 w-full rounded-[14px] border border-white/10 bg-black/30 px-4 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[#e21a22]"
                />
              </section>

              {configError && (
                <p className="rounded-[14px] border border-red-500/20 bg-red-500/10 p-3 text-[11px] text-red-300">
                  {configError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#0c0c0c] p-4">
              <div>
                <span className="block text-[9px] uppercase tracking-[0.14em] text-white/35">Total</span>
                <b className="text-[20px] text-[#ff3439]">{money(pizzaPrice(pizzaConfig))}</b>
              </div>
              <button
                type="button"
                onClick={confirmPizza}
                className="rounded-full bg-[#e21a22] px-5 py-3 text-[11px] font-bold text-white"
              >
                {editingCartKey ? "Guardar cambios" : "Agregar al carrito"}
              </button>
            </div>
          </div>
        </div>
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
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#e21a22]">Producto</p>
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

            <div className="mx-5 overflow-hidden rounded-[20px] bg-[#0b0b0b]">
              <div className="aspect-square">
                {selectedProduct.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="h-full w-full object-cover" />
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
                {selectedProduct.type === "PIZZA_SINGLE" || isTwoFlavorPizza(selectedProduct) ? (
                  <button
                    type="button"
                    onClick={() => startAdd(selectedProduct)}
                    className="rounded-full bg-[#e21a22] px-4 py-2.5 text-[10px] font-bold text-white transition hover:bg-[#ef1c25]"
                  >
                    Configurar pizza
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
