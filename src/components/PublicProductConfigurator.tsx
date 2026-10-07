"use client";

import { useMemo, useState } from "react";
import {
  buildComboConfiguration,
  estimateComboPrice,
} from "@/lib/comboConfiguration";
import {
  buildPizzaConfiguration,
  estimatePizzaPrice,
  isTwoFlavorPizzaProduct,
  pizzaCrustPrice,
} from "@/lib/pizzaConfiguration";
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
  return isTwoFlavorPizzaProduct(product);
}

function crustPriceForSize(crust: Crust, sizeId: number | null) {
  return pizzaCrustPrice(crust, sizeId);
}

function Progress({
  current,
  total,
  title,
}: {
  current: number;
  total: number;
  title: string;
}) {
  const safeTotal = Math.max(1, total);
  const percent = Math.min(100, Math.max(0, ((current + 1) / safeTotal) * 100));

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[10px] font-semibold text-white/48">
          Paso {Math.min(current + 1, safeTotal)} de {safeTotal} · {title}
        </span>
        <span className="shrink-0 text-[10px] font-black text-[#ff454b]">
          {Math.round(percent)}%
        </span>
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.10]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#e21a22,#ff3941)] transition-all duration-300"
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
  imageUrl,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  detail?: string;
  imageUrl?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        "group relative overflow-hidden rounded-[18px] border text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-30 " +
        (selected
          ? "border-[#ff3439] bg-[linear-gradient(145deg,rgba(226,26,34,.18),rgba(255,255,255,.055))] text-white shadow-[0_12px_32px_rgba(226,26,34,.16)]"
          : "border-white/[0.10] bg-white/[0.045] text-white/76 hover:border-white/20 hover:bg-white/[0.065]")
      }
    >
      <span
        className={
          "absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border text-[13px] font-black shadow-[0_5px_14px_rgba(0,0,0,.24)] backdrop-blur-md transition " +
          (selected
            ? "border-[#ff3439] bg-[#ff2630] text-white"
            : "border-white/35 bg-black/35 text-transparent")
        }
        aria-hidden="true"
      >
        ✓
      </span>

      {imageUrl ? (
        <div className="relative aspect-[16/10] overflow-hidden border-b border-white/[0.07] bg-black/20">
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        </div>
      ) : null}

      <div className={imageUrl ? "p-3.5" : "min-h-[96px] p-4"}>
        <span className="block pr-8 text-[13px] font-black leading-5 text-white">
          {title}
        </span>
        {detail && (
          <span className="mt-1.5 block text-[10px] leading-[1.45] text-white/40">
            {detail}
          </span>
        )}
      </div>
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
    if (isCombo) return 0;

    return estimatePizzaPrice({
      product,
      draft: {
        sizeId,
        firstFlavorId,
        secondFlavorId,
        crustId,
        modifierIds,
      },
      sizes: catalog.sizes,
      flavors: catalog.pizzaFlavors,
      crusts: catalog.crusts,
      modifiers: catalog.modifiers,
    });
  }, [
    catalog.crusts,
    catalog.modifiers,
    catalog.pizzaFlavors,
    catalog.sizes,
    crustId,
    firstFlavorId,
    isCombo,
    modifierIds,
    product,
    secondFlavorId,
    sizeId,
  ]);

  const comboPrice = useMemo(() => {
    if (!isCombo) return 0;

    const pizzas = (product.comboPizzaRules ?? []).flatMap((rule) =>
      Array.from({ length: rule.quantity }, (_, unit) => {
        const selection =
          comboPizzaSelections[comboSelectionKey(rule, unit)];

        const fallbackSize = [...rule.sizes].sort(
          (a, b) => a.basePrice - b.basePrice,
        )[0];
        const fallbackFlavor = [...rule.flavors].sort(
          (a, b) => a.basePrice - b.basePrice,
        )[0];

        return {
          ruleId: rule.id,
          sizeId: selection?.sizeId ?? fallbackSize?.id ?? null,
          flavorCount: 1 as const,
          firstFlavorId:
            selection?.flavorId ?? fallbackFlavor?.id ?? null,
          secondFlavorId: null,
        };
      }),
    );

    const groupSelections: Record<number, number[]> = {};
    for (const group of product.comboGroups ?? []) {
      const selected = comboGroupSelections[group.id] ?? [];
      const remaining = group.options
        .filter((option) => !selected.includes(option.productId))
        .sort(
          (a, b) =>
            (a.basePrice + a.priceDelta) *
              Math.max(1, a.quantity) -
            (b.basePrice + b.priceDelta) *
              Math.max(1, b.quantity),
        );

      const needed = Math.max(
        0,
        group.minSelections - selected.length,
      );

      groupSelections[group.id] = [
        ...selected,
        ...remaining
          .slice(0, needed)
          .map((option) => option.productId),
      ];
    }

    return estimateComboPrice({
      product,
      pizzas,
      groupSelections,
    });
  }, [
    comboGroupSelections,
    comboPizzaSelections,
    isCombo,
    product,
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

    try {
      const result = buildPizzaConfiguration({
        product,
        draft: {
          sizeId,
          firstFlavorId,
          secondFlavorId,
          crustId,
          modifierIds,
        },
        sizes: catalog.sizes,
        flavors: catalog.pizzaFlavors,
        crusts: catalog.crusts,
        modifiers: catalog.modifiers,
      });

      onAdd({
        key:
          "pizza-" +
          String(Date.now()) +
          "-" +
          Math.random().toString(36).slice(2),
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        detail: result.summary,
        unitPrice: result.estimatedUnitPrice,
        quantity: 1,
        configuration: result.configuration,
        notes: note.trim().slice(0, 120) || undefined,
      });
    } catch (configError) {
      const message =
        configError instanceof Error
          ? configError.message
          : "No fue posible configurar la pizza.";

      if (message.includes("tamaño")) setStep(0);
      else if (message.includes("primer sabor")) setStep(1);
      else if (message.includes("dos sabores") || message.includes("sabores")) {
        setStep(twoFlavors ? 2 : step);
      } else if (message.includes("borde")) {
        setStep(twoFlavors ? 3 : 1);
      }

      showError(message);
    }
  }

  function addComboToCart() {
    setError("");

    for (let index = 0; index < comboSteps.length; index += 1) {
      if (!validateComboStep(comboSteps[index])) {
        setStep(index);
        return;
      }
    }

    try {
      const pizzas = (product.comboPizzaRules ?? []).flatMap((rule) =>
        Array.from({ length: rule.quantity }, (_, unit) => {
          const selected =
            comboPizzaSelections[comboSelectionKey(rule, unit)];

          return {
            ruleId: rule.id,
            sizeId: selected?.sizeId ?? null,
            flavorCount: 1 as const,
            firstFlavorId: selected?.flavorId ?? null,
            secondFlavorId: null,
          };
        }),
      );

      const result = buildComboConfiguration({
        product,
        pizzas,
        groupSelections: comboGroupSelections,
      });

      onAdd({
        key:
          "combo-" +
          String(Date.now()) +
          "-" +
          Math.random().toString(36).slice(2),
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        detail: result.summary,
        unitPrice: result.estimatedUnitPrice,
        quantity: 1,
        configuration: result.configuration,
        notes:
          (product.comboPizzaRules ?? []).some(
            (rule) => rule.quantity > 0,
          )
            ? note.trim().slice(0, 120) || undefined
            : undefined,
      });
    } catch (configError) {
      showError(
        configError instanceof Error
          ? configError.message
          : "No fue posible configurar el combo.",
      );
    }
  }

  function renderPizzaStep() {
    if (step === 0) {
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {catalog.pizzaFlavors.map((flavor) => {
              const disabled = !first && firstFlavorId === flavor.id;
              return (
                <ChoiceButton
                  key={flavor.id}
                  disabled={disabled}
                  selected={currentId === flavor.id}
                  title={flavor.name}
                  detail={
                    disabled
                      ? "Ya elegido como primer sabor"
                      : flavor.description || undefined
                  }
                  imageUrl={flavor.imageUrl}
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


        </>
      );
    }

    if ((!twoFlavors && step === 1) || (twoFlavors && step === 3)) {
      return (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">
            El Mundo De Los Bordes®
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {catalog.modifiers.map((modifier) => (
                <ChoiceButton
                  key={modifier.id}
                  selected={modifierIds.includes(modifier.id)}
                  title={modifier.name}
                  detail={"+" + money(modifier.basePrice)}
                  imageUrl={modifier.imageUrl}
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {current.rule.flavors.map((flavor) => (
              <ChoiceButton
                key={flavor.id}
                selected={selection?.flavorId === flavor.id}
                title={flavor.name}
                detail={flavor.description || undefined}
                imageUrl={flavor.imageUrl}
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


        </>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                imageUrl={option.imageUrl}
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

  const selectedSize = catalog.sizes.find((size) => size.id === sizeId);
  const selectedFirstFlavor = catalog.pizzaFlavors.find(
    (flavor) => flavor.id === firstFlavorId,
  );
  const selectedSecondFlavor = catalog.pizzaFlavors.find(
    (flavor) => flavor.id === secondFlavorId,
  );
  const selectedCrust = catalog.crusts.find(
    (crust) => crust.id === crustId,
  );

  const stepHeading = (() => {
    const normalized = currentTitle.toLocaleLowerCase("es");

    if (normalized.includes("primer sabor")) return "Elige el primer sabor";
    if (normalized.includes("segundo sabor")) return "Elige el segundo sabor";
    if (normalized.includes("sabor")) return "Elige el sabor";
    if (normalized.includes("tamaño")) return "Elige el tamaño";
    if (normalized.includes("borde")) return "Elige tu borde";
    if (normalized.includes("ingredientes")) return "Personaliza tu pizza";
    if (normalized.includes("nota")) return "Indicaciones para cocina";
    if (normalized.includes("listo")) return "Tu combo está listo";

    return "Elige " + currentTitle.toLocaleLowerCase("es");
  })();

  const stepHint = (() => {
    if (
      activeComboStep?.kind === "combo-group"
    ) {
      const min = activeComboStep.group.minSelections;
      const max = activeComboStep.group.maxSelections;
      return min === max
        ? `Selecciona ${min} opción${min === 1 ? "" : "es"}`
        : `Selecciona de ${min} a ${max} opciones`;
    }

    if (
      currentTitle.toLocaleLowerCase("es").includes("nota") ||
      currentTitle.toLocaleLowerCase("es").includes("ingredientes")
    ) {
      return "Opcional";
    }

    return "Selecciona 1 opción";
  })();

  const selectionSummary = (() => {
    if (isCombo) {
      const parts: string[] = [];

      for (const rule of product.comboPizzaRules ?? []) {
        for (let unit = 0; unit < rule.quantity; unit += 1) {
          const selection =
            comboPizzaSelections[comboSelectionKey(rule, unit)];
          const size = rule.sizes.find(
            (item) => item.id === selection?.sizeId,
          );
          const flavor = rule.flavors.find(
            (item) => item.id === selection?.flavorId,
          );

          if (size?.name) parts.push(size.name);
          if (flavor?.name) parts.push(flavor.name);

          if (parts.length >= 2) break;
        }
        if (parts.length >= 2) break;
      }

      if (!parts.length && activeComboStep?.kind === "combo-group") {
        const selected =
          comboGroupSelections[activeComboStep.group.id] ?? [];
        const names = activeComboStep.group.options
          .filter((option) => selected.includes(option.productId))
          .map((option) => option.productName);
        parts.push(...names.slice(0, 2));
      }

      return parts.length
        ? { label: "Tu combo", value: parts.join(" · ") }
        : null;
    }

    const parts = [
      selectedSize?.name,
      selectedFirstFlavor?.name,
      selectedSecondFlavor?.name,
      selectedCrust?.name ? "Borde " + selectedCrust.name : null,
    ].filter(Boolean) as string[];

    return parts.length
      ? {
          label: twoFlavors ? "Tu pizza" : "Tu elección",
          value: parts.join(" · "),
        }
      : null;
  })();

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
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/78 backdrop-blur-[6px] md:items-center md:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-[30px] border border-white/[0.12] bg-[radial-gradient(circle_at_82%_0%,rgba(226,26,34,.12),transparent_24%),linear-gradient(180deg,#111214_0%,#0d0e10_100%)] font-sans text-white shadow-[0_30px_90px_rgba(0,0,0,.58)] md:max-w-[760px] md:rounded-[30px]">
        <header className="shrink-0 border-b border-white/[0.08] px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ff454b]">
                Compra asistida
              </p>
              <h2 className="mt-1.5 truncate text-[23px] font-black tracking-[-0.035em] text-white sm:text-[26px]">
                {product.name}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.055] text-[18px] text-white/65 transition hover:bg-white/[0.09] hover:text-white"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <div className="mt-4">
            <Progress current={step} total={totalSteps} title={currentTitle} />
          </div>
        </header>

        <div className="alento-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div>
            <h3 className="text-[24px] font-black leading-none tracking-[-0.035em] text-white sm:text-[27px]">
              {stepHeading}
            </h3>
            <p className="mt-2 text-[11px] font-medium text-white/38">
              {stepHint}
            </p>
          </div>

          <div className="mt-5">
            {isCombo ? renderComboStep() : renderPizzaStep()}
          </div>

          {selectionSummary && (
            <div className="mt-5 flex items-center gap-3 rounded-[17px] border border-red-400/20 bg-[linear-gradient(100deg,rgba(226,26,34,.11),rgba(255,255,255,.035))] px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-red-400/15 bg-red-400/10 text-[18px]">
                🍕
              </span>
              <div className="min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-[0.1em] text-white/30">
                  {selectionSummary.label}
                </span>
                <b className="mt-0.5 block truncate text-[12px] font-black text-white/84">
                  {selectionSummary.value}
                </b>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-[15px] border border-red-500/25 bg-red-500/10 p-3 text-[11px] font-semibold leading-5 text-red-200">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-[12px]">
                !
              </span>
              <span>{error}</span>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-white/[0.08] bg-[#090a0b]/96 px-5 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <span className="block text-[8px] font-black uppercase tracking-[0.15em] text-white/28">
                {isCombo
                  ? comboHasAllSizes
                    ? "Precio del combo"
                    : "Desde"
                  : pizzaPriceVisible
                    ? "Precio de tu pizza"
                    : "Precio"}
              </span>

              {isCombo || pizzaPriceVisible ? (
                <b className="mt-1 block whitespace-nowrap text-[23px] font-black tracking-[-0.035em] text-[#ff3439] sm:text-[25px]">
                  {money(isCombo ? comboPrice : pizzaPrice)}
                </b>
              ) : (
                <span className="mt-1 block max-w-[170px] text-[9px] font-semibold leading-4 text-white/35">
                  Completa los sabores para ver el valor
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={back}
                  className="h-11 min-w-11 rounded-full border border-white/[0.13] bg-white/[0.035] px-3 text-[10px] font-bold text-white/62 transition hover:bg-white/[0.07] hover:text-white sm:px-4"
                >
                  ← <span className="hidden sm:inline">Regresar</span>
                </button>
              )}

              {finalStep ? (
                <button
                  type="button"
                  disabled={!finalReady}
                  onClick={isCombo ? addComboToCart : addPizzaToCart}
                  className="h-11 rounded-full bg-[linear-gradient(135deg,#e21a22,#ff2933)] px-5 text-[10px] font-black uppercase tracking-[0.04em] text-white shadow-[0_10px_24px_rgba(226,26,34,.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none"
                >
                  {finalReady ? "Agregar al carrito" : "Completa lo que falta"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={isCombo ? nextCombo : nextPizza}
                  className="h-11 rounded-full bg-[linear-gradient(135deg,#e21a22,#ff2933)] px-5 text-[10px] font-black uppercase tracking-[0.04em] text-white shadow-[0_10px_24px_rgba(226,26,34,.20)] transition hover:brightness-110"
                >
                  Siguiente →
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );}
