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

function categoryEmoji(slug: string) {
  if (slug.includes("pizza")) return "🍕";
  if (slug.includes("combo")) return "🍱";
  if (slug.includes("antojo")) return "🥖";
  if (slug.includes("bebida")) return "🥤";
  if (slug.includes("postre")) return "🍰";
  if (slug.includes("destacado")) return "🔥";
  return "🍽️";
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

  const featuredProducts = useMemo(() => {
    const highlighted = allProducts.filter((product) => product.featured);
    return (highlighted.length ? highlighted : allProducts).slice(0, 4);
  }, [allProducts]);

  const heroProduct = featuredProducts[0] ?? allProducts[0] ?? null;

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
    <main className="min-h-screen bg-[#090909] text-white">
      <section className="hidden min-h-screen bg-[#090909] lg:block">
        <header className="border-b border-white/10 bg-black/95">
          <div className="mx-auto flex h-[88px] max-w-[1320px] items-center justify-between px-8">
            <Link href="/" className="flex items-center gap-3">
              <img
                src={home?.brand?.logoUrl || FALLBACK_LOGO}
                alt="Alentó Pizza"
                className="h-14 w-14 rounded-2xl object-cover"
              />
              <div>
                <b className="block text-[22px] font-black tracking-[-0.03em]">Alentó Pizza</b>
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">Sabor que te hace volver</span>
              </div>
            </Link>

            <nav className="flex items-center gap-9 text-[12px] font-black uppercase tracking-[0.08em]">
              <a href="#inicio-pedir" className="border-b-2 border-[#d71920] pb-2 text-white">Inicio</a>
              <a href="#categorias-pedir" className="text-white/68 transition hover:text-white">Menú</a>
              <a href="#populares-pedir" className="text-white/68 transition hover:text-white">Destacados</a>
              <Link href="/cuenta" className="text-white/68 transition hover:text-white">Mi cuenta</Link>
            </nav>

            <button
              type="button"
              onClick={() => document.getElementById("categorias-pedir")?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-full bg-[#d71920] px-7 py-3.5 text-[12px] font-black uppercase tracking-[0.07em] text-white shadow-[0_10px_30px_rgba(215,25,32,.24)]"
            >
              Pedir ahora ↗
            </button>
          </div>
        </header>

        <section id="inicio-pedir" className="relative overflow-hidden border-b border-white/10 bg-[#090909]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_45%,rgba(215,25,32,.19),transparent_34%),radial-gradient(circle_at_20%_10%,rgba(255,255,255,.05),transparent_24%)]" />
          <div className="relative mx-auto grid min-h-[560px] max-w-[1320px] grid-cols-[.92fr_1.08fr] items-center gap-10 px-8 py-12">
            <div className="relative z-10 max-w-[560px]">
              <p className="text-[31px] italic leading-none text-white/85" style={{ fontFamily: "cursive" }}>
                ¿Antojo de algo
              </p>
              <p className="mt-2 text-[64px] font-black leading-[.92] tracking-[-0.055em] text-white">
                DELICIOSO?
              </p>
              <h1 className="mt-1 text-[86px] font-black leading-[.82] tracking-[-0.065em] text-[#d71920]">
                ALENTÓ
              </h1>

              <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-white/20 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/85">
                <span>Caliente</span><span className="text-[#d71920]">•</span><span>Fresco</span><span className="text-[#d71920]">•</span><span>Irresistible</span>
              </div>

              <p className="mt-6 max-w-[430px] text-[14px] leading-6 text-white/58">
                Masa madurada, ingredientes seleccionados y combinaciones pensadas para hacerte volver.
              </p>

              <div className="mt-7 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => document.getElementById("categorias-pedir")?.scrollIntoView({ behavior: "smooth" })}
                  className="rounded-full bg-[#d71920] px-7 py-3.5 text-[12px] font-black uppercase tracking-[0.08em] text-white"
                >
                  Ver menú →
                </button>
                <Link
                  href="/cuenta"
                  className="rounded-full border border-white/20 px-6 py-3.5 text-[12px] font-black uppercase tracking-[0.08em] text-white/75"
                >
                  Mi cuenta
                </Link>
              </div>
            </div>

            <div className="relative flex min-h-[470px] items-center justify-center">
              <div className="absolute h-[420px] w-[420px] rounded-full bg-[#d71920]/16 blur-3xl" />
              {heroProduct?.imageUrl ? (
                <img
                  src={heroProduct.imageUrl}
                  alt={heroProduct.name}
                  className="relative z-10 max-h-[510px] w-full max-w-[650px] object-contain drop-shadow-[0_38px_28px_rgba(0,0,0,.58)]"
                />
              ) : (
                <div className="relative z-10 text-[180px]">🍕</div>
              )}
              <div className="absolute bottom-10 right-10 rounded-full border border-white/20 bg-black/70 px-5 py-4 text-center shadow-2xl backdrop-blur">
                <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Desde</span>
                <b className="mt-1 block text-[24px] font-black text-white">{heroProduct ? displayPrice(heroProduct) : "—"}</b>
              </div>
            </div>
          </div>
        </section>

        <section id="categorias-pedir" className="relative z-20 mx-auto -mt-8 max-w-[1240px] px-8">
          <div className="grid grid-cols-6 overflow-hidden rounded-[24px] border border-white/10 bg-white text-[#111] shadow-[0_24px_70px_rgba(0,0,0,.28)]">
            {categories.slice(0, 6).map((category, index) => (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setActiveCategory(category.slug);
                  setQuery("");
                  document.getElementById("catalogo-pedir")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`flex min-h-[126px] flex-col items-center justify-center gap-2 border-r border-neutral-200 px-3 text-center last:border-r-0 ${activeCategory === category.slug ? "bg-[#fff1f1]" : "bg-white"}`}
              >
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-neutral-50 text-3xl">
                  {category.imageUrl ? (
                    <img src={category.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span>{categoryEmoji(category.slug)}</span>
                  )}
                </div>
                <b className="text-[12px] font-black uppercase">{category.name}</b>
                <span className="text-[9px] font-semibold text-neutral-400">
                  {index === 0 ? "Lo más pedido" : "Explorar"}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section id="populares-pedir" className="mx-auto max-w-[1320px] px-8 pb-16 pt-20">
          <div className="text-center">
            <p className="text-[25px] italic text-[#d71920]" style={{ fontFamily: "cursive" }}>Popular entre clientes</p>
            <h2 className="mt-1 text-[46px] font-black uppercase tracking-[-0.04em]">Nuestros <span className="text-[#d71920]">más vendidos</span></h2>
          </div>

          <div className="mt-9 grid grid-cols-4 gap-4">
            {featuredProducts.map((product, index) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelectedProduct(product)}
                className="group overflow-hidden rounded-[18px] border border-white/18 bg-[#151515] text-left transition hover:-translate-y-1 hover:border-[#d71920]/70"
              >
                <div className="relative aspect-[1.1/1] overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,.08),transparent_58%)]">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-4 transition duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-7xl">🍕</div>
                  )}
                  {index === 0 && (
                    <span className="absolute left-3 top-3 rounded-full bg-[#d71920] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-white">
                      Bestseller
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-[17px] font-black tracking-[-0.02em] text-white">{product.name}</h3>
                  <p className="mt-1 line-clamp-2 min-h-[36px] text-[11px] leading-[18px] text-white/45">
                    {product.description || "Una de las opciones favoritas de nuestros clientes."}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <b className="text-[17px] font-black text-[#ff3439]">{displayPrice(product)}</b>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d71920] text-xl font-black text-white">+</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1320px] px-8 pb-16">
          <div className="relative overflow-hidden rounded-[22px] bg-[#d71920] px-10 py-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_50%,rgba(255,255,255,.18),transparent_28%)]" />
            {home?.secondaryBanner.active && home.secondaryBanner.imageUrl ? (
              <img src={home.secondaryBanner.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-multiply" />
            ) : null}
            <div className="relative flex items-center justify-between gap-8">
              <div>
                <p className="text-[14px] font-black uppercase tracking-[0.12em] text-black/60">¿Tienes hambre?</p>
                <h3 className="mt-1 text-[46px] font-black uppercase leading-none tracking-[-0.045em] text-white">Pide y nosotros<br/>hacemos el resto.</h3>
              </div>
              <button
                type="button"
                onClick={() => document.getElementById("catalogo-pedir")?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-full bg-black px-8 py-4 text-[12px] font-black uppercase tracking-[0.08em] text-white"
              >
                Elegir ahora →
              </button>
            </div>
          </div>
        </section>

        <section id="catalogo-pedir" className="mx-auto max-w-[1320px] px-8 pb-20">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Catálogo</p>
              <h2 className="mt-1 text-[34px] font-black tracking-[-0.04em] text-white">
                {categories.find((category) => category.slug === activeCategory)?.name || "Menú"}
              </h2>
            </div>
            <div className="flex w-[340px] items-center gap-3 rounded-full border border-white/12 bg-white/[0.05] px-4 py-3">
              <span className="text-white/45">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar en el menú..."
                className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/25"
              />
            </div>
          </div>

          {loading ? (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-10 text-center text-white/40">Cargando menú...</div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {activeProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSelectedProduct(product)}
                  className="overflow-hidden rounded-[18px] border border-white/10 bg-[#141414] text-left transition hover:border-[#d71920]/60"
                >
                  <div className="aspect-square overflow-hidden bg-[#101010]">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-4" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-6xl">🍕</div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="line-clamp-2 min-h-[44px] text-[15px] font-black text-white">{product.name}</h3>
                    <div className="mt-3 flex items-center justify-between">
                      <b className="text-[14px] font-black text-[#ff3439]">{displayPrice(product)}</b>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d71920] text-lg text-white">+</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <footer className="border-t border-white/10 bg-[#0b0b0b]">
          <div className="mx-auto grid max-w-[1320px] grid-cols-[1.25fr_.8fr_.8fr_1fr] gap-10 px-8 py-12">
            <div>
              <div className="flex items-center gap-3">
                <img src={home?.brand?.logoUrl || FALLBACK_LOGO} alt="Alentó Pizza" className="h-12 w-12 rounded-xl object-cover" />
                <div>
                  <b className="text-[18px] font-black">Alentó Pizza</b>
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">Sabor que te hace volver</p>
                </div>
              </div>
              <p className="mt-4 max-w-[290px] text-[11px] leading-5 text-white/42">
                Pizzas, combos y antojos preparados para disfrutar en casa, recoger o compartir.
              </p>
            </div>

            <div>
              <b className="text-[12px] font-black text-[#ff3439]">Enlaces</b>
              <div className="mt-4 space-y-2 text-[11px] text-white/55">
                <Link href="/">Inicio</Link>
                <a href="#categorias-pedir" className="block">Menú</a>
                <a href="#populares-pedir" className="block">Destacados</a>
                <Link href="/cuenta" className="block">Mi cuenta</Link>
              </div>
            </div>

            <div>
              <b className="text-[12px] font-black text-[#ff3439]">Ayuda</b>
              <div className="mt-4 space-y-2 text-[11px] text-white/55">
                <p>Pedidos</p>
                <p>Domicilios</p>
                <p>Preguntas frecuentes</p>
                <p>Términos</p>
              </div>
            </div>

            <div>
              <b className="text-[12px] font-black text-[#ff3439]">Alentó</b>
              <p className="mt-4 text-[11px] leading-5 text-white/45">
                Experiencia web instalable como PWA para pedir más rápido desde tu celular o computador.
              </p>
            </div>
          </div>
          <div className="border-t border-white/10 py-5 text-center text-[10px] text-white/25">
            © 2026 Alentó Pizza
          </div>
        </footer>
      </section>

      <section className="lg:hidden">
        <div className="min-h-screen bg-[#eef7f2] pb-24 text-[#101410]">
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

          </div>
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
      </section>
    </main>
  );
}
