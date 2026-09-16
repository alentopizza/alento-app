"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type CustomerAddress = { id: number; address: string; neighborhood: string | null; city: string | null; notes: string | null };
type Customer = { id: number; name: string; countryCode: string; phone: string | null; email: string | null; notes: string | null; addresses: CustomerAddress[] };
type ProductType = "STANDARD" | "PIZZA_SINGLE" | "PIZZA_TWO_FLAVORS" | "COMBO" | "MODIFIER" | "INTERNAL";
type PizzaSize = { id: number; name: string; diameterCm: number; basePrice: number };
type Modifier = { id: number; name: string; description: string | null; imageUrl: string | null; basePrice: number };
type Crust = { id: number; name: string; prices: { sizeId: number; price: number }[] };
type ComboPizzaRule = { id: number; quantity: number; sizes: PizzaSize[]; flavors: { id: number; name: string; basePrice: number; imageUrl: string | null }[] };
type ComboGroup = { id: number; kind: string; name: string; minSelections: number; maxSelections: number; options: { id: number; productId: number; productName: string; productType: ProductType; basePrice: number; imageUrl: string | null; quantity: number; priceDelta: number }[] };
type CatalogProduct = { id: number; name: string; description: string | null; imageUrl: string | null; imageUrl2: string | null; type: ProductType; basePrice: number | null; featured: boolean; comboDiscount?: number; comboPizzaRules?: ComboPizzaRule[]; comboGroups?: ComboGroup[] };
type CatalogCategory = { id: number; name: string; slug: string; imageUrl: string | null; products: CatalogProduct[] };
type CatalogResponse = { categories: CatalogCategory[]; pizzaFlavors: CatalogProduct[]; sizes: PizzaSize[]; crusts: Crust[]; modifiers: Modifier[] };
type CartItem = { key: string; productId: number; name: string; detail: string; unitPrice: number; quantity: number };
type PizzaConfig = { product: CatalogProduct; sizeId: number | null; firstFlavorId: number | null; secondFlavorId: number | null; crustId: number | null; modifierIds: number[] };
type ComboPizzaChoice = { sizeId: number | null; flavorId: number | null };
type ComboConfig = { product: CatalogProduct; pizzas: ComboPizzaChoice[]; groupSelections: Record<number, number[]> };

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function isTwoFlavorPizza(product: CatalogProduct) {
  return product.type === "PIZZA_TWO_FLAVORS" || product.name.toLowerCase().includes("2 sabores");
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+57");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState("");

  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pizzaConfig, setPizzaConfig] = useState<PizzaConfig | null>(null);
  const [comboConfig, setComboConfig] = useState<ComboConfig | null>(null);
  const [configError, setConfigError] = useState("");

  useEffect(() => {
    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError("");
      try {
        const response = await fetch("/api/catalog", { cache: "no-store" });
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
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
  const minPizzaSizePrice = useMemo(() => catalog?.sizes?.length ? Math.min(...catalog.sizes.map((size) => size.basePrice)) : 0, [catalog]);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  function displayPrice(product: CatalogProduct) {
    if (isTwoFlavorPizza(product)) {
      const flavorPrices = catalog?.pizzaFlavors.map((flavor) => flavor.basePrice ?? 0) ?? [];
      return `Desde ${formatCOP(minPizzaSizePrice + (flavorPrices.length ? Math.min(...flavorPrices) : 0))}`;
    }
    if (product.type === "PIZZA_SINGLE") return `Desde ${formatCOP(minPizzaSizePrice + (product.basePrice ?? 0))}`;
    if (product.type === "COMBO") return product.comboDiscount ? `Ahorra ${formatCOP(product.comboDiscount)}` : (product.basePrice == null ? "Configurable" : formatCOP(product.basePrice));
    return product.basePrice == null ? "Precio por definir" : formatCOP(product.basePrice);
  }

  async function searchCustomers() {
    const value = query.trim();
    if (value.length < 2) {
      setCustomers([]);
      setSearchMessage("Escribe al menos 2 caracteres para buscar.");
      return;
    }
    setSearching(true);
    setSearchMessage("");
    try {
      const response = await fetch(`/api/customers?q=${encodeURIComponent(value)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible buscar clientes.");
      setCustomers(data.customers ?? []);
      setSearchMessage((data.customers ?? []).length === 0 ? "No encontramos clientes con ese dato." : "");
    } catch (error) {
      setCustomers([]);
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

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCustomerError("");
    if (!name.trim() || !phone.trim()) {
      setCustomerError("Nombre y teléfono son obligatorios.");
      return;
    }
    setSavingCustomer(true);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, countryCode, phone, address, notes, email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible crear el cliente.");
      chooseCustomer(data.customer);
      setName("");
      setCountryCode("+57");
      setPhone("");
      setAddress("");
      setNotes("");
      setEmail("");
      setShowCreateCustomer(false);
    } catch (error) {
      setCustomerError(error instanceof Error ? error.message : "No fue posible crear el cliente.");
    } finally {
      setSavingCustomer(false);
    }
  }

  function addSimpleProduct(product: CatalogProduct) {
    if (product.basePrice == null) return;
    const key = `product-${product.id}`;
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      return existing
        ? current.map((item) => item.key === key ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { key, productId: product.id, name: product.name, detail: "Producto", unitPrice: product.basePrice!, quantity: 1 }];
    });
  }

  function startAdd(product: CatalogProduct) {
    setConfigError("");
    if (product.type === "PIZZA_SINGLE" || isTwoFlavorPizza(product)) {
      const twoFlavors = isTwoFlavorPizza(product);
      setPizzaConfig({
        product,
        sizeId: catalog?.sizes[0]?.id ?? null,
        firstFlavorId: twoFlavors ? null : product.id,
        secondFlavorId: null,
        crustId: catalog?.crusts.find((crust) => crust.name.toLowerCase().includes("tradicional"))?.id ?? null,
        modifierIds: [],
      });
      return;
    }
    if (product.type === "COMBO") {
      const rule = product.comboPizzaRules?.[0];
      const pizzaCount = rule?.quantity ?? 0;
      const pizzas = Array.from({ length: pizzaCount }, () => ({ sizeId: rule?.sizes?.[0]?.id ?? null, flavorId: rule?.flavors?.[0]?.id ?? null }));
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

    let flavorPrice = config.product.basePrice ?? 0;
    if (isTwoFlavorPizza(config.product)) {
      const first = catalog.pizzaFlavors.find((item) => item.id === config.firstFlavorId)?.basePrice ?? 0;
      const second = catalog.pizzaFlavors.find((item) => item.id === config.secondFlavorId)?.basePrice ?? 0;
      flavorPrice = Math.max(first, second);
    }

    const crust = catalog.crusts.find((item) => item.id === config.crustId);
    const crustPrice = crust?.prices.find((price) => price.sizeId === size.id)?.price ?? 0;
    const modifiersPrice = catalog.modifiers.filter((item) => config.modifierIds.includes(item.id)).reduce((sum, item) => sum + item.basePrice, 0);
    return size.basePrice + flavorPrice + crustPrice + modifiersPrice;
  }

  function confirmPizza() {
    if (!pizzaConfig || !catalog || !pizzaConfig.sizeId) return;
    const size = catalog.sizes.find((item) => item.id === pizzaConfig.sizeId);
    if (!size) return;

    const twoFlavors = isTwoFlavorPizza(pizzaConfig.product);
    if (twoFlavors && (!pizzaConfig.firstFlavorId || !pizzaConfig.secondFlavorId)) {
      setConfigError("Selecciona los dos sabores de la pizza.");
      return;
    }
    if (twoFlavors && pizzaConfig.firstFlavorId === pizzaConfig.secondFlavorId) {
      setConfigError("Los dos sabores deben ser diferentes. Si quieres un solo sabor, elige esa pizza directamente.");
      return;
    }

    const crust = catalog.crusts.find((item) => item.id === pizzaConfig.crustId);
    const extras = catalog.modifiers.filter((item) => pizzaConfig.modifierIds.includes(item.id));
    const firstFlavor = catalog.pizzaFlavors.find((item) => item.id === pizzaConfig.firstFlavorId);
    const secondFlavor = catalog.pizzaFlavors.find((item) => item.id === pizzaConfig.secondFlavorId);
    const detail = [
      size.name,
      twoFlavors && firstFlavor && secondFlavor ? `½ ${firstFlavor.name} + ½ ${secondFlavor.name}` : null,
      crust ? `Borde ${crust.name}` : null,
      ...extras.map((item) => `+ ${item.name}`),
    ].filter(Boolean).join(" · ");

    setCart((current) => [...current, {
      key: `pizza-${Date.now()}-${Math.random()}`,
      productId: pizzaConfig.product.id,
      name: pizzaConfig.product.name,
      detail,
      unitPrice: pizzaPrice(pizzaConfig),
      quantity: 1,
    }]);
    setPizzaConfig(null);
    setConfigError("");
  }

  function comboPrice(config: ComboConfig) {
    let regular = 0;
    const rule = config.product.comboPizzaRules?.[0];
    if (rule) {
      for (const choice of config.pizzas) {
        const size = rule.sizes.find((item) => item.id === choice.sizeId);
        const flavor = rule.flavors.find((item) => item.id === choice.flavorId);
        regular += (size?.basePrice ?? 0) + (flavor?.basePrice ?? 0);
      }
    }
    for (const group of config.product.comboGroups ?? []) {
      for (const productId of config.groupSelections[group.id] ?? []) {
        const option = group.options.find((item) => item.productId === productId);
        regular += (option?.basePrice ?? 0) + (option?.priceDelta ?? 0);
      }
    }
    return Math.max(0, regular - (config.product.comboDiscount ?? 0));
  }

  function toggleComboOption(group: ComboGroup, productId: number) {
    if (!comboConfig) return;
    const current = comboConfig.groupSelections[group.id] ?? [];
    let next: number[];
    if (current.includes(productId)) next = current.filter((id) => id !== productId);
    else if (group.maxSelections <= 1) next = [productId];
    else if (current.length < group.maxSelections) next = [...current, productId];
    else next = current;
    setComboConfig({ ...comboConfig, groupSelections: { ...comboConfig.groupSelections, [group.id]: next } });
  }

  function confirmCombo() {
    if (!comboConfig) return;
    const rule = comboConfig.product.comboPizzaRules?.[0];
    if (rule && comboConfig.pizzas.some((item) => !item.sizeId || !item.flavorId)) {
      setConfigError("Completa tamaño y sabor de todas las pizzas.");
      return;
    }
    for (const group of comboConfig.product.comboGroups ?? []) {
      const count = (comboConfig.groupSelections[group.id] ?? []).length;
      if (count < group.minSelections || count > group.maxSelections) {
        setConfigError(`Completa la selección de ${group.name}.`);
        return;
      }
    }
    const parts: string[] = [];
    if (rule) comboConfig.pizzas.forEach((choice, index) => {
      const size = rule.sizes.find((item) => item.id === choice.sizeId);
      const flavor = rule.flavors.find((item) => item.id === choice.flavorId);
      parts.push(`Pizza ${index + 1}: ${size?.name ?? ""} ${flavor?.name ?? ""}`.trim());
    });
    for (const group of comboConfig.product.comboGroups ?? []) {
      const names = (comboConfig.groupSelections[group.id] ?? []).map((id) => group.options.find((item) => item.productId === id)?.productName).filter(Boolean);
      if (names.length) parts.push(`${group.name}: ${names.join(", ")}`);
    }
    setCart((current) => [...current, {
      key: `combo-${Date.now()}-${Math.random()}`,
      productId: comboConfig.product.id,
      name: comboConfig.product.name,
      detail: parts.join(" · "),
      unitPrice: comboPrice(comboConfig),
      quantity: 1,
    }]);
    setComboConfig(null);
    setConfigError("");
  }

  function changeQty(key: string, delta: number) {
    setCart((current) => current.map((item) => item.key === key ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));
  }

  const selectedAddress = selectedCustomer?.addresses?.[0];
  const configuringTwoFlavors = pizzaConfig ? isTwoFlavorPizza(pizzaConfig.product) : false;

  return (
    <main className="min-h-screen p-4 sm:p-5 lg:p-7 xl:p-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="alento-dark overflow-hidden rounded-[26px] px-6 py-4 md:px-8 md:py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-red)]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">Operación Alentó</p>
              </div>
              <h1 className="text-2xl font-black md:text-3xl">Punto de venta</h1>
              <p className="mt-1 text-xs text-white/58 md:text-sm">Toma pedidos, consulta clientes y arma cada orden desde una sola pantalla.</p>
            </div>
            <span className="w-fit rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white/70">POS activo</span>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5">
            <div className="alento-card rounded-[28px] p-5 md:p-6">
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Cliente</p>
                  <h2 className="mt-1 text-2xl font-black">{selectedCustomer ? selectedCustomer.name : "Nuevo pedido"}</h2>
                  {selectedCustomer ? <div className="mt-2 text-sm text-[var(--muted)]">{selectedCustomer.countryCode} {selectedCustomer.phone || "Sin teléfono"}{selectedAddress?.address ? ` · ${selectedAddress.address}` : ""}</div> : <p className="mt-1 text-sm text-[var(--muted)]">Busca un cliente existente o crea uno nuevo para comenzar.</p>}
                </div>
                <div className="flex gap-2">
                  {selectedCustomer && <button onClick={() => { setSelectedCustomer(null); setQuery(""); }} className="rounded-2xl border border-[var(--border)] px-4 py-2.5 text-sm font-bold">Cambiar cliente</button>}
                  <button onClick={() => setShowCreateCustomer(true)} className="rounded-2xl bg-[var(--brand-red)] px-4 py-2.5 text-sm font-black text-white">+ Nuevo cliente</button>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchCustomers(); }} className="alento-input flex-1 rounded-2xl px-4 py-3.5" placeholder="Nombre, teléfono o correo del cliente" />
                <button onClick={() => void searchCustomers()} className="rounded-2xl bg-black px-5 py-3.5 text-sm font-black text-white">{searching ? "Buscando..." : "Buscar cliente"}</button>
              </div>
              {(customers.length > 0 || searchMessage) && <div className="mt-3 overflow-hidden rounded-2xl border bg-white">
                {customers.map((customer) => <button key={customer.id} onClick={() => chooseCustomer(customer)} className="flex w-full justify-between border-b px-4 py-3 text-left"><span><b>{customer.name}</b><span className="block text-sm text-neutral-500">{customer.countryCode} {customer.phone}</span></span><span>Seleccionar</span></button>)}
                {searchMessage && <p className="px-4 py-3 text-sm text-neutral-500">{searchMessage}</p>}
              </div>}
            </div>

            {catalogLoading ? <div className="alento-card rounded-[28px] p-8">Cargando catálogo...</div> : catalogError ? <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700">{catalogError}</div> : <>
              <div className="flex gap-2 overflow-x-auto pb-1">{catalog?.categories.map((category) => <button key={category.id} onClick={() => setActiveCategory(category.slug)} className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold ${selectedCategory?.slug === category.slug ? "bg-black text-white" : "border bg-white"}`}>{category.name}</button>)}</div>
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{selectedCategory?.products.map((product) => <article key={product.id} className="alento-card-soft overflow-hidden rounded-[26px]">
                <div className="relative aspect-square bg-[#111112]">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-5xl">🍕</div>}<span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-[11px] font-bold text-white">{product.type === "COMBO" ? "Combo" : selectedCategory.name}</span></div>
                <div className="p-4"><h3 className="text-lg font-black">{product.name}</h3><p className="mt-1 min-h-10 text-sm text-[var(--muted)] line-clamp-2">{product.description || "Producto Alentó Pizza"}</p><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase text-neutral-400">Precio</p><span className="font-black">{displayPrice(product)}</span></div><button onClick={() => startAdd(product)} className="rounded-2xl bg-[var(--brand-red)] px-4 py-2.5 text-sm font-black text-white">Agregar</button></div></div>
              </article>)}</div>
            </>}
          </div>

          <aside className="alento-card rounded-[30px] p-4 xl:sticky xl:top-7 xl:flex xl:h-[calc(100vh-3.5rem)] xl:flex-col">
            <div className="mb-3 shrink-0"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Pedido actual</p><div className="mt-1 flex items-end justify-between gap-3"><h2 className="text-2xl font-black">{cartCount ? `${cartCount} producto${cartCount === 1 ? "" : "s"}` : "Sin productos"}</h2>{cart.length > 0 && <span className="text-xs font-bold text-neutral-400">{cart.length} línea{cart.length === 1 ? "" : "s"}</span>}</div>{selectedCustomer && <p className="mt-1 text-sm text-[var(--muted)]">Para {selectedCustomer.name}</p>}</div>
            {cart.length === 0 ? <div className="rounded-[20px] border border-dashed bg-[#faf9f7] px-4 py-9 text-center xl:flex xl:flex-1 xl:flex-col xl:items-center xl:justify-center"><p className="font-bold">Tu pedido está vacío</p><p className="mt-1 text-xs text-neutral-400">Agrega productos para comenzar.</p></div> : <div className="alento-scroll min-h-0 space-y-2 overflow-y-auto pr-1 xl:flex-1">{cart.map((item) => <div key={item.key} className="rounded-xl border border-neutral-200 bg-white p-2.5"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{item.name}</p><p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-neutral-500">{item.detail}</p></div><b className="whitespace-nowrap text-sm">{formatCOP(item.unitPrice * item.quantity)}</b></div><div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold text-neutral-400">c/u {formatCOP(item.unitPrice)}</span><div className="flex items-center gap-1.5"><button onClick={() => changeQty(item.key, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold">−</button><span className="min-w-5 text-center text-sm font-black">{item.quantity}</span><button onClick={() => changeQty(item.key, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold">+</button></div></div></div>)}</div>}
            <div className="mt-3 shrink-0 border-t bg-white pt-3"><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><strong>{formatCOP(subtotal)}</strong></div><div className="flex justify-between"><span className="text-neutral-500">Domicilio</span><strong>$0</strong></div><div className="flex items-end justify-between border-t border-dashed pt-3"><span className="font-black">Total</span><strong className="text-2xl font-black text-[var(--brand-red)]">{formatCOP(subtotal)}</strong></div></div><button disabled={!cart.length} className="mt-3 w-full rounded-2xl bg-[var(--brand-red)] px-4 py-3 font-black text-white disabled:bg-neutral-200 disabled:text-neutral-400">Confirmar pedido</button></div>
          </aside>
        </section>
      </div>

      {showCreateCustomer && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="alento-card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[30px] p-6"><div className="mb-5 flex justify-between"><h2 className="text-2xl font-black">Nuevo cliente</h2><button onClick={() => setShowCreateCustomer(false)}>Cerrar</button></div><form onSubmit={createCustomer} className="space-y-4"><input value={name} onChange={(event) => setName(event.target.value)} className="alento-input w-full" placeholder="Nombre *" /><div className="grid grid-cols-[100px_1fr] gap-3"><select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="alento-input"><option>+57</option><option>+1</option></select><input value={phone} onChange={(event) => setPhone(event.target.value)} className="alento-input" placeholder="Teléfono *" /></div><input value={address} onChange={(event) => setAddress(event.target.value)} className="alento-input w-full" placeholder="Dirección (opcional)" /><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="alento-input w-full" placeholder="Notas" /><input value={email} onChange={(event) => setEmail(event.target.value)} className="alento-input w-full" placeholder="Correo (opcional)" />{customerError && <div className="rounded-xl bg-red-50 p-3 text-red-700">{customerError}</div>}<button disabled={savingCustomer} className="w-full rounded-2xl bg-[var(--brand-red)] p-3 font-black text-white">{savingCustomer ? "Guardando..." : "Crear cliente"}</button></form></div></div>}

      {pizzaConfig && catalog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"><div className="alento-card flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[30px]">
        <div className="shrink-0 border-b border-neutral-100 bg-white px-6 py-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-neutral-400">Configurar pizza</p><h2 className="text-2xl font-black">{pizzaConfig.product.name}</h2>{configuringTwoFlavors && <p className="mt-1 text-xs text-neutral-500">El precio toma el sabor de mayor valor.</p>}</div><div className="flex items-center gap-3"><div className="hidden rounded-2xl bg-red-50 px-4 py-2 text-right sm:block"><p className="text-[10px] font-bold uppercase tracking-wide text-red-400">Total actual</p><p className="text-lg font-black text-[var(--brand-red)]">{formatCOP(pizzaPrice(pizzaConfig))}</p></div><button onClick={() => setPizzaConfig(null)} className="rounded-full bg-neutral-100 px-3 py-2 text-sm font-bold">Cerrar</button></div></div></div>
        <div className="alento-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5"><div className="space-y-6">
          <section><h3 className="mb-3 font-black">1. Tamaño</h3><div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">{catalog.sizes.map((size) => <button key={size.id} onClick={() => setPizzaConfig({ ...pizzaConfig, sizeId: size.id })} className={`rounded-2xl border p-3 text-left ${pizzaConfig.sizeId === size.id ? "border-black bg-black text-white" : "bg-white"}`}><b>{size.name}</b><span className="block text-xs opacity-70">{size.diameterCm} cm · +{formatCOP(size.basePrice)}</span></button>)}</div></section>

          {configuringTwoFlavors && <>
            <section><h3 className="mb-3 font-black">2. Sabor 1</h3><div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">{catalog.pizzaFlavors.map((flavor) => <button key={flavor.id} onClick={() => setPizzaConfig({ ...pizzaConfig, firstFlavorId: flavor.id, secondFlavorId: pizzaConfig.secondFlavorId === flavor.id ? null : pizzaConfig.secondFlavorId })} className={`rounded-2xl border p-3 text-left ${pizzaConfig.firstFlavorId === flavor.id ? "border-black bg-black text-white" : "bg-white"}`}><b>{flavor.name}</b><span className="block text-xs opacity-70">Sabor {formatCOP(flavor.basePrice ?? 0)}</span></button>)}</div></section>
            <section><h3 className="mb-3 font-black">3. Sabor 2</h3><div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">{catalog.pizzaFlavors.map((flavor) => { const disabled = pizzaConfig.firstFlavorId === flavor.id; return <button key={flavor.id} disabled={disabled} onClick={() => setPizzaConfig({ ...pizzaConfig, secondFlavorId: flavor.id })} className={`rounded-2xl border p-3 text-left ${pizzaConfig.secondFlavorId === flavor.id ? "border-black bg-black text-white" : disabled ? "cursor-not-allowed bg-neutral-100 text-neutral-300" : "bg-white"}`}><b>{flavor.name}</b><span className="block text-xs opacity-70">{disabled ? "Ya elegido en sabor 1" : `Sabor ${formatCOP(flavor.basePrice ?? 0)}`}</span></button>; })}</div></section>
          </>}

          <section><h3 className="mb-3 font-black">{configuringTwoFlavors ? "4" : "2"}. Borde</h3><div className="grid gap-2 sm:grid-cols-2">{catalog.crusts.map((crust) => { const price = crust.prices.find((item) => item.sizeId === pizzaConfig.sizeId)?.price ?? 0; return <button key={crust.id} onClick={() => setPizzaConfig({ ...pizzaConfig, crustId: crust.id })} className={`rounded-2xl border p-3 text-left ${pizzaConfig.crustId === crust.id ? "border-black bg-black text-white" : "bg-white"}`}><b>{crust.name}</b><span className="block text-xs opacity-70">+{formatCOP(price)}</span></button>; })}</div></section>
          <section><h3 className="mb-3 font-black">Ingredientes extra</h3><div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">{catalog.modifiers.map((modifier) => <button key={modifier.id} onClick={() => setPizzaConfig({ ...pizzaConfig, modifierIds: pizzaConfig.modifierIds.includes(modifier.id) ? pizzaConfig.modifierIds.filter((id) => id !== modifier.id) : [...pizzaConfig.modifierIds, modifier.id] })} className={`rounded-2xl border p-3 text-left ${pizzaConfig.modifierIds.includes(modifier.id) ? "border-[var(--brand-red)] bg-red-50" : "bg-white"}`}><b>{modifier.name}</b><span className="block text-xs text-neutral-500">+{formatCOP(modifier.basePrice)}</span></button>)}</div></section>
        </div></div>
        <div className="shrink-0 border-t border-neutral-200 bg-white px-6 py-4 shadow-[0_-14px_30px_rgba(0,0,0,.06)]">{configError && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{configError}</div>}<div className="flex items-center justify-between gap-4"><div><span className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">Total de la pizza</span><p className="text-3xl font-black text-[var(--brand-red)]">{formatCOP(pizzaPrice(pizzaConfig))}</p></div><button onClick={confirmPizza} className="rounded-2xl bg-[var(--brand-red)] px-6 py-3.5 font-black text-white shadow-[0_10px_24px_rgba(229,28,17,.22)]">Agregar al pedido</button></div></div>
      </div></div>}

      {comboConfig && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"><div className="alento-card flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[30px]">
        <div className="shrink-0 border-b border-neutral-100 bg-white px-6 py-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-neutral-400">Configurar combo</p><h2 className="text-2xl font-black">{comboConfig.product.name}</h2></div><div className="flex items-center gap-3"><div className="hidden rounded-2xl bg-red-50 px-4 py-2 text-right sm:block"><p className="text-[10px] font-bold uppercase tracking-wide text-red-400">Precio actual</p><p className="text-lg font-black text-[var(--brand-red)]">{formatCOP(comboPrice(comboConfig))}</p></div><button onClick={() => setComboConfig(null)} className="rounded-full bg-neutral-100 px-3 py-2 text-sm font-bold">Cerrar</button></div></div></div>
        <div className="alento-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5"><div className="space-y-6">{comboConfig.product.comboPizzaRules?.[0] && comboConfig.pizzas.map((choice, index) => { const rule = comboConfig.product.comboPizzaRules![0]; return <section key={index} className="rounded-2xl border p-4"><h3 className="font-black">Pizza {index + 1}</h3><p className="mt-3 text-xs font-bold uppercase text-neutral-400">Tamaño</p><div className="mt-2 flex flex-wrap gap-2">{rule.sizes.map((size) => <button key={size.id} onClick={() => { const pizzas = [...comboConfig.pizzas]; pizzas[index] = { ...pizzas[index], sizeId: size.id }; setComboConfig({ ...comboConfig, pizzas }); }} className={`rounded-xl border px-3 py-2 ${choice.sizeId === size.id ? "bg-black text-white" : "bg-white"}`}>{size.name}</button>)}</div><p className="mt-4 text-xs font-bold uppercase text-neutral-400">Sabor</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{rule.flavors.map((flavor) => <button key={flavor.id} onClick={() => { const pizzas = [...comboConfig.pizzas]; pizzas[index] = { ...pizzas[index], flavorId: flavor.id }; setComboConfig({ ...comboConfig, pizzas }); }} className={`rounded-xl border p-3 text-left ${choice.flavorId === flavor.id ? "bg-black text-white" : "bg-white"}`}><b>{flavor.name}</b><span className="block text-xs opacity-60">{formatCOP(flavor.basePrice)}</span></button>)}</div></section>; })}{comboConfig.product.comboGroups?.map((group) => <section key={group.id}><h3 className="font-black">{group.name} <span className="text-sm font-normal text-neutral-400">(elige {group.minSelections}{group.maxSelections !== group.minSelections ? ` a ${group.maxSelections}` : ""})</span></h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{group.options.map((option) => { const selected = (comboConfig.groupSelections[group.id] ?? []).includes(option.productId); return <button key={option.id} onClick={() => toggleComboOption(group, option.productId)} className={`rounded-2xl border p-3 text-left ${selected ? "border-black bg-black text-white" : "bg-white"}`}><b>{option.productName}</b><span className="block text-xs opacity-60">{formatCOP(option.basePrice)}</span></button>; })}</div></section>)}</div></div>
        <div className="shrink-0 border-t border-neutral-200 bg-white px-6 py-4 shadow-[0_-14px_30px_rgba(0,0,0,.06)]">{configError && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{configError}</div>}<div className="flex items-center justify-between gap-4"><div><span className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">Precio combo</span><p className="text-3xl font-black text-[var(--brand-red)]">{formatCOP(comboPrice(comboConfig))}</p>{(comboConfig.product.comboDiscount ?? 0) > 0 && <p className="text-xs font-bold text-emerald-600">Incluye descuento de {formatCOP(comboConfig.product.comboDiscount ?? 0)}</p>}</div><button onClick={confirmCombo} className="rounded-2xl bg-[var(--brand-red)] px-6 py-3.5 font-black text-white shadow-[0_10px_24px_rgba(229,28,17,.22)]">Agregar combo</button></div></div>
      </div></div>}
    </main>
  );
}
