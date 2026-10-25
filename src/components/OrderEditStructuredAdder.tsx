"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComboOrderConfiguration, PizzaOrderConfiguration } from "@/lib/orderConfiguration";
import {
  buildComboConfiguration,
  createComboDraft,
  estimateComboPrice,
  type ComboDraftChoice,
} from "@/lib/comboConfiguration";
import {
  buildPizzaConfiguration,
  estimatePizzaPrice,
  isTwoFlavorPizzaProduct,
  pizzaCrustPrice,
} from "@/lib/pizzaConfiguration";

type ProductType = "STANDARD" | "PIZZA_SINGLE" | "PIZZA_TWO_FLAVORS" | "PIZZA_CUSTOM" | "COMBO" | "MODIFIER" | "INTERNAL";
type PizzaSize = { id: number; name: string; diameterCm: number; basePrice: number };
type Modifier = { id: number; name: string; basePrice: number };
type Crust = { id: number; name: string; prices: { sizeId: number; price: number }[] };
type ComboPizzaRule = { id: number; quantity: number; sizes: PizzaSize[]; flavors: { id: number; name: string; basePrice: number }[] };
type ComboGroup = {
  id: number;
  kind: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: { id: number; productId: number; productName: string; basePrice: number; quantity: number; priceDelta: number }[];
};
type CatalogProduct = {
  id: number;
  name: string;
  type: ProductType;
  basePrice: number | null;
  comboDiscount?: number;
  comboPizzaRules?: ComboPizzaRule[];
  comboGroups?: ComboGroup[];
};
type CatalogResponse = {
  categories: { products: CatalogProduct[] }[];
  pizzaFlavors: CatalogProduct[];
  sizes: PizzaSize[];
  crusts: Crust[];
  modifiers: Modifier[];
};
type PizzaDraft = {
  product: CatalogProduct;
  sizeId: number | null;
  firstFlavorId: number | null;
  secondFlavorId: number | null;
  crustId: number | null;
  modifierIds: number[];
  note: string;
};
type ComboDraft = {
  product: CatalogProduct;
  pizzas: ComboDraftChoice[];
  groupSelections: Record<number, number[]>;
};

export type StructuredEditAddition = {
  key: string;
  productId: number;
  quantity: number;
  name: string;
  summary: string;
  estimatedUnitPrice: number;
  configuration: PizzaOrderConfiguration | ComboOrderConfiguration;
  notes?: string;
};

export type ExistingPizzaEditRequest = {
  requestId: number;
  itemId: number;
  productId: number;
  productName: string;
  configuration: unknown;
  notes?: string | null;
};

export type ExistingPizzaEditUpdate = {
  itemId: number;
  summary: string;
  estimatedUnitPrice: number;
  configuration: PizzaOrderConfiguration;
  notes?: string;
};

type Props = {
  additions: StructuredEditAddition[];
  onChange: (items: StructuredEditAddition[]) => void;
  editRequest?: ExistingPizzaEditRequest | null;
  onEditComplete?: (update: ExistingPizzaEditUpdate) => void;
  onEditCancel?: () => void;
};

const money = (value: number) => new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
}).format(value);

const isTwoFlavor = (product: CatalogProduct) =>
  isTwoFlavorPizzaProduct(product);

const crustPrice = (crust: Crust, sizeId: number | null) =>
  pizzaCrustPrice(crust, sizeId);

