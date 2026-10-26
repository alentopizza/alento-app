"use client";

import Link from "next/link";
import KitchenOrderAlerts from "@/components/KitchenOrderAlerts";
import { Circle, CircleCheck, Clock3, CookingPot, Pizza, Ruler, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  presentComboOrderConfiguration,
  presentOrderItemConfiguration,
} from "@/lib/orderPresentation";
import { orderCode } from "@/lib/orderCode";
import { ORDER_KITCHEN_LEAD_MS } from "@/lib/orderScheduling";
import { fulfillmentLabel, statusLabel, type FulfillmentType, type OrderStatus } from "@/lib/orderWorkflow";

type KitchenOrderItem = {
  id: number;
  productName: string;
  quantity: number;
  preparedQuantity: number;
  configuration: unknown;
  notes?: string | null;
  product?: {
    id: number;
    type: string;
    category?: { name: string; slug: string } | null;
  } | null;
};

type KitchenOrder = {
  id: number;
  sequenceNumber: number | null;
  source: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  createdAt: string;
  scheduledFor?: string | null;
  customer: { name: string } | null;
  items: KitchenOrderItem[];
};

function displayOrderCode(order: KitchenOrder) {
  return orderCode(order.sequenceNumber ?? order.id, order.source);
}

function kitchenEntryTime(order: KitchenOrder) {
  return order.scheduledFor
    ? new Date(order.scheduledFor).getTime() - ORDER_KITCHEN_LEAD_MS
    : new Date(order.createdAt).getTime();
}

function ageMinutes(order: KitchenOrder) {
  return Math.max(
    0,
    Math.floor((Date.now() - kitchenEntryTime(order)) / 60000),
  );
}

