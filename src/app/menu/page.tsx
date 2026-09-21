"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

type CartItem = {
  key: string;
  productId: number;
  name: string;
  imageUrl: string | null;
  detail?: string;
  unitPrice: number;
  quantity: number;
  configuration?: OrderLineConfiguration;
  notes?: string;
};

type PizzaConfig = {
  product: CatalogProduct;
  sizeId: number | null;
  firstFlavorId: number | null;
  secondFlavorId: number | null;
  crustId: number | null;
  modifierIds: number[];
  note: string;
};

const CART_STORAGE_KEY = "alento-cart-v1";

const FALLBACK_LOGO = "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/ifBQewvReilKLfOzcpy4.png";
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
  const [cartOpen, setCartOpen] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const [pizzaConfig, setPizzaConfig] = useState<PizzaConfig | null>(null);
  const [editingCartKey, setEditingCartKey] = useState<string | null>(null);
  const [configError, setConfigError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [catalogResponse, homeResponse] = await Promise.all([
          fetch("/api/catalog", { cache: "no-store" }),
          fetch("/api/public-home", { cache: "no-store" }),
        ]);

        const catalogData = await catalogResponse.json();
        if (catalogResponse.ok) {
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
            catalogData.categories?.find((category: CatalogCategory) => category.products.length > 0);
          if (first) setActiveCategory(first.slug);
        }

        if (homeResponse.ok) {
          const homeData = await homeResponse.json();
          setHome(homeData?.settings ?? null);
        }
      } finally {
        setHomeLoaded(true);
        setLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 520);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } finally {
      setCartReady(true);
    }
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
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
    setCartOpen(true);
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
    setCartOpen(true);
  }

  function editCartPizza(item: CartItem) {
    if (!catalog || item.configuration?.kind !== "PIZZA") return;

    const product =
      allProducts.find((candidate) => candidate.id === item.productId) ??
      catalog.pizzaFlavors.find((candidate) => candidate.id === item.productId);

    if (!product) return;

    setCartOpen(false);
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

  function changeCartQuantity(key: string, delta: number) {
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

  function removeCartItem(key: string) {
    setCart((current) => current.filter((item) => item.key !== key));
  }

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <section className="min-h-screen bg-[#090909]">
        <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-black/95 shadow-[0_12px_34px_rgba(0,0,0,.34)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#d71920]/45 to-transparent" />

          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <div className="flex h-[68px] items-center justify-center md:h-[76px] md:justify-between lg:h-[86px]">
              <Link href="/" className="group flex min-w-0 items-center">
                {homeLoaded ? (
                  <img
                    src={home?.brand?.logoUrl || FALLBACK_LOGO}
                    alt="Alentó Pizza"
                    className="h-[42px] w-[150px] object-contain object-center transition duration-200 group-hover:opacity-90 md:h-[48px] md:w-[175px] md:object-left lg:h-[54px] lg:w-[210px]"
                  />
                ) : (
                  <span className="block h-[42px] w-[150px] md:h-[48px] md:w-[175px] lg:h-[54px] lg:w-[210px]" aria-hidden="true" />
                )}
              </Link>

              <nav className="hidden items-center gap-10 md:flex">
                <Link
                  href="/"
                  className="py-3 text-[14px] font-medium tracking-[0.015em] text-white/72 transition-colors hover:text-white"
                >
                  Home
                </Link>
                <Link
                  href="/menu"
                  className="relative py-3 text-[14px] font-medium tracking-[0.015em] text-white transition-colors after:absolute after:inset-x-0 after:bottom-0 after:mx-auto after:h-[2px] after:w-7 after:rounded-full after:bg-[#e21a22] after:content-['']"
                >
                  Menú
                </Link>
                <span
                  className="cursor-default py-3 text-[14px] font-medium tracking-[0.015em] text-white/72"
                  aria-disabled="true"
                >
                  Club De La Pizza
                </span>
              </nav>

              <div className="hidden items-center gap-3 md:flex">
                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] text-white/70 transition hover:border-[#e21a22]/60 hover:text-white"
                  aria-label={`Carrito con ${cartCount} productos`}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H7" />
                    <circle cx="10" cy="19" r="1.2" />
                    <circle cx="18" cy="19" r="1.2" />
                  </svg>
                  {cartCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#e21a22] px-1 text-[9px] font-black text-white">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </button>

              <Link
                href="/login"
                className="group relative hidden shrink-0 overflow-hidden rounded-full bg-[#e21a22] px-5 py-3 text-[13px] font-extrabold tracking-[0.02em] text-white shadow-[0_10px_26px_rgba(226,26,34,.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#ef1c25] md:flex lg:px-7 lg:py-3.5 lg:text-[14px]"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-[17px] w-[17px] lg:h-[18px] lg:w-[18px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" />
                  </svg>
                  Mi Cuenta
                </span>
              </Link>
              </div>
            </div>
          </div>
        </header>

        <section id="inicio-menu" className="relative overflow-hidden border-b border-white/10 bg-black">
          <div className="mx-auto w-full max-w-[1320px] overflow-hidden">
            {homeLoaded ? (
              <img
                src={home?.menuHero?.active && home.menuHero.imageUrl ? home.menuHero.imageUrl : DESKTOP_HERO_IMAGE}
                alt="Alentó Pizza"
                className="block aspect-[16/9] w-full object-cover object-center sm:aspect-[2/1] lg:aspect-[1920/730]"
              />
            ) : (
              <div className="aspect-[16/9] w-full bg-black sm:aspect-[2/1] lg:aspect-[1920/730]" aria-hidden="true" />
            )}
          </div>
        </section>

        <section id="categorias-menu" className="relative z-20 mx-auto -mt-5 max-w-[1180px] px-3 sm:-mt-7 sm:px-5 lg:-mt-10 lg:px-7">
          <div className="alento-scroll flex overflow-x-auto rounded-[18px] border border-black/10 bg-white text-[#111] shadow-[0_20px_54px_rgba(0,0,0,.25)] lg:overflow-hidden lg:rounded-[22px]">
            {categories.slice(0, 6).map((category) => {
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
                  className={`group relative flex min-h-[76px] min-w-[108px] flex-1 flex-col items-center justify-center gap-1 border-r border-neutral-200 px-2 text-center transition last:border-r-0 sm:min-w-[126px] lg:min-h-[86px] lg:min-w-0 lg:px-3 ${active ? "bg-[linear-gradient(180deg,#fff7f7,#ffeded)]" : "bg-white hover:bg-neutral-50"}`}
                >
                  {active && <span className="absolute inset-x-0 top-0 h-[3px] bg-[#d71920]" />}

                  <div className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-[20px] transition sm:h-10 sm:w-10 sm:text-[22px] lg:h-11 lg:w-11 lg:text-[24px] ${active ? "bg-white shadow-[0_5px_16px_rgba(215,25,32,.13)] ring-1 ring-red-100" : "bg-neutral-50"}`}>
                    {category.imageUrl ? (
                      <img src={category.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span>{categoryEmoji(category.slug)}</span>
                    )}
                  </div>

                  <span className={`max-w-[96px] truncate text-[9px] font-extrabold uppercase tracking-[0.01em] sm:text-[10px] lg:text-[11px] ${active ? "text-[#c6161c]" : "text-neutral-900"}`}>
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

        <section id="catalogo-menu" className="mx-auto max-w-[1320px] px-3 pb-32 sm:px-5 md:pb-20 lg:px-8">
          <div className="mb-5 flex flex-col gap-4 sm:mb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35 lg:text-[10px]">Catálogo</p>
              <h2 className="mt-1 text-[28px] font-black tracking-[-0.04em] text-white sm:text-[31px] lg:text-[34px]">
                {categories.find((category) => category.slug === activeCategory)?.name || "Menú"}
              </h2>
            </div>

            <div className="flex w-full items-center gap-3 rounded-full border border-white/12 bg-white/[0.05] px-4 py-3 md:w-[340px]">
              <span className="text-white/45">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar en el menú..."
                className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/25"
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

      <nav className="fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] z-[75] px-3 md:hidden">
        <div className="relative mx-auto h-[68px] max-w-[430px] rounded-[18px] border border-black/10 bg-white shadow-[0_18px_45px_rgba(0,0,0,.30)]">
          <div className="grid h-full grid-cols-5 items-center">
            <Link
              href="/"
              className="flex h-full items-center justify-center text-[#252525] transition active:scale-95"
              aria-label="Home"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m3 10 9-7 9 7" />
                <path d="M5 9.5V21h14V9.5" />
                <path d="M9 21v-7h6v7" />
              </svg>
            </Link>

            <Link
              href="/menu"
              className="relative flex h-full items-center justify-center"
              aria-label="Menú"
            >
              <span className="absolute -top-[24px] flex h-[62px] w-[62px] items-center justify-center rounded-full border-[6px] border-[#090909] bg-[#e21a22] text-white shadow-[0_10px_26px_rgba(226,26,34,.38)]">
                <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true">
                  <path d="M10 46 31 11c2-3 6-4 9-2 8 5 13 13 14 23 .4 3-2 6-5 7L15 51c-4 1-7-2-5-5Z" fill="currentColor"/>
                  <circle cx="37" cy="20" r="3.3" fill="#e21a22"/>
                  <circle cx="45" cy="29" r="3.3" fill="#e21a22"/>
                  <circle cx="29" cy="31" r="3.3" fill="#e21a22"/>
                  <path d="M15 48c10-1 23-6 35-12" fill="none" stroke="#e21a22" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative flex h-full items-center justify-center text-[#8d8d8d]"
              aria-label={`Carrito con ${cartCount} productos`}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H7" />
                <circle cx="10" cy="19" r="1.2" />
                <circle cx="18" cy="19" r="1.2" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute left-1/2 top-2 ml-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#e21a22] px-1 text-[9px] font-black text-white shadow-sm">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </button>

            <button
              type="button"
              className="flex h-full items-center justify-center text-[#8d8d8d]"
              aria-label="Club de la Pizza próximamente"
              title="Club de la Pizza próximamente"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m12 3 2.7 5.4 6 .9-4.35 4.2 1.03 5.95L12 16.65l-5.38 2.8 1.03-5.95L3.3 9.3l6-.9L12 3Z" />
              </svg>
            </button>

            <Link
              href="/cuenta"
              className="flex h-full items-center justify-center text-[#8d8d8d] transition active:scale-95"
              aria-label="Perfil"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" />
              </svg>
            </Link>
          </div>
        </div>
      </nav>

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

      {cartOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-stretch md:justify-end"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCartOpen(false);
          }}
        >
          <aside className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#111] text-white shadow-2xl md:h-full md:max-h-none md:w-[430px] md:rounded-none md:border-y-0 md:border-r-0">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#e21a22]">Tu pedido</p>
                <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.03em]">Carrito</h2>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70"
                aria-label="Cerrar carrito"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {cart.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.05] text-white/35">
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H7" />
                      <circle cx="10" cy="19" r="1.2" />
                      <circle cx="18" cy="19" r="1.2" />
                    </svg>
                  </div>
                  <b className="mt-4 text-[16px]">Tu carrito está vacío</b>
                  <p className="mt-1 max-w-[260px] text-[11px] leading-5 text-white/38">
                    Agrega productos desde el menú para comenzar las pruebas.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.key} className="flex gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
                      <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[14px] bg-black">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-3xl">🍕</div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <b className="line-clamp-2 text-[13px] font-semibold leading-4">{item.name}</b>
                            <span className="mt-1 block text-[12px] font-bold text-[#ff3439]">{money(item.unitPrice)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCartItem(item.key)}
                            className="text-[18px] leading-none text-white/30 transition hover:text-white/70"
                            aria-label={`Eliminar ${item.name}`}
                          >
                            ×
                          </button>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center rounded-full border border-white/10 bg-black/30">
                            <button
                              type="button"
                              onClick={() => changeCartQuantity(item.key, -1)}
                              className="flex h-8 w-8 items-center justify-center text-white/70"
                              aria-label="Disminuir cantidad"
                            >
                              −
                            </button>
                            <span className="min-w-7 text-center text-[12px] font-bold">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => changeCartQuantity(item.key, 1)}
                              className="flex h-8 w-8 items-center justify-center text-white/70"
                              aria-label="Aumentar cantidad"
                            >
                              +
                            </button>
                          </div>
                          <b className="text-[12px]">{money(item.unitPrice * item.quantity)}</b>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-[#0c0c0c] px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-white/45">Subtotal</span>
                <b className="text-[20px]">{money(cartSubtotal)}</b>
              </div>
              <p className="mt-1 text-[9px] text-white/28">Carrito de prueba · checkout aún no activo.</p>

              <button
                type="button"
                disabled
                className="mt-4 h-12 w-full rounded-full bg-[#e21a22] text-[12px] font-bold text-white opacity-55"
              >
                Continuar pedido · Próximamente
              </button>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="mt-2 h-9 w-full text-[10px] font-medium text-white/35 transition hover:text-white/65"
                >
                  Vaciar carrito
                </button>
              )}
            </div>
          </aside>
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
                {productPriceValue(selectedProduct) != null ? (
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
