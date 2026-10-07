"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type PizzaKey = "personal" | "mediana" | "grande" | "extra";

type DoughCounts = Record<PizzaKey, number>;

type DoughIngredients = {
  flour: number;
  water: number;
  adn: number;
  sugar: number;
  salt: number;
  yeast: number;
};

type DoughPreparation = {
  id: number;
  createdAt: string;
  createdByName: string;
  counts: DoughCounts;
  totalBalls: number;
  totalWeightGrams: number;
  formula: {
    hydrationPct: number;
    adnPct: number;
    sugarPct: number;
    saltPct: number;
    yeastPct: number;
  };
  ingredients: DoughIngredients;
};

const PIZZA_SIZES: Array<{
  key: PizzaKey;
  label: string;
  diameter: number;
  weight: number;
}> = [
  { key: "personal", label: "Personal", diameter: 20, weight: 190 },
  { key: "mediana", label: "Mediana", diameter: 27, weight: 345 },
  { key: "grande", label: "Grande", diameter: 36, weight: 610 },
  { key: "extra", label: "Extra grande", diameter: 41, weight: 790 },
];

const EMPTY_COUNTS: DoughCounts = {
  personal: 0,
  mediana: 0,
  grande: 0,
  extra: 0,
};

const DOUGH_RECIPE = {
  hydration: 0.58,
  adn: 0.05,
  sugar: 0.02,
  salt: 0.01,
  yeast: 0.005,
};

const DOUGH_FACTOR =
  1 +
  DOUGH_RECIPE.hydration +
  DOUGH_RECIPE.adn +
  DOUGH_RECIPE.sugar +
  DOUGH_RECIPE.salt +
  DOUGH_RECIPE.yeast;

function formatGrams(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 1,
  }).format(rounded);
}

