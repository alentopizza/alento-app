"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ProductType = "STANDARD" | "PIZZA_SINGLE" | "PIZZA_TWO_FLAVORS" | "COMBO" | "MODIFIER" | "INTERNAL";
type PizzaSize = { id: number; name: string; diameterCm: number; basePrice: number };

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
};

type PublicHomeBanner = {
  active: boolean;
  imageUrl: string;
  productId: number | null;
};

type PublicHomeSettings = {
  brand: {
    logoUrl: string;
  };
  primaryBanner: PublicHomeBanner;
  secondaryBanner: PublicHomeBanner;
};

const EMPTY_PUBLIC_HOME: PublicHomeSettings = {
  brand: { logoUrl: "" },
  primaryBanner: { active: false, imageUrl: "", productId: null },
  secondaryBanner: { active: false, imageUrl: "", productId: null },
};

const FALLBACK_LOGO = "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

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

function categoryIcon(slug: string) {
  if (slug.includes("pizza")) return "🍕";
  if (slug.includes("combo")) return "🍱";
  if (slug.includes("antojo")) return "🥖";
  if (slug.includes("bebida")) return "🥤";
  if (slug.includes("ingrediente")) return "🧀";
  if (slug.includes("destacado")) return "🔥";
  return "🍽️";
}

