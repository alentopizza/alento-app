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
type PublicHomeSettings = {
  brand: { logoUrl: string };
  primaryBanner: { active: boolean; imageUrl: string; productId: number | null };
  secondaryBanner: { active: boolean; imageUrl: string; productId: number | null };
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

export default function App2MenuPage() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [home, setHome] = useState<PublicHomeSettings | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);

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
            catalogData.categories?.find((category: CatalogCategory) => category.slug === "destacados") ??
            catalogData.categories?.find((category: CatalogCategory) => category.products.length > 0);
          if (first) setActiveCategory(first.slug);
        }

        if (homeResponse.ok) {
          const homeData = await homeResponse.json();
          setHome(homeData?.settings ?? null);
        }
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
        `${product.name} ${product.description ?? ""}`.toLocaleLowerCase("es").includes(value),
      );
    }

    return categories.find((category) => category.slug === activeCategory)?.products ?? allProducts;
  }, [activeCategory, allProducts, categories, query]);

  function displayPrice(product: CatalogProduct) {
    const minSize = catalog?.sizes.length
      ? Math.min(...catalog.sizes.map((size) => size.basePrice))
      : 0;

    if (isTwoFlavorPizza(product)) {
      const flavorPrices = catalog?.pizzaFlavors.map((flavor) => flavor.basePrice ?? 0) ?? [];
      return money(minSize + (flavorPrices.length ? Math.min(...flavorPrices) : 0));
    }

    if (product.type === "PIZZA_SINGLE") {
      return money(minSize + (product.basePrice ?? 0));
    }

    if (product.type === "COMBO") {
      return product.basePrice != null ? money(product.basePrice) : "Configurable";
    }

    return product.basePrice == null ? "Consultar" : money(product.basePrice);
  }

  return (
    <main className="min-h-screen bg-[#eef7f2] pb-24 text-[#101410]">
      <div className="mx-auto min-h-screen w-full max-w-[760px] bg-[linear-gradient(180deg,#eaffc5_0px,#f5fff9_210px,#f7faf8_420px)] px-4 pb-10 pt-[max(18px,env(safe-area-inset-top))] sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80 text-lg shadow-sm backdrop-blur"
              aria-label="Volver"
            >
              ←
            </Link>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-black/35">Alentó Pizza</p>
              <b className="block truncate text-[17px] font-black tracking-[-0.025em]">¿Qué se te antoja hoy?</b>
            </div>
          </div>

          <Link
            href="/cuenta"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm backdrop-blur"
            aria-label="Mi cuenta"
          >
            ○
          </Link>
        </header>

        <div className="mt-5 flex items-center gap-3 rounded-[18px] bg-white/85 px-4 py-3.5 shadow-[0_10px_26px_rgba(45,78,40,.07)] backdrop-blur">
          <span className="text-lg">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar pizzas, combos, bebidas..."
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-black/35"
          />
          <span className="text-lg">≡</span>
        </div>

        <div className="alento-scroll mt-6 flex gap-5 overflow-x-auto border-b border-black/5 pb-2">
          {categories.map((category) => {
            const active = category.slug === activeCategory && !query;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setActiveCategory(category.slug);
                  setQuery("");
                }}
                className={`relative shrink-0 pb-2 text-[11px] font-black ${active ? "text-black" : "text-black/42"}`}
              >
                {category.name}
                {active && <span className="absolute inset-x-0 -bottom-[9px] mx-auto h-[3px] w-7 rounded-full bg-[#70de00]" />}
              </button>
            );
          })}
        </div>

        {home?.secondaryBanner.active && home.secondaryBanner.imageUrl && !query && (
          <div className="mt-5 overflow-hidden rounded-[22px] bg-white p-1.5 shadow-sm">
            <img
              src={home.secondaryBanner.imageUrl}
              alt="Promoción Alentó Pizza"
              className="aspect-[3.9/1] w-full rounded-[18px] object-cover"
            />
          </div>
        )}

        <section className="pt-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-black/30">
                {query ? "Resultados" : "Explora"}
              </p>
              <h1 className="mt-1 text-[24px] font-black tracking-[-0.035em]">
                {query
                  ? "Lo que encontramos"
                  : categories.find((category) => category.slug === activeCategory)?.name || "Menú"}
              </h1>
            </div>
            <span className="rounded-full bg-black px-2.5 py-1 text-[9px] font-black text-white">
              {activeProducts.length}
            </span>
          </div>

          {loading ? (
            <div className="rounded-[24px] bg-white p-8 text-center text-sm text-black/35">Cargando menú...</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {activeProducts.map((product, index) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSelectedProduct(product)}
                  className={`relative min-h-[235px] overflow-hidden rounded-[24px] p-3 text-left shadow-[0_12px_26px_rgba(45,78,40,.08)] ${index % 4 === 0 ? "bg-[#fff0df]" : index % 4 === 1 ? "bg-[#e7f8d9]" : index % 4 === 2 ? "bg-[#f5e7eb]" : "bg-[#fff5c9]"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <b className="line-clamp-2 block text-[12px] font-black leading-[16px]">{product.name}</b>
                      <span className="mt-1 block text-[10px] font-black text-black/70">{displayPrice(product)}</span>
                    </div>
                    <span className="shrink-0 text-lg">♡</span>
                  </div>

                  <div className="mt-2 flex h-[150px] items-center justify-center">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="max-h-full max-w-full object-contain drop-shadow-[0_14px_12px_rgba(0,0,0,.10)]" />
                    ) : (
                      <span className="text-6xl">🍕</span>
                    )}
                  </div>

                  <span className="absolute bottom-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm text-white">
                    →
                  </span>

                  {product.featured && (
                    <span className="absolute bottom-3 right-3 -rotate-6 rounded-full border border-white/70 bg-white/65 px-2 py-1 text-[8px] font-black uppercase backdrop-blur">
                      Popular
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <div className="mx-auto grid max-w-[600px] grid-cols-4">
          <Link href="/" className="flex flex-col items-center gap-1 text-black/45">
            <span className="text-lg">⌂</span><span className="text-[9px] font-bold">Inicio</span>
          </Link>
          <button type="button" className="flex flex-col items-center gap-1 text-[#64c900]">
            <span className="text-lg">▦</span><span className="text-[9px] font-black">Menú</span>
          </button>
          <button type="button" className="flex flex-col items-center gap-1 text-black/45">
            <span className="text-lg">♡</span><span className="text-[9px] font-bold">Favoritos</span>
          </button>
          <Link href="/cuenta" className="flex flex-col items-center gap-1 text-black/45">
            <span className="text-lg">○</span><span className="text-[9px] font-bold">Cuenta</span>
          </Link>
        </div>
      </nav>

      {selectedProduct && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProduct(null);
          }}
        >
          <div className="max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-2xl">
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-black/10" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#62c900]">Producto</p>
                <h2 className="mt-1 text-[25px] font-black tracking-[-0.035em]">{selectedProduct.name}</h2>
              </div>
              <button type="button" onClick={() => setSelectedProduct(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5">×</button>
            </div>

            <div className="mt-4 flex aspect-[4/3] items-center justify-center rounded-[24px] bg-[#f5f7f4] p-4">
              {selectedProduct.imageUrl ? (
                <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-7xl">🍕</span>
              )}
            </div>

            <p className="mt-4 text-[12px] leading-5 text-black/50">
              {selectedProduct.description || "Producto Alentó Pizza."}
            </p>

            <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4">
              <b className="text-[18px] font-black">{displayPrice(selectedProduct)}</b>
              <span className="rounded-full bg-black px-4 py-2.5 text-[10px] font-black text-white">Configurador próximamente</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
