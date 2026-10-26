"use client";

import { useMemo, useRef, useState } from "react";
import type {
  CustomPizzaMode,
  CustomPizzaOrderConfiguration,
} from "@/lib/orderConfiguration";
import {
  buildCustomPizzaConfiguration,
  customPizzaBillableIngredientCount,
  customPizzaIngredientCharge,
  estimateCustomPizzaPrice,
  type CustomPizzaDraftChoice,
} from "@/lib/customPizzaConfiguration";
import { pizzaCrustPrice } from "@/lib/pizzaConfiguration";

type Product = {
  id: number;
  name: string;
  type: string;
  basePrice: number | null;
};

type Size = {
  id: number;
  name: string;
  diameterCm: number;
  basePrice: number;
};

type Crust = {
  id: number;
  name: string;
  prices: Array<{ sizeId: number; price: number }>;
};

type Ingredient = {
  id: number;
  name: string;
  imageUrl?: string | null;
  basePrice: number;
  ingredientGroupId?: number | null;
  ingredientGroupName?: string | null;
  ingredientGroupSlug?: string | null;
  ingredientGroupSortOrder?: number | null;
};

export type CustomPizzaConfiguratorCatalog = {
  sizes: Size[];
  crusts: Crust[];
  modifiers: Ingredient[];
};

export type CustomPizzaConfiguratorResult = ReturnType<
  typeof buildCustomPizzaConfiguration
>;

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function defaultCrustId(crusts: Crust[]) {
  const traditional = crusts.find((crust) =>
    crust.name
      .trim()
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .includes("tradicional"),
  );
  return traditional?.id ?? crusts[0]?.id ?? null;
}

function ingredientIds(
  values: Array<{ productId: number }> | undefined,
) {
  return values?.map((item) => item.productId) ?? [];
}