function scheduledLabel(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function isKitchenItem(item: KitchenOrderItem) {
  return item.product?.category?.slug !== "bebidas";
}

function kitchenPriority(item: KitchenOrderItem) {
  if (
    item.product?.type === "PIZZA_SINGLE" ||
    item.product?.type === "PIZZA_TWO_FLAVORS" ||
    item.product?.type === "PIZZA_CUSTOM"
  ) return 0;

  if (item.product?.type === "COMBO" && item.configuration && typeof item.configuration === "object" && !Array.isArray(item.configuration)) {
    const pizzas = (item.configuration as { pizzas?: unknown }).pizzas;
    if (Array.isArray(pizzas) && pizzas.length > 0) return 0;
    return 1;
  }

  if (item.product?.category?.slug === "antojos") return 1;
  return 2;
}

function kitchenItemsFor(order: KitchenOrder) {
  return order.items
    .filter(isKitchenItem)
    .sort((a, b) => kitchenPriority(a) - kitchenPriority(b) || a.id - b.id);
}

function sizeTone(value: string) {
  const normalized = value.toLocaleLowerCase("es");

  if (normalized.includes("personal")) {
    return {
      shell: "border-sky-200 bg-sky-50 text-sky-950",
      icon: "bg-sky-600 text-white",
      label: "text-sky-600",
    };
  }
  if (normalized.includes("mediana")) {
    return {
      shell: "border-emerald-200 bg-emerald-50 text-emerald-950",
      icon: "bg-emerald-600 text-white",
      label: "text-emerald-600",
    };
  }
  if (normalized.includes("grande")) {
    return {
      shell: "border-amber-200 bg-amber-50 text-amber-950",
      icon: "bg-amber-500 text-white",
      label: "text-amber-700",
    };
  }
  if (normalized.includes("extra")) {
    return {
      shell: "border-violet-200 bg-violet-50 text-violet-950",
      icon: "bg-violet-600 text-white",
      label: "text-violet-600",
    };
  }

  return {
    shell: "border-neutral-200 bg-white text-neutral-950",
    icon: "bg-neutral-900 text-white",
    label: "text-neutral-500",
  };
}

function crustTone(value: string) {
  const normalized = value.toLocaleLowerCase("es");

  if (normalized.includes("tradicional")) {
    return {
      shell: "border-neutral-300 bg-neutral-100 text-neutral-950",
      icon: "bg-neutral-800 text-white",
      label: "text-neutral-500",
    };
  }
  if (normalized.includes("mozzarella")) {
    return {
      shell: "border-yellow-300 bg-yellow-50 text-yellow-950",
      icon: "bg-yellow-500 text-yellow-950",
      label: "text-yellow-700",
    };
  }
  if (normalized.includes("bocadillo")) {
    return {
      shell: "border-rose-200 bg-rose-50 text-rose-950",
      icon: "bg-rose-500 text-white",
      label: "text-rose-600",
    };
  }
  if (normalized.includes("salchi")) {
    return {
      shell: "border-orange-200 bg-orange-50 text-orange-950",
      icon: "bg-orange-500 text-white",
      label: "text-orange-600",
    };
  }

  return {
    shell: "border-neutral-200 bg-white text-neutral-950",
    icon: "bg-neutral-900 text-white",
    label: "text-neutral-500",
  };
}

function KitchenSizeBadge({ value }: { value: string }) {
  const tone = sizeTone(value);

  return (
    <div
      className={`inline-flex min-h-[52px] min-w-[150px] items-center gap-2.5 rounded-[14px] border px-3 py-2 shadow-[0_4px_12px_rgba(28,23,20,.06)] ${tone.shell}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${tone.icon}`}
      >
        <Ruler className="h-4 w-4" strokeWidth={2.4} />
      </span>
      <span className="min-w-0">
        <span
          className={`block text-[8px] font-black uppercase tracking-[0.12em] ${tone.label}`}
        >
          Tamaño
        </span>
        <b className="mt-0.5 block truncate text-[13px] font-black uppercase leading-4 tracking-[-0.01em]">
          {value}
        </b>
      </span>
    </div>
  );
}

function KitchenCrustBadge({ value }: { value: string }) {
  const tone = crustTone(value);

  return (
    <div
      className={`inline-flex min-h-[52px] min-w-[150px] items-center gap-2.5 rounded-[14px] border px-3 py-2 shadow-[0_4px_12px_rgba(28,23,20,.06)] ${tone.shell}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.icon}`}
      >
        <Circle className="h-4 w-4" strokeWidth={2.6} />
      </span>
      <span className="min-w-0">
        <span
          className={`block text-[8px] font-black uppercase tracking-[0.12em] ${tone.label}`}
        >
          Borde
        </span>
        <b className="mt-0.5 block truncate text-[13px] font-black uppercase leading-4 tracking-[-0.01em]">
          {value}
        </b>
      </span>
    </div>
  );
}

function normalizeKitchenFlavor(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function flavorTone(value: string) {
  const normalized = normalizeKitchenFlavor(value);

  if (normalized.includes("paisa")) {
    return {
      shell: "border-amber-300 bg-amber-50 text-amber-950",
      icon: "bg-amber-500 text-white",
      label: "text-amber-700",
    };
  }
  if (normalized.includes("hawaiana")) {
    return {
      shell: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-950",
      icon: "bg-fuchsia-500 text-white",
      label: "text-fuchsia-600",
    };
  }
  if (normalized.includes("chicharrona")) {
    return {
      shell: "border-orange-300 bg-orange-50 text-orange-950",
      icon: "bg-orange-500 text-white",
      label: "text-orange-700",
    };
  }
  if (normalized.includes("napolitana")) {
    return {
      shell: "border-red-200 bg-red-50 text-red-950",
      icon: "bg-red-500 text-white",
      label: "text-red-600",
    };
  }
  if (normalized.includes("pollo") && normalized.includes("champ")) {
    return {
      shell: "border-teal-200 bg-teal-50 text-teal-950",
      icon: "bg-teal-600 text-white",
      label: "text-teal-700",
    };
  }
  if (normalized.includes("pepperoni")) {
    return {
      shell: "border-rose-300 bg-rose-50 text-rose-950",
      icon: "bg-rose-600 text-white",
      label: "text-rose-700",
    };
  }
  if (normalized.includes("tropical")) {
    return {
      shell: "border-pink-200 bg-pink-50 text-pink-950",
      icon: "bg-pink-500 text-white",
      label: "text-pink-600",
    };
  }
  if (normalized.includes("carnes")) {
    return {
      shell: "border-stone-300 bg-stone-100 text-stone-950",
      icon: "bg-stone-700 text-white",
      label: "text-stone-600",
    };
  }
  if (normalized.includes("criolla")) {
    return {
      shell: "border-yellow-300 bg-yellow-50 text-yellow-950",
      icon: "bg-yellow-500 text-yellow-950",
      label: "text-yellow-700",
    };
  }
  if (normalized.includes("vegetariana")) {
    return {
      shell: "border-lime-300 bg-lime-50 text-lime-950",
      icon: "bg-lime-600 text-white",
      label: "text-lime-700",
    };
  }
  if (normalized.includes("mexicana")) {
    return {
      shell: "border-red-300 bg-red-50 text-red-950",
      icon: "bg-red-700 text-white",
      label: "text-red-700",
    };
  }

  return {
    shell: "border-violet-200 bg-violet-50 text-violet-950",
    icon: "bg-violet-600 text-white",
    label: "text-violet-600",
  };
}

function KitchenFlavorBadge({
  value,
  label = "Sabor",
}: {
  value: string;
  label?: string;
}) {
  const tone = flavorTone(value);

  return (
    <div
      className={`inline-flex min-h-[52px] min-w-[150px] items-center gap-2.5 rounded-[14px] border px-3 py-2 shadow-[0_4px_12px_rgba(28,23,20,.06)] ${tone.shell}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${tone.icon}`}
      >
        <Pizza className="h-4 w-4" strokeWidth={2.3} />
      </span>
      <span className="min-w-0">
        <span
          className={`block text-[8px] font-black uppercase tracking-[0.12em] ${tone.label}`}
        >
          {label}
        </span>
        <b className="mt-0.5 block truncate text-[13px] font-black uppercase leading-4 tracking-[-0.01em]">
          {value}
        </b>
      </span>
    </div>
  );
}

type KitchenCustomPizzaPresentation = {
  mode: "WHOLE" | "HALF_HALF";
  sizeLabel: string | null;
  crustLabel: string | null;
  wholeIngredients: string[];
  firstHalfIngredients: string[];
  secondHalfIngredients: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function customPizzaIngredientNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((ingredient) =>
    isRecord(ingredient) && typeof ingredient.name === "string"
      ? [ingredient.name.trim()]
      : [],
  ).filter(Boolean);
}

function readCustomPizzaPresentation(
  item: KitchenOrderItem,
): KitchenCustomPizzaPresentation | null {
  if (
    item.product?.type !== "PIZZA_CUSTOM" ||
    !isRecord(item.configuration) ||
    String(item.configuration.kind ?? "").toUpperCase() !== "PIZZA_CUSTOM"
  ) {
    return null;
  }

  const size = isRecord(item.configuration.size)
    ? item.configuration.size
    : null;
  const crust = isRecord(item.configuration.crust)
    ? item.configuration.crust
    : null;
  const mode =
    String(item.configuration.mode ?? "").toUpperCase() === "HALF_HALF"
      ? "HALF_HALF"
      : "WHOLE";

  const sizeName =
    size && typeof size.name === "string" ? size.name.trim() : "";
  const diameter = size ? Number(size.diameterCm) : NaN;
  const sizeLabel = sizeName
    ? Number.isFinite(diameter) && diameter > 0
      ? `${sizeName} · ${diameter} CM`
      : sizeName
    : null;

  return {
    mode,
    sizeLabel,
    crustLabel:
      crust && typeof crust.name === "string" ? crust.name.trim() : null,
    wholeIngredients: customPizzaIngredientNames(
      item.configuration.wholeIngredients,
    ),
    firstHalfIngredients: customPizzaIngredientNames(
      item.configuration.firstHalfIngredients,
    ),
    secondHalfIngredients: customPizzaIngredientNames(
      item.configuration.secondHalfIngredients,
    ),
  };
}

function KitchenIngredientBlock({
  title,
  ingredients,
  tone,
}: {
  title: string;
  ingredients: string[];
  tone: "complete" | "first" | "second";
}) {
  const shell =
    tone === "complete"
      ? "border-emerald-200 bg-emerald-50/70"
      : tone === "first"
        ? "border-red-200 bg-red-50/70"
        : "border-sky-200 bg-sky-50/70";
  const heading =
    tone === "complete"
      ? "text-emerald-800"
      : tone === "first"
        ? "text-red-800"
        : "text-sky-800";

  return (
    <div className={`rounded-[16px] border p-3 ${shell}`}>
      <div className="flex items-center justify-between gap-2">
        <b
          className={`text-[11px] font-black uppercase tracking-[0.07em] ${heading}`}
        >
          {title}
        </b>
        <span className="rounded-full bg-white/80 px-2 py-1 text-[9px] font-black tabular-nums text-neutral-600">
          {ingredients.length} ingrediente{ingredients.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {ingredients.length ? (
          ingredients.map((ingredient, index) => (
            <span
              key={`${ingredient}-${index}`}
              className="inline-flex min-h-8 items-center rounded-[10px] border border-neutral-200 bg-white px-3 py-1.5 text-[11.5px] font-black leading-4 text-neutral-950 shadow-[0_2px_6px_rgba(28,23,20,.05)]"
            >
              {ingredient}
            </span>
          ))
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-neutral-400">
            Sin ingredientes
          </span>
        )}
      </div>
    </div>
  );
}

function KitchenItem({
  item,
  busy,
  onChangePrepared,
}: {
  item: KitchenOrderItem;
  busy: boolean;
  onChangePrepared: (value: number) => void;
}) {
  const rawComboPresentation =
    item.product?.type === "COMBO"
      ? presentComboOrderConfiguration(item.configuration)
      : null;
  const comboPresentation = rawComboPresentation
    ? {
        pizzas: rawComboPresentation.pizzas,
        groups: rawComboPresentation.groups.filter((group) => {
          const kind = group.kind.toLocaleLowerCase("es");
          const label = group.label.toLocaleLowerCase("es");
          return !(
            kind.includes("bebida") ||
            kind.includes("beverage") ||
            label.includes("bebida") ||
            label.includes("gaseosa")
          );
        }),
      }
    : null;

  const customPizzaPresentation = readCustomPizzaPresentation(item);

  const details = comboPresentation || customPizzaPresentation
    ? []
    : presentOrderItemConfiguration(item.configuration).filter((detail) => {
        const label = detail.label.trim().toLowerCase();
        return !label.includes("bebida") && !label.includes("gaseosa");
      });
  const flavorDetails = details.filter((detail) => detail.label.trim().toLowerCase().startsWith("sabor"));
  const extraDetails = details.filter((detail) => detail.label.trim().toLowerCase() === "extra");
  const sizeDetail = details.find((detail) => detail.label.trim().toLowerCase() === "tamaño");
  const crustDetail = details.find((detail) => detail.label.trim().toLowerCase() === "borde");
  const normalizedProductName = item.productName.trim().toLocaleLowerCase("es");
  const otherDetails = details.filter((detail) => {
    const label = detail.label.trim().toLowerCase();
    if (label.startsWith("sabor") || label === "extra" || label === "tamaño" || label === "borde") return false;
    if (label === "producto" && detail.value.trim().toLocaleLowerCase("es") === normalizedProductName) return false;
    return true;
  });
  const cleanFlavor = (value: string) => value.replace(/^½\s*/, "").trim();
  const complete = item.preparedQuantity >= item.quantity;

  return (
    <div className={`h-full rounded-[20px] border p-3.5 transition [font-synthesis:none] ${complete ? "border-emerald-200 bg-emerald-50/65" : "border-neutral-200 bg-[#fbfaf8] shadow-[0_5px_16px_rgba(28,23,20,.035)]"}`}>
      <div className="flex items-start gap-2.5">
        <span className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[11px] font-bold tabular-nums ${complete ? "bg-emerald-600 text-white" : "bg-black text-white"}`}>{item.quantity}×</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <b className="min-w-0 pt-0.5 text-[15px] font-black leading-5 tracking-[-0.015em] text-neutral-950">{item.productName}</b>
            {!complete && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Restar unidad preparada"
                  disabled={busy || item.preparedQuantity <= 0}
                  onClick={() => onChangePrepared(Math.max(0, item.preparedQuantity - 1))}
                  className="h-7 w-7 rounded-lg border border-neutral-200 bg-white text-sm font-semibold text-neutral-600 disabled:opacity-30"
                >
                  −
                </button>
                <b className="min-w-8 text-center text-[11px] font-semibold tabular-nums text-neutral-900">{item.preparedQuantity}/{item.quantity}</b>
                <button
                  type="button"
                  aria-label="Agregar unidad preparada"
                  disabled={busy || item.preparedQuantity >= item.quantity}
                  onClick={() => onChangePrepared(Math.min(item.quantity, item.preparedQuantity + 1))}
                  className="h-7 w-7 rounded-lg bg-[var(--brand-red)] text-sm font-semibold text-white disabled:bg-neutral-200 disabled:text-neutral-400"
                >
                  +
                </button>
              </div>
            )}
          </div>

          {comboPresentation && (
            <div className="mt-2 space-y-2">
              {comboPresentation.pizzas.map((pizza, index) => (
                <div
                  key={`combo-pizza-${index}`}
                  className="rounded-xl border border-neutral-200 bg-white/80 p-2.5"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-neutral-400">
                    {comboPresentation.pizzas.length > 1
                      ? `Pizza ${index + 1}`
                      : "Pizza"}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {pizza.sizeLabel && (
                      <KitchenSizeBadge value={pizza.sizeLabel} />
                    )}
                    {pizza.flavor &&
                      pizza.flavor
                        .split("+")
                        .map((value) => value.replace(/^\s*½\s*/, "").trim())
                        .filter(Boolean)
                        .map((value, flavorIndex, flavors) => (
                          <KitchenFlavorBadge
                            key={`${value}-${flavorIndex}`}
                            value={value}
                            label={
                              flavors.length > 1
                                ? `Mitad ${flavorIndex + 1}`
                                : "Sabor"
                            }
                          />
                        ))}
                  </div>
                </div>
              ))}

              {comboPresentation.groups.map((group, index) => (
                <div
                  key={`${group.label}-${index}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/55 px-2.5 py-2"
                >
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-amber-700/65">
                    {group.label}
                  </span>
                  {group.values.map((value, valueIndex) => (
                    <span
                      key={`${value}-${valueIndex}`}
                      className="inline-flex min-h-6 items-center rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.02em] text-amber-900"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}

          {customPizzaPresentation && (
            <div className="mt-2.5 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {customPizzaPresentation.sizeLabel && (
                  <KitchenSizeBadge value={customPizzaPresentation.sizeLabel} />
                )}
                {customPizzaPresentation.crustLabel && (
                  <KitchenCrustBadge value={customPizzaPresentation.crustLabel} />
                )}
                <span
                  className={
                    customPizzaPresentation.mode === "HALF_HALF"
                      ? "inline-flex min-h-[52px] items-center rounded-[14px] border-2 border-red-200 bg-red-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-red-800"
                      : "inline-flex min-h-[52px] items-center rounded-[14px] border-2 border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-emerald-800"
                  }
                >
                  {customPizzaPresentation.mode === "HALF_HALF"
                    ? "Mitad y mitad"
                    : "Pizza completa"}
                </span>
              </div>

              {customPizzaPresentation.mode === "HALF_HALF" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <KitchenIngredientBlock
                    title="Mitad 1"
                    ingredients={customPizzaPresentation.firstHalfIngredients}
                    tone="first"
                  />
                  <KitchenIngredientBlock
                    title="Mitad 2"
                    ingredients={customPizzaPresentation.secondHalfIngredients}
                    tone="second"
                  />
                </div>
              ) : (
                <KitchenIngredientBlock
                  title="Ingredientes · Pizza completa"
                  ingredients={customPizzaPresentation.wholeIngredients}
                  tone="complete"
                />
              )}
            </div>
          )}

          {(sizeDetail || crustDetail) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {sizeDetail && <KitchenSizeBadge value={sizeDetail.value} />}
              {crustDetail && <KitchenCrustBadge value={crustDetail.value} />}
            </div>
          )}

          {flavorDetails.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {flavorDetails.map((detail, index) => (
                <KitchenFlavorBadge
                  key={`${detail.label}-${index}`}
                  value={cleanFlavor(detail.value)}
                  label={
                    flavorDetails.length > 1
                      ? `Mitad ${index + 1}`
                      : "Sabor"
                  }
                />
              ))}
            </div>
          )}

          {extraDetails.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {extraDetails.map((detail, index) => (
                <span
                  key={`${detail.value}-${index}`}
                  className="inline-flex min-h-6 items-center rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.02em] text-[var(--brand-red)]"
                >
                  + {detail.value}
                </span>
              ))}
            </div>
          )}

          {otherDetails.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {otherDetails.map((detail, index) => (
                <p key={`${detail.label}-${index}`} className="text-[11.5px] leading-4 text-neutral-800">
                  <span className="font-semibold text-neutral-500">{detail.label}:</span> {detail.value}
                </p>
              ))}
            </div>
          )}

          {item.notes && (
            <div className="mt-2">
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 shadow-[0_2px_8px_rgba(180,120,0,.06)]">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500 text-[11px] font-bold text-white">!</span>
                  <b className="min-w-0 text-[12px] uppercase leading-4 tracking-[0.02em] text-amber-950">{item.notes}</b>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/orders?scope=kitchen", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar Cocina.");
      setOrders(data.orders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar Cocina.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    const timer = window.setInterval(
      () => void loadOrders(true),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [loadOrders]);

  const handleIncomingPush = useCallback(() => {
    void loadOrders(true);
  }, [loadOrders]);

  const kitchenOrders = useMemo(
    () => orders
      .filter((order) => ["PREPARING", "CONFIRMED"].includes(order.status))
      .filter((order) => kitchenItemsFor(order).length > 0)
      .filter(
        (order) =>
          !order.scheduledFor ||
          kitchenEntryTime(order) <= Date.now(),
      )
      .sort(
        (a, b) =>
          kitchenEntryTime(a) - kitchenEntryTime(b) ||
          a.id - b.id,
      ),
    [orders],
  );

  async function changePrepared(order: KitchenOrder, item: KitchenOrderItem, preparedQuantity: number) {
    const key = `${order.id}:${item.id}`;
    setBusyKey(key);
    setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}/items/${item.id}/prepared`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preparedQuantity }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible actualizar el producto.");
      await loadOrders(true);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No fue posible actualizar el producto.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <main className="w-full p-3 md:p-5 xl:p-6">
      <div className="w-full space-y-5">
        <section className="relative min-h-[116px] w-full overflow-hidden rounded-[24px] border border-black/5 bg-[#0a0a0b] text-white shadow-[0_14px_36px_rgba(20,16,14,.11)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_42%,rgba(226,26,34,.55),transparent_25%),radial-gradient(circle_at_68%_100%,rgba(132,12,16,.36),transparent_34%),linear-gradient(105deg,#111319_0%,#101116_43%,#1a0b0d_67%,#5a090c_100%)]" />
          <div className="absolute inset-y-0 right-0 w-[46%] opacity-70 [background:linear-gradient(115deg,transparent_0%,rgba(255,255,255,.025)_28%,transparent_29%),repeating-linear-gradient(90deg,transparent_0_54px,rgba(255,255,255,.025)_55px_56px)]" />
          <div className="absolute right-[24%] top-[-18px] h-20 w-20 rounded-full bg-red-500/10 blur-2xl" />
          <div className="absolute right-[9%] top-[22px] h-[2px] w-[30%] bg-gradient-to-r from-transparent via-red-300/40 to-transparent" />

          <div className="relative flex min-h-[116px] flex-col justify-between gap-4 px-5 py-4 md:flex-row md:items-center md:px-6 xl:px-7">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="h-[2px] w-7 rounded-full bg-[var(--brand-red)]" />
                <p className="alento-ui-label uppercase tracking-[0.2em] text-white/55">
                  Producción
                </p>
              </div>
              <h1 className="alento-ui-hero-title mt-1.5">
                Cocina
              </h1>
              <p className="alento-ui-hero-subtitle mt-1.5 text-white/60">
                Lo que entra, lo que se prepara y lo que ya puede salir.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 self-end md:self-auto">
              <KitchenOrderAlerts
                orderIds={kitchenOrders.map((order) => order.id)}
                onIncomingPush={handleIncomingPush}
              />

              <Link
                href="/masa"
                aria-label="Abrir preparaciones"
                title="Abrir preparaciones"
                className="group inline-flex h-[56px] w-[76px] shrink-0 items-center justify-center rounded-[16px] border border-red-400/45 bg-[linear-gradient(135deg,rgba(236,25,31,.96),rgba(119,12,16,.82))] text-white shadow-[0_10px_22px_rgba(168,11,16,.25),inset_0_1px_0_rgba(255,255,255,.13)] transition hover:-translate-y-0.5 hover:border-red-300/70 hover:brightness-110 active:translate-y-0"
              >
                <Pizza
                  className="h-[22px] w-[22px]"
                  strokeWidth={2.15}
                />
              </Link>

              <div className="flex h-[56px] w-[76px] shrink-0 flex-col items-center justify-center rounded-[16px] border border-white/14 bg-white/[0.08] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-sm">
                <span className="alento-ui-micro uppercase tracking-[0.14em] text-white/50">
                  Cocina
                </span>
                <b className="alento-ui-metric mt-0.5 tabular-nums text-white">
                  {kitchenOrders.length}
                </b>
              </div>
            </div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-sm text-neutral-500 shadow-sm ring-1 ring-neutral-200">Cargando pedidos...</div>
        ) : kitchenOrders.length === 0 ? (
          <div className="flex min-h-[560px] w-full items-center justify-center rounded-[28px] border border-neutral-200/90 bg-[radial-gradient(circle_at_50%_42%,rgba(236,253,245,.72),transparent_22%),linear-gradient(180deg,#ffffff,#fdfdfd)] px-6 py-12 text-center shadow-[0_12px_32px_rgba(28,23,20,.045)]">
            <div className="max-w-xl">
              <div className="relative mx-auto h-[150px] w-[190px]">
                <div className="absolute left-1/2 top-[54px] h-[72px] w-[124px] -translate-x-1/2 rounded-t-[70px] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff,#eef0f4)] shadow-[0_14px_22px_rgba(17,24,39,.10)]">
                  <span className="absolute left-1/2 top-[-18px] h-7 w-7 -translate-x-1/2 rounded-full border border-neutral-200 bg-[linear-gradient(180deg,#fff,#e7e9ee)] shadow-sm" />
                  <CookingPot className="absolute left-1/2 top-[22px] h-8 w-8 -translate-x-1/2 text-neutral-300" strokeWidth={1.3} />
                </div>
                <div className="absolute bottom-[18px] left-1/2 h-[10px] w-[146px] -translate-x-1/2 rounded-full bg-neutral-200/80 blur-[1px]" />
                <div className="absolute right-[22px] top-[66px] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_12px_26px_rgba(16,185,129,.30)]">
                  <CircleCheck className="h-8 w-8" strokeWidth={2.5} />
                </div>
                <Sparkles className="absolute left-[12px] top-[42px] h-6 w-6 text-emerald-200" />
                <Sparkles className="absolute right-[8px] top-[25px] h-5 w-5 text-emerald-300" />
              </div>

              <h2 className="mt-2 text-[32px] font-black tracking-[-0.035em] text-neutral-950">
                Cocina al día
              </h2>
              <p className="mt-2 text-[15px] font-medium text-slate-500">
                No hay pedidos pendientes de preparación.
              </p>
              <div className="mx-auto mt-6 h-1.5 w-16 rounded-full bg-emerald-400/70" />
            </div>
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {kitchenOrders.map((order, orderIndex) => {
              const minutes = ageMinutes(order);
              const kitchenItems = kitchenItemsFor(order);

              return (
                <article key={order.id} className={`self-start overflow-hidden rounded-[24px] border bg-white shadow-[0_14px_36px_rgba(28,23,20,.06)] ${order.scheduledFor ? "border-violet-300 ring-1 ring-violet-100" : "border-neutral-200"}`}>
                  <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3.5 [font-synthesis:none]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[19px] font-black tracking-[-0.03em] text-neutral-950">{displayOrderCode(order)}</h2>
                        {orderIndex === 0 && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-red-700">
                            Más antiguo
                          </span>
                        )}
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.02em] text-[var(--brand-red)]">{fulfillmentLabel(order.fulfillmentType)}</span>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.02em] text-amber-700">
                          {statusLabel(order.status === "CONFIRMED" ? "PREPARING" : order.status)}
                        </span>
                        {order.scheduledFor && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.02em] text-violet-700">
                            <Clock3 className="h-3.5 w-3.5" strokeWidth={2.2} />
                            Programado · {scheduledLabel(order.scheduledFor)}
                          </span>
                        )}
                      </div>
                      {order.customer?.name && (
                        <p className="mt-1 truncate text-[11px] font-medium leading-4 tracking-[-0.005em] text-neutral-500 [font-synthesis:none]">
                          {order.customer.name}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 tabular-nums ${minutes >= 20 ? "border-red-100 bg-red-50 text-red-700" : minutes >= 10 ? "border-amber-100 bg-amber-50 text-amber-700" : "border-neutral-200 bg-neutral-50 text-neutral-700"}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
                          <circle cx="12" cy="12" r="8.5" />
                          <path d="M12 7.5v5l3 2" />
                        </svg>
                        <b className="text-[12px] font-black">{minutes} min</b>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 p-4">
                    {kitchenItems.map((item) => (
                      <KitchenItem
                        key={item.id}
                        item={{
                          ...item,
                          preparedQuantity: Number(
                            item.preparedQuantity ?? 0,
                          ),
                        }}
                        busy={busyKey === `${order.id}:${item.id}`}
                        onChangePrepared={(value) =>
                          void changePrepared(order, item, value)
                        }
                      />
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
