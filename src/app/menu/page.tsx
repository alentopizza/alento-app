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
  menuHero?: { active: boolean; imageUrl: string };
};

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
    return (
    <main className="min-h-screen bg-[#090909] text-white">
      <section className="min-h-screen bg-[#090909]">
        <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-black/95 shadow-[0_12px_34px_rgba(0,0,0,.34)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#d71920]/45 to-transparent" />

          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <div className="flex h-[72px] items-center justify-between gap-3 lg:h-[86px]">
              <Link href="/" className="group flex min-w-0 items-center">
                {homeLoaded ? (
                  <img
                    src={home?.brand?.logoUrl || FALLBACK_LOGO}
                    alt="Alentó Pizza"
                    className="h-[42px] w-[145px] object-contain object-left transition duration-200 group-hover:opacity-90 sm:h-[48px] sm:w-[175px] lg:h-[54px] lg:w-[210px]"
                  />
                ) : (
                  <span className="block h-[42px] w-[145px] sm:h-[48px] sm:w-[175px] lg:h-[54px] lg:w-[210px]" aria-hidden="true" />
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

              <Link
                href="/login"
                className="group relative shrink-0 overflow-hidden rounded-full bg-[#e21a22] px-4 py-3 text-[12px] font-extrabold tracking-[0.02em] text-white shadow-[0_10px_26px_rgba(226,26,34,.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#ef1c25] sm:px-5 sm:text-[13px] lg:px-7 lg:py-3.5 lg:text-[14px]"
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
                  <span className="hidden xs:inline sm:inline">Mi Cuenta</span>
                  <span className="sm:hidden">Cuenta</span>
                </span>
              </Link>
            </div>

            <nav className="flex h-[44px] items-center justify-center gap-7 border-t border-white/[0.05] md:hidden">
              <Link href="/" className="text-[12px] font-medium text-white/62">
                Home
              </Link>
              <Link
                href="/menu"
                className="relative flex h-full items-center text-[12px] font-semibold text-white after:absolute after:inset-x-0 after:bottom-0 after:mx-auto after:h-[2px] after:w-6 after:bg-[#e21a22] after:content-['']"
              >
                Menú
              </Link>
              <span className="text-[12px] font-medium text-white/62">Club De La Pizza</span>
            </nav>
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
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e21a22] text-[17px] font-semibold leading-none text-white shadow-[0_6px_16px_rgba(226,26,34,.24)] lg:h-9 lg:w-9 lg:text-[18px]">
                      +
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section id="catalogo-menu" className="mx-auto max-w-[1320px] px-3 pb-20 sm:px-5 lg:px-8">
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
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e21a22] text-[17px] font-semibold leading-none text-white shadow-[0_6px_16px_rgba(226,26,34,.24)] lg:h-9 lg:w-9 lg:text-[18px]">
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
          className="fixed bottom-5 right-4 z-[80] flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#111] text-white shadow-[0_12px_30px_rgba(0,0,0,.42)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#e21a22] sm:bottom-6 sm:right-5 lg:bottom-7 lg:right-7 lg:h-12 lg:w-12"
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
                <span className="rounded-full bg-[#e21a22] px-4 py-2.5 text-[10px] font-bold text-white">
                  Configurador próximamente
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
