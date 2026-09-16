"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import OrderCheckoutModal from "@/components/OrderCheckoutModal";
import type { ComboOrderConfiguration, OrderLineConfiguration, PizzaOrderConfiguration, StandardOrderConfiguration } from "@/lib/orderConfiguration";

type CustomerAddress = { id: number; address: string; neighborhood: string | null; city: string | null; notes: string | null };
type Customer = { id: number; name: string; countryCode: string; phone: string | null; email: string | null; notes: string | null; addresses: CustomerAddress[] };
type ProductType = "STANDARD" | "PIZZA_SINGLE" | "PIZZA_TWO_FLAVORS" | "COMBO" | "MODIFIER" | "INTERNAL";
type FulfillmentType = "DELIVERY" | "PICKUP" | "STORE";
type PizzaSize = { id: number; name: string; diameterCm: number; basePrice: number };
type Modifier = { id: number; name: string; description: string | null; imageUrl: string | null; basePrice: number };
type Crust = { id: number; name: string; prices: { sizeId: number; price: number }[] };
type ComboPizzaRule = { id: number; quantity: number; sizes: PizzaSize[]; flavors: { id: number; name: string; basePrice: number; imageUrl: string | null }[] };
type ComboGroup = { id: number; kind: string; name: string; minSelections: number; maxSelections: number; options: { id: number; productId: number; productName: string; productType: ProductType; basePrice: number; imageUrl: string | null; quantity: number; priceDelta: number }[] };
type CatalogProduct = { id: number; name: string; description: string | null; imageUrl: string | null; imageUrl2: string | null; type: ProductType; basePrice: number | null; featured: boolean; comboDiscount?: number; comboPizzaRules?: ComboPizzaRule[]; comboGroups?: ComboGroup[] };
type CatalogCategory = { id: number; name: string; slug: string; imageUrl: string | null; products: CatalogProduct[] };
type CatalogResponse = { categories: CatalogCategory[]; pizzaFlavors: CatalogProduct[]; sizes: PizzaSize[]; crusts: Crust[]; modifiers: Modifier[] };
type CartItem = { key: string; productId: number; name: string; detail: string; unitPrice: number; quantity: number; configuration: OrderLineConfiguration };
type PizzaConfig = { product: CatalogProduct; sizeId: number | null; firstFlavorId: number | null; secondFlavorId: number | null; crustId: number | null; modifierIds: number[] };
type ComboPizzaChoice = { ruleId: number; sizeId: number | null; flavorId: number | null };
type ComboConfig = { product: CatalogProduct; pizzas: ComboPizzaChoice[]; groupSelections: Record<number, number[]> };

const fulfillmentOptions: { type: FulfillmentType; icon: string; title: string }[] = [
  { type: "DELIVERY", icon: "🛵", title: "Domicilio" },
  { type: "PICKUP", icon: "🛍️", title: "Recoger en tienda" },
  { type: "STORE", icon: "🍽️", title: "Local" },
];

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function isTwoFlavorPizza(product: CatalogProduct) {
  return product.type === "PIZZA_TWO_FLAVORS" || product.name.toLowerCase().includes("2 sabores");
}

