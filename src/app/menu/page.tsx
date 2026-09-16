"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ProductType = "STANDARD" | "PIZZA_SINGLE" | "PIZZA_TWO_FLAVORS" | "COMBO" | "MODIFIER" | "INTERNAL";

type ComboOption = {
  id?: number;
  productId: number;
  productName?: string;
  quantity: number;
  priceDelta: number;
};

type ComboGroup = {
  id?: number;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: ComboOption[];
};

type Product = {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imageUrl2: string | null;
  type: ProductType;
  basePrice: number | null;
  active: boolean;
  visibleInPos: boolean;
  featured: boolean;
  sortOrder: number;
  comboRegularTotal?: number | null;
  comboDiscount?: number | null;
  comboGroups: ComboGroup[];
};

type Category = {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  visibleInPos: boolean;
  sortOrder: number;
  products: Product[];
};

type PizzaSize = {
  id: number;
  name: string;
  diameterCm: number;
  basePrice: number;
};

type MenuResponse = { categories: Category[]; sizes: PizzaSize[] };

type EditorState = {
  id: number;
  name: string;
  description: string;
  basePrice: string;
  imageUrl: string;
  imageUrl2: string;
  active: boolean;
  visibleInPos: boolean;
  featured: boolean;
  type: ProductType;
};

type CreateState = {
  categorySlug: string;
  name: string;
  description: string;
  basePrice: string;
  imageUrl: string;
  imageUrl2: string;
};

type ComboState = {
  name: string;
  description: string;
  finalPrice: string;
  imageUrl: string;
  imageUrl2: string;
  productIds: number[];
};

const priority = new Map([
  ["destacados", 1],
  ["pizzas", 2],
  ["antojos", 3],
  ["bebidas", 4],
  ["ingredientes", 20],
]);

