"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bike,
  MapPin,
  Pencil,
  Search,
  ShoppingBag,
  ShoppingCart,
  Store,
  UserRound,
} from "lucide-react";
import OrderCheckoutModal from "@/components/OrderCheckoutModal";
import PosCartLine from "@/components/PosCartLine";
import type { ComboOrderConfiguration, OrderLineConfiguration, PizzaOrderConfiguration, StandardOrderConfiguration } from "@/lib/orderConfiguration";
import { emitLiveDataChange } from "@/lib/liveDataEvents";
import GoogleCustomerAddressPicker from "@/components/GoogleCustomerAddressPicker";

type CustomerAddress = { id: number; label: string | null; address: string; formattedAddress?: string | null; placeId?: string | null; latitude?: number | null; longitude?: number | null; neighborhood: string | null; city: string | null; notes: string | null; isDefault: boolean };
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
type DeliveryQuote = {
  covered: boolean;
  distanceMeters: number;
  durationSeconds?: number | null;
  deliveryFee: number | null;
};
type PizzaConfig = { product: CatalogProduct; sizeId: number | null; firstFlavorId: number | null; secondFlavorId: number | null; crustId: number | null; modifierIds: number[]; note: string };
type ComboPizzaChoice = { ruleId: number; sizeId: number | null; flavorId: number | null };
type ComboConfig = { product: CatalogProduct; pizzas: ComboPizzaChoice[]; groupSelections: Record<number, number[]> };

