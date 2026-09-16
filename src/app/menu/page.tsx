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

const priority = new Map([
  ["destacados", 1],
  ["pizzas", 2],
  ["antojos", 3],
  ["bebidas", 4],
  ["ingredientes", 20],
]);

function formatCOP(value: number | null) {
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
  const [saveMessage, setSaveMessage] = useState("");
  const [comboProduct, setComboProduct] = useState<Product | null>(null);
  const [comboGroups, setComboGroups] = useState<ComboGroup[]>([]);
  const [savingCombo, setSavingCombo] = useState(false);
  const [showIngredientCreator, setShowIngredientCreator] = useState(false);
  const [ingredientName, setIngredientName] = useState("");
  const [ingredientDescription, setIngredientDescription] = useState("");
  const [ingredientPrice, setIngredientPrice] = useState("5000");
  const [ingredientImage, setIngredientImage] = useState("");
  const [ingredientError, setIngredientError] = useState("");
  const [creatingIngredient, setCreatingIngredient] = useState(false);

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

  const visibleProducts = useMemo(() => {
    const value = query.trim().toLowerCase();
    const products = activeCategory?.products ?? [];
    if (!value) return products;
    return products.filter((product) => product.name.toLowerCase().includes(value) || product.description?.toLowerCase().includes(value));
  }, [activeCategory, query]);

  const minPizzaSize = useMemo(() => {
    if (!data?.sizes?.length) return 0;
    return Math.min(...data.sizes.map((size) => size.basePrice));
  }, [data]);

  const minFlavorPrice = useMemo(() => {
    const flavors = (data?.categories ?? [])
      .flatMap((category) => category.products)
      .filter((product) => product.type === "PIZZA_SINGLE" && product.basePrice != null)
      .map((product) => product.basePrice as number);
    return flavors.length ? Math.min(...flavors) : 0;
  }, [data]);

  const comboCandidates = useMemo(() => {
    return (data?.categories ?? [])
      .filter((category) => category.slug !== "destacados")
      .flatMap((category) => category.products)
      .filter((product) => product.type !== "INTERNAL" && product.type !== "MODIFIER" && product.id !== comboProduct?.id)
      .filter((product, index, array) => array.findIndex((candidate) => candidate.id === product.id) === index)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [data, comboProduct]);

  function displayPrice(product: Product) {
    if (product.type === "PIZZA_SINGLE") {
      return formatCOP(minPizzaSize + (product.basePrice ?? 0));
    }
    if (product.type === "PIZZA_TWO_FLAVORS") {
      return `Desde ${formatCOP(minPizzaSize + minFlavorPrice)}`;
    }
    return formatCOP(product.basePrice);
  }

  function openEditor(product: Product) {
    setSaveMessage("");
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
    setSaveMessage("");
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
      await loadMenu();
      setSaveMessage("Cambios guardados.");
    } catch (saveError) {
      setSaveMessage(saveError instanceof Error ? saveError.message : "No fue posible guardar el producto.");
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

  async function createIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIngredientError("");
    if (!ingredientName.trim()) {
      setIngredientError("Escribe el nombre del ingrediente.");
      return;
    }

    setCreatingIngredient(true);
    try {
      const response = await fetch("/api/menu-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createIngredient",
          name: ingredientName,
          description: ingredientDescription,
          basePrice: ingredientPrice,
          imageUrl: ingredientImage,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible crear el ingrediente.");
      setIngredientName("");
      setIngredientDescription("");
      setIngredientPrice("5000");
      setIngredientImage("");
      setShowIngredientCreator(false);
      await loadMenu();
    } catch (createError) {
      setIngredientError(createError instanceof Error ? createError.message : "No fue posible crear el ingrediente.");
    } finally {
      setCreatingIngredient(false);
    }
  }

  function openComboBuilder(product: Product) {
    setComboProduct(product);
    setComboGroups(product.comboGroups?.length ? product.comboGroups.map((group) => ({
      ...group,
      options: group.options.map((option) => ({ ...option })),
    })) : [{ name: "Incluye", minSelections: 1, maxSelections: 1, options: [] }]);
  }

  function toggleComboOption(groupIndex: number, product: Product) {
    setComboGroups((current) => current.map((group, index) => {
      if (index !== groupIndex) return group;
      const exists = group.options.some((option) => option.productId === product.id);
      return {
        ...group,
        options: exists
          ? group.options.filter((option) => option.productId !== product.id)
          : [...group.options, { productId: product.id, productName: product.name, quantity: 1, priceDelta: 0 }],
      };
    }));
  }

  async function saveCombo() {
    if (!comboProduct) return;
    setSavingCombo(true);
    try {
      const response = await fetch("/api/menu-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboProductId: comboProduct.id, groups: comboGroups }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible guardar el combo.");
      await loadMenu();
      setComboProduct(null);
      setComboGroups([]);
    } finally {
      setSavingCombo(false);
    }
  }

  if (loading && !data) {
    return <main className="p-6 lg:p-8"><div className="alento-card mx-auto max-w-7xl rounded-[28px] p-8">Cargando administración del menú...</div></main>;
  }

  return (
    <main className="min-h-screen p-4 sm:p-5 lg:p-7 xl:p-8">
      <div className="mx-auto max-w-[1450px] space-y-6">
        <header className="alento-dark rounded-[32px] px-6 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">Administración</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] md:text-4xl">Menú</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/55">Controla categorías, productos, precios, imágenes, visibilidad y combos desde un solo lugar.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/65">Los cambios se reflejan en el POS.</div>
          </div>
        </header>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

        <section className="grid gap-5 xl:grid-cols-[235px_minmax(0,1fr)]">
          <aside className="alento-card h-fit rounded-[26px] p-4 xl:sticky xl:top-7">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">Catálogo</p>
                <h2 className="mt-1 text-lg font-black">Categorías</h2>
              </div>
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-500">{data?.categories.length ?? 0}</span>
            </div>
            <div className="space-y-2">
              {data?.categories.map((category) => {
                const active = activeCategory?.id === category.id;
                return (
                  <button key={category.id} onClick={() => { setActiveCategoryId(category.id); setQuery(""); }} className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left ${active ? "bg-black text-white" : "bg-[#faf9f7] text-neutral-700 hover:bg-neutral-100"}`}>
                    <span>
                      <span className="block text-sm font-black">{category.name}</span>
                      <span className={`mt-0.5 block text-[10px] ${active ? "text-white/50" : "text-neutral-400"}`}>{category.products.length} productos</span>
                    </span>
                    {!category.visibleInPos && category.slug !== "ingredientes" && <span className="text-[10px] opacity-60">Oculta</span>}
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-4">
            <div className="alento-card rounded-[26px] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">Categoría</p>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]">{activeCategory?.name ?? "Productos"}</h2>
                </div>
                <div className="flex w-full gap-2 md:w-auto">
                  <input value={query} onChange={(event) => setQuery(event.target.value)} className="alento-input min-w-0 flex-1 rounded-2xl px-4 py-3 md:w-80" placeholder="Buscar producto..." />
                  {activeCategory?.slug === "ingredientes" && (
                    <button onClick={() => setShowIngredientCreator(true)} className="whitespace-nowrap rounded-2xl bg-[var(--brand-red)] px-4 py-3 text-sm font-black text-white">+ Ingrediente</button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visibleProducts.map((product) => (
                <article key={product.id} className="alento-card overflow-hidden rounded-[22px]">
                  <div className="relative aspect-square overflow-hidden bg-[#f5f3f0] p-2">
                    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-4xl">🍕</div>}
                    <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-1 text-[9px] font-black ${product.active ? "bg-emerald-500 text-white" : "bg-neutral-700 text-white"}`}>{product.active ? "Activo" : "Inactivo"}</span>
                      {product.featured && <span className="rounded-full bg-[var(--brand-red)] px-2 py-1 text-[9px] font-black text-white">Destacado</span>}
                      {!product.visibleInPos && product.type !== "MODIFIER" && <span className="rounded-full bg-black/70 px-2 py-1 text-[9px] font-black text-white">Oculto POS</span>}
                    </div>
                  </div>
                  <div className="p-3.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-400">{product.type}</p>
                    <h3 className="mt-1 line-clamp-1 text-base font-black leading-tight">{product.name}</h3>
                    <p className="mt-1 text-sm font-black text-[var(--brand-red)]">{displayPrice(product)}</p>
                    <p className="mt-2 line-clamp-2 min-h-9 text-[11px] leading-[18px] text-neutral-500">{product.description || "Sin descripción"}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button onClick={() => openEditor(product)} className="rounded-xl bg-black px-2.5 py-2 text-[11px] font-black text-white">Editar</button>
                      <button onClick={() => quickToggle(product, "active")} className="rounded-xl border border-neutral-200 px-2.5 py-2 text-[11px] font-bold text-neutral-700">{product.active ? "Desactivar" : "Activar"}</button>
                      {product.type !== "MODIFIER" && <button onClick={() => quickToggle(product, "visibleInPos")} className="rounded-xl border border-neutral-200 px-2.5 py-2 text-[11px] font-bold text-neutral-700">{product.visibleInPos ? "Ocultar POS" : "Mostrar POS"}</button>}
                      {product.type === "COMBO" && <button onClick={() => openComboBuilder(product)} className="rounded-xl bg-[var(--brand-red)] px-2.5 py-2 text-[11px] font-black text-white">Armar combo</button>}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {visibleProducts.length === 0 && <div className="alento-card rounded-[28px] p-10 text-center text-sm text-neutral-400">No hay productos para mostrar.</div>}
          </div>
        </section>
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={saveProduct} className="alento-card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[30px] p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">Editar producto</p><h2 className="mt-1 text-2xl font-black">{editor.name}</h2></div>
              <button type="button" onClick={() => setEditor(null)} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-bold">Cerrar</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Nombre</span><input value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label>
              <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Descripción</span><textarea value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} className="alento-input min-h-24 w-full rounded-2xl px-4 py-3" /></label>
              <label className="space-y-1.5"><span className="text-sm font-bold">{editor.type === "PIZZA_SINGLE" ? "Valor del sabor" : "Precio base"}</span><input value={editor.basePrice} onChange={(event) => setEditor({ ...editor, basePrice: event.target.value })} inputMode="numeric" className="alento-input w-full rounded-2xl px-4 py-3" /></label>
              <div className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm"><p className="font-bold">Tipo</p><p className="mt-1 text-neutral-500">{editor.type}</p></div>
              <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Imagen principal · URL</span><input value={editor.imageUrl} onChange={(event) => setEditor({ ...editor, imageUrl: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label>
              <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Imagen secundaria · URL</span><input value={editor.imageUrl2} onChange={(event) => setEditor({ ...editor, imageUrl2: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3"><input type="checkbox" checked={editor.active} onChange={(event) => setEditor({ ...editor, active: event.target.checked })} /><span className="text-sm font-bold">Activo</span></label>
              {editor.type !== "MODIFIER" && <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3"><input type="checkbox" checked={editor.visibleInPos} onChange={(event) => setEditor({ ...editor, visibleInPos: event.target.checked })} /><span className="text-sm font-bold">Visible en POS</span></label>}
              {editor.type !== "MODIFIER" && <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3"><input type="checkbox" checked={editor.featured} onChange={(event) => setEditor({ ...editor, featured: event.target.checked })} /><span className="text-sm font-bold">Destacado</span></label>}
            </div>
            {editor.type === "PIZZA_SINGLE" && <p className="mt-4 rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600">En el menú se muestra el precio real mínimo: tamaño Personal + valor del sabor.</p>}
            {saveMessage && <p className="mt-4 rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-medium">{saveMessage}</p>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditor(null)} className="rounded-2xl border border-neutral-200 px-4 py-3 font-bold">Cancelar</button><button type="submit" disabled={saving} className="alento-red-glow rounded-2xl bg-[var(--brand-red)] px-5 py-3 font-black text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar cambios"}</button></div>
          </form>
        </div>
      )}

      {showIngredientCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={createIngredient} className="alento-card w-full max-w-lg rounded-[30px] p-6">
            <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">Ingredientes</p><h2 className="mt-1 text-2xl font-black">Nuevo ingrediente</h2></div><button type="button" onClick={() => setShowIngredientCreator(false)} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-bold">Cerrar</button></div>
            <div className="space-y-4">
              <label className="block space-y-1.5"><span className="text-sm font-bold">Nombre *</span><input value={ingredientName} onChange={(event) => setIngredientName(event.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" placeholder="Ej. Extra Queso Mozzarella" autoFocus /></label>
              <label className="block space-y-1.5"><span className="text-sm font-bold">Descripción</span><textarea value={ingredientDescription} onChange={(event) => setIngredientDescription(event.target.value)} className="alento-input min-h-20 w-full rounded-2xl px-4 py-3" /></label>
              <label className="block space-y-1.5"><span className="text-sm font-bold">Precio</span><input value={ingredientPrice} onChange={(event) => setIngredientPrice(event.target.value)} inputMode="numeric" className="alento-input w-full rounded-2xl px-4 py-3" placeholder="5000" /></label>
              <label className="block space-y-1.5"><span className="text-sm font-bold">Imagen · URL <span className="font-normal text-neutral-400">(opcional)</span></span><input value={ingredientImage} onChange={(event) => setIngredientImage(event.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" /></label>
            </div>
            {ingredientError && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{ingredientError}</p>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowIngredientCreator(false)} className="rounded-2xl border border-neutral-200 px-4 py-3 font-bold">Cancelar</button><button type="submit" disabled={creatingIngredient} className="rounded-2xl bg-[var(--brand-red)] px-5 py-3 font-black text-white disabled:opacity-50">{creatingIngredient ? "Creando..." : "Crear ingrediente"}</button></div>
          </form>
        </div>
      )}

      {comboProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="alento-card max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[30px] p-6">
            <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">Constructor de combo</p><h2 className="mt-1 text-2xl font-black">{comboProduct.name}</h2><p className="mt-1 text-sm text-neutral-500">Crea grupos como “Incluye” o “Elige una bebida” y define cuántas opciones puede seleccionar el cliente.</p></div><button onClick={() => setComboProduct(null)} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-bold">Cerrar</button></div>
            <div className="space-y-4">
              {comboGroups.map((group, groupIndex) => (
                <section key={groupIndex} className="rounded-[24px] border border-neutral-200 bg-[#faf9f7] p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_130px_130px_auto]">
                    <input value={group.name} onChange={(event) => setComboGroups((current) => current.map((item, index) => index === groupIndex ? { ...item, name: event.target.value } : item))} className="alento-input rounded-2xl px-4 py-3" placeholder="Nombre del grupo" />
                    <input type="number" min="0" value={group.minSelections} onChange={(event) => setComboGroups((current) => current.map((item, index) => index === groupIndex ? { ...item, minSelections: Number(event.target.value) } : item))} className="alento-input rounded-2xl px-4 py-3" title="Mínimo" />
                    <input type="number" min="1" value={group.maxSelections} onChange={(event) => setComboGroups((current) => current.map((item, index) => index === groupIndex ? { ...item, maxSelections: Number(event.target.value) } : item))} className="alento-input rounded-2xl px-4 py-3" title="Máximo" />
                    <button onClick={() => setComboGroups((current) => current.filter((_, index) => index !== groupIndex))} className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-bold text-red-600">Eliminar</button>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {comboCandidates.map((candidate) => {
                      const selected = group.options.some((option) => option.productId === candidate.id);
                      return <button key={candidate.id} onClick={() => toggleComboOption(groupIndex, candidate)} className={`rounded-2xl border px-3 py-3 text-left text-sm ${selected ? "border-black bg-black text-white" : "border-neutral-200 bg-white text-neutral-700"}`}><span className="block font-black">{candidate.name}</span><span className={`mt-1 block text-xs ${selected ? "text-white/55" : "text-neutral-400"}`}>{selected ? "Incluido" : "Agregar al grupo"}</span></button>;
                    })}
                  </div>
                </section>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><button onClick={() => setComboGroups((current) => [...current, { name: `Grupo ${current.length + 1}`, minSelections: 1, maxSelections: 1, options: [] }])} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-bold">+ Agregar grupo</button><div className="flex gap-2"><button onClick={() => setComboProduct(null)} className="rounded-2xl border border-neutral-200 px-4 py-3 font-bold">Cancelar</button><button onClick={saveCombo} disabled={savingCombo} className="alento-red-glow rounded-2xl bg-[var(--brand-red)] px-5 py-3 font-black text-white disabled:opacity-50">{savingCombo ? "Guardando..." : "Guardar combo"}</button></div></div>
          </div>
        </div>
      )}
    </main>
  );
}