function formatCOP(value: number | null | undefined) {
  if (value == null) return "Sin precio";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MenuPage() {
  const [data, setData] = useState<MenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [createState, setCreateState] = useState<CreateState | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [comboState, setComboState] = useState<ComboState | null>(null);
  const [creatingCombo, setCreatingCombo] = useState(false);
  const [comboError, setComboError] = useState("");

  async function loadMenu(preserveCategory = true) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/menu-admin", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible cargar el menú.");

      const categories = [...(result.categories ?? [])].sort((a: Category, b: Category) => {
        const aPriority = priority.get(a.slug) ?? 100 + a.sortOrder;
        const bPriority = priority.get(b.slug) ?? 100 + b.sortOrder;
        return aPriority - bPriority || a.name.localeCompare(b.name, "es");
      });

      setData({ categories, sizes: result.sizes ?? [] });
      if (!preserveCategory || activeCategoryId == null || !categories.some((category: Category) => category.id === activeCategoryId)) {
        setActiveCategoryId(categories[0]?.id ?? null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el menú.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMenu(false);
  }, []);

  const activeCategory = useMemo(
    () => data?.categories.find((category) => category.id === activeCategoryId) ?? data?.categories[0],
    [data, activeCategoryId],
  );

  const minPizzaSizePrice = useMemo(() => {
    if (!data?.sizes?.length) return 0;
    return Math.min(...data.sizes.map((size) => size.basePrice));
  }, [data]);

  const visibleProducts = useMemo(() => {
    const value = query.trim().toLowerCase();
    const products = activeCategory?.products ?? [];
    if (!value) return products;
    return products.filter((product) => product.name.toLowerCase().includes(value) || product.description?.toLowerCase().includes(value));
  }, [activeCategory, query]);

  const comboCandidates = useMemo(() => {
    const allowed = new Set(["pizzas", "antojos", "bebidas"]);
    return (data?.categories ?? [])
      .filter((category) => allowed.has(category.slug))
      .flatMap((category) => category.products.map((product) => ({ product, category: category.name })))
      .filter(({ product }) => product.active && ["STANDARD", "PIZZA_SINGLE"].includes(product.type))
      .filter((item, index, array) => array.findIndex((candidate) => candidate.product.id === item.product.id) === index)
      .sort((a, b) => a.product.name.localeCompare(b.product.name, "es"));
  }, [data]);

  function regularPrice(product: Product) {
    if (product.type === "PIZZA_SINGLE") return minPizzaSizePrice + (product.basePrice ?? 0);
    return product.basePrice ?? 0;
  }

  const comboRegularTotal = useMemo(() => {
    if (!comboState) return 0;
    return comboState.productIds.reduce((total, id) => {
      const found = comboCandidates.find(({ product }) => product.id === id)?.product;
      return total + (found ? regularPrice(found) : 0);
    }, 0);
  }, [comboState, comboCandidates, minPizzaSizePrice]);

  const comboFinalPrice = comboState ? Number(comboState.finalPrice) || 0 : 0;
  const comboDiscount = Math.max(0, comboRegularTotal - comboFinalPrice);

  function displayProductPrice(product: Product) {
    if (product.type === "PIZZA_SINGLE") return `Desde ${formatCOP(minPizzaSizePrice + (product.basePrice ?? 0))}`;
    if (product.type === "PIZZA_TWO_FLAVORS") return "Precio según sabores";
    return formatCOP(product.basePrice);
  }

  function openEditor(product: Product) {
    setEditor({
      id: product.id,
      name: product.name,
      description: product.description ?? "",
      basePrice: product.basePrice == null ? "" : String(product.basePrice),
      imageUrl: product.imageUrl ?? "",
      imageUrl2: product.imageUrl2 ?? "",
      active: product.active,
      visibleInPos: product.visibleInPos,
      featured: product.featured,
      type: product.type,
    });
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    try {
      const response = await fetch("/api/menu-admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editor.id,
          name: editor.name,
          description: editor.description,
          basePrice: editor.basePrice,
          imageUrl: editor.imageUrl,
          imageUrl2: editor.imageUrl2,
          active: editor.active,
          visibleInPos: editor.visibleInPos,
          featured: editor.featured,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible guardar el producto.");
      setEditor(null);
      await loadMenu();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar el producto.");
    } finally {
      setSaving(false);
    }
  }

  async function quickToggle(product: Product, field: "active" | "visibleInPos") {
    await fetch("/api/menu-admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, [field]: !product[field] }),
    });
    await loadMenu();
  }

  function startCreateProduct(category: Category) {
    setCreateError("");
    setCreateState({
      categorySlug: category.slug,
      name: "",
      description: "",
      basePrice: category.slug === "ingredientes" ? "5000" : "",
      imageUrl: "",
      imageUrl2: "",
    });
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createState) return;
    setCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/menu-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createProduct", ...createState }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible crear el producto.");
      setCreateState(null);
      await loadMenu();
    } catch (createProductError) {
      setCreateError(createProductError instanceof Error ? createProductError.message : "No fue posible crear el producto.");
    } finally {
      setCreating(false);
    }
  }

  function startCombo() {
    setComboError("");
    setComboState({ name: "", description: "", finalPrice: "", imageUrl: "", imageUrl2: "", productIds: [] });
  }

  function toggleComboProduct(productId: number) {
    if (!comboState) return;
    setComboState({
      ...comboState,
      productIds: comboState.productIds.includes(productId)
        ? comboState.productIds.filter((id) => id !== productId)
        : [...comboState.productIds, productId],
    });
  }

  async function createCombo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comboState) return;
    setCreatingCombo(true);
    setComboError("");
    try {
      const response = await fetch("/api/menu-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createCombo",
          name: comboState.name,
          description: comboState.description,
          imageUrl: comboState.imageUrl,
          imageUrl2: comboState.imageUrl2,
          finalPrice: comboState.finalPrice,
          productIds: comboState.productIds,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible crear el combo.");
      setComboState(null);
      await loadMenu(false);
    } catch (createComboError) {
      setComboError(createComboError instanceof Error ? createComboError.message : "No fue posible crear el combo.");
    } finally {
      setCreatingCombo(false);
    }
  }

  if (loading && !data) {
    return <main className="p-6 lg:p-8"><div className="alento-card mx-auto max-w-7xl rounded-[28px] p-8">Cargando administración del menú...</div></main>;
  }

  return (
    <main className="min-h-screen p-4 sm:p-5 lg:p-7 xl:p-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="alento-dark rounded-[30px] px-6 py-5 md:px-8 md:py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Administración</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">Menú</h1>
              <p className="mt-1 text-sm text-white/55">Productos, precios, imágenes, destacados y combos.</p>
            </div>
            <button onClick={startCombo} className="alento-red-glow rounded-2xl bg-[var(--brand-red)] px-5 py-3 text-sm font-black text-white">+ Crear combo</button>
          </div>
        </header>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

        <section className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="alento-card h-fit rounded-[24px] p-3 xl:sticky xl:top-5">
            <div className="mb-3 px-1"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">Catálogo</p><h2 className="mt-1 text-lg font-black">Categorías</h2></div>
            <div className="space-y-1.5">
              {data?.categories.map((category) => {
                const active = activeCategory?.id === category.id;
                return <button key={category.id} onClick={() => { setActiveCategoryId(category.id); setQuery(""); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left ${active ? "bg-black text-white" : "bg-[#faf9f7] text-neutral-700 hover:bg-neutral-100"}`}><span><span className="block text-sm font-black">{category.name}</span><span className={`block text-[10px] ${active ? "text-white/50" : "text-neutral-400"}`}>{category.products.length} productos</span></span></button>;
              })}
            </div>
          </aside>

          <div className="space-y-3">
            <div className="alento-card rounded-[24px] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">Categoría</p><h2 className="mt-1 text-2xl font-black">{activeCategory?.name ?? "Productos"}</h2></div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {activeCategory && ["pizzas", "antojos", "bebidas", "ingredientes"].includes(activeCategory.slug) && <button onClick={() => startCreateProduct(activeCategory)} className="rounded-2xl bg-black px-4 py-3 text-sm font-black text-white">+ {activeCategory.slug === "ingredientes" ? "Ingrediente" : "Producto"}</button>}
                  <input value={query} onChange={(event) => setQuery(event.target.value)} className="alento-input w-full rounded-2xl px-4 py-3 sm:w-72" placeholder="Buscar producto..." />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visibleProducts.map((product) => (
                <article key={product.id} className="alento-card overflow-hidden rounded-[20px]">
                  <div className="relative aspect-square overflow-hidden bg-[#f7f6f3] p-1.5">
                    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-4xl">🍕</div>}
                    <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${product.active ? "bg-emerald-500 text-white" : "bg-neutral-700 text-white"}`}>{product.active ? "Activo" : "Inactivo"}</span>{product.featured && <span className="rounded-full bg-[var(--brand-red)] px-2 py-1 text-[9px] font-black text-white">Destacado</span>}</div>
                  </div>
                  <div className="p-3.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-400">{product.type}</p>
                    <h3 className="mt-1 text-base font-black leading-tight">{product.name}</h3>
                    <p className="mt-1 text-sm font-black text-[var(--brand-red)]">{displayProductPrice(product)}</p>
                    {product.type === "COMBO" && product.comboRegularTotal != null && <div className="mt-2 rounded-xl bg-[#faf9f7] p-2.5 text-[11px]"><div className="flex justify-between text-neutral-500"><span>Valor productos</span><strong>{formatCOP(product.comboRegularTotal)}</strong></div><div className="mt-1 flex justify-between text-[var(--brand-red)]"><span>Descuento</span><strong>- {formatCOP(product.comboDiscount ?? 0)}</strong></div><div className="mt-1 flex justify-between border-t border-neutral-200 pt-1 font-black"><span>Combo</span><strong>{formatCOP(product.basePrice)}</strong></div></div>}
                    <p className="mt-2 line-clamp-2 min-h-8 text-[11px] leading-4 text-neutral-500">{product.description || "Sin descripción"}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5"><button onClick={() => openEditor(product)} className="rounded-xl bg-black px-3 py-2 text-[11px] font-black text-white">Editar</button><button onClick={() => quickToggle(product, "active")} className="rounded-xl border border-neutral-200 px-3 py-2 text-[11px] font-bold">{product.active ? "Desactivar" : "Activar"}</button>{product.type !== "MODIFIER" && <button onClick={() => quickToggle(product, "visibleInPos")} className="rounded-xl border border-neutral-200 px-3 py-2 text-[11px] font-bold">{product.visibleInPos ? "Ocultar POS" : "Mostrar POS"}</button>}</div>
                  </div>
                </article>
              ))}
            </div>
            {visibleProducts.length === 0 && <div className="alento-card rounded-[24px] p-8 text-center text-sm text-neutral-400">No hay productos para mostrar.</div>}
          </div>
        </section>
      </div>

      {editor && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><form onSubmit={saveProduct} className="alento-card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] p-6"><div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">Editar producto</p><h2 className="mt-1 text-2xl font-black">{editor.name}</h2></div><button type="button" onClick={() => setEditor(null)} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-bold">Cerrar</button></div><div className="grid gap-4 md:grid-cols-2"><label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Nombre</span><input value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label><label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Descripción</span><textarea value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} className="alento-input min-h-24 w-full rounded-2xl px-4 py-3" /></label><label className="space-y-1.5"><span className="text-sm font-bold">{editor.type === "PIZZA_SINGLE" ? "Valor del sabor" : "Precio base"}</span><input value={editor.basePrice} onChange={(event) => setEditor({ ...editor, basePrice: event.target.value })} inputMode="numeric" className="alento-input w-full rounded-2xl px-4 py-3" /></label><div className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm"><p className="font-bold">Tipo</p><p className="mt-1 text-neutral-500">{editor.type}</p></div><label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Imagen principal · URL</span><input value={editor.imageUrl} onChange={(event) => setEditor({ ...editor, imageUrl: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label><label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Imagen secundaria · URL</span><input value={editor.imageUrl2} onChange={(event) => setEditor({ ...editor, imageUrl2: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><label className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3"><input type="checkbox" checked={editor.active} onChange={(event) => setEditor({ ...editor, active: event.target.checked })} /><span className="text-sm font-bold">Activo</span></label><label className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3"><input type="checkbox" checked={editor.visibleInPos} onChange={(event) => setEditor({ ...editor, visibleInPos: event.target.checked })} disabled={editor.type === "MODIFIER"} /><span className="text-sm font-bold">Visible en POS</span></label><label className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3"><input type="checkbox" checked={editor.featured} onChange={(event) => setEditor({ ...editor, featured: event.target.checked })} disabled={editor.type === "MODIFIER"} /><span className="text-sm font-bold">Destacado</span></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditor(null)} className="rounded-2xl border border-neutral-200 px-4 py-3 font-bold">Cancelar</button><button type="submit" disabled={saving} className="alento-red-glow rounded-2xl bg-[var(--brand-red)] px-5 py-3 font-black text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar cambios"}</button></div></form></div>}

      {createState && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><form onSubmit={createProduct} className="alento-card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] p-6"><div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">Nuevo producto</p><h2 className="mt-1 text-2xl font-black">Crear en {activeCategory?.name}</h2></div><button type="button" onClick={() => setCreateState(null)} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-bold">Cerrar</button></div><div className="grid gap-4 md:grid-cols-2"><label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Nombre *</span><input value={createState.name} onChange={(event) => setCreateState({ ...createState, name: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" autoFocus /></label><label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Descripción</span><textarea value={createState.description} onChange={(event) => setCreateState({ ...createState, description: event.target.value })} className="alento-input min-h-24 w-full rounded-2xl px-4 py-3" /></label><label className="space-y-1.5"><span className="text-sm font-bold">{createState.categorySlug === "pizzas" ? "Valor del sabor *" : "Precio *"}</span><input value={createState.basePrice} onChange={(event) => setCreateState({ ...createState, basePrice: event.target.value })} inputMode="numeric" className="alento-input w-full rounded-2xl px-4 py-3" placeholder={createState.categorySlug === "ingredientes" ? "5000" : ""} /></label><div className="rounded-2xl bg-neutral-100 p-3 text-sm text-neutral-500">{createState.categorySlug === "pizzas" ? `Al POS se mostrará sumando el tamaño Personal (${formatCOP(minPizzaSizePrice)}).` : createState.categorySlug === "ingredientes" ? "Se creará como ingrediente adicional y no como producto independiente del POS." : "Producto estándar con precio fijo."}</div><label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Imagen principal · URL</span><input value={createState.imageUrl} onChange={(event) => setCreateState({ ...createState, imageUrl: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label><label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Imagen secundaria · URL</span><input value={createState.imageUrl2} onChange={(event) => setCreateState({ ...createState, imageUrl2: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label></div>{createError && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{createError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCreateState(null)} className="rounded-2xl border border-neutral-200 px-4 py-3 font-bold">Cancelar</button><button type="submit" disabled={creating} className="alento-red-glow rounded-2xl bg-[var(--brand-red)] px-5 py-3 font-black text-white disabled:opacity-50">{creating ? "Creando..." : "Crear producto"}</button></div></form></div>}

      {comboState && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"><form onSubmit={createCombo} className="alento-card max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[30px] p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">Nuevo destacado</p><h2 className="mt-1 text-2xl font-black">Crear combo</h2><p className="mt-1 text-sm text-neutral-500">Agrupa productos y define un precio especial. El combo se publica automáticamente en Destacados.</p></div><button type="button" onClick={() => setComboState(null)} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-bold">Cerrar</button></div><div className="grid gap-5 lg:grid-cols-[1fr_360px]"><div><div className="grid gap-3 md:grid-cols-2"><label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Nombre del combo *</span><input value={comboState.name} onChange={(event) => setComboState({ ...comboState, name: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" placeholder="Ej. Combo Familiar" /></label><label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Descripción</span><textarea value={comboState.description} onChange={(event) => setComboState({ ...comboState, description: event.target.value })} className="alento-input min-h-20 w-full rounded-2xl px-4 py-3" /></label><label className="space-y-1.5"><span className="text-sm font-bold">Imagen principal · URL</span><input value={comboState.imageUrl} onChange={(event) => setComboState({ ...comboState, imageUrl: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label><label className="space-y-1.5"><span className="text-sm font-bold">Imagen secundaria · URL</span><input value={comboState.imageUrl2} onChange={(event) => setComboState({ ...comboState, imageUrl2: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label></div><div className="mt-5"><p className="mb-2 text-sm font-black">Selecciona los productos</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{comboCandidates.map(({ product, category }) => { const selected = comboState.productIds.includes(product.id); return <button key={product.id} type="button" onClick={() => toggleComboProduct(product.id)} className={`rounded-2xl border p-3 text-left ${selected ? "border-black bg-black text-white" : "border-neutral-200 bg-white"}`}><span className={`text-[9px] font-bold uppercase tracking-[0.13em] ${selected ? "text-white/50" : "text-neutral-400"}`}>{category}</span><span className="mt-1 block text-sm font-black">{product.name}</span><span className={`mt-1 block text-xs ${selected ? "text-white/65" : "text-neutral-500"}`}>{formatCOP(regularPrice(product))}</span></button>; })}</div></div></div><aside className="h-fit rounded-[24px] bg-[#111112] p-5 text-white lg:sticky lg:top-0"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Resumen</p><h3 className="mt-1 text-xl font-black">{comboState.name || "Nuevo combo"}</h3><div className="mt-4 space-y-2">{comboState.productIds.length === 0 ? <p className="text-sm text-white/40">Selecciona productos.</p> : comboState.productIds.map((id) => { const product = comboCandidates.find((item) => item.product.id === id)?.product; return product ? <div key={id} className="flex justify-between gap-3 text-sm"><span className="text-white/65">{product.name}</span><strong>{formatCOP(regularPrice(product))}</strong></div> : null; })}</div><div className="mt-5 space-y-3 border-t border-white/10 pt-4"><div className="flex justify-between text-sm"><span className="text-white/55">Valor normal</span><strong>{formatCOP(comboRegularTotal)}</strong></div><label className="block"><span className="text-xs font-bold text-white/55">Valor final del combo</span><input value={comboState.finalPrice} onChange={(event) => setComboState({ ...comboState, finalPrice: event.target.value })} inputMode="numeric" className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xl font-black text-white outline-none" placeholder="19900" /></label><div className="flex justify-between rounded-2xl bg-[var(--brand-red)]/15 px-3 py-2.5 text-sm"><span className="text-white/70">Descuento</span><strong className="text-red-300">- {formatCOP(comboDiscount)}</strong></div><div className="flex justify-between border-t border-white/10 pt-3"><span className="font-black">Precio combo</span><strong className="text-2xl text-white">{formatCOP(comboFinalPrice)}</strong></div></div></aside></div>{comboError && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{comboError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setComboState(null)} className="rounded-2xl border border-neutral-200 px-4 py-3 font-bold">Cancelar</button><button type="submit" disabled={creatingCombo} className="alento-red-glow rounded-2xl bg-[var(--brand-red)] px-5 py-3 font-black text-white disabled:opacity-50">{creatingCombo ? "Creando combo..." : "Crear combo"}</button></div></form></div>}
    </main>
  );
}
