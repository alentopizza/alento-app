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

type DoughBatch = {
  id: string;
  createdAt: string;
  counts: DoughCounts;
  totalGrams: number;
  ingredients: DoughIngredients;
  status: "PENDING" | "READY";
};

const STORAGE_KEY = "alento-dough-preparations-v1";

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

const RECIPE = {
  hydration: 0.58,
  adn: 0.05,
  sugar: 0.02,
  salt: 0.01,
  yeast: 0.005,
};

const RECIPE_FACTOR =
  1 +
  RECIPE.hydration +
  RECIPE.adn +
  RECIPE.sugar +
  RECIPE.salt +
  RECIPE.yeast;

const EMPTY_COUNTS: DoughCounts = {
  personal: 0,
  mediana: 0,
  grande: 0,
  extra: 0,
};

function formatGrams(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(Math.round(value * 10) / 10) ? 0 : 1,
  }).format(Math.round(value * 10) / 10);
}

function formatKg(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
  }).format(value / 1000);
}

function batchTime(value: string) {
  return new Date(value).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function calculateIngredients(totalGrams: number): DoughIngredients {
  const flour = totalGrams / RECIPE_FACTOR;

  return {
    flour,
    water: flour * RECIPE.hydration,
    adn: flour * RECIPE.adn,
    sugar: flour * RECIPE.sugar,
    salt: flour * RECIPE.salt,
    yeast: flour * RECIPE.yeast,
  };
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
        accent
          ? "border-red-200 bg-red-50/70"
          : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xl" aria-hidden="true">
          {icon}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            accent
              ? "bg-[var(--brand-red)] text-white"
              : "bg-neutral-100 text-neutral-500"
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

export default function DoughPreparationPage() {
  const [counts, setCounts] = useState<DoughCounts>(EMPTY_COUNTS);
  const [batches, setBatches] = useState<DoughBatch[]>([]);
  const [message, setMessage] = useState("");
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setBatches(parsed.slice(0, 12));
        }
      }
    } catch {
      // Si el historial local no está disponible, el calculador sigue funcionando.
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(batches.slice(0, 12)));
    } catch {
      // El historial es una mejora de conveniencia; no bloquea la preparación.
    }
  }, [batches, storageReady]);

  const totalBalls = useMemo(
    () => PIZZA_SIZES.reduce((sum, size) => sum + counts[size.key], 0),
    [counts],
  );

  const totalGrams = useMemo(
    () =>
      PIZZA_SIZES.reduce(
        (sum, size) => sum + counts[size.key] * size.weight,
        0,
      ),
    [counts],
  );

  const previewIngredients = useMemo(
    () => calculateIngredients(totalGrams),
    [totalGrams],
  );

  function updateCount(key: PizzaKey, value: number) {
    const next = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    setCounts((current) => ({ ...current, [key]: next }));
    setMessage("");
  }

  function submitPreparation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (totalBalls <= 0 || totalGrams <= 0) {
      setMessage("Agrega por lo menos una bola para crear la preparación.");
      return;
    }

    const batch: DoughBatch = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      counts: { ...counts },
      totalGrams,
      ingredients: calculateIngredients(totalGrams),
      status: "PENDING",
    };

    setBatches((current) => [batch, ...current].slice(0, 12));
    setCounts({ ...EMPTY_COUNTS });
    setMessage("Preparación creada. La tarjeta quedó lista para cocina.");
  }

  function toggleReady(id: string) {
    setBatches((current) =>
      current.map((batch) =>
        batch.id === id
          ? {
              ...batch,
              status: batch.status === "READY" ? "PENDING" : "READY",
            }
          : batch,
      ),
    );
  }

  function removeBatch(id: string) {
    setBatches((current) => current.filter((batch) => batch.id !== id));
  }

  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-[1380px] space-y-5">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-500">
              Producción · Cocina
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-neutral-950">
              Preparar masa
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
              Define cuántas bolas necesitas y genera una ficha de pesaje con la
              fórmula oficial de Alentó Pizza.
            </p>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-700">
            <span className="h-2 w-2 rounded-full bg-[var(--brand-red)] shadow-[0_0_12px_rgba(229,28,17,.55)]" />
            Fórmula oficial · 58% hidratación
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
          <section className="space-y-5">
            <form
              onSubmit={submitPreparation}
              className="alento-card overflow-hidden rounded-[28px]"
            >
              <div className="border-b border-neutral-200 bg-white px-5 py-5 md:px-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                  01 · Carga de producción
                </p>
                <h2 className="mt-1 text-xl font-black text-neutral-950">
                  ¿Cuántas bolas vas a preparar?
                </h2>
              </div>

              <div className="space-y-3 p-5 md:p-6">
                {PIZZA_SIZES.map((size) => (
                  <div
                    key={size.key}
                    className="grid gap-3 rounded-[20px] border border-neutral-200 bg-[#faf9f7] p-4 sm:grid-cols-[1fr_150px] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-[15px] font-black text-neutral-950">
                          {size.label}
                        </b>
                        <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-bold text-neutral-500">
                          {size.diameter} cm
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs font-semibold text-neutral-500">
                        Bola estándar · {size.weight} g
                      </p>
                    </div>

                    <div className="grid grid-cols-[38px_1fr_38px] items-center overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                      <button
                        type="button"
                        onClick={() =>
                          updateCount(size.key, counts[size.key] - 1)
                        }
                        className="h-11 border-r border-neutral-200 text-lg font-black text-neutral-500 hover:bg-neutral-50"
                        aria-label={`Restar bola ${size.label}`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={counts[size.key]}
                        onChange={(event) =>
                          updateCount(size.key, Number(event.target.value))
                        }
                        className="h-11 min-w-0 border-0 bg-transparent px-2 text-center text-[16px] font-black tabular-nums text-neutral-950 outline-none"
                        aria-label={`Cantidad de bolas ${size.label}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateCount(size.key, counts[size.key] + 1)
                        }
                        className="h-11 border-l border-neutral-200 text-lg font-black text-neutral-700 hover:bg-neutral-50"
                        aria-label={`Agregar bola ${size.label}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-neutral-200 bg-neutral-950 p-5 text-white md:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                      Bolas solicitadas
                    </p>
                    <p className="mt-1 text-2xl font-black tabular-nums">
                      {totalBalls}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                      Masa total
                    </p>
                    <p className="mt-1 text-2xl font-black tabular-nums">
                      {formatKg(totalGrams)} kg
                    </p>
                  </div>
                </div>

                {totalGrams > 0 && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-xs leading-5 text-white/70">
                    Vista previa:{" "}
                    <b className="text-white">
                      {formatGrams(previewIngredients.flour)} g harina
                    </b>{" "}
                    + {formatGrams(previewIngredients.water)} g agua +{" "}
                    {formatGrams(previewIngredients.adn)} g ADN.
                  </div>
                )}

                <button
                  type="submit"
                  className="mt-4 w-full rounded-2xl bg-[var(--brand-red)] px-5 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(229,28,17,.28)] hover:bg-[var(--brand-red-dark)]"
                >
                  Crear preparación
                </button>

                {message && (
                  <p className="mt-3 text-center text-xs font-semibold text-white/70">
                    {message}
                  </p>
                )}
              </div>
            </form>

            <section className="alento-dark rounded-[28px] p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                    02 · ADN de la masa
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    Fórmula oficial Alentó
                  </h2>
                </div>
                <span className="rounded-full border border-red-400/30 bg-red-500/15 px-3 py-1.5 text-[10px] font-black text-red-200">
                  FIJA
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ["Agua", "58%"],
                  ["ADN", "5%"],
                  ["Azúcar", "2%"],
                  ["Sal", "1%"],
                  ["Levadura", "0.5%"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-3 text-center"
                  >
                    <span className="block text-[10px] font-bold uppercase text-white/40">
                      {label}
                    </span>
                    <b className="mt-1 block text-[17px] font-black text-white">
                      {value}
                    </b>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[20px] border border-red-400/20 bg-red-500/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-200">
                  ADN Alentó
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-white">
                  1.000 ml de aceite de oliva + 12 g de ajo en polvo + 18 g de
                  orégano en polvo.
                </p>
              </div>

              <p className="mt-4 text-xs leading-5 text-white/50">
                Todos los porcentajes se calculan sobre el peso de harina. La
                fórmula total equivale a 166.5% y el sistema despeja la harina a
                partir del peso final de las bolas.
              </p>
            </section>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                  03 · Fichas de cocina
                </p>
                <h2 className="mt-1 text-xl font-black text-neutral-950">
                  Preparaciones creadas
                </h2>
              </div>
              {batches.length > 0 && (
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-500">
                  {batches.length} activas
                </span>
              )}
            </div>

            {batches.length === 0 ? (
              <div className="alento-card rounded-[28px] p-8 text-center md:p-12">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-950 text-2xl text-white">
                  ◌
                </div>
                <h3 className="mt-4 text-lg font-black text-neutral-950">
                  Aún no hay preparaciones
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
                  Indica las cantidades de cada tamaño y crea la primera ficha de
                  pesaje para cocina.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {batches.map((batch, index) => {
                  const sum =
                    batch.ingredients.flour +
                    batch.ingredients.water +
                    batch.ingredients.adn +
                    batch.ingredients.sugar +
                    batch.ingredients.salt +
                    batch.ingredients.yeast;
                  const balls = PIZZA_SIZES.reduce(
                    (total, size) => total + batch.counts[size.key],
                    0,
                  );
                  const ready = batch.status === "READY";

                  return (
                    <article
                      key={batch.id}
                      className={`overflow-hidden rounded-[28px] border bg-white shadow-[0_18px_55px_rgba(22,20,18,.07)] ${
                        ready
                          ? "border-emerald-200"
                          : "border-neutral-200"
                      }`}
                    >
                      <div
                        className={`px-5 py-4 text-white md:px-6 ${
                          ready
                            ? "bg-emerald-700"
                            : "bg-[linear-gradient(135deg,#0b0b0c_0%,#19191b_72%,#3a0b09_100%)]"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                              Preparación #{String(batches.length - index).padStart(2, "0")}
                            </p>
                            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <h3 className="text-xl font-black">
                                {formatKg(batch.totalGrams)} kg de masa
                              </h3>
                              <span className="text-xs font-semibold text-white/55">
                                {balls} bolas · {batchTime(batch.createdAt)}
                              </span>
                            </div>
                          </div>
                          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em]">
                            {ready ? "Preparada" : "Por preparar"}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {PIZZA_SIZES.filter(
                            (size) => batch.counts[size.key] > 0,
                          ).map((size) => (
                            <span
                              key={size.key}
                              className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-[11px] font-bold text-white/80"
                            >
                              {batch.counts[size.key]}× {size.label} · {size.weight} g
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
                            grams={batch.ingredients.flour}
                          />
                          <IngredientTile
                            icon="💧"
                            name="Agua fría"
                            percentage="58%"
                            grams={batch.ingredients.water}
                          />
                          <IngredientTile
                            icon="🌿"
                            name="ADN de sabor"
                            percentage="5%"
                            grams={batch.ingredients.adn}
                          />
                          <IngredientTile
                            icon="🍬"
                            name="Azúcar"
                            percentage="2%"
                            grams={batch.ingredients.sugar}
                          />
                          <IngredientTile
                            icon="🧂"
                            name="Sal"
                            percentage="1%"
                            grams={batch.ingredients.salt}
                          />
                          <IngredientTile
                            icon="🧪"
                            name="Levadura seca activa"
                            percentage="0.5%"
                            grams={batch.ingredients.yeast}
                            accent
                          />
                        </div>

                        <div className="mt-4 flex flex-col gap-3 rounded-[18px] border border-neutral-200 bg-[#faf9f7] p-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                              Comprobación de masa
                            </p>
                            <p className="mt-1 text-sm font-black text-neutral-950">
                              {formatGrams(sum)} g calculados = {formatGrams(batch.totalGrams)} g solicitados
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => toggleReady(batch.id)}
                              className={`rounded-xl px-4 py-2.5 text-xs font-black ${
                                ready
                                  ? "border border-neutral-200 bg-white text-neutral-700"
                                  : "bg-emerald-600 text-white"
                              }`}
                            >
                              {ready ? "Reabrir" : "Marcar preparada"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeBatch(batch.id)}
                              className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-black text-red-600"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 rounded-[18px] border border-red-100 bg-red-50/70 px-4 py-3 text-xs font-semibold leading-5 text-red-800">
                          ADN Alentó: 1.000 ml de aceite de oliva + 12 g de ajo en
                          polvo + 18 g de orégano en polvo.
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