export default function CustomPizzaConfigurator({
  product,
  catalog,
  initialConfiguration,
  theme = "dark",
  pricingMode = "operator",
  actionLabel = "Agregar al carrito",
  onClose,
  onConfirm,
}: {
  product: Product;
  catalog: CustomPizzaConfiguratorCatalog;
  initialConfiguration?: CustomPizzaOrderConfiguration | null;
  theme?: "dark" | "light";
  pricingMode?: "customer" | "operator";
  actionLabel?: string;
  onClose: () => void;
  onConfirm: (result: CustomPizzaConfiguratorResult) => void;
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [ingredientGroupFilter, setIngredientGroupFilter] = useState<
    number | "ALL" | "UNGROUPED"
  >("ALL");
  const contentRef = useRef<HTMLDivElement | null>(null);

  const [draft, setDraft] = useState<CustomPizzaDraftChoice>(() => ({
    sizeId: initialConfiguration?.size.id ?? null,
    crustId:
      initialConfiguration?.crust.id ?? defaultCrustId(catalog.crusts),
    mode: initialConfiguration?.mode ?? null,
    wholeIngredientIds: ingredientIds(
      initialConfiguration?.wholeIngredients,
    ),
    firstHalfIngredientIds: ingredientIds(
      initialConfiguration?.firstHalfIngredients,
    ),
    secondHalfIngredientIds: ingredientIds(
      initialConfiguration?.secondHalfIngredients,
    ),
  }));

  const steps = useMemo(
    () =>
      draft.mode === "HALF_HALF"
        ? [
            "Tamaño",
            "Borde",
            "Cómo la quieres",
            "Ingredientes mitad 1",
            "Ingredientes mitad 2",
          ]
        : [
            "Tamaño",
            "Borde",
            "Cómo la quieres",
            "Ingredientes",
          ],
    [draft.mode],
  );

  const isDark = theme === "dark";
  const selectedSize = catalog.sizes.find(
    (size) => size.id === draft.sizeId,
  );
  const selectedCrust = catalog.crusts.find(
    (crust) => crust.id === draft.crustId,
  );
  const price = estimateCustomPizzaPrice({
    product,
    draft,
    sizes: catalog.sizes,
    crusts: catalog.crusts,
    ingredients: catalog.modifiers,
  });
  const billableCount = customPizzaBillableIngredientCount(draft);
  const ingredientCharge = customPizzaIngredientCharge({
    draft,
    ingredients: catalog.modifiers,
  });
  const selectedIngredientCount =
    draft.mode === "WHOLE"
      ? draft.wholeIngredientIds.length
      : draft.mode === "HALF_HALF"
        ? draft.firstHalfIngredientIds.length +
          draft.secondHalfIngredientIds.length
        : 0;
  const showCustomerPrice =
    pricingMode === "operator" || selectedIngredientCount > 0;

  const ingredientGroups = useMemo(() => {
    const byId = new Map<
      number,
      { id: number; name: string; sortOrder: number }
    >();

    for (const ingredient of catalog.modifiers) {
      if (
        ingredient.ingredientGroupId &&
        ingredient.ingredientGroupName
      ) {
        byId.set(ingredient.ingredientGroupId, {
          id: ingredient.ingredientGroupId,
          name: ingredient.ingredientGroupName,
          sortOrder: ingredient.ingredientGroupSortOrder ?? 9999,
        });
      }
    }

    return [...byId.values()].sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name, "es"),
    );
  }, [catalog.modifiers]);

  const hasUngroupedIngredients = catalog.modifiers.some(
    (ingredient) => !ingredient.ingredientGroupId,
  );

  const goToStep = (next: number) => {
    setError("");
    setStep(Math.max(0, Math.min(steps.length - 1, next)));
    requestAnimationFrame(() =>
      contentRef.current?.scrollTo({ top: 0, behavior: "smooth" }),
    );
  };

  function setSize(sizeId: number) {
    const currentCrust = catalog.crusts.find(
      (crust) => crust.id === draft.crustId,
    );
    const nextCrustId =
      currentCrust &&
      pizzaCrustPrice(currentCrust, sizeId) != null
        ? draft.crustId
        : catalog.crusts.find(
            (crust) => pizzaCrustPrice(crust, sizeId) != null,
          )?.id ?? null;
    setDraft({ ...draft, sizeId, crustId: nextCrustId });
    setError("");
  }

  function toggleIngredient(
    target:
      | "wholeIngredientIds"
      | "firstHalfIngredientIds"
      | "secondHalfIngredientIds",
    ingredientId: number,
  ) {
    const values = draft[target];
    setDraft({
      ...draft,
      [target]: values.includes(ingredientId)
        ? values.filter((id) => id !== ingredientId)
        : [...values, ingredientId],
    });
    setError("");
  }

  function next() {
    setError("");

    if (step === 0 && !draft.sizeId) {
      setError("Selecciona el tamaño antes de continuar.");
      return;
    }
    if (step === 1 && !draft.crustId) {
      setError("Selecciona el borde antes de continuar.");
      return;
    }
    if (step === 2 && !draft.mode) {
      setError("Selecciona completa o mitad y mitad.");
      return;
    }

    if (step < steps.length - 1) goToStep(step + 1);
  }

  function confirm() {
    setError("");
    try {
      onConfirm(
        buildCustomPizzaConfiguration({
          product,
          draft,
          sizes: catalog.sizes,
          crusts: catalog.crusts,
          ingredients: catalog.modifiers,
        }),
      );
    } catch (configurationError) {
      const message =
        configurationError instanceof Error
          ? configurationError.message
          : "No fue posible armar la pizza.";
      setError(message);
      if (message.toLowerCase().includes("tamaño")) setStep(0);
      else if (message.toLowerCase().includes("borde")) setStep(1);
      else if (
        message.toLowerCase().includes("completa") ||
        message.toLowerCase().includes("mitad")
      )
        setStep(2);
    }
  }

  function ingredientGrid(
    target:
      | "wholeIngredientIds"
      | "firstHalfIngredientIds"
      | "secondHalfIngredientIds",
  ) {
    const selected = draft[target];

    const ingredientButton = (ingredient: Ingredient) => {
      const active = selected.includes(ingredient.id);
      return (
        <button
          type="button"
          key={ingredient.id}
          onClick={() => toggleIngredient(target, ingredient.id)}
          className={
            "min-h-[68px] rounded-[14px] border p-3 text-left transition " +
            (isDark
              ? active
                ? "border-red-400 bg-red-500/15 text-white"
                : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.07]"
              : active
                ? "border-red-300 bg-red-50 text-neutral-950"
                : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300")
          }
        >
          <div className="flex items-start justify-between gap-2">
            <b className="text-[12px] leading-4">{ingredient.name}</b>
            <span
              className={
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black " +
                (active
                  ? "bg-[var(--brand-red)] text-white"
                  : isDark
                    ? "border border-white/20 text-white/40"
                    : "border border-neutral-300 text-neutral-400")
              }
            >
              {active ? "✓" : "+"}
            </span>
          </div>
          <span
            className={
              "mt-1 block text-[10px] font-semibold " +
              (isDark ? "text-white/42" : "text-neutral-500")
            }
          >
            + {money(ingredient.basePrice)}
          </span>
        </button>
      );
    };

    const normalizedQuery = ingredientQuery
      .trim()
      .toLocaleLowerCase("es");
    const matchingIngredients = normalizedQuery
      ? catalog.modifiers.filter((ingredient) =>
          ingredient.name.toLocaleLowerCase("es").includes(normalizedQuery),
        )
      : catalog.modifiers;

    const visibleIngredients =
      ingredientGroupFilter === "ALL"
        ? matchingIngredients
        : ingredientGroupFilter === "UNGROUPED"
          ? matchingIngredients.filter(
              (ingredient) => !ingredient.ingredientGroupId,
            )
          : matchingIngredients.filter(
              (ingredient) =>
                ingredient.ingredientGroupId === ingredientGroupFilter,
            );

    return (
      <div>
        <label className="mb-3 block">
          <span className="sr-only">Buscar ingrediente</span>
          <input
            value={ingredientQuery}
            onChange={(event) => setIngredientQuery(event.target.value)}
            placeholder="Buscar ingrediente..."
            className={
              "h-11 w-full rounded-[14px] border px-4 text-[12px] outline-none transition " +
              (isDark
                ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/25 focus:border-red-400/50"
                : "border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400")
            }
          />
        </label>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIngredientGroupFilter("ALL")}
            className={
              "rounded-full border px-3 py-2 text-[10px] font-bold transition " +
              (ingredientGroupFilter === "ALL"
                ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white"
                : isDark
                  ? "border-white/10 bg-white/[0.04] text-white/60"
                  : "border-neutral-200 bg-white text-neutral-600")
            }
          >
            Todos · {catalog.modifiers.length}
          </button>

          {ingredientGroups.map((group) => {
            const count = catalog.modifiers.filter(
              (ingredient) => ingredient.ingredientGroupId === group.id,
            ).length;
            return (
              <button
                type="button"
                key={group.id}
                onClick={() => setIngredientGroupFilter(group.id)}
                className={
                  "rounded-full border px-3 py-2 text-[10px] font-bold transition " +
                  (ingredientGroupFilter === group.id
                    ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white"
                    : isDark
                      ? "border-white/10 bg-white/[0.04] text-white/60"
                      : "border-neutral-200 bg-white text-neutral-600")
                }
              >
                {group.name} · {count}
              </button>
            );
          })}

          {hasUngroupedIngredients && (
            <button
              type="button"
              onClick={() => setIngredientGroupFilter("UNGROUPED")}
              className={
                "rounded-full border px-3 py-2 text-[10px] font-bold transition " +
                (ingredientGroupFilter === "UNGROUPED"
                  ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white"
                  : isDark
                    ? "border-white/10 bg-white/[0.04] text-white/60"
                    : "border-neutral-200 bg-white text-neutral-600")
              }
            >
              Sin categoría ·{" "}
              {
                catalog.modifiers.filter(
                  (ingredient) => !ingredient.ingredientGroupId,
                ).length
              }
            </button>
          )}
        </div>

        {ingredientGroupFilter === "ALL" ? (
          <div className="space-y-5">
            {ingredientGroups.map((group) => {
              const ingredients = matchingIngredients.filter(
                (ingredient) => ingredient.ingredientGroupId === group.id,
              );
              if (!ingredients.length) return null;
              return (
                <section key={group.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.08em]">
                      {group.name}
                    </h4>
                    <span className={"text-[9px] " + muted}>
                      {ingredients.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {ingredients.map(ingredientButton)}
                  </div>
                </section>
              );
            })}

            {hasUngroupedIngredients && (
              <section>
                <h4 className="mb-2 text-[11px] font-black uppercase tracking-[0.08em]">
                  Sin categoría
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {matchingIngredients
                    .filter((ingredient) => !ingredient.ingredientGroupId)
                    .map(ingredientButton)}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleIngredients.map(ingredientButton)}
          </div>
        )}

        {matchingIngredients.length === 0 && (
          <p className={"mt-3 rounded-xl border px-3 py-3 text-[11px] " + (isDark ? "border-white/10 bg-white/[0.03] text-white/40" : "border-neutral-200 bg-neutral-50 text-neutral-500")}>
            No encontramos ingredientes con esa búsqueda.
          </p>
        )}
      </div>
    );
  }

  const currentTitle = steps[step] ?? steps[0];
  const finalStep = step === steps.length - 1;
  const ready = Boolean(draft.sizeId && draft.crustId && draft.mode);

  const shell = isDark
    ? "border-white/[0.12] bg-[radial-gradient(circle_at_82%_0%,rgba(226,26,34,.12),transparent_24%),linear-gradient(180deg,#111214_0%,#0d0e10_100%)] text-white"
    : "border-neutral-200 bg-[#f7f5f2] text-neutral-950";
  const muted = isDark ? "text-white/40" : "text-neutral-500";
  const card = isDark
    ? "border-white/10 bg-white/[0.04]"
    : "border-neutral-200 bg-white";

  return (
    <div
      className="fixed inset-0 z-[175] flex items-end justify-center bg-black/78 backdrop-blur-[6px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={
          "flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-[30px] border shadow-[0_30px_90px_rgba(0,0,0,.48)] sm:max-w-[780px] sm:rounded-[30px] " +
          shell
        }
      >
        <header
          className={
            "shrink-0 border-b px-5 pb-4 pt-5 sm:px-6 " +
            (isDark ? "border-white/10" : "border-neutral-200 bg-white")
          }
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--brand-red)]">
                Arma Tu Pizza
              </p>
              <h2 className="mt-1 text-[24px] font-black tracking-[-0.035em]">
                {product.name}
              </h2>
              <p className={"mt-1 text-[10px] " + muted}>
                Paso {step + 1} de {steps.length} · {currentTitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={
                "h-10 rounded-xl border px-3 text-[11px] font-bold " +
                (isDark
                  ? "border-white/10 bg-white/[0.05] text-white/70"
                  : "border-neutral-200 bg-white text-neutral-600")
              }
            >
              Cerrar
            </button>
          </div>

          <div className="mt-4 grid gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((title, index) => (
              <button
                type="button"
                key={title}
                onClick={() => {
                  if (index <= step) goToStep(index);
                }}
                className={
                  "h-1.5 rounded-full transition " +
                  (index <= step
                    ? "bg-[var(--brand-red)]"
                    : isDark
                      ? "bg-white/10"
                      : "bg-neutral-200")
                }
                aria-label={title}
              />
            ))}
          </div>
        </header>

        <div
          ref={contentRef}
          className="alento-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6"
        >
          <div>
            <h3 className="text-[23px] font-black tracking-[-0.03em]">
              {step === 0
                ? "Elige el tamaño"
                : step === 1
                  ? "Elige tu borde"
                  : step === 2
                    ? "¿Completa o mitad y mitad?"
                    : draft.mode === "HALF_HALF"
                      ? step === 3
                        ? "Ingredientes de la primera mitad"
                        : "Ingredientes de la segunda mitad"
                      : "Elige los ingredientes"}
            </h3>
            <p className={"mt-1.5 text-[11px] " + muted}>
              {step >= 3
                ? "El valor mostrado es el precio real de cada ingrediente. Puedes elegir los que quieras."
                : step === 2
                  ? "La forma de cobro cambia automáticamente según tu elección."
                  : "Usamos los tamaños y bordes ya configurados en Alentó."}
            </p>
          </div>

          <div className="mt-5">
            {step === 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {catalog.sizes.map((size) => (
                  <button
                    type="button"
                    key={size.id}
                    onClick={() => setSize(size.id)}
                    className={
                      "rounded-[15px] border p-3 text-left transition " +
                      (draft.sizeId === size.id
                        ? "border-[var(--brand-red)] bg-red-500/15 text-white shadow-[0_0_0_1px_rgba(239,68,68,.12)]"
                        : card)
                    }
                  >
                    <b className="block text-[13px]">{size.name}</b>
                    <span className={"mt-1 block text-[10px] " + (draft.sizeId === size.id ? "text-red-100/75" : muted)}>
                      {size.diameterCm} cm
                      {pricingMode === "operator"
                        ? ` · ${money(size.basePrice)}`
                        : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {catalog.crusts.map((crust) => {
                  const priceForSize = pizzaCrustPrice(
                    crust,
                    draft.sizeId,
                  );
                  const unavailable = priceForSize == null;
                  const selected = draft.crustId === crust.id;
                  return (
                    <button
                      type="button"
                      key={crust.id}
                      disabled={unavailable}
                      onClick={() =>
                        setDraft({ ...draft, crustId: crust.id })
                      }
                      className={
                        "rounded-[15px] border p-3 text-left transition " +
                        (selected
                          ? "border-[var(--brand-red)] bg-red-500/15 text-white shadow-[0_0_0_1px_rgba(239,68,68,.12)]"
                          : unavailable
                            ? isDark
                              ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20"
                              : "cursor-not-allowed border-neutral-100 bg-neutral-100 text-neutral-300"
                            : card)
                      }
                    >
                      <b className="block text-[13px]">{crust.name}</b>
                      <span className={"mt-1 block text-[10px] " + (selected ? "text-red-100/75" : muted)}>
                        {unavailable
                          ? "No disponible"
                          : priceForSize === 0
                            ? "Incluido"
                            : "+ " + money(priceForSize)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  [
                    "WHOLE",
                    "Pizza completa",
                    "Los ingredientes elegidos van en toda la pizza.",
                  ],
                  [
                    "HALF_HALF",
                    "Mitad y mitad",
                    "Elige ingredientes diferentes para cada mitad.",
                  ],
                ] as Array<[CustomPizzaMode, string, string]>).map(
                  ([mode, title, description]) => {
                    const selected = draft.mode === mode;
                    return (
                      <button
                        type="button"
                        key={mode}
                        onClick={() => {
                          setDraft({ ...draft, mode });
                          setError("");
                        }}
                        className={
                          "rounded-[18px] border p-4 text-left transition " +
                          (selected
                            ? "border-[var(--brand-red)] bg-red-500/10"
                            : card)
                        }
                      >
                        <div className="flex items-center justify-between gap-3">
                          <b className="text-[16px]">{title}</b>
                          <span
                            className={
                              "flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-black " +
                              (selected
                                ? "bg-[var(--brand-red)] text-white"
                                : isDark
                                  ? "border border-white/20 text-white/30"
                                  : "border border-neutral-300 text-neutral-400")
                            }
                          >
                            {selected ? "✓" : ""}
                          </span>
                        </div>
                        <p className={"mt-2 text-[11px] leading-5 " + muted}>
                          {description}
                        </p>
                      </button>
                    );
                  },
                )}
              </div>
            )}

            {step >= 3 &&
              (draft.mode === "WHOLE"
                ? ingredientGrid("wholeIngredientIds")
                : step === 3
                  ? ingredientGrid("firstHalfIngredientIds")
                  : ingredientGrid("secondHalfIngredientIds"))}
          </div>

          <div
            className={
              "mt-5 rounded-[17px] border p-4 " +
              (isDark
                ? "border-white/10 bg-white/[0.035]"
                : "border-neutral-200 bg-white")
            }
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <span className={"block text-[9px] font-bold uppercase " + muted}>
                  Tamaño
                </span>
                <b className="mt-1 block text-[11px]">
                  {selectedSize?.name ?? "Pendiente"}
                </b>
              </div>
              <div>
                <span className={"block text-[9px] font-bold uppercase " + muted}>
                  Borde
                </span>
                <b className="mt-1 block text-[11px]">
                  {selectedCrust?.name ?? "Pendiente"}
                </b>
              </div>
              <div>
                <span className={"block text-[9px] font-bold uppercase " + muted}>
                  Forma
                </span>
                <b className="mt-1 block text-[11px]">
                  {draft.mode === "WHOLE"
                    ? "Completa"
                    : draft.mode === "HALF_HALF"
                      ? "Mitad y mitad"
                      : "Pendiente"}
                </b>
              </div>
              <div>
                <span className={"block text-[9px] font-bold uppercase " + muted}>
                  Ingredientes
                </span>
                <b className="mt-1 block text-[11px]">
                  {billableCount}
                </b>
              </div>
            </div>

            {draft.mode === "HALF_HALF" && (
              <p className={"mt-3 text-[10px] leading-4 " + muted}>
                Mitad 1: {draft.firstHalfIngredientIds.length} · Mitad 2:{" "}
                {draft.secondHalfIngredientIds.length}. Se cobra la mitad con
                más ingredientes.
              </p>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-500">
              {error}
            </p>
          )}
        </div>

        <footer
          className={
            "shrink-0 border-t px-5 py-4 sm:px-6 " +
            (isDark
              ? "border-white/10 bg-black/30"
              : "border-neutral-200 bg-white")
          }
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <span className={"block text-[9px] font-bold uppercase " + muted}>
                {showCustomerPrice
                  ? "Precio de tu pizza"
                  : "Tu precio se calcula al armarla"}
              </span>
              <b
                className={
                  "mt-1 block font-black tracking-[-0.03em] " +
                  (showCustomerPrice
                    ? "text-[24px] text-[var(--brand-red)]"
                    : "max-w-[190px] text-[12px] leading-4 " + muted)
                }
              >
                {showCustomerPrice
                  ? draft.sizeId
                    ? money(price)
                    : "—"
                  : "Elige tus ingredientes y verás el total aquí."}
              </b>
            </div>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => goToStep(step - 1)}
                  className={
                    "h-11 rounded-xl border px-4 text-[11px] font-bold " +
                    (isDark
                      ? "border-white/10 bg-white/[0.04] text-white/65"
                      : "border-neutral-200 bg-white text-neutral-600")
                  }
                >
                  ← Atrás
                </button>
              )}
              {finalStep ? (
                <button
                  type="button"
                  disabled={!ready}
                  onClick={confirm}
                  className="h-11 rounded-xl bg-[var(--brand-red)] px-5 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {actionLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={next}
                  className="h-11 rounded-xl bg-[var(--brand-red)] px-5 text-[11px] font-black text-white"
                >
                  Siguiente →
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
