"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComboOrderConfiguration, PizzaOrderConfiguration } from "@/lib/orderConfiguration";

type ProductType = "STANDARD" | "PIZZA_SINGLE" | "PIZZA_TWO_FLAVORS" | "COMBO" | "MODIFIER" | "INTERNAL";
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
type ComboPizzaChoice = { ruleId: number; sizeId: number | null; flavorId: number | null };
type ComboDraft = { product: CatalogProduct; pizzas: ComboPizzaChoice[]; groupSelections: Record<number, number[]> };

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

type Props = {
  additions: StructuredEditAddition[];
  onChange: (items: StructuredEditAddition[]) => void;
};

const money = (value: number) => new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
}).format(value);

const isTwoFlavor = (product: CatalogProduct) =>
  product.type === "PIZZA_TWO_FLAVORS" || product.name.toLowerCase().includes("2 sabores");

const crustPrice = (crust: Crust, sizeId: number | null) =>
  sizeId ? crust.prices.find((price) => price.sizeId === sizeId)?.price ?? null : null;

export default function OrderEditStructuredAdder({ additions, onChange }: Props) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"PIZZA" | "COMBO">("PIZZA");
  const [pizza, setPizza] = useState<PizzaDraft | null>(null);
  const [combo, setCombo] = useState<ComboDraft | null>(null);
  const [configError, setConfigError] = useState("");

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

  function startPizza(product: CatalogProduct) {
    if (!catalog) return;
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
    if (!catalog || !draft.sizeId) return 0;
    const size = catalog.sizes.find((item) => item.id === draft.sizeId);
    if (!size) return 0;

    const flavorIds = isTwoFlavor(draft.product)
      ? [draft.firstFlavorId, draft.secondFlavorId]
      : [draft.product.id];
    const flavorPrices = flavorIds.map(
      (id) => catalog.pizzaFlavors.find((item) => item.id === id)?.basePrice ?? 0,
    );
    const selectedCrust = catalog.crusts.find((item) => item.id === draft.crustId);
    const extras = catalog.modifiers
      .filter((item) => draft.modifierIds.includes(item.id))
      .reduce((sum, item) => sum + item.basePrice, 0);

    return size.basePrice
      + Math.max(0, ...flavorPrices)
      + (selectedCrust ? crustPrice(selectedCrust, size.id) ?? 0 : 0)
      + extras;
  }

  function confirmPizza() {
    if (!pizza || !catalog || !pizza.sizeId || !pizza.crustId) return;

    const size = catalog.sizes.find((item) => item.id === pizza.sizeId);
    const selectedCrust = catalog.crusts.find((item) => item.id === pizza.crustId);
    if (!size || !selectedCrust) return setConfigError("La configuración seleccionada ya no está disponible.");

    const two = isTwoFlavor(pizza.product);
    let flavorIds: number[];
    if (two) {
      const first = pizza.firstFlavorId;
      const second = pizza.secondFlavorId;
      if (!first || !second) return setConfigError("Selecciona los dos sabores.");
      if (first === second) return setConfigError("Los sabores deben ser diferentes.");
      flavorIds = [first, second];
    } else {
      flavorIds = [pizza.product.id];
    }

    const flavors = flavorIds
      .map((id) => catalog.pizzaFlavors.find((item) => item.id === id))
      .filter((item): item is CatalogProduct => Boolean(item));
    if (flavors.length !== flavorIds.length) return setConfigError("Uno de los sabores ya no está disponible.");

    const selectedCrustPrice = crustPrice(selectedCrust, size.id);
    if (selectedCrustPrice == null) return setConfigError("Ese borde no está disponible para el tamaño seleccionado.");

    const modifiers = catalog.modifiers.filter((item) => pizza.modifierIds.includes(item.id));
    const configuration: PizzaOrderConfiguration = {
      schemaVersion: 1,
      kind: "PIZZA",
      productId: pizza.product.id,
      productName: pizza.product.name,
      size: { id: size.id, name: size.name, diameterCm: size.diameterCm, basePrice: size.basePrice },
      flavors: flavors.map((flavor) => ({
        productId: flavor.id,
        name: flavor.name,
        portion: two ? 0.5 : 1,
        basePrice: flavor.basePrice ?? 0,
      })),
      crust: { id: selectedCrust.id, name: selectedCrust.name, price: selectedCrustPrice },
      modifiers: modifiers.map((modifier) => ({
        productId: modifier.id,
        name: modifier.name,
        quantity: 1,
        unitPrice: modifier.basePrice,
      })),
    };

    const summary = [
      size.name,
      two ? flavors.map((flavor) => `½ ${flavor.name}`).join(" + ") : flavors[0]?.name,
      `Borde ${selectedCrust.name}`,
      ...modifiers.map((modifier) => `+ ${modifier.name}`),
    ].filter(Boolean).join(" · ");

    onChange([
      ...additions,
      {
        key: `pizza-${Date.now()}-${Math.random()}`,
        productId: pizza.product.id,
        quantity: 1,
        name: pizza.product.name,
        summary,
        estimatedUnitPrice: pizzaPrice(pizza),
        configuration,
        notes: pizza.note.trim().slice(0, 120) || undefined,
      },
    ]);
    setPizza(null);
    setConfigError("");
  }

  function startCombo(product: CatalogProduct) {
    const choices: ComboPizzaChoice[] = [];
    for (const rule of product.comboPizzaRules ?? []) {
      for (let index = 0; index < rule.quantity; index += 1) {
        choices.push({
          ruleId: rule.id,
          sizeId: rule.sizes[0]?.id ?? null,
          flavorId: rule.flavors[0]?.id ?? null,
        });
      }
    }

    const groupSelections: Record<number, number[]> = {};
    for (const group of product.comboGroups ?? []) {
      groupSelections[group.id] = group.options
        .slice(0, group.minSelections)
        .map((option) => option.productId);
    }

    setConfigError("");
    setCombo({ product, pizzas: choices, groupSelections });
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
    let regular = 0;
    for (const choice of draft.pizzas) {
      const rule = (draft.product.comboPizzaRules ?? []).find((item) => item.id === choice.ruleId);
      if (!rule) continue;
      regular += (rule.sizes.find((item) => item.id === choice.sizeId)?.basePrice ?? 0)
        + (rule.flavors.find((item) => item.id === choice.flavorId)?.basePrice ?? 0);
    }
    for (const group of draft.product.comboGroups ?? []) {
      for (const productId of draft.groupSelections[group.id] ?? []) {
        const option = group.options.find((item) => item.productId === productId);
        if (option) regular += (option.basePrice + option.priceDelta) * Math.max(1, option.quantity);
      }
    }
    return Math.max(0, regular - (draft.product.comboDiscount ?? 0));
  }

  function confirmCombo() {
    if (!combo) return;

    if (combo.pizzas.some((item) => !item.sizeId || !item.flavorId)) {
      return setConfigError("Completa las pizzas del combo.");
    }

    for (const group of combo.product.comboGroups ?? []) {
      const count = (combo.groupSelections[group.id] ?? []).length;
      if (count < group.minSelections || count > group.maxSelections) {
        return setConfigError(`Completa la selección de ${group.name}.`);
      }
    }

    const pizzaSnapshots: ComboOrderConfiguration["pizzas"] = [];
    for (const choice of combo.pizzas) {
      const rule = (combo.product.comboPizzaRules ?? []).find((item) => item.id === choice.ruleId);
      if (!rule) return setConfigError("Una regla del combo ya no está disponible. Vuelve a seleccionar el combo.");

      const size = rule.sizes.find((item) => item.id === choice.sizeId);
      const flavor = rule.flavors.find((item) => item.id === choice.flavorId);
      if (!size || !flavor) {
        return setConfigError("Un tamaño o sabor del combo ya no está disponible.");
      }

      pizzaSnapshots.push({
        ruleId: rule.id,
        size: {
          id: size.id,
          name: size.name,
          diameterCm: size.diameterCm,
          basePrice: size.basePrice,
        },
        flavor: {
          productId: flavor.id,
          name: flavor.name,
          portion: 1,
          basePrice: flavor.basePrice,
        },
      });
    }

    const groups: ComboOrderConfiguration["groups"] = [];
    for (const group of combo.product.comboGroups ?? []) {
      const selections: ComboOrderConfiguration["groups"][number]["selections"] = [];
      for (const productId of combo.groupSelections[group.id] ?? []) {
        const option = group.options.find((item) => item.productId === productId);
        if (!option) return setConfigError(`Una opción de ${group.name} ya no está disponible.`);
        selections.push({
          optionId: option.id,
          productId: option.productId,
          name: option.productName,
          quantity: Math.max(1, option.quantity),
          unitPrice: option.basePrice,
          priceDelta: option.priceDelta,
        });
      }
      groups.push({ groupId: group.id, kind: group.kind, name: group.name, selections });
    }

    const configuration: ComboOrderConfiguration = {
      schemaVersion: 1,
      kind: "COMBO",
      comboProductId: combo.product.id,
      comboName: combo.product.name,
      comboDiscount: combo.product.comboDiscount ?? 0,
      pizzas: pizzaSnapshots,
      groups,
    };

    const summary = [
      ...pizzaSnapshots.map((item, index) => `Pizza ${index + 1}: ${item.size.name} ${item.flavor.name}`),
      ...groups.map((group) => `${group.name}: ${group.selections.map((item) => item.name).join(", ")}`),
    ].join(" · ");

    onChange([
      ...additions,
      {
        key: `combo-${Date.now()}-${Math.random()}`,
        productId: combo.product.id,
        quantity: 1,
        name: combo.product.name,
        summary,
        estimatedUnitPrice: comboPrice(combo),
        configuration,
      },
    ]);
    setCombo(null);
    setConfigError("");
  }

  function changeQuantity(key: string, delta: number) {
    onChange(
      additions
        .map((item) => item.key === key ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)
        .filter((item) => item.quantity > 0),
    );
  }

  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.1em] text-neutral-400">Agregar pizzas y combos</p>
        <p className="mt-1 text-[11px] text-neutral-500">Configura el producto antes de agregarlo al pedido.</p>
      </div>
      <div className="flex rounded-xl bg-neutral-100 p-1">
        <button type="button" onClick={() => setTab("PIZZA")} className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${tab === "PIZZA" ? "bg-white shadow-sm" : "text-neutral-500"}`}>Pizzas</button>
        <button type="button" onClick={() => setTab("COMBO")} className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${tab === "COMBO" ? "bg-white shadow-sm" : "text-neutral-500"}`}>Combos</button>
      </div>
    </div>

    {loading ? (
      <p className="rounded-xl bg-neutral-50 p-3 text-xs text-neutral-500">Cargando catálogo...</p>
    ) : error ? (
      <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>
    ) : (
      <div className="grid gap-2 sm:grid-cols-2">
        {(tab === "PIZZA" ? pizzas : combos).map((product) => (
          <button
            type="button"
            key={product.id}
            onClick={() => tab === "PIZZA" ? startPizza(product) : startCombo(product)}
            className="flex min-h-[58px] items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left hover:border-neutral-400"
          >
            <div className="min-w-0">
              <b className="block truncate text-sm">{product.name}</b>
              <span className="text-[11px] text-neutral-500">{tab === "PIZZA" ? "Configurar tamaño, sabores y borde" : "Configurar contenido del combo"}</span>
            </div>
            <span className="shrink-0 rounded-lg bg-black px-2.5 py-1.5 text-[10px] font-black text-white">Configurar</span>
          </button>
        ))}
      </div>
    )}

    {additions.length > 0 && (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3">
        <p className="text-[10px] font-black uppercase tracking-[.08em] text-emerald-700">Por agregar al pedido</p>
        <div className="mt-2 space-y-2">
          {additions.map((item) => (
            <div key={item.key} className="rounded-xl border border-emerald-100 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <b className="text-sm">{item.name}</b>
                  <p className="mt-1 text-[11px] leading-4 text-neutral-500">{item.summary}</p>
                  {item.notes && <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10.5px] font-semibold text-amber-900">Nota: {item.notes}</p>}
                  <b className="mt-1 block text-xs text-[var(--brand-red)]">{money(item.estimatedUnitPrice * item.quantity)}</b>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => changeQuantity(item.key, -1)} className="h-8 w-8 rounded-lg border">−</button>
                  <b className="w-4 text-center text-sm">{item.quantity}</b>
                  <button type="button" onClick={() => changeQuantity(item.key, 1)} className="h-8 w-8 rounded-lg border">+</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {pizza && catalog && (
      <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4" onClick={() => setPizza(null)}>
        <div onClick={(event) => event.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[26px] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b bg-black px-5 py-4 text-white">
            <div><p className="text-[9px] font-black uppercase tracking-[.12em] text-white/45">Configurar pizza</p><h3 className="text-xl font-black">{pizza.product.name}</h3></div>
            <button type="button" onClick={() => setPizza(null)} className="h-9 w-9 rounded-xl bg-white/10">×</button>
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
          <div className="flex items-center justify-between border-t p-4"><b className="text-xl text-[var(--brand-red)]">{money(pizzaPrice(pizza))}</b><button type="button" onClick={confirmPizza} className="rounded-xl bg-[var(--brand-red)] px-5 py-3 text-sm font-black text-white">Agregar pizza</button></div>
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
              return <section key={`${choice.ruleId}-${index}`} className="rounded-2xl border bg-[#faf9f7] p-4">
                <h4 className="font-black">Pizza {index + 1}</h4>
                <p className="mb-2 mt-3 text-[10px] font-black uppercase text-neutral-400">Tamaño</p>
                <div className="flex flex-wrap gap-2">{rule.sizes.map((size) => <button type="button" key={size.id} onClick={() => { const items = [...combo.pizzas]; items[index] = { ...items[index], sizeId: size.id }; setCombo({ ...combo, pizzas: items }); }} className={`rounded-xl border px-4 py-2 text-sm ${choice.sizeId === size.id ? "bg-black text-white" : "bg-white"}`}>{size.name}</button>)}</div>
                <p className="mb-2 mt-3 text-[10px] font-black uppercase text-neutral-400">Sabor</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{rule.flavors.map((flavor) => <button type="button" key={flavor.id} onClick={() => { const items = [...combo.pizzas]; items[index] = { ...items[index], flavorId: flavor.id }; setCombo({ ...combo, pizzas: items }); }} className={`rounded-xl border p-3 text-left text-sm ${choice.flavorId === flavor.id ? "bg-black text-white" : "bg-white"}`}>{flavor.name}</button>)}</div>
              </section>;
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