export default function PublicAppPage() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [publicHome, setPublicHome] = useState<PublicHomeSettings>(EMPTY_PUBLIC_HOME);

  useEffect(() => {
    async function load() {
      try {
        const [catalogResponse, publicHomeResponse] = await Promise.all([
          fetch("/api/catalog", { cache: "no-store" }),
          fetch("/api/public-home", { cache: "no-store" }),
        ]);

        const data = await catalogResponse.json();
        if (!catalogResponse.ok) throw new Error(data.error || "No fue posible cargar el menú.");

        setCatalog(data);

        const preferred =
          data.categories?.find((category: CatalogCategory) => category.slug === "destacados") ??
          data.categories?.find((category: CatalogCategory) => category.products.length > 0) ??
          data.categories?.[0];

        if (preferred) setActiveCategory(preferred.slug);

        if (publicHomeResponse.ok) {
          const home = await publicHomeResponse.json();
          if (home?.settings) setPublicHome(home.settings);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el menú.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const categories = useMemo(
    () => (catalog?.categories ?? []).filter((category) => category.slug !== "ingredientes" && category.products.length > 0),
    [catalog],
  );

  const selectedCategory = useMemo(
    () => categories.find((category) => category.slug === activeCategory) ?? categories[0],
    [categories, activeCategory],
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

  const visibleProducts = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("es");
    if (!value) return selectedCategory?.products ?? [];

    return allProducts.filter((product) =>
      `${product.name} ${product.description ?? ""}`.toLocaleLowerCase("es").includes(value),
    );
  }, [query, selectedCategory, allProducts]);

  const featuredProducts = useMemo(() => {
    const featuredCategory = categories.find((category) => category.slug === "destacados");
    return (featuredCategory?.products.length
      ? featuredCategory.products
      : allProducts.filter((product) => product.featured)
    ).slice(0, 8);
  }, [categories, allProducts]);

  const heroProduct = featuredProducts[0] ?? allProducts[0] ?? null;
  const primaryBannerProduct = publicHome.primaryBanner.productId
    ? allProducts.find((product) => product.id === publicHome.primaryBanner.productId) ?? null
    : null;
  const secondaryBannerProduct = publicHome.secondaryBanner.productId
    ? allProducts.find((product) => product.id === publicHome.secondaryBanner.productId) ?? null
    : null;

  function displayPrice(product: CatalogProduct) {
    const minSize = catalog?.sizes.length
      ? Math.min(...catalog.sizes.map((size) => size.basePrice))
      : 0;

    if (isTwoFlavorPizza(product)) {
      const flavorPrices = catalog?.pizzaFlavors.map((flavor) => flavor.basePrice ?? 0) ?? [];
      return `Desde ${money(minSize + (flavorPrices.length ? Math.min(...flavorPrices) : 0))}`;
    }

    if (product.type === "PIZZA_SINGLE") {
      return `Desde ${money(minSize + (product.basePrice ?? 0))}`;
    }

    if (product.type === "COMBO") {
      return product.basePrice != null ? `Desde ${money(product.basePrice)}` : "Configurable";
    }

    return product.basePrice == null ? "Consultar" : money(product.basePrice);
  }

  function openCategory(slug: string) {
    setActiveCategory(slug);
    setQuery("");
    requestAnimationFrame(() => {
      document.getElementById("menu-publico")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function scrollMenu() {
    document.getElementById("menu-publico")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="min-h-screen bg-[#f6f1e9] pb-28 text-[#161311]">
      <div className="mx-auto min-h-screen w-full max-w-[760px] bg-[#fffaf3] px-4 pb-10 pt-4 shadow-[0_0_55px_rgba(73,45,20,.06)] sm:px-6">
        <header className="relative flex min-h-[72px] items-center justify-between">
          <button
            type="button"
            onClick={scrollMenu}
            className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-black/[0.035] bg-white text-neutral-800 shadow-[0_8px_24px_rgba(52,32,18,.07)] transition active:scale-95"
            aria-label="Abrir menú"
          >
            <svg viewBox="0 0 24 24" className="h-[20px] w-[20px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <div className="pointer-events-none absolute inset-x-[66px] top-1/2 flex -translate-y-1/2 justify-center">
            {publicHome.brand.logoUrl ? (
              <img
                src={publicHome.brand.logoUrl}
                alt="Alentó Pizza"
                className="h-[54px] w-full max-w-[170px] object-contain sm:max-w-[190px]"
              />
            ) : (
              <div className="flex items-center justify-center gap-2.5">
                <img src={FALLBACK_LOGO} alt="Alentó Pizza" className="h-11 w-11 rounded-xl object-cover" />
                <div className="text-left">
                  <b className="block text-[18px] leading-5 tracking-[-0.03em]">Alentó Pizza</b>
                  <span className="text-[7px] font-bold uppercase tracking-[0.13em] text-neutral-400">Sabor que te hace volver</span>
                </div>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => document.getElementById("populares")?.scrollIntoView({ behavior: "smooth" })}
              className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-black/[0.035] bg-white text-neutral-800 shadow-[0_8px_24px_rgba(52,32,18,.07)] transition active:scale-95"
              aria-label="Ver favoritos"
            >
              <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 5.9l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.3 1-1a5.5 5.5 0 0 0 0-7.8Z" />
              </svg>
            </button>

            <Link
              href="/cuenta"
              className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-black/[0.035] bg-white text-neutral-800 shadow-[0_8px_24px_rgba(52,32,18,.07)] transition active:scale-95"
              aria-label="Mi cuenta"
            >
              <svg viewBox="0 0 24 24" className="h-[20px] w-[20px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" />
              </svg>
            </Link>
          </div>
        </header>

        <div className="mt-3 flex items-center gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[18px] border border-black/[0.035] bg-white px-4 py-3.5 shadow-[0_10px_28px_rgba(52,32,18,.055)]">
            <svg viewBox="0 0 24 24" className="h-[19px] w-[19px] shrink-0 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="6" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busca tu pizza favorita..."
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-neutral-800 outline-none placeholder:font-normal placeholder:text-neutral-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-[14px] text-neutral-500"
                aria-label="Limpiar búsqueda"
              >
                ×
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={scrollMenu}
            className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[18px] border border-black/[0.035] bg-white text-neutral-800 shadow-[0_10px_28px_rgba(52,32,18,.055)] transition active:scale-95"
            aria-label="Explorar menú"
          >
            <svg viewBox="0 0 24 24" className="h-[20px] w-[20px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h7M15 17h5" />
              <circle cx="16" cy="7" r="1.7" fill="white" />
              <circle cx="10" cy="12" r="1.7" fill="white" />
              <circle cx="13" cy="17" r="1.7" fill="white" />
            </svg>
          </button>
        </div>

        {!query && publicHome.primaryBanner.active && publicHome.primaryBanner.imageUrl ? (
          <button
            type="button"
            onClick={() => primaryBannerProduct && setSelectedProduct(primaryBannerProduct)}
            className="group mt-5 block w-full overflow-hidden rounded-[27px] bg-neutral-950 text-left shadow-[0_18px_45px_rgba(45,29,17,.14)]"
            aria-label={primaryBannerProduct ? `Abrir ${primaryBannerProduct.name}` : "Banner principal"}
          >
            <div className="aspect-[1.92/1] w-full overflow-hidden">
              <img
                src={publicHome.primaryBanner.imageUrl}
                alt={primaryBannerProduct?.name || "Promoción Alentó Pizza"}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.01]"
              />
            </div>
          </button>
        ) : heroProduct ? (
          <button
            type="button"
            onClick={() => setSelectedProduct(heroProduct)}
            className="relative mt-5 block aspect-[1.92/1] w-full overflow-hidden rounded-[27px] bg-[#18110f] text-left shadow-[0_18px_45px_rgba(45,29,17,.14)]"
          >
            {heroProduct.imageUrl && (
              <img src={heroProduct.imageUrl} alt={heroProduct.name} className="absolute inset-0 h-full w-full object-cover opacity-75" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
            <div className="relative flex h-full max-w-[58%] flex-col justify-center p-5 text-white">
              <span className="w-fit rounded-full bg-[#d4171b] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.08em]">Recomendado</span>
              <h1 className="mt-3 text-[27px] font-black leading-[.95] tracking-[-0.04em]">{heroProduct.name}</h1>
              <span className="mt-3 text-[11px] font-semibold">{displayPrice(heroProduct)}</span>
            </div>
          </button>
        ) : null}

        <div className="alento-scroll mt-6 flex gap-4 overflow-x-auto pb-2">
          {categories.slice(0, 8).map((category) => {
            const active = category.slug === selectedCategory?.slug && !query;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => openCategory(category.slug)}
                className="flex min-w-[66px] shrink-0 flex-col items-center gap-2 text-center"
              >
                <span className={`flex h-[58px] w-[58px] items-center justify-center overflow-hidden rounded-full border-2 bg-white text-2xl shadow-sm ${active ? "border-[#d4171b]" : "border-[#efe7dc]"}`}>
                  {category.imageUrl ? (
                    <img src={category.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    categoryIcon(category.slug)
                  )}
                </span>
                <span className={`max-w-[70px] truncate text-[10px] font-semibold ${active ? "text-[#d4171b]" : "text-neutral-700"}`}>
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="mt-7 rounded-[24px] bg-white p-8 text-center text-sm text-neutral-400">Cargando menú...</div>
        ) : error ? (
          <div className="mt-7 rounded-[24px] border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700">{error}</div>
        ) : (
          <>
            {!query && featuredProducts.length > 0 && (
              <section id="populares" className="mt-7">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">Lo más pedido</p>
                    <h2 className="mt-1 text-[22px] font-black tracking-[-0.03em]">Populares</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCategory(categories.find((category) => category.slug === "destacados")?.slug ?? categories[0]?.slug)}
                    className="text-[11px] font-bold text-[#b5161a]"
                  >
                    Ver todos →
                  </button>
                </div>

                <div className="alento-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
                  {featuredProducts.map((product) => (
                    <PopularProductCard
                      key={product.id}
                      product={product}
                      price={displayPrice(product)}
                      onOpen={() => setSelectedProduct(product)}
                    />
                  ))}
                </div>
              </section>
            )}

            {!query && publicHome.secondaryBanner.active && publicHome.secondaryBanner.imageUrl && (
              <button
                type="button"
                onClick={() => secondaryBannerProduct && setSelectedProduct(secondaryBannerProduct)}
                className="group mt-6 block w-full overflow-hidden rounded-[22px] bg-neutral-950 text-left shadow-[0_14px_35px_rgba(45,29,17,.11)]"
                aria-label={secondaryBannerProduct ? `Abrir ${secondaryBannerProduct.name}` : "Banner secundario"}
              >
                <div className="aspect-[3.9/1] w-full overflow-hidden">
                  <img
                    src={publicHome.secondaryBanner.imageUrl}
                    alt={secondaryBannerProduct?.name || "Promoción Alentó Pizza"}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.01]"
                  />
                </div>
              </button>
            )}

            <section id="menu-publico" className="scroll-mt-4 pt-8">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">{query ? "Resultados" : "Nuestro menú"}</p>
                  <h2 className="mt-1 text-[22px] font-black tracking-[-0.03em]">
                    {query ? `Resultados para “${query}”` : selectedCategory?.name || "Productos"}
                  </h2>
                </div>
                <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-neutral-500 shadow-sm">
                  {visibleProducts.length}
                </span>
              </div>

              {visibleProducts.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {visibleProducts.map((product) => (
                    <PublicProductCard
                      key={product.id}
                      product={product}
                      price={displayPrice(product)}
                      onOpen={() => setSelectedProduct(product)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-[22px] bg-white p-8 text-center shadow-sm">
                  <b className="text-sm">No encontramos ese producto</b>
                  <p className="mt-1 text-[11px] text-neutral-500">Prueba con otro nombre o explora una categoría.</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#eadfd5] bg-[#fffdf9]/96 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_34px_rgba(47,26,12,.08)] backdrop-blur-xl">
        <div className="mx-auto grid max-w-[620px] grid-cols-5 items-end">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex flex-col items-center gap-1 text-[#c81317]">
            <span className="text-lg">⌂</span><span className="text-[9px] font-bold">Inicio</span>
          </button>
          <button type="button" onClick={scrollMenu} className="flex flex-col items-center gap-1 text-neutral-600">
            <span className="text-lg">▦</span><span className="text-[9px] font-medium">Menú</span>
          </button>
          <button
            type="button"
            onClick={scrollMenu}
            className="-mt-7 flex flex-col items-center gap-1 text-[#c81317]"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#df241f] text-xl text-white shadow-[0_12px_28px_rgba(223,36,31,.30)]">🛍</span>
            <span className="text-[9px] font-bold">Pedir</span>
          </button>
          <button
            type="button"
            onClick={() => openCategory(categories.find((category) => category.slug === "destacados")?.slug ?? categories[0]?.slug)}
            className="flex flex-col items-center gap-1 text-neutral-600"
          >
            <span className="text-lg">◇</span><span className="text-[9px] font-medium">Ofertas</span>
          </button>
          <Link href="/cuenta" className="flex flex-col items-center gap-1 text-neutral-600">
            <span className="text-lg">○</span><span className="text-[9px] font-medium">Cuenta</span>
          </Link>
        </div>
      </nav>

      {selectedProduct && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProduct(null);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-t-[30px] bg-white shadow-2xl sm:rounded-[30px]">
            <div className="aspect-[4/3] overflow-hidden bg-[#faf7f2]">
              {selectedProduct.imageUrl ? (
                <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="h-full w-full object-contain p-3" />
              ) : (
                <div className="flex h-full items-center justify-center text-7xl">🍕</div>
              )}
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#c81317]">
                    {selectedProduct.type === "COMBO" ? "Combo" : selectedProduct.type.includes("PIZZA") ? "Pizza" : "Producto"}
                  </p>
                  <h3 className="mt-1 text-[25px] font-semibold tracking-[-0.035em]">{selectedProduct.name}</h3>
                </div>
                <button type="button" onClick={() => setSelectedProduct(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm">×</button>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-neutral-500">{selectedProduct.description || "Producto Alentó Pizza."}</p>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                <b className="text-[18px] font-semibold text-[#c81317]">{displayPrice(selectedProduct)}</b>
                <span className="rounded-full bg-neutral-950 px-4 py-2.5 text-[10px] font-semibold text-white">Configurador próximamente</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PopularProductCard({
  product,
  price,
  onOpen,
}: {
  product: CatalogProduct;
  price: string;
  onOpen: () => void;
}) {
  return (
    <article className="w-[165px] shrink-0 overflow-hidden rounded-[20px] bg-white shadow-[0_10px_28px_rgba(61,35,18,.07)] sm:w-[190px]">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-[1.18/1] overflow-hidden bg-[#faf7f2]">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-2" />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">🍕</div>
          )}
          {product.featured && (
            <span className="absolute left-2 top-2 rounded-full bg-[#d4171b] px-2 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-white">
              Popular
            </span>
          )}
          <span className="absolute right-2 top-2 text-lg text-neutral-400">♡</span>
        </div>
        <div className="p-3">
          <h3 className="line-clamp-2 min-h-[34px] text-[12px] font-black leading-[17px]">{product.name}</h3>
          <p className="mt-1 line-clamp-2 min-h-[28px] text-[9px] leading-[14px] text-neutral-400">
            {product.description || "Preparado al momento con el sabor de Alentó."}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <b className="truncate text-[12px] text-neutral-950">{price}</b>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#df241f] text-lg text-white">+</span>
          </div>
        </div>
      </button>
    </article>
  );
}

function PublicProductCard({
  product,
  price,
  onOpen,
}: {
  product: CatalogProduct;
  price: string;
  onOpen: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-[20px] bg-white shadow-[0_9px_25px_rgba(61,35,18,.06)]">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="aspect-square overflow-hidden bg-[#faf7f2]">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.02]" />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">🍕</div>
          )}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-2 min-h-[34px] text-[12px] font-black leading-[17px]">{product.name}</h3>
          <div className="mt-3 flex items-center justify-between gap-2">
            <b className="min-w-0 truncate text-[11px] font-bold text-[#c81317]">{price}</b>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#df241f] text-base text-white">+</span>
          </div>
        </div>
      </button>
    </article>
  );
}
