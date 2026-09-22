"use client";

import { useMemo, useState } from "react";
import type {
  ComboOrderConfiguration,
  PizzaOrderConfiguration,
} from "@/lib/orderConfiguration";
import type { PublicCartItem } from "@/lib/publicCart";

type ProductType =
  | "STANDARD"
  | "PIZZA_SINGLE"
  | "PIZZA_TWO_FLAVORS"
  | "COMBO"
  | "MODIFIER"
  | "INTERNAL";

type Size = {
  id: number;
  name: string;
  diameterCm: number;
  basePrice: number;
};

type Crust = {
  id: number;
  name: string;
  prices: { sizeId: number; price: number }[];
};

type Modifier = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
};

type Product = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imageUrl2: string | null;
  type: ProductType;
  basePrice: number | null;
  featured: boolean;
  comboDiscount?: number;
  comboPizzaRules?: Array<{
    id: number;
    quantity: number;
    sizes: Size[];
    flavors: Array<{
      id: number;
      name: string;
      description?: string | null;
      basePrice: number;
      imageUrl: string | null;
    }>;
  }>;
  comboGroups?: Array<{
    id: number;
    kind: string;
    name: string;
    minSelections: number;
    maxSelections: number;
    options: Array<{
      id: number;
      productId: number;
      productName: string;
      productType: ProductType;
      basePrice: number;
      imageUrl: string | null;
      quantity: number;
      priceDelta: number;
    }>;
  }>;
};

type Catalog = {
  pizzaFlavors: Product[];
  sizes: Size[];
  crusts: Crust[];
  modifiers: Modifier[];
};

type ComboStep =
  | {
      kind: "combo-size";
      key: string;
      rule: NonNullable<Product["comboPizzaRules"]>[number];
      unit: number;
      title: string;
    }
  | {
      kind: "combo-flavor";
      key: string;
      rule: NonNullable<Product["comboPizzaRules"]>[number];
      unit: number;
      title: string;
    }
  | {
      kind: "combo-group";
      key: string;
      group: NonNullable<Product["comboGroups"]>[number];
      title: string;
    }
  | {
      kind: "combo-note";
      key: string;
      title: string;
    }
  | {
      kind: "combo-review";
      key: string;
      title: string;
    };

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function isTwoFlavorPizza(product: Product) {
  return (
    product.type === "PIZZA_TWO_FLAVORS" ||
    product.name.toLowerCase().includes("2 sabores")
  );
}

function crustPriceForSize(crust: Crust, sizeId: number | null) {
  if (!sizeId) return null;
  return crust.prices.find((price) => price.sizeId === sizeId)?.price ?? null;
}

function Progress({ current, total }: { current: number; total: number }) {
  const safeTotal = Math.max(1, total);
  const percent = Math.min(100, Math.max(0, ((current + 1) / safeTotal) * 100));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[9px] font-bold uppercase tracking-[0.12em]">
        <span className="text-white/40">
          Paso {Math.min(current + 1, safeTotal)} de {safeTotal}
        </span>
        <span className="text-[#ff454b]">{Math.round(percent)}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#e21a22] transition-all duration-300"
          style={{ width: String(percent) + "%" }}
        />
      </div>
    </div>
  );
}

function ChoiceButton({
  selected,
  disabled = false,
  title,
  detail,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        "rounded-[16px] border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-30 " +
        (selected
          ? "border-[#e21a22] bg-[#e21a22]/14 text-white shadow-[0_10px_24px_rgba(226,26,34,.12)]"
          : "border-white/10 bg-black/25 text-white/70 hover:border-white/20")
      }
    >
      <span className="block text-[13px] font-bold">{title}</span>
      {detail && (
        <span className="mt-1 block text-[10px] leading-4 text-white/40">
          {detail}
        </span>
      )}
    </button>
  );
}

