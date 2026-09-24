"use client";

import Link from "next/link";
import { CircleCheck, CookingPot, Pizza, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";
import { orderCode } from "@/lib/orderCode";
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
  customer: { name: string } | null;
  items: KitchenOrderItem[];
};

function displayOrderCode(order: KitchenOrder) {
  return orderCode(order.sequenceNumber ?? order.id, order.source);
}

function ageMinutes(createdAt: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
}

function isKitchenItem(item: KitchenOrderItem) {
  return item.product?.category?.slug !== "bebidas";
}

function kitchenPriority(item: KitchenOrderItem) {
  if (item.product?.type === "PIZZA_SINGLE" || item.product?.type === "PIZZA_TWO_FLAVORS") return 0;

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

type KitchenComboPizza = {
  size: string;
  flavor: string;
};

type KitchenComboGroup = {
  label: string;
  values: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function comboKitchenPresentation(configuration: unknown): {
  pizzas: KitchenComboPizza[];
  groups: KitchenComboGroup[];
} | null {
  if (!isRecord(configuration) || stringValue(configuration.kind).toUpperCase() !== "COMBO") {
    return null;
  }

  const pizzas: KitchenComboPizza[] = [];
  if (Array.isArray(configuration.pizzas)) {
    configuration.pizzas.forEach((pizza) => {
      if (!isRecord(pizza)) return;

      const size = isRecord(pizza.size)
        ? [
            stringValue(pizza.size.name),
            Number(pizza.size.diameterCm) > 0
              ? `${Number(pizza.size.diameterCm)} cm`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : "";

      const flavor = isRecord(pizza.flavor)
        ? stringValue(pizza.flavor.name)
        : "";

      if (size || flavor) pizzas.push({ size, flavor });
    });
  }

  const groups: KitchenComboGroup[] = [];
  if (Array.isArray(configuration.groups)) {
    configuration.groups.forEach((group) => {
      if (!isRecord(group)) return;

      const label = stringValue(group.name) || "Acompañante";
      const kind = stringValue(group.kind).toLocaleLowerCase("es");
      const normalizedLabel = label.toLocaleLowerCase("es");

      if (
        kind.includes("bebida") ||
        kind.includes("beverage") ||
        normalizedLabel.includes("bebida") ||
        normalizedLabel.includes("gaseosa")
      ) {
        return;
      }

      const values = Array.isArray(group.selections)
        ? group.selections.flatMap((selection) => {
            if (!isRecord(selection)) return [];
            const name = stringValue(selection.name);
            if (!name) return [];
            const quantity = Math.max(1, Number(selection.quantity) || 1);
            return [quantity > 1 ? `${quantity} × ${name}` : name];
          })
        : [];

      if (values.length) groups.push({ label, values });
    });
  }

  return pizzas.length || groups.length ? { pizzas, groups } : null;
}

function kitchenSpecChipClass(base: string) {
  return `inline-flex min-h-7 items-center rounded-lg border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.025em] shadow-[0_2px_8px_rgba(28,23,20,.04)] ${base}`;
}

function sizeChipClass(value: string) {
  const normalized = value.toLocaleLowerCase("es");

  if (normalized.includes("personal")) return kitchenSpecChipClass("border-sky-200 bg-sky-50 text-sky-800");
  if (normalized.includes("mediana")) return kitchenSpecChipClass("border-emerald-200 bg-emerald-50 text-emerald-800");
  if (normalized.includes("grande")) return kitchenSpecChipClass("border-amber-200 bg-amber-50 text-amber-800");
  if (normalized.includes("extra")) return kitchenSpecChipClass("border-violet-200 bg-violet-50 text-violet-800");

  return kitchenSpecChipClass("border-neutral-200 bg-white text-neutral-800");
}

function crustChipClass(value: string) {
  const normalized = value.toLocaleLowerCase("es");

  if (normalized.includes("tradicional")) return kitchenSpecChipClass("border-neutral-300 bg-neutral-100 text-neutral-800");
  if (normalized.includes("mozzarella")) return kitchenSpecChipClass("border-yellow-200 bg-yellow-50 text-yellow-800");
  if (normalized.includes("bocadillo")) return kitchenSpecChipClass("border-rose-200 bg-rose-50 text-rose-800");
  if (normalized.includes("salchi")) return kitchenSpecChipClass("border-orange-200 bg-orange-50 text-orange-800");

  return kitchenSpecChipClass("border-neutral-200 bg-white text-neutral-800");
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
  const comboPresentation =
    item.product?.type === "COMBO"
      ? comboKitchenPresentation(item.configuration)
      : null;

  const details = comboPresentation
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
    <div className={`rounded-[18px] border p-2.5 transition [font-synthesis:none] ${complete ? "border-emerald-200 bg-emerald-50/65" : "border-neutral-200 bg-[#faf9f7]"}`}>
      <div className="flex items-start gap-2.5">
        <span className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[11px] font-bold tabular-nums ${complete ? "bg-emerald-600 text-white" : "bg-black text-white"}`}>{item.quantity}×</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <b className="min-w-0 pt-1 text-[14px] font-bold leading-5 tracking-[-0.01em] text-neutral-950">{item.productName}</b>
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
                    {pizza.size && (
                      <span className={sizeChipClass(pizza.size)}>
                        {pizza.size}
                      </span>
                    )}
                    {pizza.flavor && (
                      <span className="inline-flex min-h-7 items-center rounded-lg border border-neutral-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.025em] text-neutral-950 shadow-[0_2px_8px_rgba(28,23,20,.04)]">
                        {pizza.flavor}
                      </span>
                    )}
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

          {(sizeDetail || crustDetail) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {sizeDetail && <span className={sizeChipClass(sizeDetail.value)}>{sizeDetail.value}</span>}
              {crustDetail && <span className={crustChipClass(crustDetail.value)}>{crustDetail.value}</span>}
            </div>
          )}

          {flavorDetails.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {flavorDetails.map((detail, index) => (
                <span key={`${detail.label}-${index}`} className="contents">
                  <span className="inline-flex min-h-7 items-center rounded-lg border border-neutral-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.025em] text-neutral-950 shadow-[0_2px_8px_rgba(28,23,20,.04)]">
                    {cleanFlavor(detail.value)}
                  </span>
                  {index < flavorDetails.length - 1 && (
                    <span className="text-[11px] font-bold text-neutral-300">−</span>
                  )}
                </span>
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

  async function loadOrders(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar Cocina.");
      setOrders(data.orders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar Cocina.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
    const timer = window.setInterval(() => void loadOrders(true), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const kitchenOrders = useMemo(
    () => orders
      .filter((order) => ["PREPARING", "CONFIRMED"].includes(order.status))
      .filter((order) => kitchenItemsFor(order).length > 0)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
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
        <section className="relative min-h-[176px] w-full overflow-hidden rounded-[26px] border border-black/5 bg-[#0a0a0b] text-white shadow-[0_18px_45px_rgba(20,16,14,.12)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_42%,rgba(226,26,34,.55),transparent_25%),radial-gradient(circle_at_68%_100%,rgba(132,12,16,.36),transparent_34%),linear-gradient(105deg,#111319_0%,#101116_43%,#1a0b0d_67%,#5a090c_100%)]" />
          <div className="absolute inset-y-0 right-0 w-[46%] opacity-70 [background:linear-gradient(115deg,transparent_0%,rgba(255,255,255,.025)_28%,transparent_29%),repeating-linear-gradient(90deg,transparent_0_54px,rgba(255,255,255,.025)_55px_56px)]" />
          <div className="absolute right-[24%] top-[-18px] h-20 w-20 rounded-full bg-red-500/10 blur-2xl" />
          <div className="absolute right-[9%] top-[22px] h-[2px] w-[30%] bg-gradient-to-r from-transparent via-red-300/40 to-transparent" />

          <div className="relative flex min-h-[176px] flex-col justify-between gap-6 px-6 py-6 md:flex-row md:items-center md:px-8 xl:px-10">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="h-[3px] w-8 rounded-full bg-[var(--brand-red)]" />
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/58">
                  Producción
                </p>
              </div>
              <h1 className="mt-2 text-[42px] font-black leading-none tracking-[-0.045em] md:text-[48px]">
                Cocina
              </h1>
              <p className="mt-2 text-[14px] font-medium text-white/68 md:text-[15px]">
                Lo que entra, lo que se prepara y lo que ya puede salir.
              </p>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto">
              <Link
                href="/masa"
                className="group inline-flex h-[68px] items-center gap-3 rounded-[19px] border border-red-400/45 bg-[linear-gradient(135deg,rgba(236,25,31,.96),rgba(119,12,16,.82))] px-5 text-white shadow-[0_12px_28px_rgba(168,11,16,.30),inset_0_1px_0_rgba(255,255,255,.15)] transition hover:-translate-y-0.5 hover:border-red-300/70 hover:brightness-110 active:translate-y-0"
                title="Abrir preparaciones"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08]">
                  <Pizza className="h-[22px] w-[22px]" strokeWidth={2.15} />
                </span>
                <span className="hidden text-[13px] font-black sm:inline">
                  Preparaciones
                </span>
              </Link>

              <div className="flex h-[68px] min-w-[92px] flex-col items-center justify-center rounded-[19px] border border-white/14 bg-white/[0.08] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-sm">
                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/55">
                  Cocina
                </span>
                <b className="mt-1 text-[30px] font-black leading-none tabular-nums text-white">
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
          <div className="grid items-start gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {kitchenOrders.map((order) => {
              const minutes = ageMinutes(order.createdAt);
              const kitchenItems = kitchenItemsFor(order);

              return (
                <article key={order.id} className="self-start overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-[0_12px_32px_rgba(28,23,20,.055)]">
                  <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 [font-synthesis:none]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[18px] font-bold tracking-[-0.025em] text-neutral-950">{displayOrderCode(order)}</h2>
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.02em] text-[var(--brand-red)]">{fulfillmentLabel(order.fulfillmentType)}</span>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.02em] text-amber-700">
                          {statusLabel(order.status === "CONFIRMED" ? "PREPARING" : order.status)}
                        </span>
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
                        <b className="text-[12px] font-semibold">{minutes}</b>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 p-3.5">
                    {kitchenItems.map((item) => (
                      <KitchenItem
                        key={item.id}
                        item={{ ...item, preparedQuantity: Number(item.preparedQuantity ?? 0) }}
                        busy={busyKey === `${order.id}:${item.id}`}
                        onChangePrepared={(value) => void changePrepared(order, item, value)}
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
