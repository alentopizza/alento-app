"use client";

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
                  <p className="text-[9px] font-black uppercase tracking-[0.07em] text-neutral-400">
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
                  <span className="text-[9px] font-black uppercase tracking-[0.06em] text-amber-700/65">
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
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500 text-[11px] font-black text-white">!</span>
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
    <main className="p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <section className="rounded-[28px] bg-[radial-gradient(circle_at_88%_20%,rgba(229,28,17,.24),transparent_28%),linear-gradient(135deg,#09090a,#181516)] px-6 py-5 text-white shadow-[0_20px_55px_rgba(20,16,14,.12)] md:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Producción</p>
              <h1 className="mt-0.5 text-3xl font-black tracking-[-0.035em]">Cocina</h1>
              <p className="mt-0.5 text-sm text-white/65">Lo que entra, lo que se prepara y lo que ya puede salir.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2.5 text-center shadow-inner">
              <span className="block text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">Cocina</span>
              <b className="mt-0.5 block text-[28px] font-black leading-none tabular-nums text-white">{kitchenOrders.length}</b>
            </div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-sm text-neutral-500 shadow-sm ring-1 ring-neutral-200">Cargando pedidos...</div>
        ) : kitchenOrders.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-neutral-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-2xl">✓</div>
            <h2 className="mt-4 text-xl font-black">Cocina al día</h2>
            <p className="mt-1 text-sm text-neutral-500">No hay pedidos pendientes de preparación.</p>
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
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.02em] text-[var(--brand-red)]">{fulfillmentLabel(order.fulfillmentType)}</span>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.02em] text-amber-700">
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
