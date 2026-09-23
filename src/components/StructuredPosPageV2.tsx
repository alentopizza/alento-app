"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import OrderCheckoutModal from "@/components/OrderCheckoutModal";
import PosCartLine from "@/components/PosCartLine";
import type { ComboOrderConfiguration, OrderLineConfiguration, PizzaOrderConfiguration, StandardOrderConfiguration } from "@/lib/orderConfiguration";
import { emitLiveDataChange } from "@/lib/liveDataEvents";

type CustomerAddress = { id: number; label: string | null; address: string; neighborhood: string | null; city: string | null; notes: string | null; isDefault: boolean };
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
type CartItem = { key: string; productId: number; name: string; detail: string; unitPrice: number; quantity: number; configuration: OrderLineConfiguration; notes?: string };
type PizzaConfig = { product: CatalogProduct; sizeId: number | null; firstFlavorId: number | null; secondFlavorId: number | null; crustId: number | null; modifierIds: number[]; note: string };
type ComboPizzaChoice = { ruleId: number; sizeId: number | null; flavorId: number | null };
type ComboConfig = { product: CatalogProduct; pizzas: ComboPizzaChoice[]; groupSelections: Record<number, number[]> };

const fulfillmentOptions: { type: FulfillmentType; icon: string; title: string; shortTitle: string }[] = [
  { type: "DELIVERY", icon: "🛵", title: "Domicilio", shortTitle: "Domicilio" },
  { type: "PICKUP", icon: "🛍️", title: "Recoger en tienda", shortTitle: "Recoger" },
  { type: "STORE", icon: "🍽️", title: "Local", shortTitle: "Local" },
];

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function isTwoFlavorPizza(product: CatalogProduct) {
  return product.type === "PIZZA_TWO_FLAVORS" || product.name.toLowerCase().includes("2 sabores");
}

function crustPriceForSize(crust: Crust, sizeId: number | null) {
  if (!sizeId) return null;
  return crust.prices.find((price) => price.sizeId === sizeId)?.price ?? null;
}