const fulfillmentOptions = [
  { type: "DELIVERY" as const, icon: Bike, title: "Domicilio", shortTitle: "Domicilio" },
  { type: "PICKUP" as const, icon: ShoppingBag, title: "Recoger en tienda", shortTitle: "Recoger" },
  { type: "STORE" as const, icon: Store, title: "Local", shortTitle: "Local" },
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

export default function StructuredPosPageV2({
  initialCustomerId = null,
}: {
  initialCustomerId?: number | null;
}) {
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
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [deliveryQuoteLoading, setDeliveryQuoteLoading] = useState(false);
  const [deliveryQuoteError, setDeliveryQuoteError] = useState("");
  const [deliveryFeeOverrideInput, setDeliveryFeeOverrideInput] = useState<string | null>(null);

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
    formattedAddress: string;
    placeId: string;
    latitude: number | null;
    longitude: number | null;
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

  useEffect(() => {
    if (!initialCustomerId) return;

    let cancelled = false;

    async function loadInitialCustomer() {
      try {
        const response = await fetch(
          `/api/customers/${initialCustomerId}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data.error || "No fue posible cargar el cliente de Chatwoot.",
          );
        }
        if (cancelled) return;

        const customer = data.customer as Customer;
        setSelectedCustomer(customer);
        setQuery(customer.phone || customer.name);
        setCustomers([]);
        setSearchMessage("");
      } catch (error) {
        if (!cancelled) {
          setSearchMessage(
            error instanceof Error
              ? error.message
              : "No fue posible cargar el cliente de Chatwoot.",
          );
        }
      }
    }

    void loadInitialCustomer();

    return () => {
      cancelled = true;
    };
  }, [initialCustomerId]);

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

  useEffect(() => {
    if (fulfillmentType !== "DELIVERY") {
      setDeliveryQuote(null);
      setDeliveryQuoteError("");
      setDeliveryQuoteLoading(false);
      return;
    }

    const latitude = Number(selectedAddress?.latitude);
    const longitude = Number(selectedAddress?.longitude);

    if (
      !selectedAddress ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      setDeliveryQuote(null);
      setDeliveryQuoteError(
        selectedCustomer
          ? "Valida la dirección del cliente con Google Maps para calcular el domicilio."
          : "",
      );
      setDeliveryQuoteLoading(false);
      return;
    }

    let cancelled = false;
    setDeliveryQuoteLoading(true);
    setDeliveryQuoteError("");

    void fetch("/api/delivery/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude,
        longitude,
        formattedAddress:
          selectedAddress.formattedAddress || selectedAddress.address,
        placeId: selectedAddress.placeId || "",
      }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data.error || "No fue posible calcular el domicilio.",
          );
        }
        if (!data.covered || data.deliveryFee == null) {
          throw new Error("La dirección está fuera de cobertura.");
        }
        if (!cancelled) setDeliveryQuote(data as DeliveryQuote);
      })
      .catch((quoteError) => {
        if (cancelled) return;
        setDeliveryQuote(null);
        setDeliveryQuoteError(
          quoteError instanceof Error
            ? quoteError.message
            : "No fue posible calcular el domicilio.",
        );
      })
      .finally(() => {
        if (!cancelled) setDeliveryQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    fulfillmentType,
    selectedAddress?.address,
    selectedAddress?.formattedAddress,
    selectedAddress?.id,
    selectedAddress?.latitude,
    selectedAddress?.longitude,
    selectedAddress?.placeId,
    selectedCustomer,
  ]);

  useEffect(() => {
    setDeliveryFeeOverrideInput(null);
  }, [fulfillmentType, selectedAddress?.id, deliveryQuote?.deliveryFee]);

  const automaticDeliveryFee =
    fulfillmentType === "DELIVERY"
      ? Number(deliveryQuote?.deliveryFee ?? 0)
      : 0;
  const deliveryFeeOverride =
    fulfillmentType === "DELIVERY" && deliveryFeeOverrideInput !== null
      ? Math.max(0, Math.floor(Number(deliveryFeeOverrideInput || 0)))
      : null;
  const deliveryFee =
    fulfillmentType === "DELIVERY"
      ? deliveryFeeOverride ?? automaticDeliveryFee
      : 0;
  const orderTotal = subtotal + deliveryFee;
  const validDeliveryQuote =
    fulfillmentType !== "DELIVERY" ||
    Boolean(
      deliveryQuote?.covered &&
        deliveryQuote.deliveryFee != null &&
        !deliveryQuoteError &&
        !deliveryQuoteLoading,
    );
  const canContinue = Boolean(
    cart.length &&
      fulfillmentType &&
      (!requiresCustomer || selectedCustomer) &&
      (fulfillmentType !== "DELIVERY" || hasDeliveryAddress) &&
      validDeliveryQuote,
  );

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
      formattedAddress: "",
      placeId: "",
      latitude: null,
      longitude: null,
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

    const savedAddress = customer.addresses?.[0] ?? null;
    setAddressEditor(
      savedAddress
        ? {
            id: savedAddress.id,
            label: savedAddress.label ?? "Casa",
            address: savedAddress.address,
            neighborhood: savedAddress.neighborhood ?? "",
            city: savedAddress.city ?? "Bogotá",
            notes: savedAddress.notes ?? "",
            isDefault: true,
            formattedAddress:
              savedAddress.formattedAddress ?? savedAddress.address,
            placeId: savedAddress.placeId ?? "",
            latitude: savedAddress.latitude ?? null,
            longitude: savedAddress.longitude ?? null,
          }
        : {
            id: null,
            label: "Casa",
            address: "",
            neighborhood: "",
            city: "Bogotá",
            notes: "",
            isDefault: true,
            formattedAddress: "",
            placeId: "",
            latitude: null,
            longitude: null,
          },
    );

    setShowCustomerModal(true);
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !phone.trim()) {
      return setCustomerError("Nombre y teléfono son obligatorios.");
    }

    if (
      fulfillmentType === "DELIVERY" &&
      (!addressEditor?.formattedAddress.trim() ||
        !addressEditor.placeId.trim() ||
        addressEditor.latitude == null ||
        addressEditor.longitude == null)
    ) {
      return setCustomerError(
        "Valida la dirección del cliente con Google Maps antes de continuar.",
      );
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
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible guardar el cliente.");
      }

      let savedCustomer = data.customer as Customer;

      if (
        addressEditor?.formattedAddress.trim() &&
        addressEditor.placeId.trim() &&
        addressEditor.latitude != null &&
        addressEditor.longitude != null
      ) {
        const addressResponse = await fetch(
          `/api/customers/${savedCustomer.id}/addresses`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...addressEditor,
              address: addressEditor.formattedAddress,
              isDefault: true,
            }),
          },
        );
        const addressData = await addressResponse.json();

        if (!addressResponse.ok) {
          throw new Error(
            addressData.error || "No fue posible guardar la dirección.",
          );
        }

        if (addressData.customer) {
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
    <main className="min-h-screen w-full p-3 md:p-5 xl:p-6">
      <div className="w-full space-y-5">
        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 space-y-5">
            <header className="relative min-h-[150px] w-full overflow-hidden rounded-[26px] border border-black/5 bg-[#0a0a0b] text-white shadow-[0_18px_45px_rgba(20,16,14,.12)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_77%_42%,rgba(226,26,34,.48),transparent_24%),radial-gradient(circle_at_62%_110%,rgba(120,10,14,.34),transparent_34%),linear-gradient(105deg,#111319_0%,#101116_42%,#1a0b0d_67%,#5a090c_100%)]" />
              <div className="absolute inset-y-0 right-0 w-[48%] opacity-60 [background:repeating-linear-gradient(120deg,transparent_0_46px,rgba(255,255,255,.025)_47px_48px)]" />
              <div className="absolute right-[7%] top-[-24px] h-32 w-32 rounded-full border border-red-300/10 bg-red-500/[0.04]" />

              <div className="relative flex min-h-[150px] items-center justify-between gap-5 px-6 py-5 md:px-8 xl:px-9">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="h-[3px] w-8 rounded-full bg-[var(--brand-red)]" />
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/58">
                        Operación Alentó
                      </p>
                    </div>
                    <h1 className="mt-2 text-[36px] font-black leading-none tracking-[-0.045em] md:text-[42px]">
                      Punto de venta
                    </h1>
                    <p className="mt-2 text-[13px] font-medium text-white/65 md:text-[14px]">
                      Configura, cobra y envía cada pedido a operación.
                    </p>
                  </div>
                </div>

                <div className="hidden items-center gap-2 rounded-[18px] border border-white/12 bg-white/[0.08] px-4 py-3 shadow-inner backdrop-blur-sm sm:inline-flex">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/45" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>
                  <div className="leading-tight">
                    <span className="block text-[8px] font-black uppercase tracking-[0.13em] text-white/42">Sistema</span>
                    <b className="text-[11px] font-bold text-white/88">POS activo</b>
                  </div>
                </div>
              </div>
            </header>

            {catalogLoading ? <div className="alento-card rounded-3xl p-8">Cargando catálogo...</div> : catalogError ? <div className="rounded-3xl bg-red-50 p-5 text-red-700">{catalogError}</div> : <>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 gap-2 overflow-x-auto pb-0.5">
                  {catalog?.categories.map((category) => {
                    const active = selectedCategory?.slug === category.slug && !productQuery.trim();
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setActiveCategory(category.slug);
                          setProductQuery("");
                        }}
                        className={`h-12 whitespace-nowrap rounded-[16px] border px-5 text-[13px] font-black transition-all ${
                          active
                            ? "border-red-500 bg-[linear-gradient(135deg,#ef1d26,#c90f16)] text-white shadow-[0_8px_18px_rgba(226,26,34,.22)]"
                            : "border-neutral-200 bg-white text-neutral-700 shadow-sm hover:border-neutral-300 hover:bg-neutral-50"
                        }`}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>

                <label className="group relative w-full shrink-0 xl:w-[320px]">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-neutral-400 transition group-focus-within:text-neutral-700" strokeWidth={2} />
                  <input
                    type="search"
                    value={productQuery}
                    onChange={(event) => setProductQuery(event.target.value)}
                    placeholder="Buscar producto..."
                    className="h-12 w-full rounded-[16px] border border-neutral-200 bg-white pl-11 pr-10 text-sm font-medium text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,.035)]"
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
                    className="group relative overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-[0_10px_28px_rgba(28,23,20,.075)] transition duration-200 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-[0_18px_38px_rgba(28,23,20,.13)]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(145deg,#fff,#f7f5f1)]">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.025]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[linear-gradient(145deg,#f7f6f3,#ece8e2)] text-5xl">🍕</div>
                      )}
                    </div>

                    <div className="bg-[linear-gradient(135deg,#111113,#1d191a)] p-4 text-white">
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
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-red)] text-[22px] font-medium leading-none text-white shadow-[0_8px_18px_rgba(226,26,34,.30)] transition hover:scale-[1.06] hover:brightness-110 active:scale-95"
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

          <aside className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_18px_42px_rgba(28,23,20,.09)] xl:sticky xl:top-5 xl:flex xl:h-[calc(100vh-3.5rem)] xl:flex-col">
            <div className="relative shrink-0 overflow-hidden border-b border-white/10 bg-[#0b0b0c] px-5 py-4 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(226,26,34,.42),transparent_34%),linear-gradient(135deg,#101114,#221215_70%,#650b0f)]" />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.08]">
                    <ShoppingCart className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/45">Punto de venta</p>
                    <h2 className="mt-0.5 text-[20px] font-black tracking-[-0.025em]">Nuevo pedido</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openNewCustomer}
                  className="rounded-xl border border-white/12 bg-white/[0.08] px-3 py-2 text-[10px] font-black text-white/85 transition hover:bg-white/[0.13]"
                >
                  + Cliente
                </button>
              </div>
            </div>

            <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mb-3 rounded-[20px] border border-neutral-200 bg-[#faf9f7] p-3.5">
                <div className="space-y-3">
                <div><p className="mb-2 text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">Tipo de pedido</p><div className="grid grid-cols-3 gap-1.5 rounded-[16px] border border-neutral-200 bg-white p-1.5">{fulfillmentOptions.map((option) => { const selected = fulfillmentType === option.type; return <button key={option.type} onClick={() => setFulfillmentType(option.type)} className={`flex min-h-[52px] items-center justify-center gap-2 rounded-[12px] px-2 text-center transition ${selected ? "bg-[linear-gradient(135deg,#ef1d26,#c90f16)] text-white shadow-[0_6px_16px_rgba(226,26,34,.22)]" : "text-neutral-700 hover:bg-neutral-50"}`}><option.icon className="h-[17px] w-[17px]" strokeWidth={2.15} /><b className="text-[11px] leading-4">{option.shortTitle}</b></button>; })}</div></div>
                <div><p className="mb-1.5 text-[11px] font-black">2. Cliente <span className={`ml-1 text-[10px] uppercase ${requiresCustomer ? "text-[var(--brand-red)]" : "text-neutral-400"}`}>{requiresCustomer ? "Obligatorio" : "Opcional"}</span></p>{selectedCustomer ? <div className="rounded-[16px] border border-neutral-200 bg-white p-3 shadow-[0_4px_14px_rgba(25,22,18,0.035)]"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600"><UserRound className="h-5 w-5" strokeWidth={2} /></span><div className="min-w-0"><b className="block truncate text-sm">{selectedCustomer.name}</b><span className="text-xs text-neutral-500">{selectedCustomer.countryCode} {selectedCustomer.phone}</span>{fulfillmentType === "DELIVERY" && selectedAddress?.address && <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-neutral-500"><MapPin className="h-3 w-3 shrink-0" />{selectedAddress.address}</span>}</div></div><div className="flex gap-1.5"><button onClick={() => openEditCustomer(selectedCustomer)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600" title="Editar cliente"><Pencil className="h-4 w-4" /></button><button onClick={() => { setSelectedCustomer(null); setQuery(""); }} className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600" title="Cambiar cliente"><UserRound className="h-4 w-4" /></button></div></div>{fulfillmentType === "DELIVERY" && !hasDeliveryAddress && (
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

            <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-400">Productos</p><h2 className="mt-1 text-[22px] font-black tracking-[-0.025em]">{cartCount ? `${cartCount} producto${cartCount === 1 ? "" : "s"}` : "Sin productos"}</h2>{selectedCustomer && <p className="text-xs text-neutral-500">Para {selectedCustomer.name}</p>}</div>{fulfillmentType && <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase text-neutral-500">{fulfillmentOptions.find((option) => option.type === fulfillmentType)?.title}</span>}</div>

            {cart.length ? <div className="space-y-2">{cart.map((item) => <PosCartLine key={item.key} item={item} editable={item.configuration.kind === "PIZZA" || item.configuration.kind === "COMBO"} onEdit={() => editCartItem(item)} onChangeQty={(delta) => changeQty(item.key, delta)} />)}</div> : <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-400">Agrega productos al pedido.</div>}

            </div>

            <div className="shrink-0 border-t border-neutral-200 bg-white p-4">
              <div className="flex justify-between">
                <span className="text-neutral-500">Subtotal</span>
                <b>{formatCOP(subtotal)}</b>
              </div>

              {fulfillmentType === "DELIVERY" && (
                <div className="mt-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-500">Domicilio</span>
                    {deliveryQuoteLoading ? (
                      <b className="text-[var(--brand-red)]">Calculando...</b>
                    ) : deliveryQuote?.covered && deliveryQuote.deliveryFee != null ? (
                      <div className="flex items-center gap-2">
                        {deliveryFeeOverride !== null && (
                          <span className="text-[10px] font-bold text-neutral-400 line-through">
                            {formatCOP(automaticDeliveryFee)}
                          </span>
                        )}
                        <label className="flex h-9 items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 shadow-inner focus-within:border-[var(--brand-red)] focus-within:bg-white">
                          <Pencil className="h-3 w-3 text-neutral-400" strokeWidth={2.2} />
                          <span className="text-xs font-black text-neutral-500">$</span>
                          <input
                            value={deliveryFeeOverrideInput ?? String(automaticDeliveryFee)}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) => {
                              setDeliveryFeeOverrideInput(event.target.value.replace(/\D/g, "").slice(0, 9));
                            }}
                            inputMode="numeric"
                            aria-label="Valor de domicilio"
                            className="w-[72px] bg-transparent text-right text-sm font-black text-[var(--brand-red)] outline-none"
                          />
                        </label>
                      </div>
                    ) : (
                      <b className="text-[var(--brand-red)]">Pendiente</b>
                    )}
                  </div>

                  {deliveryQuote?.covered && deliveryQuote.deliveryFee != null && (
                    <div className="mt-1.5 flex items-center justify-end gap-2 text-[9px] font-semibold text-neutral-400">
                      <span>Tarifa calculada {formatCOP(automaticDeliveryFee)}</span>
                      {deliveryFeeOverride !== null && (
                        <button
                          type="button"
                          onClick={() => setDeliveryFeeOverrideInput(null)}
                          className="font-black text-[var(--brand-red)] hover:underline"
                        >
                          Restaurar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {fulfillmentType === "DELIVERY" && deliveryQuoteError && (
                <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-semibold leading-4 text-red-600">
                  {deliveryQuoteError}
                </p>
              )}

              <div className="mt-3 flex items-end justify-between border-t border-dashed pt-3">
                <b>Total</b>
                <b className="text-2xl text-[var(--brand-red)]">
                  {formatCOP(orderTotal)}
                </b>
              </div>

              <button
                onClick={() => setCheckoutOpen(true)}
                disabled={!canContinue}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#ef1d26,#d4131a)] px-4 text-sm font-black text-white shadow-[0_8px_20px_rgba(226,26,34,.22)] transition hover:brightness-105 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
              >
                <ShoppingCart className="h-[17px] w-[17px]" strokeWidth={2.2} />
                Continuar pedido
              </button>
            </div>
          </aside>
        </section>
      </div>

      <OrderCheckoutModal
        open={checkoutOpen}
        fulfillmentType={fulfillmentType}
        customer={selectedCustomer}
        cart={cart}
        subtotal={subtotal}
        deliveryFeeOverride={deliveryFeeOverride}
        onClose={() => setCheckoutOpen(false)}
      />

      {showCustomerModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4">
          <div className="alento-card flex max-h-[94dvh] w-[min(96vw,980px)] max-w-none flex-col overflow-hidden rounded-[30px] bg-white">
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
              <div className="alento-scroll min-h-0 flex-1 overflow-y-auto bg-[#f7f6f3] p-4 sm:p-5 lg:p-6">
                <div className="space-y-4">
                  <section className="rounded-[24px] border border-neutral-200 bg-white p-4 shadow-[0_10px_30px_rgba(20,18,16,.04)] sm:p-5">
                    <div className="mb-5 flex items-start gap-3 border-b border-neutral-100 pb-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-[12px] font-bold text-white">
                        01
                      </div>
                      <div>
                        <p className="alento-ui-label uppercase text-neutral-400">
                          Información personal
                        </p>
                        <h3 className="mt-1 text-[20px] font-bold tracking-[-0.025em] text-neutral-950">
                          Datos del cliente
                        </h3>
                        <p className="mt-1 text-[12px] leading-5 text-neutral-400">
                          Información básica para identificarlo y contactarlo.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-12">
                      <label className="block md:col-span-5">
                        <span className="mb-1.5 block text-[11px] font-bold text-neutral-600">
                          Nombre
                        </span>
                        <input
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          className="alento-input h-12 w-full rounded-2xl px-4"
                          placeholder="Nombre del cliente"
                        />
                      </label>

                      <div className="grid grid-cols-[110px_1fr] gap-3 md:col-span-7">
                        <label className="block">
                          <span className="mb-1.5 block text-[11px] font-bold text-neutral-600">
                            Indicativo
                          </span>
                          <select
                            value={countryCode}
                            onChange={(event) => setCountryCode(event.target.value)}
                            className="alento-input h-12 w-full rounded-2xl px-3"
                          >
                            <option>+57</option>
                            <option>+1</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-1.5 block text-[11px] font-bold text-neutral-600">
                            Teléfono
                          </span>
                          <input
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            className="alento-input h-12 w-full rounded-2xl px-4"
                            placeholder="Número de teléfono"
                          />
                        </label>
                      </div>

                      <label className="block md:col-span-6">
                        <span className="mb-1.5 block text-[11px] font-bold text-neutral-600">
                          Correo <span className="font-medium text-neutral-400">(opcional)</span>
                        </span>
                        <input
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          className="alento-input h-12 w-full rounded-2xl px-4"
                          placeholder="correo@ejemplo.com"
                        />
                      </label>

                      <label className="block md:col-span-6">
                        <span className="mb-1.5 block text-[11px] font-bold text-neutral-600">
                          Nota del cliente <span className="font-medium text-neutral-400">(opcional)</span>
                        </span>
                        <textarea
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          className="alento-input min-h-[48px] w-full resize-none rounded-2xl px-4 py-3 md:h-12 md:min-h-12"
                          placeholder="Información útil para futuras compras"
                        />
                      </label>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-neutral-200 bg-white p-4 shadow-[0_10px_30px_rgba(20,18,16,.04)] sm:p-5">
                    <div className="flex items-start gap-3 border-b border-neutral-100 pb-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-red)] text-[12px] font-bold text-white">
                        02
                      </div>
                      <div>
                        <p className="alento-ui-label uppercase text-neutral-400">
                          Dirección
                        </p>
                        <h3 className="mt-1 text-[20px] font-bold tracking-[-0.025em] text-neutral-950">
                          Dirección de entrega
                        </h3>
                        <p className="mt-1 text-[12px] leading-5 text-neutral-400">
                          Cada cliente conserva una sola dirección. Debe quedar validada con Google Maps.
                        </p>
                      </div>
                    </div>

                    {addressEditor && (
                      <div className="mt-4 rounded-[22px] border border-neutral-200 bg-[#faf9f7] p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <span className="text-[11px] font-bold text-neutral-600">
                              Estado
                            </span>
                            <div className="mt-1">
                              {addressEditor.placeId &&
                              addressEditor.latitude != null &&
                              addressEditor.longitude != null ? (
                                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">
                                  Validada con Google
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-700">
                                  Requiere actualización
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <GoogleCustomerAddressPicker
                            currentAddress={
                              addressEditor.placeId &&
                              addressEditor.latitude != null &&
                              addressEditor.longitude != null
                                ? addressEditor.formattedAddress ||
                                  addressEditor.address
                                : undefined
                            }
                            onSelect={(selection) =>
                              setAddressEditor((current) =>
                                current
                                  ? {
                                      ...current,
                                      address: selection.formattedAddress,
                                      formattedAddress:
                                        selection.formattedAddress,
                                      placeId: selection.placeId,
                                      latitude: selection.latitude,
                                      longitude: selection.longitude,
                                      neighborhood:
                                        selection.neighborhood ||
                                        current.neighborhood,
                                      city: selection.city || current.city,
                                      isDefault: true,
                                    }
                                  : current,
                              )
                            }
                          />
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="mb-1.5 block text-[11px] font-bold text-neutral-600">
                              Barrio
                            </span>
                            <input
                              value={addressEditor.neighborhood}
                              onChange={(event) =>
                                setAddressEditor({
                                  ...addressEditor,
                                  neighborhood: event.target.value,
                                })
                              }
                              className="alento-input h-11 w-full rounded-xl px-3"
                              placeholder="Opcional"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-[11px] font-bold text-neutral-600">
                              Indicaciones
                            </span>
                            <input
                              value={addressEditor.notes}
                              onChange={(event) =>
                                setAddressEditor({
                                  ...addressEditor,
                                  notes: event.target.value,
                                })
                              }
                              className="alento-input h-11 w-full rounded-xl px-3"
                              placeholder="Torre, apto, portería..."
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </section>
                </div>

                {customerError && (
                  <p className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                    {customerError}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t bg-white px-5 py-4 sm:px-6">
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
