"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import ActionConfirmModal from "@/components/ActionConfirmModal";

type ProductType = "STANDARD" | "PIZZA_SINGLE" | "PIZZA_TWO_FLAVORS" | "COMBO" | "MODIFIER" | "INTERNAL";
type ComboOption = { id?: number; productId: number; productName?: string; quantity: number; priceDelta: number };
type ComboGroup = { id?: number; kind: string; name: string; minSelections: number; maxSelections: number; options: ComboOption[] };
type ComboPizzaRule = { id?: number; quantity: number; sizeIds: number[]; flavorIds: number[] };
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
  comboDiscount?: number | null;
  comboRegularMin?: number | null;
  comboRegularMax?: number | null;
  comboFinalMin?: number | null;
  comboFinalMax?: number | null;
  comboPizzaRules: ComboPizzaRule[];
  comboGroups: ComboGroup[];
};
type Category = { id: number; name: string; slug: string; active: boolean; visibleInPos: boolean; sortOrder: number; products: Product[] };
type PizzaSize = { id: number; name: string; diameterCm: number; basePrice: number };
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
type CreateState = { categorySlug: string; name: string; description: string; basePrice: string; imageUrl: string; imageUrl2: string };
type ComboState = {
  id?: number;
  name: string;
  description: string;
  discountAmount: string;
  imageUrl: string;
  imageUrl2: string;
  pizzaQuantity: number;
  pizzaSizeIds: number[];
  pizzaFlavorIds: number[];
  snackQuantity: number;
  snackProductIds: number[];
  beverageQuantity: number;
  beverageProductIds: number[];
};

const priority = new Map([
  ["destacados", 1],
  ["pizzas", 2],
  ["antojos", 3],
  ["bebidas", 4],
  ["combos", 5],
  ["ingredientes", 20],
]);

