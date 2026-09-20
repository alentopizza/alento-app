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

const LOGO = "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

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
  const [customerName, setCustomerName] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [catalogResponse, accountResponse] = await Promise.all([
          fetch("/api/catalog", { cache: "no-store" }),
          fetch("/api/auth/customer/me", { cache: "no-store" }),
        ]);

        const data = await catalogResponse.json();
        if (!catalogResponse.ok) throw new Error(data.error || "No fue posible cargar el menú.");

        setCatalog(data);

        const preferred =
          data.categories?.find((category: CatalogCategory) => category.slug === "destacados") ??
          data.categories?.find((category: CatalogCategory) => category.products.length > 0) ??
          data.categories?.[0];

        if (preferred) setActiveCategory(preferred.slug);

        if (accountResponse.ok) {
          const account = await accountResponse.json();
          setCustomerName(account?.customer?.name && account.customer.name !== "NUEVO" ? account.customer.name : "");
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
    return (featuredCategory?.products.length ? featuredCategory.products : allProducts.filter((product) => product.featured)).slice(0, 6);
  }, [categories, allProducts]);

  const heroProduct = featuredProducts[0] ?? allProducts[0] ?? null;
  const secondaryHero = featuredProducts[1] ?? allProducts[1] ?? heroProduct;

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
    requestAnimationFrame(() => document.getElementById("menu-publico")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <main className="min-h-screen bg-[#fff9f2] pb-24 text-[#17120f]">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 py-2">
          <button type="button" className="flex min-w-0 items-center gap-3" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-black/5 bg-black shadow-sm sm:h-14 sm:w-14">
              <img src={LOGO} alt="Alentó Pizza" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-[20px] font-semibold leading-6 tracking-[-0.03em] sm:text-[24px]">Alentó Pizza</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">Sabor Que Te Hace Volver.</p>
            </div>
          </button>

          <Link href="/cuenta" className="flex shrink-0 items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-950 text-[15px] text-white">◯</span>
            <span className="hidden text-left sm:block">
              <span className="block text-[9px] font-medium uppercase tracking-[0.1em] text-neutral-400">{customerName ? "Hola" : "Acceso"}</span>
              <b className="block max-w-[110px] truncate text-[11px] font-semibold">{customerName || "Cuenta"}</b>
            </span>
          </Link>
        </header>

        <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-[#eadfd5] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(60,35,15,.05)]">
          <span className="text-xl text-neutral-500">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca pizzas, combos, antojos..."
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-neutral-400"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold text-neutral-500">
              Limpiar
            </button>
          )}
        </div>

        <div className="alento-scroll mt-5 flex gap-3 overflow-x-auto pb-2">
          {categories.map((category) => {
            const active = category.slug === selectedCategory?.slug && !query;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => openCategory(category.slug)}
                className="flex min-w-[78px] shrink-0 flex-col items-center gap-2"
              >
                <span className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border text-2xl shadow-sm transition ${active ? "border-[#c81317] bg-[#c81317] text-white" : "border-[#eadfd5] bg-white"}`}>
                  {category.imageUrl ? <img src={category.imageUrl} alt="" className="h-full w-full object-cover" /> : categoryIcon(category.slug)}
                </span>
                <span className={`max-w-[82px] truncate text-[11px] font-semibold ${active ? "text-[#c81317]" : "text-neutral-700"}`}>{category.name}</span>
                {active && <span className="h-0.5 w-8 rounded-full bg-[#c81317]" />}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="mt-8 rounded-[28px] border border-[#eadfd5] bg-white p-10 text-center text-sm text-neutral-400">Cargando menú...</div>
        ) : error ? (
          <div className="mt-8 rounded-[28px] border border-red-100 bg-red-50 p-8 text-center text-sm text-red-700">{error}</div>
        ) : (
          <>
            {!query && heroProduct && (
              <section className="relative mt-4 min-h-[300px] overflow-hidden rounded-[30px] bg-[#15100e] shadow-[0_24px_60px_rgba(61,24,7,.18)] sm:min-h-[360px]">
                {heroProduct.imageUrl && (
                  <img src={heroProduct.imageUrl} alt={heroProduct.name} className="absolute inset-0 h-full w-full object-cover opacity-75 sm:object-contain sm:object-right" />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,8,7,.98)_0%,rgba(13,8,7,.82)_42%,rgba(13,8,7,.20)_78%,rgba(13,8,7,.08)_100%)]" />
                <div className="relative z-10 flex min-h-[300px] max-w-[580px] flex-col justify-end p-6 text-white sm:min-h-[360px] sm:p-9">
                  <span className="w-fit rounded-full bg-[#c81317] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]">Recomendado Alentó</span>
                  <h1 className="mt-4 max-w-[500px] text-[36px] font-semibold leading-[0.95] tracking-[-0.045em] sm:text-[52px]">{heroProduct.name}</h1>
                  <p className="mt-3 max-w-[450px] line-clamp-2 text-[13px] leading-5 text-white/70">{heroProduct.description || "Preparado con el sabor que te hace volver."}</p>
                  <div className="mt-5 flex items-center gap-3">
                    <button type="button" onClick={() => setSelectedProduct(heroProduct)} className="rounded-full bg-[#d31418] px-5 py-3 text-[12px] font-semibold text-white shadow-[0_10px_28px_rgba(211,20,24,.28)]">Ver producto</button>
                    <b className="text-[13px] font-semibold text-white/90">{displayPrice(heroProduct)}</b>
                  </div>
                </div>
              </section>
            )}

            {!query && featuredProducts.length > 0 && (
              <section className="mt-8">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#c81317]">Lo más pedido</p>
                    <h2 className="mt-1 text-[28px] font-semibold tracking-[-0.035em]">Populares 🔥</h2>
                  </div>
                  <button type="button" onClick={() => openCategory(categories.find((category) => category.slug === "destacados")?.slug ?? categories[0]?.slug)} className="text-[11px] font-semibold text-[#c81317]">Ver todos →</button>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {featuredProducts.slice(0, 4).map((product) => (
                    <PublicProductCard key={product.id} product={product} price={displayPrice(product)} onOpen={() => setSelectedProduct(product)} />
                  ))}
                </div>
              </section>
            )}

            {!query && secondaryHero && secondaryHero.id !== heroProduct?.id && (
              <section className="relative mt-8 overflow-hidden rounded-[28px] bg-[#17110f] p-6 text-white shadow-[0_18px_46px_rgba(61,24,7,.14)] sm:p-8">
                {secondaryHero.imageUrl && <img src={secondaryHero.imageUrl} alt="" className="absolute inset-y-0 right-0 h-full w-[58%] object-cover opacity-65" />}
                <div className="absolute inset-0 bg-[linear-gradient(90deg,#17110f_0%,#17110f_44%,rgba(23,17,15,.45)_75%,rgba(23,17,15,.08)_100%)]" />
                <div className="relative max-w-[500px]">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#ffbd54]">Plan recomendado</span>
                  <h3 className="mt-2 text-[28px] font-semibold leading-8 tracking-[-0.03em]">{secondaryHero.name}</h3>
                  <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-white/65">{secondaryHero.description || "Buena comida. Mejores planes."}</p>
                  <button type="button" onClick={() => setSelectedProduct(secondaryHero)} className="mt-4 rounded-full bg-[#d31418] px-4 py-2.5 text-[11px] font-semibold">Ver opción →</button>
                </div>
              </section>
            )}

            <section id="menu-publico" className="scroll-mt-4 pt-9">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-neutral-400">{query ? "Resultados" : "Menú"}</p>
                  <h2 className="mt-1 text-[27px] font-semibold tracking-[-0.035em]">{query ? `Resultados para “${query}”` : selectedCategory?.name || "Productos"}</h2>
                </div>
                <span className="rounded-full border border-[#eadfd5] bg-white px-3 py-1.5 text-[10px] font-medium text-neutral-500">{visibleProducts.length} productos</span>
              </div>

              {visibleProducts.length ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {visibleProducts.map((product) => (
                    <PublicProductCard key={product.id} product={product} price={displayPrice(product)} onOpen={() => setSelectedProduct(product)} />
                  ))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-[#eadfd5] bg-white p-8 text-center">
                  <b className="text-[15px] font-semibold">No encontramos ese producto</b>
                  <p className="mt-1 text-[11px] text-neutral-500">Prueba con otro nombre o explora una categoría.</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#eadfd5] bg-[#fffdf9]/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_34px_rgba(47,26,12,.08)] backdrop-blur-xl">
        <div className="mx-auto grid max-w-[620px] grid-cols-5">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex flex-col items-center gap-1 text-[#c81317]">
            <span className="text-lg">⌂</span><span className="text-[9px] font-semibold">Inicio</span>
          </button>
          <button type="button" onClick={() => document.getElementById("menu-publico")?.scrollIntoView({ behavior: "smooth" })} className="flex flex-col items-center gap-1 text-neutral-600">
            <span className="text-lg">🍕</span><span className="text-[9px] font-medium">Menú</span>
          </button>
          <button type="button" onClick={() => openCategory(categories.find((category) => category.slug === "destacados")?.slug ?? categories[0]?.slug)} className="flex flex-col items-center gap-1 text-neutral-600">
            <span className="text-lg">◇</span><span className="text-[9px] font-medium">Ofertas</span>
          </button>
          <Link href="/cuenta" className="flex flex-col items-center gap-1 text-neutral-600">
            <span className="text-lg">▤</span><span className="text-[9px] font-medium">Pedidos</span>
          </Link>
          <Link href="/cuenta" className="flex flex-col items-center gap-1 text-neutral-600">
            <span className="text-lg">○</span><span className="text-[9px] font-medium">Cuenta</span>
          </Link>
        </div>
      </nav>

      {selectedProduct && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedProduct(null);
        }}>
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
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#c81317]">{selectedProduct.type === "COMBO" ? "Combo" : selectedProduct.type.includes("PIZZA") ? "Pizza" : "Producto"}</p>
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
    <article className="group overflow-hidden rounded-[22px] border border-[#eadfd5] bg-white shadow-[0_10px_30px_rgba(61,35,18,.06)]">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="aspect-square overflow-hidden bg-[#faf7f2]">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-1.5 transition duration-300 group-hover:scale-[1.02]" />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">🍕</div>
          )}
        </div>
        <div className="p-3.5">
          <h3 className="line-clamp-2 min-h-[38px] text-[14px] font-semibold leading-[19px] tracking-[-0.015em]">{product.name}</h3>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
            <b className="min-w-0 truncate text-[12px] font-semibold text-[#c81317]">{price}</b>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d31418] text-lg font-medium text-white shadow-[0_8px_18px_rgba(211,20,24,.22)]">+</span>
          </div>
        </div>
      </button>
    </article>
  );
}