export default function StructuredPosPage() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pizzaConfig, setPizzaConfig] = useState<PizzaConfig | null>(null);
  const [comboConfig, setComboConfig] = useState<ComboConfig | null>(null);
  const [configError, setConfigError] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+57");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState("");

  useEffect(() => {
    async function loadCatalog() {
      setCatalogLoading(true);
      try {
        const response = await fetch("/api/catalog", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible cargar el catálogo.");
        setCatalog(data);
        if (data.categories?.length) setActiveCategory(data.categories[0].slug);
      } catch (error) {
        setCatalogError(error instanceof Error ? error.message : "No fue posible cargar el catálogo.");
      } finally {
        setCatalogLoading(false);
      }
    }
    void loadCatalog();
  }, []);

  const selectedCategory = useMemo(() => catalog?.categories.find((category) => category.slug === activeCategory) ?? catalog?.categories[0], [catalog, activeCategory]);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const selectedAddress = selectedCustomer?.addresses?.[0];
  const requiresCustomer = fulfillmentType === "DELIVERY" || fulfillmentType === "PICKUP";
  const hasDeliveryAddress = Boolean(selectedAddress?.address?.trim());
  const canAddProducts = Boolean(fulfillmentType && (!requiresCustomer || selectedCustomer));
  const canContinue = Boolean(cart.length && fulfillmentType && (!requiresCustomer || selectedCustomer) && (fulfillmentType !== "DELIVERY" || hasDeliveryAddress));

  function displayPrice(product: CatalogProduct) {
    const minSize = catalog?.sizes.length ? Math.min(...catalog.sizes.map((size) => size.basePrice)) : 0;
    if (isTwoFlavorPizza(product)) {
      const flavorPrices = catalog?.pizzaFlavors.map((flavor) => flavor.basePrice ?? 0) ?? [];
      return `Desde ${formatCOP(minSize + (flavorPrices.length ? Math.min(...flavorPrices) : 0))}`;
    }
    if (product.type === "PIZZA_SINGLE") return `Desde ${formatCOP(minSize + (product.basePrice ?? 0))}`;
    if (product.type === "COMBO") return product.comboDiscount ? `Ahorra ${formatCOP(product.comboDiscount)}` : "Configurable";
    return product.basePrice == null ? "Precio por definir" : formatCOP(product.basePrice);
  }

  async function searchCustomers() {
    if (query.trim().length < 2) return setSearchMessage("Escribe al menos 2 caracteres.");
    setSearching(true);
    setSearchMessage("");
    try {
      const response = await fetch(`/api/customers?q=${encodeURIComponent(query.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible buscar clientes.");
      setCustomers(data.customers ?? []);
      if (!(data.customers ?? []).length) setSearchMessage("No encontramos clientes con ese dato.");
    } catch (error) {
      setSearchMessage(error instanceof Error ? error.message : "No fue posible buscar clientes.");
    } finally {
      setSearching(false);
    }
  }

  function chooseCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setQuery(customer.phone || customer.name);
    setCustomers([]);
    setSearchMessage("");
  }

  function resetCustomerForm() {
    setName(""); setCountryCode("+57"); setPhone(""); setAddress(""); setEmail(""); setNotes(""); setCustomerError("");
  }

  function openNewCustomer() {
    setEditingCustomer(null); resetCustomerForm(); setShowCustomerModal(true);
  }

  function openEditCustomer(customer: Customer) {
    setEditingCustomer(customer);
    setName(customer.name); setCountryCode(customer.countryCode || "+57"); setPhone(customer.phone || "");
    setAddress(customer.addresses?.[0]?.address || ""); setEmail(customer.email || ""); setNotes(customer.notes || ""); setCustomerError("");
    setShowCustomerModal(true);
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !phone.trim()) return setCustomerError("Nombre y teléfono son obligatorios.");
    if (fulfillmentType === "DELIVERY" && !address.trim()) return setCustomerError("La dirección es obligatoria para domicilio.");
    setSavingCustomer(true);
    try {
      const response = await fetch(editingCustomer ? `/api/customers/${editingCustomer.id}` : "/api/customers", {
        method: editingCustomer ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, countryCode, phone, address, email, notes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible guardar el cliente.");
      chooseCustomer(data.customer);
      setShowCustomerModal(false); setEditingCustomer(null); resetCustomerForm();
    } catch (error) {
      setCustomerError(error instanceof Error ? error.message : "No fue posible guardar el cliente.");
    } finally {
      setSavingCustomer(false);
    }
  }

  function addSimpleProduct(product: CatalogProduct) {
    if (product.basePrice == null) return;
    const configuration: StandardOrderConfiguration = { schemaVersion: 1, kind: "STANDARD", productId: product.id, productName: product.name };
    const key = `standard-${product.id}`;
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      return existing
        ? current.map((item) => item.key === key ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { key, productId: product.id, name: product.name, detail: "Producto", unitPrice: product.basePrice!, quantity: 1, configuration }];
    });
  }

  function startAdd(product: CatalogProduct) {
    setConfigError("");
    if (product.type === "PIZZA_SINGLE" || isTwoFlavorPizza(product)) {
      setPizzaConfig({
        product,
        sizeId: catalog?.sizes[0]?.id ?? null,
        firstFlavorId: isTwoFlavorPizza(product) ? null : product.id,
        secondFlavorId: null,
        crustId: catalog?.crusts.find((crust) => crust.name.toLowerCase().includes("tradicional"))?.id ?? catalog?.crusts[0]?.id ?? null,
        modifierIds: [],
      });
      return;
    }
    if (product.type === "COMBO") {
      const pizzas: ComboPizzaChoice[] = [];
      for (const rule of product.comboPizzaRules ?? []) {
        for (let index = 0; index < rule.quantity; index += 1) pizzas.push({ ruleId: rule.id, sizeId: rule.sizes[0]?.id ?? null, flavorId: rule.flavors[0]?.id ?? null });
      }
      const groupSelections: Record<number, number[]> = {};
      for (const group of product.comboGroups ?? []) groupSelections[group.id] = group.options.slice(0, group.minSelections).map((option) => option.productId);
      setComboConfig({ product, pizzas, groupSelections });
      return;
    }
    addSimpleProduct(product);
  }

  function pizzaPrice(config: PizzaConfig) {
    if (!catalog || !config.sizeId) return 0;
    const size = catalog.sizes.find((item) => item.id === config.sizeId);
    if (!size) return 0;
    const flavorPrices = isTwoFlavorPizza(config.product)
      ? [config.firstFlavorId, config.secondFlavorId].map((id) => catalog.pizzaFlavors.find((flavor) => flavor.id === id)?.basePrice ?? 0)
      : [config.product.basePrice ?? 0];
    const crust = catalog.crusts.find((item) => item.id === config.crustId);
    const crustPrice = crust?.prices.find((price) => price.sizeId === size.id)?.price ?? 0;
    const modifiersPrice = catalog.modifiers.filter((item) => config.modifierIds.includes(item.id)).reduce((sum, item) => sum + item.basePrice, 0);
    return size.basePrice + Math.max(...flavorPrices) + crustPrice + modifiersPrice;
  }

  function confirmPizza() {
    if (!pizzaConfig || !catalog || !pizzaConfig.sizeId || !pizzaConfig.crustId) return;
    const size = catalog.sizes.find((item) => item.id === pizzaConfig.sizeId);
    const crust = catalog.crusts.find((item) => item.id === pizzaConfig.crustId);
    if (!size || !crust) return;
    const twoFlavors = isTwoFlavorPizza(pizzaConfig.product);
    if (twoFlavors && (!pizzaConfig.firstFlavorId || !pizzaConfig.secondFlavorId)) return setConfigError("Selecciona los dos sabores.");
    if (twoFlavors && pizzaConfig.firstFlavorId === pizzaConfig.secondFlavorId) return setConfigError("Los dos sabores deben ser diferentes.");

    const flavorIds = twoFlavors ? [pizzaConfig.firstFlavorId!, pizzaConfig.secondFlavorId!] : [pizzaConfig.product.id];
    const flavors = flavorIds.map((id) => catalog.pizzaFlavors.find((item) => item.id === id)).filter(Boolean) as CatalogProduct[];
    if (flavors.length !== flavorIds.length) return setConfigError("Uno de los sabores ya no está disponible.");
    const crustPrice = crust.prices.find((price) => price.sizeId === size.id)?.price;
    if (crustPrice == null) return setConfigError("Ese borde no está disponible para el tamaño seleccionado.");
    const modifiers = catalog.modifiers.filter((modifier) => pizzaConfig.modifierIds.includes(modifier.id));

    const configuration: PizzaOrderConfiguration = {
      schemaVersion: 1,
      kind: "PIZZA",
      productId: pizzaConfig.product.id,
      productName: pizzaConfig.product.name,
      size: { id: size.id, name: size.name, diameterCm: size.diameterCm, basePrice: size.basePrice },
      flavors: flavors.map((flavor) => ({ productId: flavor.id, name: flavor.name, portion: twoFlavors ? 0.5 : 1, basePrice: flavor.basePrice ?? 0 })),
      crust: { id: crust.id, name: crust.name, price: crustPrice },
      modifiers: modifiers.map((modifier) => ({ productId: modifier.id, name: modifier.name, quantity: 1, unitPrice: modifier.basePrice })),
    };

    const detail = [
      size.name,
      twoFlavors ? flavors.map((flavor) => `½ ${flavor.name}`).join(" + ") : flavors[0]?.name,
      `Borde ${crust.name}`,
      ...modifiers.map((modifier) => `+ ${modifier.name}`),
    ].filter(Boolean).join(" · ");

    setCart((current) => [...current, {
      key: `pizza-${Date.now()}-${Math.random()}`,
      productId: pizzaConfig.product.id,
      name: pizzaConfig.product.name,
      detail,
      unitPrice: pizzaPrice(pizzaConfig),
      quantity: 1,
      configuration,
    }]);
    setPizzaConfig(null); setConfigError("");
  }

  function comboPrice(config: ComboConfig) {
    let regular = 0;
    for (const choice of config.pizzas) {
      const rule = config.product.comboPizzaRules?.find((item) => item.id === choice.ruleId);
      const size = rule?.sizes.find((item) => item.id === choice.sizeId);
      const flavor = rule?.flavors.find((item) => item.id === choice.flavorId);
      regular += (size?.basePrice ?? 0) + (flavor?.basePrice ?? 0);
    }
    for (const group of config.product.comboGroups ?? []) {
      for (const productId of config.groupSelections[group.id] ?? []) {
        const option = group.options.find((item) => item.productId === productId);
        if (option) regular += (option.basePrice + option.priceDelta) * Math.max(1, option.quantity);
      }
    }
    return Math.max(0, regular - (config.product.comboDiscount ?? 0));
  }

  function toggleComboOption(group: ComboGroup, productId: number) {
    if (!comboConfig) return;
    const current = comboConfig.groupSelections[group.id] ?? [];
    let next = current;
    if (current.includes(productId)) next = current.filter((id) => id !== productId);
    else if (group.maxSelections <= 1) next = [productId];
    else if (current.length < group.maxSelections) next = [...current, productId];
    setComboConfig({ ...comboConfig, groupSelections: { ...comboConfig.groupSelections, [group.id]: next } });
  }

  function confirmCombo() {
    if (!comboConfig) return;
    for (const group of comboConfig.product.comboGroups ?? []) {
      const count = (comboConfig.groupSelections[group.id] ?? []).length;
      if (count < group.minSelections || count > group.maxSelections) return setConfigError(`Completa la selección de ${group.name}.`);
    }
    if (comboConfig.pizzas.some((pizza) => !pizza.sizeId || !pizza.flavorId)) return setConfigError("Completa todas las pizzas del combo.");

    const pizzas = comboConfig.pizzas.map((choice) => {
      const rule = comboConfig.product.comboPizzaRules?.find((item) => item.id === choice.ruleId)!;
      const size = rule.sizes.find((item) => item.id === choice.sizeId)!;
      const flavor = rule.flavors.find((item) => item.id === choice.flavorId)!;
      return {
        ruleId: rule.id,
        size: { id: size.id, name: size.name, diameterCm: size.diameterCm, basePrice: size.basePrice },
        flavor: { productId: flavor.id, name: flavor.name, portion: 1, basePrice: flavor.basePrice },
      };
    });

    const groups = (comboConfig.product.comboGroups ?? []).map((group) => ({
      groupId: group.id,
      kind: group.kind,
      name: group.name,
      selections: (comboConfig.groupSelections[group.id] ?? []).map((productId) => {
        const option = group.options.find((item) => item.productId === productId)!;
        return { optionId: option.id, productId: option.productId, name: option.productName, quantity: Math.max(1, option.quantity), unitPrice: option.basePrice, priceDelta: option.priceDelta };
      }),
    }));

    const configuration: ComboOrderConfiguration = {
      schemaVersion: 1,
      kind: "COMBO",
      comboProductId: comboConfig.product.id,
      comboName: comboConfig.product.name,
      comboDiscount: comboConfig.product.comboDiscount ?? 0,
      pizzas,
      groups,
    };

    const detail = [
      ...pizzas.map((pizza, index) => `Pizza ${index + 1}: ${pizza.size.name} ${pizza.flavor.name}`),
      ...groups.map((group) => `${group.name}: ${group.selections.map((selection) => `${selection.quantity > 1 ? `${selection.quantity}× ` : ""}${selection.name}`).join(", ")}`),
    ].join(" · ");

    setCart((current) => [...current, {
      key: `combo-${Date.now()}-${Math.random()}`,
      productId: comboConfig.product.id,
      name: comboConfig.product.name,
      detail,
      unitPrice: comboPrice(comboConfig),
      quantity: 1,
      configuration,
    }]);
    setComboConfig(null); setConfigError("");
  }

  function changeQty(key: string, delta: number) {
    setCart((current) => current.map((item) => item.key === key ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));
  }

  return (
    <main className="min-h-screen p-4 sm:p-5 lg:p-7 xl:p-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="alento-dark rounded-[26px] px-6 py-4 md:px-8 md:py-5">
          <div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">Operación Alentó</p><h1 className="text-2xl font-black md:text-3xl">Punto de venta</h1><p className="mt-1 text-xs text-white/60">Pedidos estructurados y preparados para inventario y costos.</p></div><span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white/70">POS activo</span></div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5">
            <section className="alento-card rounded-[26px] p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Preparar pedido</p><h2 className="mt-1 text-xl font-black">Tipo de pedido y cliente</h2></div><span className="text-[10px] font-black uppercase text-emerald-600">Datos estructurados</span></div>
              <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
                <div><p className="mb-2 text-xs font-black">1. Tipo de pedido</p><div className="grid grid-cols-3 gap-2">{fulfillmentOptions.map((option) => <button key={option.type} onClick={() => setFulfillmentType(option.type)} className={`rounded-2xl border-2 px-3 py-3 text-left ${fulfillmentType === option.type ? "border-[var(--brand-red)] bg-red-50" : "border-neutral-200 bg-white"}`}><span className="text-xl">{option.icon}</span><b className="mt-1 block text-xs sm:text-sm">{option.title}</b></button>)}</div></div>
                <div className="border-t pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-black">2. Cliente <span className={`ml-1 text-[10px] uppercase ${requiresCustomer ? "text-[var(--brand-red)]" : "text-neutral-400"}`}>{requiresCustomer ? "Obligatorio" : "Opcional"}</span></p><button onClick={openNewCustomer} className="text-xs font-black text-[var(--brand-red)]">+ Nuevo cliente</button></div>
                  {selectedCustomer ? <div><div className="flex items-center justify-between rounded-2xl border bg-[#faf9f7] px-4 py-3"><div className="min-w-0"><b className="block truncate text-sm">{selectedCustomer.name}</b><span className="text-xs text-neutral-500">{selectedCustomer.countryCode} {selectedCustomer.phone}</span>{fulfillmentType === "DELIVERY" && selectedAddress?.address && <span className="block truncate text-xs text-neutral-500">{selectedAddress.address}</span>}</div><div className="flex gap-1"><button onClick={() => openEditCustomer(selectedCustomer)} className="rounded-xl border bg-white px-3 py-2 text-xs font-bold">Editar</button><button onClick={() => { setSelectedCustomer(null); setQuery(""); }} className="rounded-xl border bg-white px-3 py-2 text-xs font-bold">Cambiar</button></div></div>{fulfillmentType === "DELIVERY" && !hasDeliveryAddress && <button onClick={() => openEditCustomer(selectedCustomer)} className="mt-2 w-full rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700">Agregar dirección de domicilio</button>}</div> : <><div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchCustomers(); }} className="alento-input min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm" placeholder="Nombre, teléfono o correo"/><button onClick={() => void searchCustomers()} className="rounded-xl bg-black px-4 text-xs font-black text-white">{searching ? "..." : "Buscar"}</button></div>{(customers.length > 0 || searchMessage) && <div className="mt-2 overflow-hidden rounded-xl border">{customers.map((customer) => <button key={customer.id} onClick={() => chooseCustomer(customer)} className="flex w-full justify-between border-b bg-white px-3 py-2 text-left text-xs"><b>{customer.name}</b><span>{customer.phone}</span></button>)}{searchMessage && <p className="bg-white px-3 py-2 text-xs text-neutral-500">{searchMessage}</p>}</div>}</>}
                </div>
              </div>
            </section>

            {catalogLoading ? <div className="alento-card rounded-3xl p-8">Cargando catálogo...</div> : catalogError ? <div className="rounded-3xl bg-red-50 p-5 text-red-700">{catalogError}</div> : <><div className="flex gap-2 overflow-x-auto">{catalog?.categories.map((category) => <button key={category.id} onClick={() => setActiveCategory(category.slug)} className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold ${selectedCategory?.slug === category.slug ? "bg-black text-white" : "border bg-white"}`}>{category.name}</button>)}</div><div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{selectedCategory?.products.map((product) => <article key={product.id} className="alento-card-soft overflow-hidden rounded-[24px]"><div className="aspect-square bg-[#f7f6f3]">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-2"/> : <div className="flex h-full items-center justify-center text-5xl">🍕</div>}</div><div className="p-4"><h3 className="font-black">{product.name}</h3><p className="mt-1 line-clamp-2 min-h-9 text-xs text-neutral-500">{product.description || "Producto Alentó Pizza"}</p><div className="mt-4 flex items-end justify-between"><div><span className="text-[10px] font-bold uppercase text-neutral-400">Precio</span><b className="block">{displayPrice(product)}</b></div><button onClick={() => startAdd(product)} disabled={!canAddProducts} className="rounded-2xl bg-[var(--brand-red)] px-4 py-2.5 text-sm font-black text-white disabled:bg-neutral-200 disabled:text-neutral-400">Agregar</button></div></div></article>)}</div></>}
          </div>

          <aside className="alento-card rounded-[30px] p-4 xl:sticky xl:top-7 xl:flex xl:h-[calc(100vh-4rem)] xl:flex-col"><div className="mb-3"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Pedido actual</p><h2 className="mt-1 text-2xl font-black">{cartCount ? `${cartCount} producto${cartCount === 1 ? "" : "s"}` : "Sin productos"}</h2>{selectedCustomer && <p className="text-sm text-neutral-500">Para {selectedCustomer.name}</p>}</div>
            {cart.length ? <div className="alento-scroll min-h-0 flex-1 space-y-2 overflow-y-auto">{cart.map((item) => <div key={item.key} className="rounded-xl border p-2.5"><div className="flex justify-between gap-2"><div className="min-w-0"><b className="block truncate text-sm">{item.name}</b><p className="line-clamp-3 text-[11px] text-neutral-500">{item.detail}</p><span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700">✓ Estructurado</span></div><b className="text-sm">{formatCOP(item.unitPrice * item.quantity)}</b></div><div className="mt-2 flex items-center justify-between"><span className="text-[10px] text-neutral-400">c/u {formatCOP(item.unitPrice)}</span><div className="flex items-center gap-1"><button onClick={() => changeQty(item.key, -1)} className="h-7 w-7 rounded-lg bg-neutral-100">−</button><b className="w-6 text-center text-sm">{item.quantity}</b><button onClick={() => changeQty(item.key, 1)} className="h-7 w-7 rounded-lg bg-neutral-100">+</button></div></div></div>)}</div> : <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed p-8 text-center text-sm text-neutral-400">Agrega productos al pedido.</div>}
            <div className="mt-3 border-t pt-3"><div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><b>{formatCOP(subtotal)}</b></div><div className="mt-3 flex items-end justify-between border-t border-dashed pt-3"><b>Total productos</b><b className="text-2xl text-[var(--brand-red)]">{formatCOP(subtotal)}</b></div><button onClick={() => setCheckoutOpen(true)} disabled={!canContinue} className="mt-3 w-full rounded-2xl bg-[var(--brand-red)] px-4 py-3 font-black text-white disabled:bg-neutral-200 disabled:text-neutral-400">Continuar pedido</button></div>
          </aside>
        </section>
      </div>

      <OrderCheckoutModal open={checkoutOpen} fulfillmentType={fulfillmentType} customer={selectedCustomer} cart={cart} subtotal={subtotal} onClose={() => setCheckoutOpen(false)} />

      {showCustomerModal && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4"><div className="alento-card w-full max-w-xl rounded-[28px]"><div className="flex items-start justify-between border-b px-6 py-5"><div><p className="text-[10px] font-black uppercase text-neutral-400">Cliente</p><h2 className="text-2xl font-black">{editingCustomer ? "Editar cliente" : "Nuevo cliente"}</h2></div><button onClick={() => setShowCustomerModal(false)} className="rounded-full bg-neutral-100 px-3 py-2 text-sm">Cerrar</button></div><form onSubmit={saveCustomer}><div className="space-y-4 p-6"><input value={name} onChange={(event) => setName(event.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" placeholder="Nombre *"/><div className="grid grid-cols-[100px_1fr] gap-3"><select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="alento-input rounded-2xl px-3"><option>+57</option><option>+1</option></select><input value={phone} onChange={(event) => setPhone(event.target.value)} className="alento-input rounded-2xl px-4 py-3" placeholder="Teléfono *"/></div><input value={address} onChange={(event) => setAddress(event.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" placeholder={fulfillmentType === "DELIVERY" ? "Dirección *" : "Dirección (opcional)"}/><input value={email} onChange={(event) => setEmail(event.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" placeholder="Correo (opcional)"/><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" rows={3} placeholder="Notas"/>{customerError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{customerError}</p>}</div><div className="flex justify-end gap-2 border-t p-4"><button type="button" onClick={() => setShowCustomerModal(false)} className="rounded-2xl border px-5 py-3 text-sm font-black">Cancelar</button><button disabled={savingCustomer} className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 text-sm font-black text-white">{savingCustomer ? "Guardando..." : "Guardar"}</button></div></form></div></div>}

      {pizzaConfig && catalog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"><div className="alento-card flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[26px]"><div className="flex items-center justify-between border-b px-5 py-4"><div><p className="text-[10px] font-black uppercase text-neutral-400">Configurar pizza</p><h2 className="text-2xl font-black">{pizzaConfig.product.name}</h2></div><button onClick={() => setPizzaConfig(null)} className="rounded-full bg-neutral-100 px-3 py-2 text-sm">Cerrar</button></div><div className="alento-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-5"><section><h3 className="mb-2 font-black">Tamaño</h3><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{catalog.sizes.map((size) => <button key={size.id} onClick={() => setPizzaConfig({ ...pizzaConfig, sizeId: size.id })} className={`rounded-xl border p-3 text-left ${pizzaConfig.sizeId === size.id ? "bg-black text-white" : "bg-white"}`}><b>{size.name}</b><span className="block text-xs opacity-70">{size.diameterCm} cm</span></button>)}</div></section>{isTwoFlavorPizza(pizzaConfig.product) && <><section><h3 className="mb-2 font-black">Sabor 1</h3><div className="grid grid-cols-2 gap-2 md:grid-cols-3">{catalog.pizzaFlavors.map((flavor) => <button key={flavor.id} onClick={() => setPizzaConfig({ ...pizzaConfig, firstFlavorId: flavor.id, secondFlavorId: pizzaConfig.secondFlavorId === flavor.id ? null : pizzaConfig.secondFlavorId })} className={`rounded-xl border p-3 text-left ${pizzaConfig.firstFlavorId === flavor.id ? "bg-black text-white" : "bg-white"}`}>{flavor.name}</button>)}</div></section><section><h3 className="mb-2 font-black">Sabor 2</h3><div className="grid grid-cols-2 gap-2 md:grid-cols-3">{catalog.pizzaFlavors.map((flavor) => <button key={flavor.id} disabled={pizzaConfig.firstFlavorId === flavor.id} onClick={() => setPizzaConfig({ ...pizzaConfig, secondFlavorId: flavor.id })} className={`rounded-xl border p-3 text-left ${pizzaConfig.secondFlavorId === flavor.id ? "bg-black text-white" : pizzaConfig.firstFlavorId === flavor.id ? "bg-neutral-100 text-neutral-300" : "bg-white"}`}>{flavor.name}</button>)}</div></section></>}<section><h3 className="mb-2 font-black">Borde</h3><div className="grid grid-cols-2 gap-2">{catalog.crusts.map((crust) => <button key={crust.id} onClick={() => setPizzaConfig({ ...pizzaConfig, crustId: crust.id })} className={`rounded-xl border p-3 text-left ${pizzaConfig.crustId === crust.id ? "bg-black text-white" : "bg-white"}`}>{crust.name}</button>)}</div></section><section><h3 className="mb-2 font-black">Ingredientes extra</h3><div className="grid grid-cols-2 gap-2 md:grid-cols-3">{catalog.modifiers.map((modifier) => <button key={modifier.id} onClick={() => setPizzaConfig({ ...pizzaConfig, modifierIds: pizzaConfig.modifierIds.includes(modifier.id) ? pizzaConfig.modifierIds.filter((id) => id !== modifier.id) : [...pizzaConfig.modifierIds, modifier.id] })} className={`rounded-xl border p-3 text-left ${pizzaConfig.modifierIds.includes(modifier.id) ? "border-[var(--brand-red)] bg-red-50" : "bg-white"}`}><b>{modifier.name}</b><span className="block text-xs text-neutral-500">+{formatCOP(modifier.basePrice)}</span></button>)}</div></section>{configError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{configError}</p>}</div><div className="flex items-center justify-between border-t p-4"><b className="text-2xl text-[var(--brand-red)]">{formatCOP(pizzaPrice(pizzaConfig))}</b><button onClick={confirmPizza} className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 font-black text-white">Agregar al pedido</button></div></div></div>}

      {comboConfig && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"><div className="alento-card flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[26px]"><div className="flex items-center justify-between border-b px-5 py-4"><div><p className="text-[10px] font-black uppercase text-neutral-400">Configurar combo</p><h2 className="text-2xl font-black">{comboConfig.product.name}</h2></div><button onClick={() => setComboConfig(null)} className="rounded-full bg-neutral-100 px-3 py-2 text-sm">Cerrar</button></div><div className="alento-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-5">{comboConfig.pizzas.map((choice, index) => { const rule = comboConfig.product.comboPizzaRules?.find((item) => item.id === choice.ruleId); if (!rule) return null; return <section key={`${choice.ruleId}-${index}`} className="rounded-2xl border p-4"><h3 className="font-black">Pizza {index + 1}</h3><div className="mt-3 flex flex-wrap gap-2">{rule.sizes.map((size) => <button key={size.id} onClick={() => { const pizzas = [...comboConfig.pizzas]; pizzas[index] = { ...pizzas[index], sizeId: size.id }; setComboConfig({ ...comboConfig, pizzas }); }} className={`rounded-xl border px-3 py-2 text-sm ${choice.sizeId === size.id ? "bg-black text-white" : "bg-white"}`}>{size.name}</button>)}</div><div className="mt-3 grid grid-cols-2 gap-2">{rule.flavors.map((flavor) => <button key={flavor.id} onClick={() => { const pizzas = [...comboConfig.pizzas]; pizzas[index] = { ...pizzas[index], flavorId: flavor.id }; setComboConfig({ ...comboConfig, pizzas }); }} className={`rounded-xl border p-3 text-left text-sm ${choice.flavorId === flavor.id ? "bg-black text-white" : "bg-white"}`}>{flavor.name}</button>)}</div></section>; })}{comboConfig.product.comboGroups?.map((group) => <section key={group.id}><h3 className="font-black">{group.name} <span className="text-xs font-normal text-neutral-400">elige {group.minSelections}{group.maxSelections !== group.minSelections ? ` a ${group.maxSelections}` : ""}</span></h3><div className="mt-2 grid grid-cols-2 gap-2">{group.options.map((option) => { const selected = (comboConfig.groupSelections[group.id] ?? []).includes(option.productId); return <button key={option.id} onClick={() => toggleComboOption(group, option.productId)} className={`rounded-xl border p-3 text-left ${selected ? "bg-black text-white" : "bg-white"}`}><b>{option.productName}</b>{option.quantity > 1 && <span className="block text-xs opacity-60">Cantidad incluida: {option.quantity}</span>}</button>; })}</div></section>)}{configError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{configError}</p>}</div><div className="flex items-center justify-between border-t p-4"><div><b className="block text-2xl text-[var(--brand-red)]">{formatCOP(comboPrice(comboConfig))}</b>{(comboConfig.product.comboDiscount ?? 0) > 0 && <span className="text-xs font-bold text-emerald-600">Ahorra {formatCOP(comboConfig.product.comboDiscount ?? 0)}</span>}</div><button onClick={confirmCombo} className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 font-black text-white">Agregar combo</button></div></div></div>}
    </main>
  );
}