export default function PublicProductConfigurator({
  product,
  catalog,
  onClose,
  onAdd,
}: {
  product: Product;
  catalog: Catalog;
  onClose: () => void;
  onAdd: (item: PublicCartItem) => void;
}) {
  const twoFlavors = isTwoFlavorPizza(product);
  const isCombo = product.type === "COMBO";

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const [sizeId, setSizeId] = useState<number | null>(null);
  const [firstFlavorId, setFirstFlavorId] = useState<number | null>(
    twoFlavors ? null : product.type === "PIZZA_SINGLE" ? product.id : null,
  );
  const [secondFlavorId, setSecondFlavorId] = useState<number | null>(null);
  const [crustId, setCrustId] = useState<number | null>(() => {
    const traditional = catalog.crusts.find((crust) =>
      crust.name
        .trim()
        .toLocaleLowerCase("es")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes("tradicional"),
    );

    return traditional?.id ?? null;
  });
  const [modifierIds, setModifierIds] = useState<number[]>([]);

  const [comboPizzaSelections, setComboPizzaSelections] = useState<
    Record<string, { sizeId: number | null; flavorId: number | null }>
  >(() => {
    const initial: Record<
      string,
      { sizeId: number | null; flavorId: number | null }
    > = {};

    for (const rule of product.comboPizzaRules ?? []) {
      for (let unit = 0; unit < rule.quantity; unit += 1) {
        const key = String(rule.id) + ":" + String(unit);
        initial[key] = {
          sizeId: rule.sizes.length === 1 ? rule.sizes[0].id : null,
          flavorId: rule.flavors.length === 1 ? rule.flavors[0].id : null,
        };
      }
    }

    return initial;
  });
  const [comboGroupSelections, setComboGroupSelections] = useState<
    Record<number, number[]>
  >(() => {
    const initial: Record<number, number[]> = {};

    for (const group of product.comboGroups ?? []) {
      if (
        group.options.length === 1 &&
        group.minSelections === 1 &&
        group.maxSelections === 1
      ) {
        initial[group.id] = [group.options[0].productId];
      }
    }

    return initial;
  });

  const pizzaSteps = twoFlavors
    ? [
        "Tamaño",
        "Primer sabor",
        "Segundo sabor",
        "El Mundo De Los Bordes®",
        "Nota para cocina",
      ]
    : [
        "Tamaño",
        "El Mundo De Los Bordes®",
        "Ingredientes extra",
        "Nota para cocina",
      ];

  const comboSteps = useMemo<ComboStep[]>(() => {
    if (!isCombo) return [];
    const steps: ComboStep[] = [];

    for (const rule of product.comboPizzaRules ?? []) {
      for (let unit = 0; unit < rule.quantity; unit += 1) {
        const selectionKey = String(rule.id) + ":" + String(unit);
        const suffix = rule.quantity > 1 ? " " + String(unit + 1) : "";

        if (rule.sizes.length > 1) {
          steps.push({
            kind: "combo-size",
            key: "size:" + selectionKey,
            rule,
            unit,
            title: "Tamaño pizza" + suffix,
          });
        }

        if (rule.flavors.length > 1) {
          steps.push({
            kind: "combo-flavor",
            key: "flavor:" + selectionKey,
            rule,
            unit,
            title: "Sabor pizza" + suffix,
          });
        }
      }
    }

    for (const group of product.comboGroups ?? []) {
      const automaticallySelected =
        group.options.length === 1 &&
        group.minSelections === 1 &&
        group.maxSelections === 1;

      if (!automaticallySelected) {
        steps.push({
          kind: "combo-group",
          key: "group:" + String(group.id),
          group,
          title: group.name,
        });
      }
    }

    const hasPizza = (product.comboPizzaRules ?? []).some(
      (rule) => rule.quantity > 0,
    );

    if (hasPizza) {
      steps.push({
        kind: "combo-note",
        key: "pizza-note",
        title: "Nota para cocina",
      });
    } else if (steps.length === 0) {
      steps.push({
        kind: "combo-review",
        key: "ready",
        title: "Combo listo",
      });
    }

    return steps;
  }, [isCombo, product.comboGroups, product.comboPizzaRules]);

  const totalSteps = isCombo ? comboSteps.length : pizzaSteps.length;
  const activeComboStep = isCombo ? comboSteps[step] : null;

  function showError(message: string) {
    setError(message);
  }

  function nextPizza() {
    setError("");

    if (step === 0 && !sizeId) {
      showError("Selecciona el tamaño antes de continuar.");
      return;
    }

    if (
      ((!twoFlavors && step === 1) || (twoFlavors && step === 3)) &&
      !crustId
    ) {
      showError("Selecciona el borde antes de continuar.");
      return;
    }

    if (twoFlavors) {
      if (step === 1 && !firstFlavorId) {
        showError("Selecciona el primer sabor antes de continuar.");
        return;
      }
      if (step === 2 && !secondFlavorId) {
        showError("Selecciona el segundo sabor antes de continuar.");
        return;
      }
      if (step === 2 && secondFlavorId === firstFlavorId) {
        showError("El segundo sabor debe ser diferente al primero.");
        return;
      }
    }

    if (step < totalSteps - 1) {
      setStep((current) => current + 1);
    }
  }

  function comboSelectionKey(
    rule: NonNullable<Product["comboPizzaRules"]>[number],
    unit: number,
  ) {
    return String(rule.id) + ":" + String(unit);
  }

  function validateComboStep(current: ComboStep | null) {
    if (!current) return true;

    if (current.kind === "combo-size") {
      const key = comboSelectionKey(current.rule, current.unit);
      if (!comboPizzaSelections[key]?.sizeId) {
        showError("Selecciona el tamaño de la pizza antes de continuar.");
        return false;
      }
    }

    if (current.kind === "combo-flavor") {
      const key = comboSelectionKey(current.rule, current.unit);
      if (!comboPizzaSelections[key]?.flavorId) {
        showError("Selecciona el sabor de la pizza antes de continuar.");
        return false;
      }
    }

    if (current.kind === "combo-group") {
      const selected = comboGroupSelections[current.group.id] ?? [];
      if (selected.length < current.group.minSelections) {
        const missing = current.group.minSelections - selected.length;
        showError(
          missing === 1
            ? "Selecciona 1 opción más de " + current.group.name + "."
            : "Selecciona " + String(missing) + " opciones más de " + current.group.name + ".",
        );
        return false;
      }
    }

    return true;
  }

  function nextCombo() {
    setError("");
    if (!validateComboStep(activeComboStep)) return;
    if (step < totalSteps - 1) setStep((current) => current + 1);
  }

  function back() {
    setError("");
    setStep((current) => Math.max(0, current - 1));
  }

  function toggleModifier(modifierId: number) {
    setModifierIds((current) =>
      current.includes(modifierId)
        ? current.filter((id) => id !== modifierId)
        : [...current, modifierId],
    );
  }

  function toggleComboGroupOption(
    group: NonNullable<Product["comboGroups"]>[number],
    productId: number,
  ) {
    setError("");
    setComboGroupSelections((current) => {
      const selected = current[group.id] ?? [];

      if (selected.includes(productId)) {
        return {
          ...current,
          [group.id]: selected.filter((id) => id !== productId),
        };
      }

      if (group.maxSelections <= 1) {
        return { ...current, [group.id]: [productId] };
      }

      if (selected.length >= group.maxSelections) {
        setError(
          "Puedes seleccionar máximo " +
            String(group.maxSelections) +
            " opciones en " +
            group.name +
            ".",
        );
        return current;
      }

      return { ...current, [group.id]: [...selected, productId] };
    });
  }

  const pizzaPrice = useMemo(() => {
    if (isCombo || !sizeId) return 0;
    const size = catalog.sizes.find((item) => item.id === sizeId);
    if (!size) return 0;

    const flavorPrices = twoFlavors
      ? [firstFlavorId, secondFlavorId].map(
          (id) =>
            catalog.pizzaFlavors.find((flavor) => flavor.id === id)?.basePrice ??
            0,
        )
      : [product.basePrice ?? 0];

    const crust = catalog.crusts.find((item) => item.id === crustId);
    const crustPrice =
      crust?.prices.find((price) => price.sizeId === size.id)?.price ?? 0;

    const extrasPrice = twoFlavors
      ? 0
      : catalog.modifiers
          .filter((modifier) => modifierIds.includes(modifier.id))
          .reduce((sum, modifier) => sum + modifier.basePrice, 0);

    return (
      size.basePrice +
      Math.max(0, ...flavorPrices) +
      crustPrice +
      extrasPrice
    );
  }, [
    catalog,
    crustId,
    firstFlavorId,
    isCombo,
    modifierIds,
    product.basePrice,
    secondFlavorId,
    sizeId,
    twoFlavors,
  ]);

  const comboPrice = useMemo(() => {
    if (!isCombo) return 0;
    let regular = 0;

    for (const rule of product.comboPizzaRules ?? []) {
      const flavorBase = rule.flavors.length
        ? Math.min(...rule.flavors.map((flavor) => flavor.basePrice))
        : 0;

      for (let unit = 0; unit < rule.quantity; unit += 1) {
        const selection =
          comboPizzaSelections[comboSelectionKey(rule, unit)] ?? null;
        const selectedSize = rule.sizes.find(
          (item) => item.id === selection?.sizeId,
        );
        const sizeBase =
          selectedSize?.basePrice ??
          (rule.sizes.length
            ? Math.min(...rule.sizes.map((item) => item.basePrice))
            : 0);

        regular += sizeBase + flavorBase;
      }
    }

    for (const group of product.comboGroups ?? []) {
      const requiredCount = Math.max(0, group.minSelections);
      const baseOptions = [...group.options]
        .map(
          (option) =>
            (option.basePrice + option.priceDelta) *
            Math.max(1, option.quantity),
        )
        .sort((a, b) => a - b)
        .slice(0, requiredCount);

      regular += baseOptions.reduce((sum, value) => sum + value, 0);
    }

    return Math.max(0, regular - Number(product.comboDiscount ?? 0));
  }, [
    comboPizzaSelections,
    isCombo,
    product.comboDiscount,
    product.comboGroups,
    product.comboPizzaRules,
  ]);

  const comboHasAllSizes = useMemo(
    () =>
      (product.comboPizzaRules ?? []).every((rule) =>
        Array.from({ length: rule.quantity }).every((_, unit) =>
          Boolean(
            comboPizzaSelections[comboSelectionKey(rule, unit)]?.sizeId,
          ),
        ),
      ),
    [comboPizzaSelections, product.comboPizzaRules],
  );

  function addPizzaToCart() {
    setError("");

    if (!sizeId) {
      setStep(0);
      showError("Selecciona el tamaño.");
      return;
    }

    if (twoFlavors && !firstFlavorId) {
      setStep(1);
      showError("Selecciona el primer sabor.");
      return;
    }

    if (twoFlavors && !secondFlavorId) {
      setStep(2);
      showError("Selecciona el segundo sabor.");
      return;
    }

    if (
      twoFlavors &&
      firstFlavorId &&
      secondFlavorId &&
      firstFlavorId === secondFlavorId
    ) {
      setStep(2);
      showError("Los dos sabores deben ser diferentes.");
      return;
    }

    if (!crustId) {
      setStep(twoFlavors ? 3 : 1);
      showError("Selecciona el borde antes de agregar la pizza.");
      return;
    }

    const size = catalog.sizes.find((item) => item.id === sizeId);
    const crust = catalog.crusts.find((item) => item.id === crustId);
    if (!size || !crust) {
      showError("La configuración seleccionada ya no está disponible.");
      return;
    }

    const crustPrice = crustPriceForSize(crust, size.id);
    if (crustPrice == null) {
      showError("Ese borde no está disponible para este tamaño.");
      return;
    }

    const flavorIds = twoFlavors
      ? [firstFlavorId!, secondFlavorId!]
      : [product.id];

    const flavors = flavorIds
      .map((id) => catalog.pizzaFlavors.find((item) => item.id === id))
      .filter((item): item is Product => Boolean(item));

    if (flavors.length !== flavorIds.length) {
      showError("Uno de los sabores ya no está disponible.");
      return;
    }

    const modifiers = twoFlavors
      ? []
      : catalog.modifiers.filter((modifier) =>
          modifierIds.includes(modifier.id),
        );

    const configuration: PizzaOrderConfiguration = {
      schemaVersion: 1,
      kind: "PIZZA",
      productId: product.id,
      productName: product.name,
      size: {
        id: size.id,
        name: size.name,
        diameterCm: size.diameterCm,
        basePrice: size.basePrice,
      },
      flavors: flavors.map((flavor) => ({
        productId: flavor.id,
        name: flavor.name,
        portion: twoFlavors ? 0.5 : 1,
        basePrice: flavor.basePrice ?? 0,
      })),
      crust: {
        id: crust.id,
        name: crust.name,
        price: crustPrice,
      },
      modifiers: modifiers.map((modifier) => ({
        productId: modifier.id,
        name: modifier.name,
        quantity: 1,
        unitPrice: modifier.basePrice,
      })),
    };

    const detail = [
      size.name,
      twoFlavors
        ? flavors.map((flavor) => "½ " + flavor.name).join(" + ")
        : flavors[0]?.name,
      "Borde " + crust.name,
      ...modifiers.map((modifier) => "+ " + modifier.name),
    ]
      .filter(Boolean)
      .join(" · ");

    onAdd({
      key:
        "pizza-" +
        String(Date.now()) +
        "-" +
        Math.random().toString(36).slice(2),
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      detail,
      unitPrice: pizzaPrice,
      quantity: 1,
      configuration,
      notes: note.trim().slice(0, 120) || undefined,
    });
  }

  function addComboToCart() {
    setError("");

    for (let index = 0; index < comboSteps.length; index += 1) {
      if (!validateComboStep(comboSteps[index])) {
        setStep(index);
        return;
      }
    }

    const pizzas: ComboOrderConfiguration["pizzas"] = [];
    const groups: ComboOrderConfiguration["groups"] = [];
    const detailParts: string[] = [];

    for (const rule of product.comboPizzaRules ?? []) {
      for (let unit = 0; unit < rule.quantity; unit += 1) {
        const selected =
          comboPizzaSelections[comboSelectionKey(rule, unit)];
        const size = rule.sizes.find((item) => item.id === selected?.sizeId);
        const flavor = rule.flavors.find(
          (item) => item.id === selected?.flavorId,
        );
        if (!size || !flavor) {
          showError("Falta completar una pizza del combo.");
          return;
        }

        pizzas.push({
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
        detailParts.push(size.name + " · " + flavor.name);
      }
    }

    for (const group of product.comboGroups ?? []) {
      const selectedIds = comboGroupSelections[group.id] ?? [];
      const selectedOptions = selectedIds
        .map((productId) =>
          group.options.find((option) => option.productId === productId),
        )
        .filter(Boolean) as NonNullable<
          Product["comboGroups"]
        >[number]["options"];

      groups.push({
        groupId: group.id,
        kind: group.kind,
        name: group.name,
        selections: selectedOptions.map((option) => ({
          optionId: option.id,
          productId: option.productId,
          name: option.productName,
          quantity: Math.max(1, option.quantity),
          unitPrice: option.basePrice,
          priceDelta: option.priceDelta,
        })),
      });

      if (selectedOptions.length) {
        detailParts.push(
          group.name +
            ": " +
            selectedOptions.map((option) => option.productName).join(", "),
        );
      }
    }

    const configuration: ComboOrderConfiguration = {
      schemaVersion: 1,
      kind: "COMBO",
      comboProductId: product.id,
      comboName: product.name,
      comboDiscount: Number(product.comboDiscount ?? 0),
      pizzas,
      groups,
    };

    onAdd({
      key:
        "combo-" +
        String(Date.now()) +
        "-" +
        Math.random().toString(36).slice(2),
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      detail: detailParts.join(" · "),
      unitPrice: comboPrice,
      quantity: 1,
      configuration,
      notes:
        (product.comboPizzaRules ?? []).some((rule) => rule.quantity > 0)
          ? note.trim().slice(0, 120) || undefined
          : undefined,
    });
  }

  function renderPizzaStep() {
    if (step === 0) {
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {catalog.sizes.map((size) => (
            <ChoiceButton
              key={size.id}
              selected={sizeId === size.id}
              title={size.name}
              detail={String(size.diameterCm) + " cm"}
              onClick={() => {
                setError("");
                setSizeId(size.id);
                const currentCrust = catalog.crusts.find(
                  (item) => item.id === crustId,
                );
                if (
                  currentCrust &&
                  crustPriceForSize(currentCrust, size.id) == null
                ) {
                  setCrustId(null);
                }
              }}
            />
          ))}
        </div>
      );
    }

    if (twoFlavors && (step === 1 || step === 2)) {
      const first = step === 1;
      const currentId = first ? firstFlavorId : secondFlavorId;

      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {catalog.pizzaFlavors.map((flavor) => {
            const disabled = !first && firstFlavorId === flavor.id;
            return (
              <ChoiceButton
                key={flavor.id}
                disabled={disabled}
                selected={currentId === flavor.id}
                title={flavor.name}
                detail={disabled ? "Ya elegido como primer sabor" : undefined}
                onClick={() => {
                  setError("");
                  if (first) {
                    setFirstFlavorId(flavor.id);
                    if (secondFlavorId === flavor.id) {
                      setSecondFlavorId(null);
                    }
                  } else {
                    setSecondFlavorId(flavor.id);
                  }
                }}
              />
            );
          })}
        </div>
        {currentId && (() => {
          const selectedFlavor = catalog.pizzaFlavors.find(
            (flavor) => flavor.id === currentId,
          );
          if (!selectedFlavor?.description) return null;

          return (
            <div className="mt-3 rounded-[16px] border border-white/10 bg-white/[0.045] p-3.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#ff454b]">
                {selectedFlavor.name}
              </p>
              <p className="mt-1.5 text-[11px] leading-5 text-white/58">
                {selectedFlavor.description}
              </p>
            </div>
          );
        })()}
      );
    }

    if ((!twoFlavors && step === 1) || (twoFlavors && step === 3)) {
      return (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">
            El Mundo De Los Bordes®
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {catalog.crusts.map((crust) => {
              const price = crustPriceForSize(crust, sizeId);
              return (
                <ChoiceButton
                  key={crust.id}
                  disabled={price == null}
                  selected={crustId === crust.id}
                  title={crust.name}
                  detail={
                    price == null
                      ? "No disponible para este tamaño"
                      : price > 0
                        ? "+" + money(price)
                        : "Incluido"
                  }
                  onClick={() => {
                    setError("");
                    setCrustId(crust.id);
                  }}
                />
              );
            })}
          </div>
        </div>
      );
    }

    if (!twoFlavors && step === 2) {
      return (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">
            Ingredientes extra · opcional
          </p>
          {catalog.modifiers.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {catalog.modifiers.map((modifier) => (
                <ChoiceButton
                  key={modifier.id}
                  selected={modifierIds.includes(modifier.id)}
                  title={modifier.name}
                  detail={"+" + money(modifier.basePrice)}
                  onClick={() => toggleModifier(modifier.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[15px] border border-white/10 bg-black/20 p-3 text-[11px] text-white/40">
              No hay ingredientes extra disponibles.
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <textarea
          value={note}
          maxLength={120}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ej. Ligera en salsa"
          className="h-24 w-full resize-none rounded-[16px] border border-white/10 bg-black/25 p-3 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[#e21a22]"
        />
        <p className="mt-1.5 text-right text-[9px] font-semibold text-white/30">
          {note.length}/120
        </p>
      </div>
    );
  }

  function renderComboStep() {
    const current = activeComboStep;
    if (!current) return null;

    if (current.kind === "combo-size") {
      const key = comboSelectionKey(current.rule, current.unit);
      const selection = comboPizzaSelections[key];

      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {current.rule.sizes.map((size) => (
            <ChoiceButton
              key={size.id}
              selected={selection?.sizeId === size.id}
              title={size.name}
              detail={String(size.diameterCm) + " cm"}
              onClick={() => {
                setError("");
                setComboPizzaSelections((state) => ({
                  ...state,
                  [key]: {
                    sizeId: size.id,
                    flavorId: state[key]?.flavorId ?? null,
                  },
                }));
              }}
            />
          ))}
        </div>
      );
    }

    if (current.kind === "combo-flavor") {
      const key = comboSelectionKey(current.rule, current.unit);
      const selection = comboPizzaSelections[key];

      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {current.rule.flavors.map((flavor) => (
            <ChoiceButton
              key={flavor.id}
              selected={selection?.flavorId === flavor.id}
              title={flavor.name}
              detail={undefined}
              onClick={() => {
                setError("");
                setComboPizzaSelections((state) => ({
                  ...state,
                  [key]: {
                    sizeId: state[key]?.sizeId ?? null,
                    flavorId: flavor.id,
                  },
                }));
              }}
            />
          ))}
        </div>
        {selection?.flavorId && (() => {
          const selectedFlavor = current.rule.flavors.find(
            (flavor) => flavor.id === selection.flavorId,
          );
          if (!selectedFlavor?.description) return null;

          return (
            <div className="mt-3 rounded-[16px] border border-white/10 bg-white/[0.045] p-3.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#ff454b]">
                {selectedFlavor.name}
              </p>
              <p className="mt-1.5 text-[11px] leading-5 text-white/58">
                {selectedFlavor.description}
              </p>
            </div>
          );
        })()}
      );
    }

    if (current.kind === "combo-group") {
      const selected = comboGroupSelections[current.group.id] ?? [];

      return (
        <div>
          <div className="mb-3 rounded-[14px] border border-white/8 bg-white/[0.035] px-3 py-2 text-[10px] text-white/45">
            Elige {current.group.minSelections}
            {current.group.maxSelections !== current.group.minSelections
              ? " a " + String(current.group.maxSelections)
              : ""}{" "}
            opción{current.group.maxSelections > 1 ? "es" : ""}.
            <b className="ml-2 text-white/70">
              {selected.length}/{current.group.maxSelections}
            </b>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {current.group.options.map((option) => (
              <ChoiceButton
                key={option.id}
                selected={selected.includes(option.productId)}
                title={option.productName}
                detail={
                  option.quantity > 1
                    ? "Incluye ×" + String(option.quantity)
                    : "Incluido"
                }
                onClick={() =>
                  toggleComboGroupOption(current.group, option.productId)
                }
              />
            ))}
          </div>
        </div>
      );
    }

    if (current.kind === "combo-note") {
      return (
        <div>
          <textarea
            value={note}
            maxLength={120}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ej. Pizza bien dorada"
            className="h-24 w-full resize-none rounded-[16px] border border-white/10 bg-black/25 p-3 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[#e21a22]"
          />
          <p className="mt-1.5 text-right text-[9px] font-semibold text-white/30">
            {note.length}/120
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-[18px] border border-emerald-400/20 bg-emerald-400/10 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">
          Listo para agregar
        </p>
        <p className="mt-1 text-[12px] leading-5 text-white/65">
          Este combo ya tiene sus opciones incluidas seleccionadas.
        </p>
      </div>
    );
  }

  const currentTitle = isCombo
    ? activeComboStep?.title ?? "Compra Asistida"
    : pizzaSteps[step];

  const finalStep = step === totalSteps - 1;
  const pizzaPriceVisible = twoFlavors
    ? Boolean(
        firstFlavorId &&
          secondFlavorId &&
          firstFlavorId !== secondFlavorId &&
          sizeId,
      )
    : Boolean(sizeId);

  const finalReady = isCombo
    ? comboSteps.every((current) => {
        if (current.kind === "combo-size") {
          return Boolean(
            comboPizzaSelections[
              comboSelectionKey(current.rule, current.unit)
            ]?.sizeId,
          );
        }
        if (current.kind === "combo-flavor") {
          return Boolean(
            comboPizzaSelections[
              comboSelectionKey(current.rule, current.unit)
            ]?.flavorId,
          );
        }
        if (current.kind === "combo-group") {
          const selected = comboGroupSelections[current.group.id] ?? [];
          return (
            selected.length >= current.group.minSelections &&
            selected.length <= current.group.maxSelections
          );
        }
        return true;
      })
    : Boolean(
        sizeId &&
          crustId &&
          (!twoFlavors ||
            (firstFlavorId &&
              secondFlavorId &&
              firstFlavorId !== secondFlavorId)),
      );

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/80 backdrop-blur-sm md:items-center md:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#111] font-sans text-white shadow-[0_28px_80px_rgba(0,0,0,.52)] md:max-w-[700px] md:rounded-[28px]">
        <header className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#e21a22]">
                Compra Asistida
              </p>
              <h2 className="mt-1 truncate text-[21px] font-bold tracking-[-0.01em]">
                {product.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <div className="mt-4">
            <Progress current={step} total={totalSteps} />
          </div>
        </header>

        <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 md:overflow-y-visible">
          <section className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
                Te guiamos paso a paso
              </p>
              <h3 className="mt-1 text-[18px] font-bold">{currentTitle}</h3>
            </div>

            {isCombo ? renderComboStep() : renderPizzaStep()}

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-[15px] border border-red-500/25 bg-red-500/10 p-3 text-[11px] font-semibold leading-5 text-red-200">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-[12px]">
                  !
                </span>
                <span>{error}</span>
              </div>
            )}
          </section>
        </div>

        <footer className="border-t border-white/10 bg-[#0c0c0c] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <span className="block text-[8px] font-bold uppercase tracking-[0.13em] text-white/30">
                {isCombo
                  ? comboHasAllSizes
                    ? "Precio del combo"
                    : "Desde"
                  : pizzaPriceVisible
                    ? "Precio de tu pizza"
                    : "Precio"}
              </span>
              {isCombo || pizzaPriceVisible ? (
                <b className="mt-0.5 block text-[20px] text-[#ff3439]">
                  {money(isCombo ? comboPrice : pizzaPrice)}
                </b>
              ) : (
                <span className="mt-1 block text-[11px] font-semibold text-white/35">
                  Completa los sabores para ver el valor
                </span>
              )}
            </div>
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                className="h-10 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[10px] font-bold text-white/60"
              >
                ← Regresar
              </button>
            )}
          </div>

          {finalStep ? (
            <button
              type="button"
              disabled={!finalReady}
              onClick={isCombo ? addComboToCart : addPizzaToCart}
              className="h-12 w-full rounded-full bg-[#e21a22] px-5 text-[11px] font-bold uppercase tracking-[0.06em] text-white shadow-[0_10px_24px_rgba(226,26,34,.22)] transition hover:bg-[#ef1c25] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none"
            >
              {finalReady ? "Agregar al carrito" : "Completa lo que falta"}
            </button>
          ) : (
            <button
              type="button"
              onClick={isCombo ? nextCombo : nextPizza}
              className="h-12 w-full rounded-full bg-white px-5 text-[11px] font-bold uppercase tracking-[0.06em] text-black transition hover:bg-neutral-100"
            >
              Siguiente →
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