function formatCOP(value: number | null | undefined) {
  if (value == null) return "Sin precio";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function toggleId(values: number[], id: number) {
  return values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
}

export default function MenuPage() {
  const [data, setData] = useState<MenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [createState, setCreateState] = useState<CreateState | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [comboState, setComboState] = useState<ComboState | null>(null);
  const [savingCombo, setSavingCombo] = useState(false);
  const [comboError, setComboError] = useState("");
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [draggingProductId, setDraggingProductId] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

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
    void loadMenu(false);
  }, []);

  const activeCategory = useMemo(
    () => data?.categories.find((category) => category.id === activeCategoryId) ?? data?.categories[0],
    [data, activeCategoryId],
  );

  const totalProducts = useMemo(
    () => data?.categories.filter((category) => category.slug !== "destacados").reduce((sum, category) => sum + category.products.length, 0) ?? 0,
    [data],
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

  const pizzas = useMemo(() => {
    const category = data?.categories.find((item) => item.slug === "pizzas");
    return (category?.products ?? []).filter((product) => product.type === "PIZZA_SINGLE" && product.active);
  }, [data]);

  const snacks = useMemo(() => {
    const category = data?.categories.find((item) => item.slug === "antojos");
    return (category?.products ?? []).filter((product) => product.active);
  }, [data]);

  const beverages = useMemo(() => {
    const category = data?.categories.find((item) => item.slug === "bebidas");
    return (category?.products ?? []).filter((product) => product.active);
  }, [data]);

  function displayProductPrice(product: Product) {
    if (product.type === "PIZZA_SINGLE") return `Desde ${formatCOP(minPizzaSizePrice + (product.basePrice ?? 0))}`;
    if (product.type === "PIZZA_TWO_FLAVORS") return "Precio según sabores";
    if (product.type === "COMBO" && product.comboFinalMin != null && product.comboFinalMax != null) {
      return product.comboFinalMin === product.comboFinalMax ? formatCOP(product.comboFinalMin) : `Desde ${formatCOP(product.comboFinalMin)}`;
    }
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
    setError("");
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
      setNotice("Producto actualizado correctamente.");
      await loadMenu();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar el producto.");
    } finally {
      setSaving(false);
    }
  }

  async function quickToggle(product: Product, field: "active" | "visibleInPos") {
    setError("");
    const response = await fetch("/api/menu-admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, [field]: !product[field] }),
    });
    const result = await response.json();
    if (!response.ok) return setError(result.error || "No fue posible actualizar el producto.");
    setSelectedProduct(null);
    await loadMenu();
  }

  async function persistProductOrder(category: Category, productIds: number[]) {
    setSavingOrder(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/menu-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorderProducts",
          categoryId: category.id,
          productIds,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible guardar el orden.");

      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          categories: current.categories.map((item) => {
            if (item.id !== category.id) return item;
            const byId = new Map(item.products.map((product) => [product.id, product] as const));
            return {
              ...item,
              products: productIds.map((id, index) => ({
                ...byId.get(id)!,
                sortOrder: index,
              })),
            };
          }),
        };
      });

      setNotice("Orden de productos actualizado.");
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : "No fue posible guardar el orden.");
      await loadMenu();
    } finally {
      setSavingOrder(false);
    }
  }

  function moveProductBefore(targetProductId: number) {
    if (!activeCategory || draggingProductId == null || draggingProductId === targetProductId) return;
    if (query.trim()) return;
    if (activeCategory.slug === "destacados") return;

    const current = [...activeCategory.products];
    const fromIndex = current.findIndex((product) => product.id === draggingProductId);
    const toIndex = current.findIndex((product) => product.id === targetProductId);

    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);

    const productIds = current.map((product) => product.id);

    setData((state) => {
      if (!state) return state;
      return {
        ...state,
        categories: state.categories.map((category) =>
          category.id === activeCategory.id
            ? {
                ...category,
                products: current.map((product, index) => ({ ...product, sortOrder: index })),
              }
            : category,
        ),
      };
    });

    void persistProductOrder(activeCategory, productIds);
  }

  async function deleteProduct(product: Product) {
    setDeletingProductId(product.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/menu-admin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible eliminar el producto.");
      setNotice(`${product.name} fue eliminado.`);
      setSelectedProduct(null);
      setDeleteTarget(null);
      await loadMenu();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No fue posible eliminar el producto.");
    } finally {
      setDeletingProductId(null);
    }
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
      setNotice("Producto creado correctamente.");
      await loadMenu();
    } catch (createProductError) {
      setCreateError(createProductError instanceof Error ? createProductError.message : "No fue posible crear el producto.");
    } finally {
      setCreating(false);
    }
  }

  function startCombo(product?: Product) {
    setComboError("");
    const pizzaRule = product?.comboPizzaRules?.[0];
    const snackGroup = product?.comboGroups?.find((group) => group.kind === "ANTOJO");
    const beverageGroup = product?.comboGroups?.find((group) => group.kind === "BEBIDA");
    setComboState({
      id: product?.id,
      name: product?.name ?? "",
      description: product?.description ?? "",
      discountAmount: product?.comboDiscount == null ? "" : String(product.comboDiscount),
      imageUrl: product?.imageUrl ?? "",
      imageUrl2: product?.imageUrl2 ?? "",
      pizzaQuantity: pizzaRule?.quantity ?? 0,
      pizzaSizeIds: pizzaRule?.sizeIds ?? [],
      pizzaFlavorIds: pizzaRule?.flavorIds ?? [],
      snackQuantity: snackGroup?.minSelections ?? 0,
      snackProductIds: snackGroup?.options.map((option) => option.productId) ?? [],
      beverageQuantity: beverageGroup?.minSelections ?? 0,
      beverageProductIds: beverageGroup?.options.map((option) => option.productId) ?? [],
    });
  }

  const comboPreview = useMemo(() => {
    if (!comboState) return { min: 0, max: 0, discount: 0, finalMin: 0, finalMax: 0 };
    let min = 0;
    let max = 0;

    if (comboState.pizzaQuantity > 0 && comboState.pizzaSizeIds.length && comboState.pizzaFlavorIds.length) {
      const selectedSizes = (data?.sizes ?? []).filter((size) => comboState.pizzaSizeIds.includes(size.id));
      const selectedFlavors = pizzas.filter((pizza) => comboState.pizzaFlavorIds.includes(pizza.id));
      const sizePrices = selectedSizes.map((size) => size.basePrice);
      const flavorPrices = selectedFlavors.map((pizza) => pizza.basePrice ?? 0);
      if (sizePrices.length && flavorPrices.length) {
        min += (Math.min(...sizePrices) + Math.min(...flavorPrices)) * comboState.pizzaQuantity;
        max += (Math.max(...sizePrices) + Math.max(...flavorPrices)) * comboState.pizzaQuantity;
      }
    }

    if (comboState.snackQuantity > 0 && comboState.snackProductIds.length) {
      const prices = snacks.filter((item) => comboState.snackProductIds.includes(item.id)).map((item) => item.basePrice ?? 0);
      if (prices.length) {
        min += Math.min(...prices) * comboState.snackQuantity;
        max += Math.max(...prices) * comboState.snackQuantity;
      }
    }

    if (comboState.beverageQuantity > 0 && comboState.beverageProductIds.length) {
      const prices = beverages.filter((item) => comboState.beverageProductIds.includes(item.id)).map((item) => item.basePrice ?? 0);
      if (prices.length) {
        min += Math.min(...prices) * comboState.beverageQuantity;
        max += Math.max(...prices) * comboState.beverageQuantity;
      }
    }

    const discount = Math.max(0, Number(comboState.discountAmount) || 0);
    return { min, max, discount, finalMin: Math.max(0, min - discount), finalMax: Math.max(0, max - discount) };
  }, [comboState, data, pizzas, snacks, beverages]);

  async function saveCombo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comboState) return;
    setSavingCombo(true);
    setComboError("");
    try {
      const response = await fetch("/api/menu-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: comboState.id ? "saveCombo" : "createCombo",
          comboProductId: comboState.id,
          name: comboState.name,
          description: comboState.description,
          imageUrl: comboState.imageUrl,
          imageUrl2: comboState.imageUrl2,
          discountAmount: comboState.discountAmount,
          pizzaQuantity: comboState.pizzaQuantity,
          pizzaSizeIds: comboState.pizzaSizeIds,
          pizzaFlavorIds: comboState.pizzaFlavorIds,
          snackQuantity: comboState.snackQuantity,
          snackProductIds: comboState.snackProductIds,
          beverageQuantity: comboState.beverageQuantity,
          beverageProductIds: comboState.beverageProductIds,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible guardar el combo.");
      setComboState(null);
      setNotice(comboState.id ? "Combo actualizado correctamente." : "Combo creado correctamente.");
      await loadMenu(false);
    } catch (comboSaveError) {
      setComboError(comboSaveError instanceof Error ? comboSaveError.message : "No fue posible guardar el combo.");
    } finally {
      setSavingCombo(false);
    }
  }

  if (loading && !data) {
    return <main className="p-6 lg:p-8"><div className="alento-card mx-auto max-w-7xl rounded-[28px] p-8">Cargando administración del menú...</div></main>;
  }

  return (
    <main className="min-h-screen p-3 sm:p-4 lg:p-5 xl:p-5">
      <div className="w-full space-y-4">
        <header className="alento-dark rounded-[28px] px-7 py-5 md:px-8 md:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Administración del catálogo</p>
              <h1 className="mt-0.5 text-3xl font-black tracking-[-0.035em]">Menú</h1>
              <p className="mt-1 text-sm text-white/65">Organiza productos, precios, visibilidad y combos desde un solo lugar.</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2.5 text-center shadow-inner">
                <span className="block text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">Productos</span>
                <b className="mt-0.5 block text-[28px] font-black leading-none tabular-nums text-white">{totalProducts}</b>
              </div>
              <button
                type="button"
                onClick={() => startCombo()}
                className="alento-red-glow h-[52px] rounded-2xl bg-[var(--brand-red)] px-5 text-sm font-black text-white"
              >
                + Crear combo
              </button>
            </div>
          </div>
        </header>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
        {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div>}

        <section className="grid gap-4 xl:grid-cols-[205px_minmax(0,1fr)]">
          <aside className="alento-card h-fit rounded-[24px] p-3 xl:sticky xl:top-5">
            <div className="mb-3 px-1"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">Catálogo</p><h2 className="mt-1 text-lg font-black">Categorías</h2></div>
            <div className="space-y-1.5">
              {data?.categories.map((category) => {
                const active = activeCategory?.id === category.id;
                return (
                  <button key={category.id} onClick={() => { setActiveCategoryId(category.id); setQuery(""); setNotice(""); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left ${active ? "bg-black text-white" : "bg-[#faf9f7] text-neutral-700 hover:bg-neutral-100"}`}>
                    <span><span className="block text-sm font-black">{category.name}</span><span className={`block text-[10px] ${active ? "text-white/50" : "text-neutral-400"}`}>{category.products.length} productos</span></span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-3">
            <div className="alento-card rounded-[24px] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">Categoría</p>
                  <h2 className="mt-1 text-2xl font-black">{activeCategory?.name ?? "Productos"}</h2>
                  {activeCategory && activeCategory.slug !== "destacados" && (
                    <p className="mt-1 text-[11px] text-neutral-400">
                      {query.trim() ? "Quita la búsqueda para reorganizar productos." : savingOrder ? "Guardando nuevo orden..." : "Arrastra las tarjetas para cambiar el orden en el POS."}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {activeCategory && ["pizzas", "antojos", "bebidas", "ingredientes"].includes(activeCategory.slug) && <button onClick={() => startCreateProduct(activeCategory)} className="rounded-2xl bg-black px-4 py-3 text-sm font-black text-white">+ {activeCategory.slug === "ingredientes" ? "Ingrediente" : "Producto"}</button>}
                  {activeCategory?.slug === "combos" && <button onClick={() => startCombo()} className="rounded-2xl bg-[var(--brand-red)] px-4 py-3 text-sm font-black text-white">+ Combo</button>}
                  <input value={query} onChange={(event) => setQuery(event.target.value)} className="alento-input w-full rounded-2xl px-4 py-3 sm:w-72" placeholder="Buscar producto..." />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visibleProducts.map((product) => (
                <article
                  key={product.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!savingOrder && draggingProductId == null) setSelectedProduct(product);
                  }}
                  onKeyDown={(event) => {
                    if ((event.key === "Enter" || event.key === " ") && !savingOrder) {
                      event.preventDefault();
                      setSelectedProduct(product);
                    }
                  }}
                  onDragOver={(event) => {
                    if (draggingProductId == null || query.trim() || activeCategory?.slug === "destacados") return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    moveProductBefore(product.id);
                    setDraggingProductId(null);
                  }}
                  className={`alento-card group relative cursor-pointer overflow-hidden rounded-[20px] border border-neutral-200 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_14px_30px_rgba(28,23,20,.08)] ${draggingProductId === product.id ? "opacity-45 ring-2 ring-black/10" : ""}`}
                >
                  {!query.trim() && activeCategory?.slug !== "destacados" && (
                    <div
                      role="button"
                      tabIndex={0}
                      draggable={!savingOrder}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      onDragStart={(event) => {
                        event.stopPropagation();
                        if (savingOrder) {
                          event.preventDefault();
                          return;
                        }
                        setDraggingProductId(product.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(product.id));
                      }}
                      onDragEnd={(event) => {
                        event.stopPropagation();
                        setDraggingProductId(null);
                      }}
                      className="absolute right-2.5 top-2.5 z-20 flex h-8 w-8 cursor-grab items-center justify-center rounded-xl border border-white/80 bg-white/95 text-[15px] font-black text-neutral-500 shadow-sm backdrop-blur active:cursor-grabbing"
                      title="Arrastrar para reordenar"
                    >
                      ⋮⋮
                    </div>
                  )}

                  <div className="relative aspect-square overflow-hidden border-b border-neutral-100 bg-[#f7f6f3] p-1.5">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl">🍕</div>
                    )}
                    <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-1 text-[9px] font-black ${product.active ? "bg-emerald-500 text-white" : "bg-neutral-700 text-white"}`}>
                        {product.active ? "Activo" : "Inactivo"}
                      </span>
                      {product.featured && (
                        <span className="rounded-full bg-[var(--brand-red)] px-2 py-1 text-[9px] font-black text-white">Destacado</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-400">{product.type}</p>
                    <h3 className="mt-1 truncate text-[15px] font-black leading-tight text-neutral-950">{product.name}</h3>
                    <p className="mt-1 text-[13px] font-black text-[var(--brand-red)]">{displayProductPrice(product)}</p>
                    <p className="mt-2 line-clamp-2 min-h-8 text-[11px] leading-4 text-neutral-500">{product.description || "Sin descripción"}</p>

                    <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                      <span className="text-[10px] font-semibold text-neutral-400">Abrir producto</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-sm font-black text-neutral-500 transition group-hover:bg-black group-hover:text-white">→</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {visibleProducts.length === 0 && <div className="alento-card rounded-[24px] p-8 text-center text-sm text-neutral-400">No hay productos para mostrar.</div>}
          </div>
        </section>
      </div>

      {selectedProduct && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProduct(null);
          }}
        >
          <div className="w-full max-w-[980px] overflow-hidden rounded-[30px] border border-neutral-200 bg-white shadow-[0_30px_90px_rgba(0,0,0,.28)]">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-100 bg-[linear-gradient(135deg,#ffffff,#faf8f5)] px-6 py-5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-400">Administrar producto</p>
                <h2 className="mt-1 text-[26px] font-black tracking-[-0.03em] text-neutral-950">{selectedProduct.name}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[9px] font-bold uppercase text-neutral-600">{selectedProduct.type}</span>
                  <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase ${selectedProduct.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-neutral-100 text-neutral-600"}`}>
                    {selectedProduct.active ? "Activo" : "Inactivo"}
                  </span>
                  {selectedProduct.visibleInPos && selectedProduct.type !== "MODIFIER" && (
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[9px] font-bold uppercase text-sky-700">Visible en POS</span>
                  )}
                  {selectedProduct.featured && (
                    <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[9px] font-bold uppercase text-red-700">Destacado</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-xl text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-900"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-[300px_minmax(0,1fr)] md:p-6">
              <div>
                <div className="aspect-square overflow-hidden rounded-[22px] border border-neutral-200 bg-[#f7f6f3] p-2">
                  {selectedProduct.imageUrl ? (
                    <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl">🍕</div>
                  )}
                </div>

                <div className="mt-3 rounded-2xl border border-neutral-200 bg-[#faf9f7] p-4">
                  <span className="block text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-400">Precio</span>
                  <b className="mt-1.5 block text-[20px] font-black tracking-[-0.02em] text-[var(--brand-red)]">{displayProductPrice(selectedProduct)}</b>
                  <p className="mt-2 text-[11px] leading-4 text-neutral-500">{selectedProduct.description || "Sin descripción registrada."}</p>
                </div>
              </div>

              <div className="min-w-0">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400">Acciones del producto</p>
                  <h3 className="mt-1 text-[19px] font-black tracking-[-0.02em] text-neutral-950">¿Qué deseas hacer?</h3>
                </div>

                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      const product = selectedProduct;
                      setSelectedProduct(null);
                      openEditor(product);
                    }}
                    className="group rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-400 hover:shadow-sm"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-950 text-sm font-black text-white">✎</span>
                    <b className="mt-3 block text-[13px] text-neutral-950">Editar información</b>
                    <span className="mt-1 block text-[10px] leading-4 text-neutral-500">Nombre, precio, descripción, imágenes y estados.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void quickToggle(selectedProduct, "active")}
                    className={`rounded-2xl border p-4 text-left transition ${selectedProduct.active ? "border-amber-200 bg-amber-50/60 hover:bg-amber-50" : "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50"}`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${selectedProduct.active ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>●</span>
                    <b className="mt-3 block text-[13px] text-neutral-950">{selectedProduct.active ? "Desactivar producto" : "Activar producto"}</b>
                    <span className="mt-1 block text-[10px] leading-4 text-neutral-500">{selectedProduct.active ? "Deja de ofrecerlo temporalmente." : "Vuelve a habilitarlo en el catálogo."}</span>
                  </button>

                  {selectedProduct.type !== "MODIFIER" && (
                    <button
                      type="button"
                      onClick={() => void quickToggle(selectedProduct, "visibleInPos")}
                      className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 text-left transition hover:bg-sky-50"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sm font-black text-sky-700">POS</span>
                      <b className="mt-3 block text-[13px] text-neutral-950">{selectedProduct.visibleInPos ? "Ocultar del POS" : "Mostrar en POS"}</b>
                      <span className="mt-1 block text-[10px] leading-4 text-neutral-500">Controla si aparece en el catálogo del punto de venta.</span>
                    </button>
                  )}

                  {selectedProduct.type === "COMBO" && (
                    <button
                      type="button"
                      onClick={() => {
                        const product = selectedProduct;
                        setSelectedProduct(null);
                        startCombo(product);
                      }}
                      className="rounded-2xl border border-red-200 bg-red-50/60 p-4 text-left transition hover:bg-red-50"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-sm font-black text-red-700">+</span>
                      <b className="mt-3 block text-[13px] text-neutral-950">Configurar combo</b>
                      <span className="mt-1 block text-[10px] leading-4 text-neutral-500">Productos, cantidades, sabores, tamaños y descuento.</span>
                    </button>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <b className="text-[12px] text-red-900">Eliminar producto</b>
                      <p className="mt-1 text-[10px] leading-4 text-red-700">Solo podrá eliminarse si no tiene pedidos ni dependencias activas.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(selectedProduct)}
                      className="shrink-0 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-[11px] font-black text-red-700 shadow-sm hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={saveProduct} className="alento-card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] p-6">
            <div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">Editar producto</p><h2 className="mt-1 text-2xl font-black">{editor.name}</h2></div><button type="button" onClick={() => setEditor(null)} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-bold">Cerrar</button></div>
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
              <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3"><input type="checkbox" checked={editor.visibleInPos} onChange={(event) => setEditor({ ...editor, visibleInPos: event.target.checked })} disabled={editor.type === "MODIFIER"} /><span className="text-sm font-bold">Visible en POS</span></label>
              <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3"><input type="checkbox" checked={editor.featured} onChange={(event) => setEditor({ ...editor, featured: event.target.checked })} disabled={editor.type === "MODIFIER"} /><span className="text-sm font-bold">Destacado</span></label>
            </div>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditor(null)} className="rounded-2xl border border-neutral-200 px-4 py-3 font-bold">Cancelar</button><button type="submit" disabled={saving} className="alento-red-glow rounded-2xl bg-[var(--brand-red)] px-5 py-3 font-black text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar cambios"}</button></div>
          </form>
        </div>
      )}

      {createState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={createProduct} className="alento-card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] p-6">
            <div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">Nuevo producto</p><h2 className="mt-1 text-2xl font-black">Crear en {activeCategory?.name}</h2></div><button type="button" onClick={() => setCreateState(null)} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-bold">Cerrar</button></div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Nombre *</span><input value={createState.name} onChange={(event) => setCreateState({ ...createState, name: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" autoFocus /></label>
              <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Descripción</span><textarea value={createState.description} onChange={(event) => setCreateState({ ...createState, description: event.target.value })} className="alento-input min-h-24 w-full rounded-2xl px-4 py-3" /></label>
              <label className="space-y-1.5"><span className="text-sm font-bold">{createState.categorySlug === "pizzas" ? "Valor del sabor *" : "Precio *"}</span><input value={createState.basePrice} onChange={(event) => setCreateState({ ...createState, basePrice: event.target.value })} inputMode="numeric" className="alento-input w-full rounded-2xl px-4 py-3" placeholder={createState.categorySlug === "ingredientes" ? "5000" : ""} /></label>
              <div className="rounded-2xl bg-neutral-100 p-3 text-sm text-neutral-500">{createState.categorySlug === "pizzas" ? `Al POS se mostrará sumando el tamaño Personal (${formatCOP(minPizzaSizePrice)}).` : createState.categorySlug === "ingredientes" ? "Se creará como ingrediente adicional y no como producto independiente del POS." : "Producto estándar con precio fijo."}</div>
              <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Imagen principal · URL</span><input value={createState.imageUrl} onChange={(event) => setCreateState({ ...createState, imageUrl: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label>
              <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Imagen secundaria · URL</span><input value={createState.imageUrl2} onChange={(event) => setCreateState({ ...createState, imageUrl2: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label>
            </div>
            {createError && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{createError}</p>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCreateState(null)} className="rounded-2xl border border-neutral-200 px-4 py-3 font-bold">Cancelar</button><button type="submit" disabled={creating} className="alento-red-glow rounded-2xl bg-[var(--brand-red)] px-5 py-3 font-black text-white disabled:opacity-50">{creating ? "Creando..." : "Crear producto"}</button></div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <ActionConfirmModal
          variant="danger"
          eyebrow="Eliminar producto"
          title={`Eliminar ${deleteTarget.name}`}
          description="Esta acción no se puede deshacer."
          detail="Solo se eliminará si el producto no tiene pedidos registrados ni dependencias activas en combos."
          confirmLabel={deletingProductId === deleteTarget.id ? "Eliminando..." : "Eliminar producto"}
          cancelLabel="Cancelar"
          busy={deletingProductId === deleteTarget.id}
          onClose={() => {
            if (deletingProductId == null) setDeleteTarget(null);
          }}
          onConfirm={() => void deleteProduct(deleteTarget)}
        />
      )}

      {comboState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <form onSubmit={saveCombo} className="alento-card max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-[30px] p-6">
            <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">Constructor de combo</p><h2 className="mt-1 text-2xl font-black">{comboState.id ? `Configurar ${comboState.name}` : "Crear combo"}</h2><p className="mt-1 text-sm text-neutral-500">Define qué tamaños, sabores y productos puede escoger el cliente.</p></div><button type="button" onClick={() => setComboState(null)} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-bold">Cerrar</button></div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                <section className="rounded-[24px] border border-neutral-200 p-4">
                  <h3 className="font-black">Información del combo</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Nombre *</span><input value={comboState.name} onChange={(event) => setComboState({ ...comboState, name: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label>
                    <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Descripción</span><textarea value={comboState.description} onChange={(event) => setComboState({ ...comboState, description: event.target.value })} className="alento-input min-h-20 w-full rounded-2xl px-4 py-3" /></label>
                    <label className="space-y-1.5"><span className="text-sm font-bold">Imagen principal · URL</span><input value={comboState.imageUrl} onChange={(event) => setComboState({ ...comboState, imageUrl: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label>
                    <label className="space-y-1.5"><span className="text-sm font-bold">Imagen secundaria · URL</span><input value={comboState.imageUrl2} onChange={(event) => setComboState({ ...comboState, imageUrl2: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label>
                  </div>
                </section>

                <section className="rounded-[24px] border border-neutral-200 bg-[#faf9f7] p-4">
                  <div className="flex items-center justify-between gap-4"><div><h3 className="font-black">Pizza</h3><p className="text-xs text-neutral-500">Cantidad de pizzas, tamaños permitidos y sabores disponibles.</p></div><label className="flex items-center gap-2"><span className="text-xs font-bold">Cantidad</span><input type="number" min="0" max="10" value={comboState.pizzaQuantity} onChange={(event) => setComboState({ ...comboState, pizzaQuantity: Math.max(0, Number(event.target.value) || 0) })} className="alento-input w-20 rounded-xl px-3 py-2" /></label></div>
                  {comboState.pizzaQuantity > 0 && <><p className="mb-2 mt-4 text-xs font-black uppercase tracking-[0.12em] text-neutral-400">Tamaños permitidos</p><div className="flex flex-wrap gap-2">{data?.sizes.map((size) => { const selected = comboState.pizzaSizeIds.includes(size.id); return <button key={size.id} type="button" onClick={() => setComboState({ ...comboState, pizzaSizeIds: toggleId(comboState.pizzaSizeIds, size.id) })} className={`rounded-xl border px-3 py-2 text-sm font-bold ${selected ? "border-black bg-black text-white" : "border-neutral-200 bg-white"}`}>{size.name} · {formatCOP(size.basePrice)}</button>; })}</div><p className="mb-2 mt-4 text-xs font-black uppercase tracking-[0.12em] text-neutral-400">Sabores permitidos</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{pizzas.map((pizza) => { const selected = comboState.pizzaFlavorIds.includes(pizza.id); return <button key={pizza.id} type="button" onClick={() => setComboState({ ...comboState, pizzaFlavorIds: toggleId(comboState.pizzaFlavorIds, pizza.id) })} className={`rounded-xl border p-3 text-left ${selected ? "border-black bg-black text-white" : "border-neutral-200 bg-white"}`}><span className="block text-sm font-black">{pizza.name}</span><span className={`mt-1 block text-xs ${selected ? "text-white/55" : "text-neutral-400"}`}>Sabor {formatCOP(pizza.basePrice)}</span></button>; })}</div></>}
                </section>

                <section className="rounded-[24px] border border-neutral-200 bg-[#faf9f7] p-4">
                  <div className="flex items-center justify-between gap-4"><div><h3 className="font-black">Antojo</h3><p className="text-xs text-neutral-500">Opciones permitidas dentro del combo.</p></div><label className="flex items-center gap-2"><span className="text-xs font-bold">Cantidad</span><input type="number" min="0" max="10" value={comboState.snackQuantity} onChange={(event) => setComboState({ ...comboState, snackQuantity: Math.max(0, Number(event.target.value) || 0) })} className="alento-input w-20 rounded-xl px-3 py-2" /></label></div>
                  {comboState.snackQuantity > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{snacks.map((product) => { const selected = comboState.snackProductIds.includes(product.id); return <button key={product.id} type="button" onClick={() => setComboState({ ...comboState, snackProductIds: toggleId(comboState.snackProductIds, product.id) })} className={`rounded-xl border p-3 text-left ${selected ? "border-black bg-black text-white" : "border-neutral-200 bg-white"}`}><span className="block text-sm font-black">{product.name}</span><span className={`mt-1 block text-xs ${selected ? "text-white/55" : "text-neutral-400"}`}>{formatCOP(product.basePrice)}</span></button>; })}</div>}
                </section>

                <section className="rounded-[24px] border border-neutral-200 bg-[#faf9f7] p-4">
                  <div className="flex items-center justify-between gap-4"><div><h3 className="font-black">Bebida</h3><p className="text-xs text-neutral-500">Selecciona las presentaciones que aplican.</p></div><label className="flex items-center gap-2"><span className="text-xs font-bold">Cantidad</span><input type="number" min="0" max="10" value={comboState.beverageQuantity} onChange={(event) => setComboState({ ...comboState, beverageQuantity: Math.max(0, Number(event.target.value) || 0) })} className="alento-input w-20 rounded-xl px-3 py-2" /></label></div>
                  {comboState.beverageQuantity > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{beverages.map((product) => { const selected = comboState.beverageProductIds.includes(product.id); return <button key={product.id} type="button" onClick={() => setComboState({ ...comboState, beverageProductIds: toggleId(comboState.beverageProductIds, product.id) })} className={`rounded-xl border p-3 text-left ${selected ? "border-black bg-black text-white" : "border-neutral-200 bg-white"}`}><span className="block text-sm font-black">{product.name}</span><span className={`mt-1 block text-xs ${selected ? "text-white/55" : "text-neutral-400"}`}>{formatCOP(product.basePrice)}</span></button>; })}</div>}
                </section>
              </div>

              <aside className="h-fit rounded-[24px] bg-[#111112] p-5 text-white xl:sticky xl:top-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Resumen</p><h3 className="mt-1 text-xl font-black">{comboState.name || "Nuevo combo"}</h3>
                <div className="mt-4 space-y-2 text-sm text-white/65">{comboState.pizzaQuantity > 0 && <p>{comboState.pizzaQuantity} × pizza · {comboState.pizzaSizeIds.length} tamaños · {comboState.pizzaFlavorIds.length} sabores</p>}{comboState.snackQuantity > 0 && <p>{comboState.snackQuantity} × antojo · {comboState.snackProductIds.length} opciones</p>}{comboState.beverageQuantity > 0 && <p>{comboState.beverageQuantity} × bebida · {comboState.beverageProductIds.length} opciones</p>}</div>
                <div className="mt-5 space-y-3 border-t border-white/10 pt-4"><div className="flex justify-between gap-3 text-sm"><span className="text-white/55">Valor normal mínimo</span><strong>{formatCOP(comboPreview.min)}</strong></div><div className="flex justify-between gap-3 text-sm"><span className="text-white/55">Valor normal máximo</span><strong>{formatCOP(comboPreview.max)}</strong></div><label className="block"><span className="text-xs font-bold text-white/55">Descuento del combo</span><input value={comboState.discountAmount} onChange={(event) => setComboState({ ...comboState, discountAmount: event.target.value })} inputMode="numeric" className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xl font-black text-white outline-none" placeholder="7800" /></label><div className="rounded-2xl bg-[var(--brand-red)]/15 px-3 py-2.5 text-sm"><div className="flex justify-between"><span className="text-white/70">Descuento fijo</span><strong className="text-red-300">- {formatCOP(comboPreview.discount)}</strong></div></div><div className="border-t border-white/10 pt-3"><div className="flex justify-between"><span className="font-black">Precio combo mínimo</span><strong className="text-xl">{formatCOP(comboPreview.finalMin)}</strong></div><div className="mt-1 flex justify-between"><span className="font-black">Precio combo máximo</span><strong className="text-xl">{formatCOP(comboPreview.finalMax)}</strong></div></div></div>
              </aside>
            </div>

            {comboError && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{comboError}</p>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setComboState(null)} className="rounded-2xl border border-neutral-200 px-4 py-3 font-bold">Cancelar</button><button type="submit" disabled={savingCombo} className="alento-red-glow rounded-2xl bg-[var(--brand-red)] px-5 py-3 font-black text-white disabled:opacity-50">{savingCombo ? "Guardando..." : comboState.id ? "Guardar combo" : "Crear combo"}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