export default function OrderEditStructuredAdder({
  additions,
  onChange,
  editRequest = null,
  onEditComplete,
  onEditCancel,
}: Props) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"PIZZA" | "COMBO">("PIZZA");
  const [productQuery, setProductQuery] = useState("");
  const [pizza, setPizza] = useState<PizzaDraft | null>(null);
  const [combo, setCombo] = useState<ComboDraft | null>(null);
  const [configError, setConfigError] = useState("");
  const [editingExistingItemId, setEditingExistingItemId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/catalog", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible cargar el catálogo.");
        if (active) setCatalog(data);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el catálogo.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!catalog || !editRequest) return;

    const allProducts = catalog.categories.flatMap(
      (category) => category.products,
    );
    const product =
      allProducts.find((item) => item.id === editRequest.productId) ?? null;

    if (!product) {
      setConfigError(
        "La pizza original ya no está disponible en el catálogo.",
      );
      return;
    }

    const configuration =
      editRequest.configuration &&
      typeof editRequest.configuration === "object" &&
      !Array.isArray(editRequest.configuration)
        ? (editRequest.configuration as {
            size?: { id?: unknown };
            flavors?: Array<{ productId?: unknown }>;
            crust?: { id?: unknown };
            modifiers?: Array<{ productId?: unknown }>;
          })
        : null;

    const sizeId = Number(configuration?.size?.id);
    const crustId = Number(configuration?.crust?.id);
    const flavorIds = Array.isArray(configuration?.flavors)
      ? configuration!.flavors!
          .map((flavor) => Number(flavor?.productId))
          .filter((id) => Number.isInteger(id) && id > 0)
      : [];
    const modifierIds = Array.isArray(configuration?.modifiers)
      ? configuration!.modifiers!
          .map((modifier) => Number(modifier?.productId))
          .filter((id) => Number.isInteger(id) && id > 0)
      : [];

    const fallbackSize = catalog.sizes[0] ?? null;
    const resolvedSizeId =
      Number.isInteger(sizeId) && sizeId > 0
        ? sizeId
        : fallbackSize?.id ?? null;
    const fallbackCrust =
      catalog.crusts.find(
        (item) =>
          item.name.toLowerCase().includes("tradicional") &&
          crustPrice(item, resolvedSizeId) != null,
      ) ??
      catalog.crusts.find(
        (item) => crustPrice(item, resolvedSizeId) != null,
      ) ??
      null;

    setConfigError("");
    setEditingExistingItemId(editRequest.itemId);
    setPizza({
      product,
      sizeId: resolvedSizeId,
      firstFlavorId:
        flavorIds[0] ?? (isTwoFlavor(product) ? null : product.id),
      secondFlavorId: flavorIds[1] ?? null,
      crustId:
        Number.isInteger(crustId) && crustId > 0
          ? crustId
          : fallbackCrust?.id ?? null,
      modifierIds,
      note: editRequest.notes?.trim().slice(0, 120) ?? "",
    });
  }, [catalog, editRequest?.requestId]);

  const products = useMemo(() => catalog?.categories.flatMap((category) => category.products) ?? [], [catalog]);

  const pizzas = useMemo(() => {
    const unique = new Map<number, CatalogProduct>();
    products
      .filter((product) => product.type === "PIZZA_SINGLE" || product.type === "PIZZA_TWO_FLAVORS")
      .forEach((product) => unique.set(product.id, product));
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [products]);

  const combos = useMemo(() => {
    const unique = new Map<number, CatalogProduct>();
    products.filter((product) => product.type === "COMBO").forEach((product) => unique.set(product.id, product));
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [products]);

  const visibleProducts = useMemo(() => {
    const source = tab === "PIZZA" ? pizzas : combos;
    const value = productQuery.trim().toLocaleLowerCase("es");
    if (!value) return source;
    return source.filter((product) =>
      product.name.toLocaleLowerCase("es").includes(value),
    );
  }, [combos, pizzas, productQuery, tab]);

  function startPizza(product: CatalogProduct) {
    if (!catalog) return;
    setEditingExistingItemId(null);
    const defaultSize = catalog.sizes[0] ?? null;
    const defaultCrust = catalog.crusts.find(
      (item) => item.name.toLowerCase().includes("tradicional") && crustPrice(item, defaultSize?.id ?? null) != null,
    ) ?? catalog.crusts.find((item) => crustPrice(item, defaultSize?.id ?? null) != null) ?? null;

    setConfigError("");
    setPizza({
      product,
      sizeId: defaultSize?.id ?? null,
      firstFlavorId: isTwoFlavor(product) ? null : product.id,
      secondFlavorId: null,
      crustId: defaultCrust?.id ?? null,
      modifierIds: [],
      note: "",
    });
  }

  function updatePizzaSize(sizeId: number) {
    if (!pizza || !catalog) return;
    const current = catalog.crusts.find((item) => item.id === pizza.crustId);
    const nextCrustId = current && crustPrice(current, sizeId) != null
      ? current.id
      : catalog.crusts.find((item) => crustPrice(item, sizeId) != null)?.id ?? null;
    setPizza({ ...pizza, sizeId, crustId: nextCrustId });
  }

  function pizzaPrice(draft: PizzaDraft) {
    if (!catalog) return 0;
    return estimatePizzaPrice({
      product: draft.product,
      draft,
      sizes: catalog.sizes,
      flavors: catalog.pizzaFlavors,
      crusts: catalog.crusts,
      modifiers: catalog.modifiers,
    });
  }

  function confirmPizza() {
    if (!pizza || !catalog) return;

    try {
      const result = buildPizzaConfiguration({
        product: pizza.product,
        draft: pizza,
        sizes: catalog.sizes,
        flavors: catalog.pizzaFlavors,
        crusts: catalog.crusts,
        modifiers: catalog.modifiers,
      });

      if (editingExistingItemId != null && onEditComplete) {
        onEditComplete({
          itemId: editingExistingItemId,
          summary: result.summary,
          estimatedUnitPrice: result.estimatedUnitPrice,
          configuration: result.configuration,
          notes: pizza.note.trim().slice(0, 120) || undefined,
        });
      } else {
        onChange([
          ...additions,
          {
            key: `pizza-${Date.now()}-${Math.random()}`,
            productId: pizza.product.id,
            quantity: 1,
            name: pizza.product.name,
            summary: result.summary,
            estimatedUnitPrice: result.estimatedUnitPrice,
            configuration: result.configuration,
            notes: pizza.note.trim().slice(0, 120) || undefined,
          },
        ]);
      }
      setEditingExistingItemId(null);
      setPizza(null);
      setConfigError("");
    } catch (error) {
      setConfigError(
        error instanceof Error
          ? error.message
          : "No fue posible configurar la pizza.",
      );
    }
  }

  function startCombo(product: CatalogProduct) {
    const draft = createComboDraft(product);
    setConfigError("");
    setCombo({ product, ...draft });
  }

  function toggleComboOption(group: ComboGroup, productId: number) {
    if (!combo) return;
    const current = combo.groupSelections[group.id] ?? [];
    let next = current;
    if (current.includes(productId)) next = current.filter((id) => id !== productId);
    else if (group.maxSelections <= 1) next = [productId];
    else if (current.length < group.maxSelections) next = [...current, productId];
    setCombo({ ...combo, groupSelections: { ...combo.groupSelections, [group.id]: next } });
  }

  function comboPrice(draft: ComboDraft) {
    return estimateComboPrice({
      product: draft.product,
      pizzas: draft.pizzas,
      groupSelections: draft.groupSelections,
    });
  }

  function confirmCombo() {
    if (!combo) return;

    try {
      const result = buildComboConfiguration({
        product: combo.product,
        pizzas: combo.pizzas,
        groupSelections: combo.groupSelections,
      });

      onChange([
        ...additions,
        {
          key: `combo-${Date.now()}-${Math.random()}`,
          productId: combo.product.id,
          quantity: 1,
          name: combo.product.name,
          summary: result.summary,
          estimatedUnitPrice: result.estimatedUnitPrice,
          configuration: result.configuration,
        },
      ]);
      setCombo(null);
      setConfigError("");
    } catch (error) {
      setConfigError(
        error instanceof Error
          ? error.message
          : "No fue posible configurar el combo.",
      );
    }
  }

  function changeQuantity(key: string, delta: number) {
    onChange(
      additions
        .map((item) => item.key === key ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)
        .filter((item) => item.quantity > 0),
    );
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 border-b border-neutral-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[.12em] text-neutral-400">
          Agregar productos
        </p>
        <h4 className="mt-1 text-[18px] font-black tracking-[-0.02em] text-neutral-950">
          Pizzas y combos
        </h4>
        <p className="mt-1 text-[11px] text-neutral-400">
          Configura el producto antes de sumarlo al pedido.
        </p>
      </div>

      <div className="flex rounded-2xl border border-neutral-200 bg-[#f7f6f3] p-1">
        <button
          type="button"
          onClick={() => {
            setTab("PIZZA");
            setProductQuery("");
          }}
          className={`min-w-[86px] rounded-xl px-4 py-2 text-[11px] font-bold transition ${
            tab === "PIZZA"
              ? "bg-white text-neutral-950 shadow-sm"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          Pizzas
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("COMBO");
            setProductQuery("");
          }}
          className={`min-w-[86px] rounded-xl px-4 py-2 text-[11px] font-bold transition ${
            tab === "COMBO"
              ? "bg-white text-neutral-950 shadow-sm"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          Combos
        </button>
      </div>
    </div>

    <div className="relative">
      <input
        type="search"
        value={productQuery}
        onChange={(event) => setProductQuery(event.target.value)}
        placeholder={tab === "PIZZA" ? "Buscar pizza..." : "Buscar combo..."}
        className="alento-input h-11 w-full rounded-2xl bg-[#faf9f7] px-4 pr-10 text-sm"
      />
      {productQuery && (
        <button
          type="button"
          onClick={() => setProductQuery("")}
          className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-200/70 text-xs font-bold text-neutral-500 hover:bg-neutral-200"
          aria-label="Limpiar búsqueda"
        >
          ×
        </button>
      )}
    </div>

    {loading ? (
      <p className="rounded-2xl bg-neutral-50 p-4 text-xs text-neutral-500">
        Cargando catálogo...
      </p>
    ) : error ? (
      <p className="rounded-2xl bg-red-50 p-4 text-xs font-bold text-red-700">
        {error}
      </p>
    ) : visibleProducts.length ? (
      <div className="grid gap-2.5 lg:grid-cols-2">
        {visibleProducts.map((product) => (
          <button
            type="button"
            key={product.id}
            onClick={() =>
              tab === "PIZZA" ? startPizza(product) : startCombo(product)
            }
            className="group flex min-h-[76px] items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-[#fcfbf9] p-3.5 text-left transition hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-white hover:shadow-[0_8px_20px_rgba(20,18,16,.06)]"
          >
            <div className="min-w-0">
              <b className="block truncate text-[13px] font-bold text-neutral-950">
                {product.name}
              </b>
              <span className="mt-1 block text-[10px] leading-4 text-neutral-400">
                {tab === "PIZZA"
                  ? "Tamaño, sabores, borde y extras"
                  : "Contenido, pizza y acompañantes"}
              </span>
            </div>
            <span className="shrink-0 rounded-xl bg-neutral-950 px-3 py-2 text-[9px] font-black uppercase tracking-[.03em] text-white transition group-hover:bg-[var(--brand-red)]">
              Configurar
            </span>
          </button>
        ))}
      </div>
    ) : (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-[#faf9f7] px-4 py-8 text-center">
        <b className="text-xs text-neutral-700">
          No encontramos {tab === "PIZZA" ? "pizzas" : "combos"}
        </b>
        <p className="mt-1 text-[10px] text-neutral-400">
          Prueba con otro nombre o limpia la búsqueda.
        </p>
      </div>
    )}

    {additions.length > 0 && (
      <div className="rounded-[20px] border border-emerald-100 bg-emerald-50/45 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[9px] font-black uppercase tracking-[.1em] text-emerald-700">
            Por agregar al pedido
          </p>
          <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold text-emerald-700 shadow-sm">
            {additions.reduce((sum, item) => sum + item.quantity, 0)} uds.
          </span>
        </div>
        <div className="mt-2.5 space-y-2">
          {additions.map((item) => (
            <div
              key={item.key}
              className="rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-[0_4px_14px_rgba(16,185,129,.05)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <b className="text-[13px] font-bold text-neutral-950">
                    {item.name}
                  </b>
                  <p className="mt-1 text-[10px] leading-4 text-neutral-500">
                    {item.summary}
                  </p>
                  {item.notes && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-semibold text-amber-900">
                      Nota: {item.notes}
                    </p>
                  )}
                  <b className="mt-2 block text-[11px] text-[var(--brand-red)]">
                    {money(item.estimatedUnitPrice * item.quantity)}
                  </b>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 bg-[#faf9f7] p-1">
                  <button
                    type="button"
                    onClick={() => changeQuantity(item.key, -1)}
                    className="h-8 w-8 rounded-lg transition hover:bg-white"
                  >
                    −
                  </button>
                  <b className="w-5 text-center text-[13px] tabular-nums">
                    {item.quantity}
                  </b>
                  <button
                    type="button"
                    onClick={() => changeQuantity(item.key, 1)}
                    className="h-8 w-8 rounded-lg transition hover:bg-white"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {pizza && catalog && (
      <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4" onClick={() => {
          setPizza(null);
          setEditingExistingItemId(null);
          if (editingExistingItemId != null) onEditCancel?.();
        }}>
        <div onClick={(event) => event.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[26px] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b bg-black px-5 py-4 text-white">
            <div><p className="text-[9px] font-black uppercase tracking-[.12em] text-white/45">{editingExistingItemId != null ? "Editar pizza" : "Configurar pizza"}</p><h3 className="text-xl font-black">{pizza.product.name}</h3></div>
            <button type="button" onClick={() => {
          setPizza(null);
          setEditingExistingItemId(null);
          if (editingExistingItemId != null) onEditCancel?.();
        }} className="h-9 w-9 rounded-xl bg-white/10">×</button>
          </div>
          <div className="alento-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <section>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[.08em] text-neutral-400">Tamaño</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {catalog.sizes.map((size) => <button type="button" key={size.id} onClick={() => updatePizzaSize(size.id)} className={`rounded-xl border p-3 text-left ${pizza.sizeId === size.id ? "bg-black text-white" : "bg-white"}`}><b className="text-sm">{size.name}</b><span className="block text-xs opacity-60">{size.diameterCm} cm</span></button>)}
              </div>
            </section>

            {isTwoFlavor(pizza.product) && <>
              <section>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[.08em] text-neutral-400">Sabor 1</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{catalog.pizzaFlavors.map((flavor) => <button type="button" key={flavor.id} onClick={() => setPizza({ ...pizza, firstFlavorId: flavor.id, secondFlavorId: pizza.secondFlavorId === flavor.id ? null : pizza.secondFlavorId })} className={`rounded-xl border p-3 text-left text-sm ${pizza.firstFlavorId === flavor.id ? "bg-black text-white" : "bg-white"}`}>{flavor.name}</button>)}</div>
              </section>
              <section>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[.08em] text-neutral-400">Sabor 2</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{catalog.pizzaFlavors.map((flavor) => <button type="button" key={flavor.id} disabled={pizza.firstFlavorId === flavor.id} onClick={() => setPizza({ ...pizza, secondFlavorId: flavor.id })} className={`rounded-xl border p-3 text-left text-sm ${pizza.secondFlavorId === flavor.id ? "bg-black text-white" : pizza.firstFlavorId === flavor.id ? "bg-neutral-100 text-neutral-300" : "bg-white"}`}>{flavor.name}</button>)}</div>
              </section>
            </>}

            <section>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[.08em] text-neutral-400">Borde</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {catalog.crusts.map((item) => {
                  const price = crustPrice(item, pizza.sizeId);
                  return <button type="button" key={item.id} disabled={price == null} onClick={() => setPizza({ ...pizza, crustId: item.id })} className={`rounded-xl border p-3 text-left ${pizza.crustId === item.id ? "bg-black text-white" : price == null ? "bg-neutral-100 text-neutral-300" : "bg-white"}`}><b className="text-sm">{item.name}</b><span className="block text-xs opacity-60">{price == null ? "No disponible" : price === 0 ? "Incluido" : `+ ${money(price)}`}</span></button>;
                })}
              </div>
            </section>

            <section>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[.08em] text-neutral-400">Ingredientes extra</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {catalog.modifiers.map((modifier) => {
                  const selected = pizza.modifierIds.includes(modifier.id);
                  return <button type="button" key={modifier.id} onClick={() => setPizza({ ...pizza, modifierIds: selected ? pizza.modifierIds.filter((id) => id !== modifier.id) : [...pizza.modifierIds, modifier.id] })} className={`rounded-xl border p-3 text-left ${selected ? "border-[var(--brand-red)] bg-red-50" : "bg-white"}`}><b className="text-sm">{modifier.name}</b><span className="block text-xs text-neutral-500">+ {money(modifier.basePrice)}</span></button>;
                })}
              </div>
            </section>
            <section className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-[.08em] text-neutral-400">Nota para cocina</p><p className="mt-1 text-[11px] text-neutral-500">Opcional · instrucción corta para esta pizza.</p></div>
                <span className="text-[10px] font-semibold text-neutral-400">{pizza.note.length}/120</span>
              </div>
              <input value={pizza.note} maxLength={120} onChange={(event) => setPizza({ ...pizza, note: event.target.value })} className="alento-input mt-2 w-full rounded-xl bg-white px-3.5 py-3 text-sm" placeholder="Ej. Ligera en salsa" />
            </section>
            {configError && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{configError}</p>}
          </div>
          <div className="flex items-center justify-between border-t p-4"><b className="text-xl text-[var(--brand-red)]">{money(pizzaPrice(pizza))}</b><button type="button" onClick={confirmPizza} className="rounded-xl bg-[var(--brand-red)] px-5 py-3 text-sm font-black text-white">{editingExistingItemId != null ? "Guardar cambios" : "Agregar pizza"}</button></div>
        </div>
      </div>
    )}

    {combo && (
      <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4" onClick={() => setCombo(null)}>
        <div onClick={(event) => event.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[26px] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b bg-black px-5 py-4 text-white">
            <div><p className="text-[9px] font-black uppercase tracking-[.12em] text-white/45">Configurar combo</p><h3 className="text-xl font-black">{combo.product.name}</h3></div>
            <button type="button" onClick={() => setCombo(null)} className="h-9 w-9 rounded-xl bg-white/10">×</button>
          </div>
          <div className="alento-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {combo.pizzas.map((choice, index) => {
              const rule = (combo.product.comboPizzaRules ?? []).find((item) => item.id === choice.ruleId);
              if (!rule) return null;
              const updateChoice = (
                patch: Partial<ComboDraftChoice>,
              ) => {
                const items = [...combo.pizzas];
                items[index] = { ...items[index], ...patch };
                setCombo({ ...combo, pizzas: items });
                setConfigError("");
              };

              return (
                <section
                  key={`${choice.ruleId}-${index}`}
                  className="rounded-[20px] border border-neutral-200 bg-[#faf9f7] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-black">Pizza {index + 1}</h4>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-neutral-500">
                      Incluida
                    </span>
                  </div>

                  <p className="mb-2 mt-3 text-[10px] font-black uppercase tracking-[.06em] text-neutral-400">
                    Tamaño
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {rule.sizes.map((size) => (
                      <button
                        type="button"
                        key={size.id}
                        onClick={() => updateChoice({ sizeId: size.id })}
                        className={`rounded-xl border px-4 py-2 text-sm ${choice.sizeId === size.id ? "border-black bg-black text-white" : "border-neutral-300 bg-white"}`}
                      >
                        {size.name}
                      </button>
                    ))}
                  </div>

                  <p className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[.06em] text-neutral-400">
                    ¿Cuántos sabores?
                  </p>
                  <div className="flex gap-2">
                    {([1, 2] as const).map((count) => (
                      <button
                        type="button"
                        key={count}
                        onClick={() =>
                          updateChoice({
                            flavorCount: count,
                            secondFlavorId:
                              count === 1
                                ? null
                                : choice.secondFlavorId,
                          })
                        }
                        className={`rounded-xl border px-4 py-2 text-sm font-bold ${choice.flavorCount === count ? "border-black bg-black text-white" : "border-neutral-300 bg-white"}`}
                      >
                        {count === 1 ? "1 sabor" : "2 sabores"}
                      </button>
                    ))}
                  </div>

                  <p className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[.06em] text-neutral-400">
                    {choice.flavorCount === 2 ? "Sabor 1" : "Sabor"}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {rule.flavors.map((flavor) => (
                      <button
                        type="button"
                        key={flavor.id}
                        onClick={() =>
                          updateChoice({
                            firstFlavorId: flavor.id,
                            secondFlavorId:
                              choice.secondFlavorId === flavor.id
                                ? null
                                : choice.secondFlavorId,
                          })
                        }
                        className={`rounded-xl border p-3 text-left text-sm ${choice.firstFlavorId === flavor.id ? "border-black bg-black text-white" : "border-neutral-300 bg-white"}`}
                      >
                        {flavor.name}
                      </button>
                    ))}
                  </div>

                  {choice.flavorCount === 2 && (
                    <>
                      <p className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[.06em] text-neutral-400">
                        Sabor 2
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {rule.flavors.map((flavor) => {
                          const disabled =
                            choice.firstFlavorId === flavor.id;
                          return (
                            <button
                              type="button"
                              key={flavor.id}
                              disabled={disabled}
                              onClick={() =>
                                updateChoice({
                                  secondFlavorId: flavor.id,
                                })
                              }
                              className={`rounded-xl border p-3 text-left text-sm ${choice.secondFlavorId === flavor.id ? "border-black bg-black text-white" : disabled ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-300" : "border-neutral-300 bg-white"}`}
                            >
                              {flavor.name}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </section>
              );
            })}

            {(combo.product.comboGroups ?? []).map((group) => {
              const selected = combo.groupSelections[group.id] ?? [];
              return <section key={group.id} className="rounded-2xl border bg-[#faf9f7] p-4">
                <div className="flex items-center justify-between"><h4 className="font-black">{group.name}</h4><span className="text-xs text-neutral-500">{selected.length}/{group.maxSelections}</span></div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{group.options.map((option) => <button type="button" key={option.id} onClick={() => toggleComboOption(group, option.productId)} className={`rounded-xl border p-3 text-left text-sm ${selected.includes(option.productId) ? "bg-black text-white" : "bg-white"}`}>{option.productName}</button>)}</div>
              </section>;
            })}
            {configError && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{configError}</p>}
          </div>
          <div className="flex items-center justify-between border-t p-4"><b className="text-xl text-[var(--brand-red)]">{money(comboPrice(combo))}</b><button type="button" onClick={confirmCombo} className="rounded-xl bg-[var(--brand-red)] px-5 py-3 text-sm font-black text-white">Agregar combo</button></div>
        </div>
      </div>
    )}
  </div>;
}