export default function StructuredPosPageV2() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pizzaConfig, setPizzaConfig] = useState<PizzaConfig | null>(null);
  const [comboConfig, setComboConfig] = useState<ComboConfig | null>(null);
  const [editingCartKey, setEditingCartKey] = useState<string | null>(null);
  const [configError, setConfigError] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+57");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [addressEditor, setAddressEditor] = useState<{
    id: number | null;
    label: string;
    address: string;
    neighborhood: string;
    city: string;
    notes: string;
    isDefault: boolean;
  } | null>(null);
  const [addressBusy, setAddressBusy] = useState(false);

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
  const visibleCatalogProducts = useMemo(() => {
    const value = productQuery.trim().toLocaleLowerCase("es");
    if (!value) return selectedCategory?.products ?? [];

    const uniqueProducts = new Map<number, CatalogProduct>();
    for (const category of catalog?.categories ?? []) {
      for (const product of category.products) {
        if (uniqueProducts.has(product.id)) continue;
        const haystack = `${product.name} ${product.description ?? ""}`.toLocaleLowerCase("es");
        if (haystack.includes(value)) uniqueProducts.set(product.id, product);
      }
    }
    return [...uniqueProducts.values()];
  }, [catalog, selectedCategory, productQuery]);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const selectedAddress =
    selectedCustomer?.addresses?.find((item) => item.isDefault) ??
    selectedCustomer?.addresses?.[0];
  const requiresCustomer = fulfillmentType === "DELIVERY" || fulfillmentType === "PICKUP";
  const hasDeliveryAddress = Boolean(selectedAddress?.address?.trim());
  const canContinue = Boolean(cart.length && fulfillmentType && (!requiresCustomer || selectedCustomer) && (fulfillmentType !== "DELIVERY" || hasDeliveryAddress));

  function allProducts() {
    return catalog?.categories.flatMap((category) => category.products) ?? [];
  }

  function findProduct(id: number) {
    return allProducts().find((product) => product.id === id) ?? catalog?.pizzaFlavors.find((product) => product.id === id) ?? null;
  }

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
    setName("");
    setCountryCode("+57");
    setPhone("");
    setEmail("");
    setNotes("");
    setCustomerError("");
    setAddressEditor(null);
  }

  function openNewCustomer() {
    setEditingCustomer(null);
    resetCustomerForm();
    setAddressEditor({
      id: null,
      label: "Casa",
      address: "",
      neighborhood: "",
      city: "Bogotá",
      notes: "",
      isDefault: true,
    });
    setShowCustomerModal(true);
  }

  function openEditCustomer(customer: Customer) {
    setEditingCustomer(customer);
    setName(customer.name);
    setCountryCode(customer.countryCode || "+57");
    setPhone(customer.phone || "");
    setEmail(customer.email || "");
    setNotes(customer.notes || "");
    setCustomerError("");
    setShowCustomerModal(true);
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !phone.trim()) {
      return setCustomerError("Nombre y teléfono son obligatorios.");
    }

    if (
      !editingCustomer &&
      fulfillmentType === "DELIVERY" &&
      !addressEditor?.address.trim()
    ) {
      return setCustomerError("Agrega una dirección para el domicilio.");
    }

    setSavingCustomer(true);
    setCustomerError("");

    try {
      const response = await fetch(
        editingCustomer ? `/api/customers/${editingCustomer.id}` : "/api/customers",
        {
          method: editingCustomer ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            countryCode,
            phone,
            email,
            notes,
            ...(!editingCustomer && addressEditor?.address.trim()
              ? { address: addressEditor.address.trim() }
              : {}),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible guardar el cliente.");
      }

      let savedCustomer = data.customer as Customer;

      // Para cliente nuevo, enriquecer la primera dirección con etiqueta/barrio/notas.
      if (
        !editingCustomer &&
        addressEditor?.address.trim() &&
        savedCustomer.addresses?.[0]?.id
      ) {
        const addressResponse = await fetch(
          `/api/customers/${savedCustomer.id}/addresses/${savedCustomer.addresses[0].id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: addressEditor.label,
              address: addressEditor.address,
              neighborhood: addressEditor.neighborhood,
              city: addressEditor.city,
              notes: addressEditor.notes,
              isDefault: true,
            }),
          },
        );
        const addressData = await addressResponse.json();
        if (addressResponse.ok && addressData.customer) {
          savedCustomer = addressData.customer;
        }
      }

      chooseCustomer(savedCustomer);
      emitLiveDataChange(["customers", "account"]);
      setShowCustomerModal(false);
      setEditingCustomer(null);
      resetCustomerForm();
    } catch (error) {
      setCustomerError(
        error instanceof Error ? error.message : "No fue posible guardar el cliente.",
      );
    } finally {
      setSavingCustomer(false);
    }
  }

  function openAddressEditor(address?: CustomerAddress) {
    setAddressEditor(
      address
        ? {
            id: address.id,
            label: address.label ?? "",
            address: address.address,
            neighborhood: address.neighborhood ?? "",
            city: address.city ?? "Bogotá",
            notes: address.notes ?? "",
            isDefault: address.isDefault,
          }
        : {
            id: null,
            label: "Casa",
            address: "",
            neighborhood: "",
            city: "Bogotá",
            notes: "",
            isDefault: (editingCustomer?.addresses?.length ?? 0) === 0,
          },
    );
    setCustomerError("");
  }

  async function saveAddress() {
    if (!editingCustomer || !addressEditor?.address.trim()) {
      setCustomerError("Escribe una dirección.");
      return;
    }

    setAddressBusy(true);
    setCustomerError("");

    try {
      const endpoint = addressEditor.id
        ? `/api/customers/${editingCustomer.id}/addresses/${addressEditor.id}`
        : `/api/customers/${editingCustomer.id}/addresses`;

      const response = await fetch(endpoint, {
        method: addressEditor.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addressEditor),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible guardar la dirección.");
      }

      const updated = data.customer as Customer;
      setEditingCustomer(updated);
      if (selectedCustomer?.id === updated.id) chooseCustomer(updated);
      setAddressEditor(null);
      emitLiveDataChange(["customers", "account"]);
    } catch (error) {
      setCustomerError(
        error instanceof Error ? error.message : "No fue posible guardar la dirección.",
      );
    } finally {
      setAddressBusy(false);
    }
  }

  async function makeDefaultAddress(address: CustomerAddress) {
    if (!editingCustomer || address.isDefault) return;

    setAddressBusy(true);
    try {
      const response = await fetch(
        `/api/customers/${editingCustomer.id}/addresses/${address.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDefault: true }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible cambiar la dirección principal.");
      }

      const updated = data.customer as Customer;
      setEditingCustomer(updated);
      if (selectedCustomer?.id === updated.id) chooseCustomer(updated);
      emitLiveDataChange(["customers", "account"]);
    } catch (error) {
      setCustomerError(
        error instanceof Error ? error.message : "No fue posible cambiar la dirección principal.",
      );
    } finally {
      setAddressBusy(false);
    }
  }

  async function deleteAddress(address: CustomerAddress) {
    if (!editingCustomer) return;

    setAddressBusy(true);
    try {
      const response = await fetch(
        `/api/customers/${editingCustomer.id}/addresses/${address.id}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible eliminar la dirección.");
      }

      const updated = data.customer as Customer;
      setEditingCustomer(updated);
      if (selectedCustomer?.id === updated.id) chooseCustomer(updated);
      emitLiveDataChange(["customers", "account"]);
    } catch (error) {
      setCustomerError(
        error instanceof Error ? error.message : "No fue posible eliminar la dirección.",
      );
    } finally {
      setAddressBusy(false);
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
    setEditingCartKey(null);
    setConfigError("");
    if (product.type === "PIZZA_SINGLE" || isTwoFlavorPizza(product)) {
      setPizzaConfig({
        product,
        sizeId: catalog?.sizes[0]?.id ?? null,
        firstFlavorId: isTwoFlavorPizza(product) ? null : product.id,
        secondFlavorId: null,
        crustId: catalog?.crusts.find((crust) => crust.name.toLowerCase().includes("tradicional"))?.id ?? catalog?.crusts[0]?.id ?? null,
        modifierIds: [],
        note: "",
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

  function editCartItem(item: CartItem) {
    setConfigError("");
    if (item.configuration.kind === "PIZZA") {
      const product = findProduct(item.configuration.productId);
      if (!product) return;
      setEditingCartKey(item.key);
      setPizzaConfig({
        product,
        sizeId: item.configuration.size.id,
        firstFlavorId: item.configuration.flavors[0]?.productId ?? null,
        secondFlavorId: item.configuration.flavors[1]?.productId ?? null,
        crustId: item.configuration.crust.id,
        modifierIds: isTwoFlavorPizza(product) ? [] : item.configuration.modifiers.map((modifier) => modifier.productId),
        note: item.notes ?? "",
      });
      return;
    }

    if (item.configuration.kind === "COMBO") {
      const product = findProduct(item.configuration.comboProductId);
      if (!product) return;
      const groupSelections: Record<number, number[]> = {};
      for (const group of item.configuration.groups) groupSelections[group.groupId] = group.selections.map((selection) => selection.productId);
      setEditingCartKey(item.key);
      setComboConfig({
        product,
        pizzas: item.configuration.pizzas.map((pizza) => ({ ruleId: pizza.ruleId, sizeId: pizza.size.id, flavorId: pizza.flavor.productId })),
        groupSelections,
      });
    }
  }

  function closePizzaConfig() { setPizzaConfig(null); setEditingCartKey(null); setConfigError(""); }
  function closeComboConfig() { setComboConfig(null); setEditingCartKey(null); setConfigError(""); }

  function updatePizzaSize(sizeId: number) {
    if (!pizzaConfig || !catalog) return;
    const currentCrust = catalog.crusts.find((crust) => crust.id === pizzaConfig.crustId);
    const currentCrustAvailable = currentCrust ? crustPriceForSize(currentCrust, sizeId) != null : false;
    const nextCrustId = currentCrustAvailable ? pizzaConfig.crustId : catalog.crusts.find((crust) => crustPriceForSize(crust, sizeId) != null)?.id ?? null;
    setPizzaConfig({ ...pizzaConfig, sizeId, crustId: nextCrustId });
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
    const modifiersPrice = isTwoFlavorPizza(config.product)
      ? 0
      : catalog.modifiers.filter((item) => config.modifierIds.includes(item.id)).reduce((sum, item) => sum + item.basePrice, 0);
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
    const modifiers = twoFlavors
      ? []
      : catalog.modifiers.filter((modifier) => pizzaConfig.modifierIds.includes(modifier.id));

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

    const detail = [size.name, twoFlavors ? flavors.map((flavor) => `½ ${flavor.name}`).join(" + ") : flavors[0]?.name, `Borde ${crust.name}`, ...modifiers.map((modifier) => `+ ${modifier.name}`)].filter(Boolean).join(" · ");
    const unitPrice = pizzaPrice(pizzaConfig);

    const note = pizzaConfig.note.trim().slice(0, 120);
    setCart((current) => {
      if (!editingCartKey) return [...current, { key: `pizza-${Date.now()}-${Math.random()}`, productId: pizzaConfig.product.id, name: pizzaConfig.product.name, detail, unitPrice, quantity: 1, configuration, notes: note || undefined }];
      return current.map((item) => item.key === editingCartKey ? { ...item, productId: pizzaConfig.product.id, name: pizzaConfig.product.name, detail, unitPrice, configuration, notes: note || undefined } : item);
    });
    closePizzaConfig();
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
      return { ruleId: rule.id, size: { id: size.id, name: size.name, diameterCm: size.diameterCm, basePrice: size.basePrice }, flavor: { productId: flavor.id, name: flavor.name, portion: 1, basePrice: flavor.basePrice } };
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

    const configuration: ComboOrderConfiguration = { schemaVersion: 1, kind: "COMBO", comboProductId: comboConfig.product.id, comboName: comboConfig.product.name, comboDiscount: comboConfig.product.comboDiscount ?? 0, pizzas, groups };
    const detail = [...pizzas.map((pizza, index) => `Pizza ${index + 1}: ${pizza.size.name} ${pizza.flavor.name}`), ...groups.map((group) => `${group.name}: ${group.selections.map((selection) => `${selection.quantity > 1 ? `${selection.quantity}× ` : ""}${selection.name}`).join(", ")}`)].join(" · ");
    const unitPrice = comboPrice(comboConfig);

    setCart((current) => {
      if (!editingCartKey) return [...current, { key: `combo-${Date.now()}-${Math.random()}`, productId: comboConfig.product.id, name: comboConfig.product.name, detail, unitPrice, quantity: 1, configuration }];
      return current.map((item) => item.key === editingCartKey ? { ...item, productId: comboConfig.product.id, name: comboConfig.product.name, detail, unitPrice, configuration } : item);
    });
    closeComboConfig();
  }

  function changeQty(key: string, delta: number) {
    setCart((current) => current.map((item) => item.key === key ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));
  }

  return (
    <main className="min-h-screen p-3 sm:p-4 lg:p-5 xl:p-5">
      <div className="w-full space-y-4">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <header className="alento-dark max-w-[820px] rounded-[22px] px-6 py-4 md:px-7 md:py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">Operación Alentó</p>
                  <h1 className="text-2xl font-black md:text-[2rem] md:leading-9">Punto de venta</h1>
                  <p className="mt-1 text-xs text-white/60">Configura, cobra y envía cada pedido a operación.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 shadow-inner">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>
                  <div className="leading-tight">
                    <span className="block text-[8px] font-bold uppercase tracking-[0.12em] text-white/40">Sistema</span>
                    <b className="text-[11px] font-semibold text-white/85">POS activo</b>
                  </div>
                </div>
              </div>
            </header>

            {catalogLoading ? <div className="alento-card rounded-3xl p-8">Cargando catálogo...</div> : catalogError ? <div className="rounded-3xl bg-red-50 p-5 text-red-700">{catalogError}</div> : <>
              <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 gap-2 overflow-x-auto pb-0.5">
                  {catalog?.categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setActiveCategory(category.slug);
                        setProductQuery("");
                      }}
                      className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold transition ${selectedCategory?.slug === category.slug && !productQuery.trim() ? "bg-black text-white" : "border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400"}`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                <label className="group relative w-full shrink-0 xl:w-[290px]">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-neutral-400 transition group-focus-within:text-neutral-700">⌕</span>
                  <input
                    type="search"
                    value={productQuery}
                    onChange={(event) => setProductQuery(event.target.value)}
                    placeholder="Buscar producto..."
                    className="h-[42px] w-full rounded-full border border-neutral-300 bg-white pl-10 pr-10 text-sm font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:shadow-[0_0_0_3px_rgba(0,0,0,.04)]"
                    aria-label="Buscar productos"
                  />
                  {productQuery && (
                    <button
                      type="button"
                      onClick={() => setProductQuery("")}
                      className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-900"
                      aria-label="Limpiar búsqueda"
                      title="Limpiar búsqueda"
                    >
                      ×
                    </button>
                  )}
                </label>
              </div>

              {productQuery.trim() && (
                <div className="flex items-center justify-between gap-3 px-1">
                  <p className="text-[11px] font-medium text-neutral-500">
                    {visibleCatalogProducts.length} {visibleCatalogProducts.length === 1 ? "producto encontrado" : "productos encontrados"} para <b className="text-neutral-800">“{productQuery.trim()}”</b>
                  </p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {visibleCatalogProducts.map((product) => (
                  <article
                    key={product.id}
                    className="group relative overflow-hidden rounded-[22px] border-[5px] border-white bg-white shadow-[0_10px_26px_rgba(28,23,20,.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(28,23,20,.14)]"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-[17px_17px_0_0] bg-white">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-contain p-1.5 transition duration-300 group-hover:scale-[1.012]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[linear-gradient(145deg,#f7f6f3,#ece8e2)] text-5xl">🍕</div>
                      )}
                    </div>

                    <div className="bg-[linear-gradient(135deg,#111112,#1b1819)] p-3.5 text-white">
                      <h3 className="truncate text-[17px] font-medium leading-6 tracking-[-0.01em] text-white">
                        {product.name}
                      </h3>

                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/12 pt-3">
                        <span className="min-w-0 truncate text-[17px] font-semibold leading-6 tracking-[-0.015em] text-white">
                          {displayPrice(product)}
                        </span>

                        <button
                          type="button"
                          onClick={() => startAdd(product)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[19px] font-medium leading-none text-neutral-950 shadow-[0_6px_18px_rgba(0,0,0,.2)] transition hover:scale-[1.05] active:scale-95"
                          aria-label={`Agregar ${product.name}`}
                          title={`Agregar ${product.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {visibleCatalogProducts.length === 0 && productQuery.trim() && (
                <div className="rounded-[22px] border border-dashed border-neutral-300 bg-white/70 px-6 py-10 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 text-xl text-neutral-500">⌕</div>
                  <h3 className="mt-3 text-sm font-black text-neutral-900">No encontramos ese producto</h3>
                  <p className="mt-1 text-xs text-neutral-500">Prueba con otro nombre o limpia la búsqueda para volver al catálogo.</p>
                  <button
                    type="button"
                    onClick={() => setProductQuery("")}
                    className="mt-3 rounded-xl bg-black px-4 py-2 text-[11px] font-black text-white"
                  >
                    Ver catálogo
                  </button>
                </div>
              )}
            </>}
          </div>

          <aside className="alento-card rounded-[28px] p-4 xl:sticky xl:top-5 xl:flex xl:h-[calc(100vh-3.5rem)] xl:flex-col">
            <div className="mb-3 rounded-[22px] border border-neutral-200 bg-[#faf9f7] p-3.5">
              <div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">Preparar pedido</p><h2 className="mt-1 text-lg font-black">Tipo de pedido y cliente</h2></div><button onClick={openNewCustomer} className="rounded-full border border-[rgba(229,28,17,0.14)] bg-white px-3 py-1.5 text-[11px] font-black text-[var(--brand-red)]">+ Nuevo cliente</button></div>
              <div className="space-y-3">
                <div><p className="mb-1.5 text-[11px] font-black">1. Tipo</p><div className="grid grid-cols-3 gap-1 rounded-2xl border border-neutral-200 bg-white p-1">{fulfillmentOptions.map((option) => { const selected = fulfillmentType === option.type; return <button key={option.type} onClick={() => setFulfillmentType(option.type)} className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-2 text-center ${selected ? "border border-[var(--brand-red)] bg-red-50 shadow-[0_4px_14px_rgba(229,28,17,0.12)]" : "border border-transparent bg-transparent hover:bg-neutral-50"}`}><span className="text-[16px] leading-none">{option.icon}</span><b className="text-[12px] leading-4">{option.shortTitle}</b></button>; })}</div></div>
                <div><p className="mb-1.5 text-[11px] font-black">2. Cliente <span className={`ml-1 text-[10px] uppercase ${requiresCustomer ? "text-[var(--brand-red)]" : "text-neutral-400"}`}>{requiresCustomer ? "Obligatorio" : "Opcional"}</span></p>{selectedCustomer ? <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-[0_4px_14px_rgba(25,22,18,0.035)]"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><b className="block truncate text-sm">{selectedCustomer.name}</b><span className="text-xs text-neutral-500">{selectedCustomer.countryCode} {selectedCustomer.phone}</span>{fulfillmentType === "DELIVERY" && selectedAddress?.address && <span className="block truncate text-xs text-neutral-500">{selectedAddress.address}</span>}</div><div className="flex gap-1.5"><button onClick={() => openEditCustomer(selectedCustomer)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] font-bold">Editar</button><button onClick={() => { setSelectedCustomer(null); setQuery(""); }} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] font-bold">Cambiar</button></div></div>{fulfillmentType === "DELIVERY" && !hasDeliveryAddress && (
                  <button
                    type="button"
                    onClick={() => openEditCustomer(selectedCustomer)}
                    className="mt-2.5 flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-left transition hover:border-amber-300 hover:bg-amber-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-white text-[16px] shadow-sm">
                      📍
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-[12px] font-semibold leading-[17px] tracking-[-0.005em] text-amber-950">Sin dirección registrada</b>
                      <span className="block text-[11px] font-normal leading-[16px] text-amber-800/80">Necesaria para pedidos a domicilio.</span>
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-white text-[20px] font-normal leading-none text-amber-900 shadow-sm">
                      +
                    </span>
                  </button>
                )}</div> : <><div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchCustomers(); }} className="alento-input min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm" placeholder="Nombre, teléfono o correo"/><button onClick={() => void searchCustomers()} className="rounded-xl bg-black px-4 text-xs font-black text-white">{searching ? "..." : "Buscar"}</button></div>{(customers.length > 0 || searchMessage) && <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white">{customers.map((customer) => <button key={customer.id} onClick={() => chooseCustomer(customer)} className="flex w-full justify-between border-b bg-white px-3 py-2 text-left text-xs last:border-b-0"><b>{customer.name}</b><span>{customer.phone}</span></button>)}{searchMessage && <p className="bg-white px-3 py-2 text-xs text-neutral-500">{searchMessage}</p>}</div>}</>}</div>
              </div>
            </div>

            <div className="mb-3"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Pedido actual</p><h2 className="mt-1 text-2xl font-black">{cartCount ? `${cartCount} producto${cartCount === 1 ? "" : "s"}` : "Sin productos"}</h2>{selectedCustomer && <p className="text-sm text-neutral-500">Para {selectedCustomer.name}</p>}{fulfillmentType && <p className="mt-1 text-xs font-bold text-neutral-400">{fulfillmentOptions.find((option) => option.type === fulfillmentType)?.title}</p>}</div>

            {cart.length ? <div className="alento-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">{cart.map((item) => <PosCartLine key={item.key} item={item} editable={item.configuration.kind === "PIZZA" || item.configuration.kind === "COMBO"} onEdit={() => editCartItem(item)} onChangeQty={(delta) => changeQty(item.key, delta)} />)}</div> : <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed p-8 text-center text-sm text-neutral-400">Agrega productos al pedido.</div>}

            <div className="mt-3 border-t pt-3"><div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><b>{formatCOP(subtotal)}</b></div><div className="mt-3 flex items-end justify-between border-t border-dashed pt-3"><b>Total productos</b><b className="text-2xl text-[var(--brand-red)]">{formatCOP(subtotal)}</b></div><button onClick={() => setCheckoutOpen(true)} disabled={!canContinue} className="mt-3 w-full rounded-2xl bg-[var(--brand-red)] px-4 py-3 font-black text-white disabled:bg-neutral-200 disabled:text-neutral-400">Continuar pedido</button></div>
          </aside>
        </section>
      </div>

      <OrderCheckoutModal open={checkoutOpen} fulfillmentType={fulfillmentType} customer={selectedCustomer} cart={cart} subtotal={subtotal} onClose={() => setCheckoutOpen(false)} />

      {showCustomerModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4">
          <div className="alento-card flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px]">
            <div className="flex items-start justify-between border-b px-6 py-5">
              <div>
                <p className="alento-ui-label uppercase text-neutral-400">Cliente</p>
                <h2 className="alento-ui-title mt-1">
                  {editingCustomer ? "Editar cliente" : "Nuevo cliente"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="rounded-xl bg-neutral-100 px-3 py-2 text-sm font-semibold"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={saveCustomer} className="flex min-h-0 flex-1 flex-col">
              <div className="alento-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="alento-input w-full rounded-2xl px-4 py-3"
                  placeholder="Nombre *"
                />

                <div className="grid grid-cols-[100px_1fr] gap-3">
                  <select
                    value={countryCode}
                    onChange={(event) => setCountryCode(event.target.value)}
                    className="alento-input rounded-2xl px-3"
                  >
                    <option>+57</option>
                    <option>+1</option>
                  </select>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="alento-input rounded-2xl px-4 py-3"
                    placeholder="Teléfono *"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="alento-input w-full rounded-2xl px-4 py-3"
                    placeholder="Correo (opcional)"
                  />
                  <input
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="alento-input w-full rounded-2xl px-4 py-3"
                    placeholder="Nota del cliente (opcional)"
                  />
                </div>

                <section className="rounded-[20px] border border-neutral-200 bg-[#faf9f7] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="alento-ui-label uppercase text-neutral-400">Direcciones</p>
                      <h3 className="mt-1 text-[16px] font-bold text-neutral-900">
                        {editingCustomer
                          ? `${editingCustomer.addresses.length} guardada${editingCustomer.addresses.length === 1 ? "" : "s"}`
                          : "Primera dirección"}
                      </h3>
                    </div>

                    {editingCustomer && !addressEditor && (
                      <button
                        type="button"
                        onClick={() => openAddressEditor()}
                        className="rounded-xl bg-black px-3 py-2 text-[11px] font-bold text-white"
                      >
                        + Agregar
                      </button>
                    )}
                  </div>

                  {editingCustomer && !addressEditor && (
                    <div className="mt-3 space-y-2">
                      {editingCustomer.addresses.length ? (
                        editingCustomer.addresses.map((item) => (
                          <div
                            key={item.id}
                            className={
                              "rounded-2xl border p-3 " +
                              (item.isDefault
                                ? "border-emerald-200 bg-emerald-50/60"
                                : "border-neutral-200 bg-white")
                            }
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <b className="text-[13px] font-bold text-neutral-900">
                                    {item.label || "Dirección"}
                                  </b>
                                  {item.isDefault && (
                                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">
                                      Principal
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-[12px] leading-5 text-neutral-700">
                                  {item.address}
                                </p>
                                {(item.neighborhood || item.city) && (
                                  <p className="mt-0.5 text-[10px] text-neutral-400">
                                    {[item.neighborhood, item.city].filter(Boolean).join(" · ")}
                                  </p>
                                )}
                              </div>

                              <div className="flex shrink-0 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openAddressEditor(item)}
                                  className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[10px] font-bold text-neutral-600"
                                >
                                  Editar
                                </button>
                                {!item.isDefault && (
                                  <button
                                    type="button"
                                    disabled={addressBusy}
                                    onClick={() => void makeDefaultAddress(item)}
                                    className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[10px] font-bold text-neutral-600"
                                  >
                                    Principal
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={addressBusy}
                                  onClick={() => void deleteAddress(item)}
                                  className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-[10px] font-bold text-red-600"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <button
                          type="button"
                          onClick={() => openAddressEditor()}
                          className="mt-2 w-full rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4 text-left"
                        >
                          <b className="block text-[13px] text-amber-900">
                            Sin dirección registrada
                          </b>
                          <span className="mt-1 block text-[11px] text-amber-700">
                            Agrega una para pedidos a domicilio.
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {(!editingCustomer || addressEditor) && addressEditor && (
                    <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          value={addressEditor.label}
                          onChange={(event) =>
                            setAddressEditor({ ...addressEditor, label: event.target.value })
                          }
                          className="alento-input rounded-xl px-3 py-2.5"
                          placeholder="Etiqueta: Casa, Trabajo..."
                        />
                        <input
                          value={addressEditor.neighborhood}
                          onChange={(event) =>
                            setAddressEditor({ ...addressEditor, neighborhood: event.target.value })
                          }
                          className="alento-input rounded-xl px-3 py-2.5"
                          placeholder="Barrio (opcional)"
                        />
                      </div>
                      <input
                        value={addressEditor.address}
                        onChange={(event) =>
                          setAddressEditor({ ...addressEditor, address: event.target.value })
                        }
                        className="alento-input mt-2 w-full rounded-xl px-3 py-2.5"
                        placeholder={
                          fulfillmentType === "DELIVERY"
                            ? "Dirección *"
                            : "Dirección"
                        }
                      />
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input
                          value={addressEditor.city}
                          onChange={(event) =>
                            setAddressEditor({ ...addressEditor, city: event.target.value })
                          }
                          className="alento-input rounded-xl px-3 py-2.5"
                          placeholder="Ciudad"
                        />
                        <input
                          value={addressEditor.notes}
                          onChange={(event) =>
                            setAddressEditor({ ...addressEditor, notes: event.target.value })
                          }
                          className="alento-input rounded-xl px-3 py-2.5"
                          placeholder="Indicaciones (opcional)"
                        />
                      </div>

                      {editingCustomer && (
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setAddressEditor(null)}
                            className="rounded-xl border px-3 py-2 text-[11px] font-semibold"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={addressBusy}
                            onClick={() => void saveAddress()}
                            className="rounded-xl bg-black px-4 py-2 text-[11px] font-bold text-white disabled:opacity-50"
                          >
                            {addressBusy ? "Guardando..." : "Guardar dirección"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {customerError && (
                  <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {customerError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t bg-white p-4">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="rounded-2xl border px-5 py-3 text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  disabled={savingCustomer}
                  className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {savingCustomer
                    ? "Guardando..."
                    : editingCustomer
                      ? "Guardar cliente"
                      : "Crear cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pizzaConfig && catalog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"><div className="alento-card flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[26px]"><div className="flex items-center justify-between border-b px-5 py-4"><div><p className="text-[10px] font-black uppercase text-neutral-400">{editingCartKey ? "Editar pizza" : "Configurar pizza"}</p><h2 className="text-2xl font-black">{pizzaConfig.product.name}</h2></div><button onClick={closePizzaConfig} className="rounded-full bg-neutral-100 px-3 py-2 text-sm">Cerrar</button></div><div className="alento-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-5"><section className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3.5"><div className="mb-2 flex items-center justify-between"><h3 className="font-black">Tamaño</h3><span className="text-[11px] text-neutral-400">Define precio base y borde</span></div><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{catalog.sizes.map((size) => <button key={size.id} onClick={() => updatePizzaSize(size.id)} className={`rounded-xl border p-3 text-left ${pizzaConfig.sizeId === size.id ? "bg-black text-white" : "bg-white"}`}><b>{size.name}</b><span className="block text-xs opacity-70">{size.diameterCm} cm</span></button>)}</div></section>{isTwoFlavorPizza(pizzaConfig.product) && <><section className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3.5"><h3 className="mb-2 font-black">Sabor 1</h3><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{catalog.pizzaFlavors.map((flavor) => <button key={flavor.id} onClick={() => setPizzaConfig({ ...pizzaConfig, firstFlavorId: flavor.id, secondFlavorId: pizzaConfig.secondFlavorId === flavor.id ? null : pizzaConfig.secondFlavorId })} className={`rounded-xl border p-3 text-left ${pizzaConfig.firstFlavorId === flavor.id ? "bg-black text-white" : "bg-white"}`}>{flavor.name}</button>)}</div></section><section className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3.5"><h3 className="mb-2 font-black">Sabor 2</h3><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{catalog.pizzaFlavors.map((flavor) => <button key={flavor.id} disabled={pizzaConfig.firstFlavorId === flavor.id} onClick={() => setPizzaConfig({ ...pizzaConfig, secondFlavorId: flavor.id })} className={`rounded-xl border p-3 text-left ${pizzaConfig.secondFlavorId === flavor.id ? "bg-black text-white" : pizzaConfig.firstFlavorId === flavor.id ? "bg-neutral-100 text-neutral-300" : "bg-white"}`}>{flavor.name}</button>)}</div></section></>}<section className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3.5"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="font-black">Borde</h3><span className="text-[11px] font-semibold text-neutral-400">Precio para {catalog.sizes.find((size) => size.id === pizzaConfig.sizeId)?.name ?? "tamaño seleccionado"}</span></div><div className="grid grid-cols-2 gap-2 md:grid-cols-3">{catalog.crusts.map((crust) => { const price = crustPriceForSize(crust, pizzaConfig.sizeId); const selected = pizzaConfig.crustId === crust.id; const unavailable = price == null; return <button key={crust.id} disabled={unavailable} onClick={() => setPizzaConfig({ ...pizzaConfig, crustId: crust.id })} className={`flex min-h-[58px] items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left ${selected ? "border-black bg-black text-white" : unavailable ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-300" : "border-neutral-300 bg-white hover:border-neutral-500"}`}><div className="min-w-0"><b className="block truncate text-sm">{crust.name}</b><span className={`mt-0.5 block text-xs ${selected ? "text-white/65" : unavailable ? "text-neutral-300" : "text-neutral-500"}`}>{unavailable ? "No disponible" : price === 0 ? "Incluido" : `+ ${formatCOP(price)}`}</span></div><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-black ${selected ? "border-white/30 bg-white text-black" : "border-neutral-300 text-neutral-400"}`}>{selected ? "✓" : ""}</span></button>; })}</div></section>{!isTwoFlavorPizza(pizzaConfig.product) && (<section className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3.5"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="font-black">Ingredientes extra</h3><span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-500">{pizzaConfig.modifierIds.length ? `${pizzaConfig.modifierIds.length} seleccionado${pizzaConfig.modifierIds.length === 1 ? "" : "s"}` : "Opcional"}</span></div><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{catalog.modifiers.map((modifier) => { const selected = pizzaConfig.modifierIds.includes(modifier.id); return <button key={modifier.id} onClick={() => setPizzaConfig({ ...pizzaConfig, modifierIds: selected ? pizzaConfig.modifierIds.filter((id) => id !== modifier.id) : [...pizzaConfig.modifierIds, modifier.id] })} className={`flex min-h-[58px] items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left ${selected ? "border-[var(--brand-red)] bg-red-50 shadow-[0_4px_12px_rgba(229,28,17,0.08)]" : "border-neutral-300 bg-white hover:border-neutral-500"}`}><div className="min-w-0"><b className="block truncate text-[13px]">{modifier.name}</b><span className={`mt-0.5 block text-[11px] ${selected ? "font-semibold text-[var(--brand-red)]" : "text-neutral-500"}`}>+ {formatCOP(modifier.basePrice)}</span></div><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black ${selected ? "bg-[var(--brand-red)] text-white" : "border border-neutral-300 text-neutral-400"}`}>{selected ? "✓" : "+"}</span></button>; })}</div></section>)}<section className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3.5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black">Nota para cocina</h3><p className="mt-0.5 text-[11px] text-neutral-400">Opcional · instrucción corta para esta pizza</p></div><span className="text-[10px] font-semibold text-neutral-400">{pizzaConfig.note.length}/120</span></div><input value={pizzaConfig.note} maxLength={120} onChange={(event) => setPizzaConfig({ ...pizzaConfig, note: event.target.value })} className="alento-input mt-2 w-full rounded-xl bg-white px-3.5 py-3 text-sm" placeholder="Ej. Ligera en salsa" /></section>{configError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{configError}</p>}</div><div className="flex items-center justify-between border-t p-4"><b className="text-2xl text-[var(--brand-red)]">{formatCOP(pizzaPrice(pizzaConfig))}</b><button onClick={confirmPizza} className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 font-black text-white">{editingCartKey ? "Guardar cambios" : "Agregar al pedido"}</button></div></div></div>}

      {comboConfig && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"><div className="alento-card flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[26px]"><div className="flex items-center justify-between border-b px-5 py-4"><div><p className="text-[10px] font-black uppercase text-neutral-400">{editingCartKey ? "Editar combo" : "Configurar combo"}</p><h2 className="text-2xl font-black">{comboConfig.product.name}</h2></div><button onClick={closeComboConfig} className="rounded-full bg-neutral-100 px-3 py-2 text-sm">Cerrar</button></div><div className="alento-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{comboConfig.pizzas.map((choice, index) => { const rule = comboConfig.product.comboPizzaRules?.find((item) => item.id === choice.ruleId); if (!rule) return null; return <section key={`${choice.ruleId}-${index}`} className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-black">Pizza {index + 1}</h3><span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-500">Incluida en el combo</span></div><p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-400">Tamaño</p><div className="flex flex-wrap gap-2">{rule.sizes.map((size) => <button key={size.id} onClick={() => { const pizzas = [...comboConfig.pizzas]; pizzas[index] = { ...pizzas[index], sizeId: size.id }; setComboConfig({ ...comboConfig, pizzas }); }} className={`rounded-xl border px-4 py-2 text-sm ${choice.sizeId === size.id ? "bg-black text-white" : "bg-white"}`}>{size.name}</button>)}</div><p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-400">Sabor</p><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{rule.flavors.map((flavor) => <button key={flavor.id} onClick={() => { const pizzas = [...comboConfig.pizzas]; pizzas[index] = { ...pizzas[index], flavorId: flavor.id }; setComboConfig({ ...comboConfig, pizzas }); }} className={`rounded-xl border p-3 text-left text-sm ${choice.flavorId === flavor.id ? "bg-black text-white" : "bg-white"}`}>{flavor.name}</button>)}</div></section>; })}{comboConfig.product.comboGroups?.map((group) => { const selectedIds = comboConfig.groupSelections[group.id] ?? []; const choiceText = group.minSelections === group.maxSelections ? `Elige ${group.minSelections}` : `Elige ${group.minSelections} a ${group.maxSelections}`; return <section key={group.id} className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-4"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="font-black">{group.name}</h3><span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-500">{selectedIds.length}/{group.maxSelections} · {choiceText}</span></div><div className="grid grid-cols-2 gap-2 md:grid-cols-3">{group.options.map((option) => { const selected = selectedIds.includes(option.productId); return <button key={option.id} onClick={() => toggleComboOption(group, option.productId)} className={`flex min-h-[52px] items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left ${selected ? "border-black bg-black text-white" : "border-neutral-300 bg-white hover:border-neutral-500"}`}><div><b className="text-[13px]">{option.productName}</b>{option.quantity > 1 && <span className={`block text-[11px] ${selected ? "text-white/65" : "text-neutral-400"}`}>Incluye {option.quantity}</span>}</div><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${selected ? "bg-white text-black" : "border border-neutral-300 text-neutral-400"}`}>{selected ? "✓" : ""}</span></button>; })}</div></section>; })}{configError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{configError}</p>}</div><div className="flex items-center justify-between border-t p-4"><div><b className="block text-2xl text-[var(--brand-red)]">{formatCOP(comboPrice(comboConfig))}</b>{(comboConfig.product.comboDiscount ?? 0) > 0 && <span className="text-xs font-bold text-emerald-600">Ahorra {formatCOP(comboConfig.product.comboDiscount ?? 0)}</span>}</div><button onClick={confirmCombo} className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 font-black text-white">{editingCartKey ? "Guardar cambios" : "Agregar combo"}</button></div></div></div>}
    </main>
  );
}