function formatKg(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
  }).format(value / 1000);
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function IngredientTile({
  icon,
  name,
  percentage,
  grams,
  accent = false,
}: {
  icon: string;
  name: string;
  percentage: string;
  grams: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[18px] border p-4 shadow-[0_8px_22px_rgba(22,20,18,.04)] ${
        accent ? "border-red-200 bg-red-50/70" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xl" aria-hidden="true">{icon}</span>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            accent ? "bg-[var(--brand-red)] text-white" : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {percentage}
        </span>
      </div>
      <p
        className={`mt-3 text-[11px] font-bold uppercase tracking-[0.08em] ${
          accent ? "text-red-700" : "text-neutral-400"
        }`}
      >
        {name}
      </p>
      <div
        className={`mt-1 text-[24px] font-black tracking-[-0.04em] ${
          accent ? "text-[var(--brand-red)]" : "text-neutral-950"
        }`}
      >
        {formatGrams(grams)}
        <span className="ml-1 text-xs font-bold text-neutral-400">g</span>
      </div>
    </div>
  );
}

export default function PreparationPage() {
  const [counts, setCounts] = useState<DoughCounts>(EMPTY_COUNTS);
  const [preparations, setPreparations] = useState<DoughPreparation[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPreparation, setEditingPreparation] =
    useState<DoughPreparation | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const totalBalls = useMemo(
    () => PIZZA_SIZES.reduce((sum, size) => sum + counts[size.key], 0),
    [counts],
  );

  const totalWeightGrams = useMemo(
    () =>
      PIZZA_SIZES.reduce(
        (sum, size) => sum + counts[size.key] * size.weight,
        0,
      ),
    [counts],
  );

  const liveIngredients = useMemo<DoughIngredients>(() => {
    if (totalWeightGrams <= 0) {
      return {
        flour: 0,
        water: 0,
        adn: 0,
        sugar: 0,
        salt: 0,
        yeast: 0,
      };
    }

    const flour = totalWeightGrams / DOUGH_FACTOR;

    return {
      flour,
      water: flour * DOUGH_RECIPE.hydration,
      adn: flour * DOUGH_RECIPE.adn,
      sugar: flour * DOUGH_RECIPE.sugar,
      salt: flour * DOUGH_RECIPE.salt,
      yeast: flour * DOUGH_RECIPE.yeast,
    };
  }, [totalWeightGrams]);

  const liveIngredientSum = useMemo(
    () =>
      liveIngredients.flour +
      liveIngredients.water +
      liveIngredients.adn +
      liveIngredients.sugar +
      liveIngredients.salt +
      liveIngredients.yeast,
    [liveIngredients],
  );

  async function loadPreparations() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/dough-preparations", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible cargar las preparaciones.");
      }
      setPreparations(Array.isArray(data.preparations) ? data.preparations : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar las preparaciones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPreparations();
  }, []);

  function updateCount(key: PizzaKey, value: number) {
    const next = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    setCounts((current) => ({ ...current, [key]: next }));
  }

  function openNewPreparation() {
    setEditingPreparation(null);
    setCounts({ ...EMPTY_COUNTS });
    setError("");
    setFormOpen(true);
  }

  function openEditPreparation(preparation: DoughPreparation) {
    setEditingPreparation(preparation);
    setCounts({ ...preparation.counts });
    setError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditingPreparation(null);
    setCounts({ ...EMPTY_COUNTS });
    setError("");
  }

  async function submitPreparation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (totalBalls <= 0) {
      setError("Agrega por lo menos una bola para guardar la preparación.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        editingPreparation
          ? `/api/dough-preparations?id=${editingPreparation.id}`
          : "/api/dough-preparations",
        {
          method: editingPreparation ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(counts),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible guardar la preparación.");
      }

      setPreparations((current) =>
        editingPreparation
          ? current.map((item) =>
              item.id === editingPreparation.id ? data.preparation : item,
            )
          : [data.preparation, ...current],
      );
      setCounts({ ...EMPTY_COUNTS });
      setEditingPreparation(null);
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible guardar la preparación.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePreparation(preparation: DoughPreparation) {
    const confirmed = window.confirm(
      `¿Eliminar la preparación #${String(preparation.id).padStart(4, "0")}? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setDeletingId(preparation.id);
    setError("");

    try {
      const response = await fetch(
        `/api/dough-preparations?id=${preparation.id}`,
        { method: "DELETE" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible eliminar la preparación.");
      }

      setPreparations((current) =>
        current.filter((item) => item.id !== preparation.id),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible eliminar la preparación.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-[1380px] space-y-5">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-500">Producción</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-neutral-950">
              Preparación
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
              Historial de preparaciones de masa con la fórmula oficial de Alentó.
            </p>
          </div>

          <button
            type="button"
            onClick={openNewPreparation}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-red)] px-5 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(229,28,17,.24)] hover:bg-[var(--brand-red-dark)]"
          >
            <span className="text-lg leading-none">+</span>
            Nueva preparación
          </button>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PIZZA_SIZES.map((size) => (
            <div key={size.key} className="alento-card rounded-[22px] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-400">
                {size.label}
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <b className="text-[24px] font-black tracking-[-0.04em] text-neutral-950">
                  {size.weight} g
                </b>
                <span className="rounded-full border border-neutral-200 bg-[#faf9f7] px-2.5 py-1 text-[10px] font-bold text-neutral-500">
                  {size.diameter} cm
                </span>
              </div>
            </div>
          ))}
        </section>

        {error && !formOpen && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                Historial
              </p>
              <h2 className="mt-1 text-xl font-black text-neutral-950">
                Preparaciones guardadas
              </h2>
            </div>
            {!loading && (
              <span className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-500">
                {preparations.length} registros
              </span>
            )}
          </div>

          {loading ? (
            <div className="alento-card rounded-[28px] p-8 text-sm font-semibold text-neutral-500">
              Cargando preparaciones...
            </div>
          ) : preparations.length === 0 ? (
            <div className="alento-card rounded-[28px] p-8 text-center md:p-12">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-950 text-2xl text-white">
                ◌
              </div>
              <h3 className="mt-4 text-lg font-black text-neutral-950">
                Aún no hay preparaciones
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
                Usa el botón + Nueva preparación para crear el primer registro de producción.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {preparations.map((preparation) => {
                const ingredientSum =
                  preparation.ingredients.flour +
                  preparation.ingredients.water +
                  preparation.ingredients.adn +
                  preparation.ingredients.sugar +
                  preparation.ingredients.salt +
                  preparation.ingredients.yeast;

                return (
                  <article
                    key={preparation.id}
                    className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_18px_55px_rgba(22,20,18,.07)]"
                  >
                    <div className="bg-[linear-gradient(135deg,#0b0b0c_0%,#19191b_72%,#3a0b09_100%)] px-5 py-5 text-white md:px-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                            Preparación #{String(preparation.id).padStart(4, "0")}
                          </p>
                          <h3 className="mt-1 text-2xl font-black tracking-[-0.035em]">
                            {formatKg(preparation.totalWeightGrams)} kg de masa
                          </h3>
                          <p className="mt-1 text-xs font-semibold text-white/50">
                            {dateTime(preparation.createdAt)} · {preparation.createdByName}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-red-300/20 bg-red-500/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-red-100">
                            {preparation.totalBalls} bolas
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditPreparation(preparation)}
                            disabled={deletingId === preparation.id}
                            className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-emerald-100 transition hover:border-emerald-300/30 hover:bg-emerald-400/20 disabled:opacity-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void deletePreparation(preparation)}
                            disabled={deletingId === preparation.id}
                            className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-white/70 transition hover:border-red-300/30 hover:bg-red-500/20 hover:text-red-100 disabled:cursor-wait disabled:opacity-50"
                          >
                            {deletingId === preparation.id ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {PIZZA_SIZES.filter((size) => preparation.counts[size.key] > 0).map((size) => (
                          <span
                            key={size.key}
                            className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-[11px] font-bold text-white/80"
                          >
                            {preparation.counts[size.key]}× {size.label} · {size.weight} g
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-5 md:p-6">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <IngredientTile
                          icon="🌾"
                          name="Harina"
                          percentage="100%"
                          grams={preparation.ingredients.flour}
                        />
                        <IngredientTile
                          icon="💧"
                          name="Agua fría"
                          percentage="58%"
                          grams={preparation.ingredients.water}
                        />
                        <IngredientTile
                          icon="🌿"
                          name="ADN de sabor"
                          percentage="5%"
                          grams={preparation.ingredients.adn}
                        />
                        <IngredientTile
                          icon="🍬"
                          name="Azúcar"
                          percentage="2%"
                          grams={preparation.ingredients.sugar}
                        />
                        <IngredientTile
                          icon="🧂"
                          name="Sal"
                          percentage="1%"
                          grams={preparation.ingredients.salt}
                        />
                        <IngredientTile
                          icon="🧪"
                          name="Levadura seca activa"
                          percentage="0.5%"
                          grams={preparation.ingredients.yeast}
                          accent
                        />
                      </div>

                      <div className="mt-4 rounded-[18px] border border-neutral-200 bg-[#faf9f7] px-4 py-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                              Comprobación de masa
                            </p>
                            <p className="mt-1 text-sm font-black text-neutral-950">
                              {formatGrams(ingredientSum)} g calculados = {formatGrams(preparation.totalWeightGrams)} g solicitados
                            </p>
                          </div>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700">
                            FÓRMULA 58 / 5 / 2 / 1 / 0.5
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 rounded-[18px] border border-red-100 bg-red-50/70 px-4 py-3 text-xs font-semibold leading-5 text-red-800">
                        ADN Alentó: 1.000 ml de aceite de oliva + 12 g de ajo en polvo + 18 g de orégano en polvo.
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <form
            onSubmit={submitPreparation}
            className="alento-card w-full max-w-5xl overflow-hidden rounded-[28px] bg-white"
          >
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-5 md:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                  {editingPreparation
                    ? `Editar preparación #${String(editingPreparation.id).padStart(4, "0")}`
                    : "Nueva preparación"}
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-neutral-950">
                  Cantidad de bolas y receta
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  La hidratación y los porcentajes de la receta son fijos.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-xl font-semibold text-neutral-500 hover:bg-neutral-50"
                aria-label="Cerrar formulario"
              >
                ×
              </button>
            </div>

            <div className="max-h-[68vh] space-y-4 overflow-y-auto p-5 md:p-6">
              {PIZZA_SIZES.map((size) => (
                <div
                  key={size.key}
                  className="grid gap-3 rounded-[20px] border border-neutral-200 bg-[#faf9f7] p-4 sm:grid-cols-[1fr_160px] sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-[15px] font-black text-neutral-950">{size.label}</b>
                      <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-bold text-neutral-500">
                        {size.diameter} cm
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-neutral-500">
                      Bola estándar · {size.weight} g
                    </p>
                  </div>

                  <div className="grid grid-cols-[40px_1fr_40px] items-center overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                    <button
                      type="button"
                      onClick={() => updateCount(size.key, counts[size.key] - 1)}
                      className="h-12 border-r border-neutral-200 text-lg font-black text-neutral-500 hover:bg-neutral-50"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={counts[size.key]}
                      onChange={(event) => updateCount(size.key, Number(event.target.value))}
                      className="h-12 min-w-0 border-0 bg-transparent px-2 text-center text-[16px] font-black tabular-nums text-neutral-950 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateCount(size.key, counts[size.key] + 1)}
                      className="h-12 border-l border-neutral-200 text-lg font-black text-neutral-700 hover:bg-neutral-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              <div className="grid gap-3 rounded-[20px] bg-neutral-950 p-4 text-white sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Total bolas</p>
                  <p className="mt-1 text-2xl font-black">{totalBalls}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Masa total</p>
                  <p className="mt-1 text-2xl font-black">{formatKg(totalWeightGrams)} kg</p>
                </div>
              </div>

              <section className="rounded-[22px] border border-neutral-200 bg-white p-4 shadow-[0_10px_28px_rgba(22,20,18,.05)]">
                <div className="flex flex-col gap-2 border-b border-neutral-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-emerald-600">
                      Cálculo en vivo
                    </p>
                    <h3 className="mt-1 text-[17px] font-black text-neutral-950">
                      Ingredientes necesarios
                    </h3>
                    <p className="mt-1 text-[10px] leading-4 text-neutral-500">
                      Se recalcula automáticamente mientras cambias la cantidad de bolas.
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[9px] font-black text-emerald-700">
                    {formatGrams(totalWeightGrams)} g de masa
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <IngredientTile
                    icon="🌾"
                    name="Harina"
                    percentage="100%"
                    grams={liveIngredients.flour}
                  />
                  <IngredientTile
                    icon="💧"
                    name="Agua fría"
                    percentage="58%"
                    grams={liveIngredients.water}
                  />
                  <IngredientTile
                    icon="🌿"
                    name="ADN de sabor"
                    percentage="5%"
                    grams={liveIngredients.adn}
                  />
                  <IngredientTile
                    icon="🍬"
                    name="Azúcar"
                    percentage="2%"
                    grams={liveIngredients.sugar}
                  />
                  <IngredientTile
                    icon="🧂"
                    name="Sal"
                    percentage="1%"
                    grams={liveIngredients.salt}
                  />
                  <IngredientTile
                    icon="🧪"
                    name="Levadura seca activa"
                    percentage="0.5%"
                    grams={liveIngredients.yeast}
                    accent
                  />
                </div>

                <div className="mt-3 rounded-[16px] border border-neutral-200 bg-[#faf9f7] px-4 py-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-400">
                      Comprobación
                    </span>
                    <b className="text-[11px] text-neutral-800">
                      {formatGrams(liveIngredientSum)} g calculados = {formatGrams(totalWeightGrams)} g solicitados
                    </b>
                  </div>
                </div>
              </section>

              <div className="rounded-[18px] border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-800">
                Fórmula fija: 58% agua · 5% ADN · 2% azúcar · 1% sal · 0.5% levadura.
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-[#faf9f7] px-5 py-4 md:px-6">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black text-neutral-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || totalBalls <= 0}
                className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 text-sm font-black text-white shadow-[0_10px_22px_rgba(229,28,17,.2)] disabled:bg-neutral-300 disabled:shadow-none"
              >
                {saving
                  ? editingPreparation
                    ? "Actualizando..."
                    : "Guardando..."
                  : editingPreparation
                    ? "Guardar cambios"
                    : "Guardar preparación"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
