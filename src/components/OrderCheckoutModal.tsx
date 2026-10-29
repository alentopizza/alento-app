"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ComboOrderConfiguration,
  CustomPizzaOrderConfiguration,
  OrderLineConfiguration,
  PizzaOrderConfiguration,
} from "@/lib/orderConfiguration";
import { presentComboOrderConfiguration, presentOrderItemConfiguration } from "@/lib/orderPresentation";
import {
  scheduledServiceWindow,
  validateScheduledServiceHours,
} from "@/lib/orderScheduling";
import { createIdempotencyKey } from "@/lib/clientIdempotency";
import {
  formatServiceRange,
  type ServiceHour,
} from "@/lib/storeServiceHours";

type FulfillmentType = "DELIVERY" | "PICKUP" | "STORE";
type DiscountMode = "NONE" | "COUPON" | "MANUAL";
type ScheduleMode = "ASAP" | "SCHEDULED";
type CouponType = "FIXED" | "PERCENTAGE";

type CustomerAddress = {
  id: number;
  label?: string | null;
  address: string;
  formattedAddress?: string | null;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  neighborhood: string | null;
  city: string | null;
  notes: string | null;
  isDefault?: boolean;
};
type Customer = { id: number; name: string; countryCode: string; phone: string | null; email: string | null; notes: string | null; addresses: CustomerAddress[] };
type CartItem = { key: string; productId: number; name: string; detail: string; unitPrice: number; quantity: number; configuration?: unknown; notes?: string };
type PaymentMethodSetting = { id: string; name: string; active: boolean };
type PosSettings = {
  paymentMethods: PaymentMethodSetting[];
  store?: {
    serviceHours?: ServiceHour[];
  };
};
type DeliveryQuote = {
  covered: boolean;
  distanceMeters: number;
  durationSeconds?: number | null;
  deliveryFee: number | null;
  band?: { id: string; name?: string } | null;
};
type Coupon = { id: number; name: string; type: CouponType; value: number; active: boolean };
type Eligibility = { eligibleSubtotal: number; excludedSubtotal: number; eligibleProductIds: number[]; excludedProductIds: number[] };

type CheckoutResult = {
  deliveryFee: number;
  discount: number;
  discountMode: DiscountMode;
  couponId: number | null;
  couponName: string | null;
  distanceMeters: number | null;
  deliveryZoneId: string | null;
  deliveryZoneName: string | null;
  paymentMethodId: string;
  paymentMethodName: string;
  cashReceived: number | null;
  changeDue: number | null;
};

type CreatedOrder = {
  id: number;
  code: string;
  status: string;
  fulfillmentType: FulfillmentType;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  scheduledFor?: string | null;
};

type Props = {
  open: boolean;
  fulfillmentType: FulfillmentType | null;
  customer: Customer | null;
  cart: CartItem[];
  subtotal: number;
  deliveryFeeOverride?: number | null;
  onClose: () => void;
  onValidated?: (result: CheckoutResult) => void;
};

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0,, maximumFractionDigits: 0 }).format(value);
}

function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function defaultScheduledInput() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  const minutes = Math.ceil(date.getMinutes() / 15) * 15;
  if (minutes === 60) {
    date.setHours(date.getHours() + 1, 0, 0, 0);
  } else {
    date.setMinutes(minutes, 0, 0);
  }
  return toDateTimeLocalValue(date);
}

function scheduleLabel(value: string | Date) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function fulfillmentLabel(type: FulfillmentType | null) {
  if (type === "DELIVERY") return "Domicilio";
  if (type === "PICKUP") return "Recoger en tienda";
  if (type === "STORE") return "Local";
  return "Pedido";
}

function isCashMethod(method: PaymentMethodSetting | undefined) {
  if (!method) return false;
  const id = method.id.toLowerCase();
  const name = method.name.trim().toLowerCase();
  return id === "cash" || name === "efectivo";
}

function cashSuggestions(total: number) {
  const denominations = [10000, 20000, 50000, 100000, 200000];
  return denominations.filter((value) => value >= total).slice(0, 3);
}

function orderConfiguration(value: unknown): OrderLineConfiguration | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const kind = (value as { kind?: unknown }).kind;
  if (
    kind === "PIZZA" ||
    kind === "PIZZA_CUSTOM" ||
    kind === "COMBO" ||
    kind === "STANDARD"
  ) {
    return value as OrderLineConfiguration;
  }
  return null;
}

function CheckoutSpec({ label, value }: { label: string; value: string }) {
  return (
    <div className="checkout-product-spec">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function CheckoutProductLine({ item, excluded }: { item: CartItem; excluded: boolean }) {
  const configuration = orderConfiguration(item.configuration);
  const pizza = configuration?.kind === "PIZZA" ? configuration as PizzaOrderConfiguration : null;
  const customPizza =
    configuration?.kind === "PIZZA_CUSTOM"
      ? (configuration as CustomPizzaOrderConfiguration)
      : null;
  const combo = configuration?.kind === "COMBO" ? configuration as ComboOrderConfiguration : null;
  const customPizzaDetails = customPizza
    ? presentOrderItemConfiguration(customPizza)
    : [];
  const comboPresentation = combo
    ? presentComboOrderConfiguration(combo)
    : null;

  return (
    <article className="checkout-product-line">
      <div className="checkout-product-head">
        <div className="min-w-0">
          <b className="checkout-product-title">{item.quantity} × {item.name}</b>
        </div>
        <b className="checkout-product-price">{formatCOP(item.unitPrice * item.quantity)}</b>
      </div>

      {pizza && (
        <div className="checkout-product-details">
          <div className="checkout-product-specs">
            <CheckoutSpec label="Tamaño" value={pizza.size.name} />
            <CheckoutSpec label="Borde" value={pizza.crust.name} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {pizza.flavors.map((flavor, index) => (
              <span key={`${flavor.productId}-${index}`} className="contents">
                <span className="inline-flex min-h-7 items-center rounded-lg border border-neutral-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.025em] text-neutral-950 shadow-[0_2px_8px_rgba(28,23,20,.04)]">
                  {flavor.name}
                </span>
                {index < pizza.flavors.length - 1 && <span className="text-[10px] font-bold text-neutral-300">−</span>}
              </span>
            ))}
          </div>
          {pizza.modifiers.length > 0 && (
            <div className="checkout-product-extras">
              <span>Ingredientes adicionales</span>
              <div>
                {pizza.modifiers.map((modifier) => (
                  <em key={modifier.productId}>+ {modifier.name}</em>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {customPizza && (
        <div className="checkout-product-details">
          <div className="checkout-product-specs">
            {customPizzaDetails
              .filter((detail) =>
                ["Tamaño", "Borde", "Forma"].includes(detail.label),
              )
              .map((detail) => (
                <CheckoutSpec
                  key={detail.label}
                  label={detail.label}
                  value={detail.value}
                />
              ))}
          </div>
          <div className="checkout-product-extras">
            <span>Ingredientes</span>
            <div>
              {customPizzaDetails
                .filter((detail) =>
                  ["Ingredientes", "Mitad 1", "Mitad 2"].includes(
                    detail.label,
                  ),
                )
                .map((detail) => (
                  <em key={detail.label}>
                    {detail.label}: {detail.value}
                  </em>
                ))}
            </div>
          </div>
        </div>
      )}

      {comboPresentation && (
        <div className="checkout-product-details checkout-combo-details">
          {comboPresentation.pizzas.map((comboPizza, index) => (
            <div
              key={`combo-pizza-${index}`}
              className="checkout-combo-pizza"
            >
              <span>Pizza {index + 1}</span>
              <b>
                {[comboPizza.sizeName, comboPizza.flavor]
                  .filter(Boolean)
                  .join(" · ")}
              </b>
            </div>
          ))}
          {comboPresentation.groups.length > 0 && (
            <div className="checkout-product-extras">
              <div>
                {comboPresentation.groups.flatMap((group, groupIndex) =>
                  group.values.map((value, valueIndex) => (
                    <em
                      key={`${groupIndex}-${valueIndex}-${value}`}
                      className="neutral"
                    >
                      {group.label}: {value}
                    </em>
                  )),
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!pizza && !combo && item.detail && item.detail !== "Producto" && (
        <p className="checkout-product-standard">{item.detail}</p>
      )}

      {item.notes && (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <span className="block text-[9px] font-black uppercase tracking-[0.08em] text-amber-600">Nota cocina</span>
          <b className="mt-0.5 block text-[11px] leading-4 text-amber-900">{item.notes}</b>
        </div>
      )}

      {excluded && <span className="checkout-product-excluded">No acumula cupón</span>}
    </article>
  );
}

export default function OrderCheckoutModal({ open, fulfillmentType, customer, cart, subtotal, deliveryFeeOverride = null, onClose }: Props) {
  const [settings, setSettings] = useState<PosSettings | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [eligibility, setEligibility] = useState<Eligibility>({ eligibleSubtotal: 0, excludedSubtotal: 0, eligibleProductIds: [], excludedProductIds: [] });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [loadingDeliveryQuote, setLoadingDeliveryQuote] = useState(false);
  const [deliveryQuoteError, setDeliveryQuoteError] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("NONE");
  const [couponId, setCouponId] = useState<number | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("ASAP");
  const [scheduledForInput, setScheduledForInput] = useState("");
  const [error, setError] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const orderAttemptKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) orderAttemptKeyRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setDeliveryQuote(null);
    setDeliveryQuoteError("");
    setPaymentMethodId("");
    setDiscountMode("NONE");
    setCouponId(null);
    setDiscountInput("");
    setCashReceivedInput("");
    setScheduleMode("ASAP");
    setScheduledForInput("");
    setCreatedOrder(null);
    const defaultAddress =
      customer?.addresses?.find((item) => item.isDefault) ??
      customer?.addresses?.[0] ??
      null;
    setSelectedAddressId(defaultAddress?.id ?? null);

    async function loadCheckoutData() {
      setLoadingSettings(true);
      setSettingsError("");
      try {
        const [settingsResponse, couponsResponse, eligibilityResponse] = await Promise.all([
          fetch("/api/settings", { cache: "no-store" }),
          fetch("/api/coupons?active=1", { cache: "no-store" }),
          fetch("/api/discount/eligibility", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lines: cart.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                configuration: item.configuration,
              })),
            }),
          }),
        ]);

        const settingsData = await settingsResponse.json();
        const couponsData = await couponsResponse.json();
        const eligibilityData = await eligibilityResponse.json();
        if (!settingsResponse.ok) throw new Error(settingsData.error || "No fue posible cargar la configuración.");
        if (!couponsResponse.ok) throw new Error(couponsData.error || "No fue posible cargar los cupones.");
        if (!eligibilityResponse.ok) throw new Error(eligibilityData.error || "No fue posible validar los productos elegibles.");

        setSettings(settingsData.settings);
        setCoupons(couponsData.coupons ?? []);
        setEligibility({
          eligibleSubtotal: Number(eligibilityData.eligibleSubtotal ?? 0),
          excludedSubtotal: Number(eligibilityData.excludedSubtotal ?? 0),
          eligibleProductIds: eligibilityData.eligibleProductIds ?? [],
          excludedProductIds: eligibilityData.excludedProductIds ?? [],
        });
      } catch (loadError) {
        setSettingsError(loadError instanceof Error ? loadError.message : "No fue posible cargar el cierre del pedido.");
      } finally {
        setLoadingSettings(false);
      }
    }

    void loadCheckoutData();
  }, [open, cart, customer]);

  const activePaymentMethods = useMemo(() => settings?.paymentMethods.filter((method) => method.active) ?? [], [settings]);
  const selectedCoupon = coupons.find((coupon) => coupon.id === couponId) ?? null;
  const selectedPaymentMethod = activePaymentMethods.find((method) => method.id === paymentMethodId);
  const scheduledService =
    scheduleMode === "SCHEDULED" &&
    scheduledForInput &&
    settings?.store?.serviceHours
      ? scheduledServiceWindow(
          new Date(scheduledForInput),
          settings.store.serviceHours,
        )
      : null;
  const automaticDeliveryFee =
    fulfillmentType === "DELIVERY"
      ? Number(deliveryQuote?.deliveryFee ?? 0)
      : 0;
  const hasDeliveryFeeOverride =
    fulfillmentType === "DELIVERY" &&
    deliveryFeeOverride != null &&
    Number.isFinite(deliveryFeeOverride) &&
    deliveryFeeOverride >= 0;
  const deliveryFee =
    fulfillmentType === "DELIVERY"
      ? hasDeliveryFeeOverride
        ? Math.floor(Number(deliveryFeeOverride))
        : automaticDeliveryFee
      : 0;
  const eligibleSubtotal = eligibility.eligibleSubtotal;

  const manualRaw = Number(discountInput || 0);
  const manualDiscount = Number.isFinite(manualRaw) && manualRaw > 0 ? Math.floor(manualRaw) : 0;
  const couponDiscount = selectedCoupon
    ? selectedCoupon.type === "PERCENTAGE"
      ? Math.round(eligibleSubtotal * (selectedCoupon.value / 100))
      : Math.min(selectedCoupon.value, eligibleSubtotal)
    : 0;
  const discount = discountMode === "COUPON" ? couponDiscount : discountMode === "MANUAL" ? manualDiscount : 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const selectedAddress =
    customer?.addresses?.find((item) => item.id === selectedAddressId) ??
    customer?.addresses?.find((item) => item.isDefault) ??
    customer?.addresses?.[0] ??
    null;
  const address =
    selectedAddress?.formattedAddress ||
    selectedAddress?.address ||
    "";

  useEffect(() => {
    if (!open || fulfillmentType !== "DELIVERY") {
      setDeliveryQuote(null);
      setDeliveryQuoteError("");
      setLoadingDeliveryQuote(false);
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
        "La dirección del cliente debe estar validada con Google Maps para calcular el domicilio.",
      );
      setLoadingDeliveryQuote(false);
      return;
    }

    let cancelled = false;
    setLoadingDeliveryQuote(true);
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
          throw new Error("La dirección está fuera de la cobertura de domicilio.");
        }
        if (!cancelled) setDeliveryQuote(data as DeliveryQuote);
      })
      .catch((quoteError) => {
        if (!cancelled) {
          setDeliveryQuote(null);
          setDeliveryQuoteError(
            quoteError instanceof Error
              ? quoteError.message
              : "No fue posible calcular el domicilio.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDeliveryQuote(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    fulfillmentType,
    open,
    selectedAddress?.address,
    selectedAddress?.formattedAddress,
    selectedAddress?.id,
    selectedAddress?.latitude,
    selectedAddress?.longitude,
    selectedAddress?.placeId,
  ]);

  const cashPayment = isCashMethod(selectedPaymentMethod);
  const cashReceived = Number(cashReceivedInput || 0);
  const validCashReceived = Number.isFinite(cashReceived) && cashReceived >= total;
  const changeDue = cashPayment && validCashReceived ? Math.max(0, cashReceived - total) : 0;
  const suggestions = cashSuggestions(total);

  function chooseDiscountMode(mode: DiscountMode) {
    setDiscountMode(mode);
    setError("");
    if (mode !== "COUPON") setCouponId(null);
    if (mode !== "MANUAL") setDiscountInput("");
  }

  function choosePaymentMethod(methodId: string) {
    setPaymentMethodId(methodId);
    setCashReceivedInput("");
    setError("");
  }

  async function createOrder() {
    setError("");
    if (!fulfillmentType) return setError("Falta definir el tipo de pedido.");
    if (fulfillmentType === "DELIVERY") {
      if (!customer || !address)
        return setError("El domicilio necesita un cliente con dirección registrada.");
      if (loadingDeliveryQuote)
        return setError("Espera mientras calculamos el domicilio.");
      if (deliveryQuoteError || !deliveryQuote?.covered || deliveryQuote.deliveryFee == null)
        return setError(
          deliveryQuoteError || "No fue posible calcular el domicilio para esta dirección.",
        );
    }
    if (discountMode === "COUPON" && !selectedCoupon) return setError("Selecciona un cupón.");
    if ((discountMode === "COUPON" || discountMode === "MANUAL") && eligibleSubtotal <= 0) return setError("Este pedido no tiene productos elegibles para descuento.");
    if (discountMode === "MANUAL" && manualDiscount > eligibleSubtotal) return setError(`El descuento manual no puede superar la base elegible de ${formatCOP(eligibleSubtotal)}.`);
    let scheduledFor: string | null = null;
    if (scheduleMode === "SCHEDULED") {
      if (!scheduledForInput) {
        return setError("Selecciona la fecha y hora del pedido programado.");
      }
      const scheduledDate = new Date(scheduledForInput);
      if (
        !Number.isFinite(scheduledDate.getTime()) ||
        scheduledDate.getTime() <= Date.now()
      ) {
        return setError("La hora programada debe estar en el futuro.");
      }
      scheduledFor = scheduledDate.toISOString();

      try {
        validateScheduledServiceHours(
          scheduledDate,
          settings?.store?.serviceHours,
        );
      } catch (scheduleError) {
        return setError(
          scheduleError instanceof Error
            ? scheduleError.message
            : "La hora seleccionada está fuera del horario de servicio.",
        );
      }
    }

    if (!paymentMethodId) return setError("Selecciona un medio de pago.");
    if (!selectedPaymentMethod) return setError("El medio de pago seleccionado ya no está disponible.");
    if (cashPayment && !validCashReceived) return setError(`En efectivo, "Paga con" debe ser igual o mayor al total de ${formatCOP(total)}.`);

    setCreatingOrder(true);
    try {
      const idempotencyKey =
        orderAttemptKeyRef.current ?? createIdempotencyKey();
      orderAttemptKeyRef.current = idempotencyKey;

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          fulfillmentType,
          customerId: customer?.id ?? null,
          addressId: fulfillmentType === "DELIVERY" ? selectedAddress?.id ?? null : null,
          discountMode,
          couponId: discountMode === "COUPON" ? selectedCoupon?.id ?? null : null,
          manualDiscount: discountMode === "MANUAL" ? manualDiscount : 0,
          deliveryFeeOverride:
            fulfillmentType === "DELIVERY" && hasDeliveryFeeOverride
              ? deliveryFee
              : null,
          paymentMethodId,
          scheduledFor,
          cashReceived: cashPayment ? cashReceived : null,
          items: cart.map((item) => ({
            productId: item.productId,
            name: item.name,
            detail: item.detail,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            configuration: item.configuration,
            notes: item.notes ?? null,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible crear el pedido.");
      orderAttemptKeyRef.current = null;
      setCreatedOrder(data.order);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No fue posible crear el pedido.");
    } finally {
      setCreatingOrder(false);
    }
  }

  if (!open) return null;

  if (createdOrder) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[3px]">
        <div className="w-full max-w-[470px] overflow-hidden rounded-[30px] border border-white/10 bg-[#f7f4ef] shadow-[0_28px_90px_rgba(0,0,0,.32)]">
          <header className="relative overflow-hidden bg-[radial-gradient(circle_at_84%_18%,rgba(229,28,17,.28),transparent_30%),linear-gradient(135deg,#09090a,#181516)] px-6 pb-7 pt-6 text-white">
            <div className="absolute inset-x-0 top-0 h-[3px] bg-[var(--brand-red)]" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Pedido creado</p>
                <h2 className="mt-1.5 text-[34px] font-black tracking-[-0.04em]">{createdOrder.code}</h2>
                <p className="mt-1 max-w-[300px] text-[12px] leading-5 text-white/60">
                  {createdOrder.scheduledFor
                    ? `Programado para ${scheduleLabel(createdOrder.scheduledFor)}.`
                    : "Guardado correctamente y listo para continuar en la operación."}
                </p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-2xl font-black text-emerald-300 shadow-inner">
                ✓
              </div>
            </div>
          </header>

          <div className="p-5 sm:p-6">
            <section className="rounded-[22px] border border-neutral-200 bg-white p-4 shadow-[0_8px_24px_rgba(28,23,20,.05)]">
              <div className="grid grid-cols-2 divide-x divide-neutral-100">
                <div className="pr-4">
                  <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">Tipo</span>
                  <b className="mt-1 block text-sm text-neutral-900">{fulfillmentLabel(createdOrder.fulfillmentType)}</b>
                </div>
                <div className="pl-4 text-right">
                  <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">Total</span>
                  <b className="mt-1 block text-[22px] font-black tracking-[-0.03em] text-[var(--brand-red)]">{formatCOP(createdOrder.total)}</b>
                </div>
              </div>
            </section>

            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-left">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white">✓</div>
              <div>
                <b className="block text-[11px] text-emerald-900">
                  {createdOrder.scheduledFor ? "Pedido programado" : "Listo para operación"}
                </b>
                <span className="text-[10px] leading-4 text-emerald-700">
                  {createdOrder.scheduledFor
                    ? `Visible en Pedidos desde ahora. Entrará a Cocina 30 minutos antes de ${scheduleLabel(createdOrder.scheduledFor)}.`
                    : "El pedido ya está disponible en Pedidos y, cuando corresponde, en Cocina."}
                </span>
              </div>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--brand-red)] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(229,28,17,.20)] transition hover:-translate-y-[1px] hover:shadow-[0_14px_30px_rgba(229,28,17,.28)]"
            >
              Nuevo pedido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-overlay">
      <div className="checkout-modal-v2">
        <header className="checkout-header">
          <div>
            <div className="checkout-eyebrow"><span>Cierre del pedido</span><em>{fulfillmentLabel(fulfillmentType)}</em></div>
            <h2>Descuento y forma de pago</h2>
            <p>Revisa los datos comerciales antes de crear definitivamente la orden.</p>
          </div>
          <button onClick={onClose} disabled={creatingOrder}>Cerrar</button>
        </header>

        <div className="checkout-body alento-scroll">
          {loadingSettings ? (
            <div className="checkout-loading">Cargando cierre del pedido...</div>
          ) : settingsError ? (
            <div className="checkout-error">{settingsError}</div>
          ) : (
            <div className="checkout-layout">
              <div className="checkout-left">
                <section className="checkout-panel">
                  <div className="checkout-panel-head">
                    <div>
                      <span>1. Horario</span>
                      <h3>¿Cuándo lo necesita?</h3>
                    </div>
                    {scheduleMode === "SCHEDULED" && scheduledForInput && (
                      <p>
                        <small>Programado</small>
                        <b>{scheduleLabel(new Date(scheduledForInput))}</b>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleMode("ASAP");
                        setError("");
                      }}
                      className={
                        "min-h-[54px] rounded-[16px] border px-3 text-left transition " +
                        (scheduleMode === "ASAP"
                          ? "border-neutral-950 bg-neutral-950 text-white"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300")
                      }
                    >
                      <b className="block text-[12px]">Lo antes posible</b>
                      <span className="mt-1 block text-[9px] opacity-60">
                        Entra a Cocina ahora
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleMode("SCHEDULED");
                        setScheduledForInput((current) =>
                          current || defaultScheduledInput(),
                        );
                        setError("");
                      }}
                      className={
                        "min-h-[54px] rounded-[16px] border px-3 text-left transition " +
                        (scheduleMode === "SCHEDULED"
                          ? "border-violet-500 bg-violet-50 text-violet-950"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300")
                      }
                    >
                      <b className="block text-[12px]">Programar pedido</b>
                      <span className="mt-1 block text-[9px] opacity-60">
                        Cocina recibe aviso 30 min antes
                      </span>
                    </button>
                  </div>

                  {scheduleMode === "SCHEDULED" && (
                    <div className="mt-3 rounded-[16px] border border-violet-200 bg-violet-50/70 p-3">
                      <label className="block text-[9px] font-black uppercase tracking-[0.1em] text-violet-700">
                        Fecha y hora solicitada
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledForInput}
                        min={toDateTimeLocalValue(new Date())}
                        onChange={(event) => {
                          setScheduledForInput(event.target.value);
                          setError("");
                        }}
                        className="mt-2 h-11 w-full rounded-xl border border-violet-200 bg-white px-3 text-[12px] font-bold text-neutral-900 outline-none focus:border-violet-400"
                      />
                      {scheduledService ? (
                        <p
                          className={
                            "mt-2 text-[9px] font-semibold leading-4 " +
                            (scheduledService.valid
                              ? "text-emerald-700"
                              : "text-rose-700")
                          }
                        >
                          {scheduledService.valid
                            ? `Horario válido · ${formatServiceRange(
                                scheduledService.schedule,
                              )}`
                            : scheduledService.schedule.enabled
                              ? `Fuera de horario · ${formatServiceRange(
                                  scheduledService.schedule,
                                )}`
                              : `${scheduledService.dayLabel}: cerrado`}
                        </p>
                      ) : (
                        <p className="mt-2 text-[9px] leading-4 text-violet-800/70">
                          El pedido queda visible en Pedidos desde ahora y aparece en Cocina 30 minutos antes de esta hora.
                        </p>
                      )}
                      <p className="mt-1 text-[9px] leading-4 text-violet-800/60">
                        Solo se aceptan pedidos programados dentro del horario de apertura y cierre configurado.
                      </p>
                    </div>
                  )}
                </section>

                <section className="checkout-panel">
                  <div className="checkout-panel-head">
                    <div><span>2. Descuento</span><h3>¿Aplica descuento?</h3></div>
                    <p><small>Base elegible</small><b>{formatCOP(eligibleSubtotal)}</b></p>
                  </div>
                  <div className="checkout-discount-tabs">
                    {[
                      { mode: "NONE" as const, label: "Sin descuento" },
                      { mode: "COUPON" as const, label: "Cupón" },
                      { mode: "MANUAL" as const, label: "Manual" },
                    ].map((option) => (
                      <button key={option.mode} onClick={() => chooseDiscountMode(option.mode)} className={discountMode === option.mode ? "selected" : ""}>{option.label}</button>
                    ))}
                  </div>
                  {eligibility.excludedSubtotal > 0 && (
                    <p className="checkout-note">
                      Productos no acumulables: {formatCOP(eligibility.excludedSubtotal)}.
                      {eligibleSubtotal <= 0
                        ? " Este pedido no tiene productos elegibles para cupón."
                        : " El cupón solo se aplica sobre la base elegible."}
                    </p>
                  )}
                  {discountMode === "COUPON" && (
                    <div className="checkout-coupon-grid">
                      {coupons.length ? coupons.map((coupon) => {
                        const selected = couponId === coupon.id;
                        return (
                          <button key={coupon.id} onClick={() => { setCouponId(coupon.id); setError(""); }} disabled={eligibleSubtotal <= 0} className={selected ? "selected" : ""}>
                            <b>{coupon.name}</b><span>{coupon.type === "PERCENTAGE" ? `${coupon.value}%` : formatCOP(coupon.value)}</span>
                          </button>
                        );
                      }) : <p className="checkout-empty-note">No hay cupones activos.</p>}
                    </div>
                  )}
                  {discountMode === "MANUAL" && (
                    <div className="checkout-money-input"><span>$</span><input value={discountInput} onChange={(event) => { setDiscountInput(event.target.value.replace(/\D/g, "")); setError(""); }} inputMode="numeric" disabled={eligibleSubtotal <= 0} placeholder="0" /></div>
                  )}
                </section>

                <section className="checkout-panel">
                  <div className="checkout-panel-head"><div><span>3. Forma de pago</span><h3>¿Cómo paga el cliente?</h3></div></div>
                  <div className="checkout-choice-grid checkout-payment-grid">
                    {activePaymentMethods.map((method) => {
                      const selected = paymentMethodId === method.id;
                      return (
                        <button key={method.id} onClick={() => choosePaymentMethod(method.id)} className={selected ? "selected" : ""}>
                          <b>{method.name}</b><i>{selected ? "✓" : ""}</i>
                        </button>
                      );
                    })}
                  </div>

                  {cashPayment && (
                    <div className="checkout-cash-panel">
                      <div className="checkout-cash-head"><div><span>Efectivo</span><h4>¿Con cuánto paga?</h4></div><p>Total <b>{formatCOP(total)}</b></p></div>
                      <div className="checkout-cash-entry"><div className="checkout-money-input"><span>$</span><input value={cashReceivedInput} onChange={(event) => { setCashReceivedInput(event.target.value.replace(/\D/g, "")); setError(""); }} inputMode="numeric" placeholder="Ej. 100000" /></div><button onClick={() => setCashReceivedInput(String(total))}>Exacto</button></div>
                      <div className="checkout-cash-suggestions">{suggestions.map((value) => <button key={value} onClick={() => { setCashReceivedInput(String(value)); setError(""); }}>{formatCOP(value)}</button>)}</div>
                      {cashReceivedInput && <div className={`checkout-change ${validCashReceived ? "valid" : "invalid"}`}><span>{validCashReceived ? "Vueltas" : "Falta para completar"}</span><b>{validCashReceived ? formatCOP(changeDue) : formatCOP(Math.max(0, total - cashReceived))}</b></div>}
                    </div>
                  )}
                </section>
              </div>

              <aside className="checkout-summary">
                <div className="checkout-summary-head"><div><span>Resumen</span><h3>Revisión del pedido</h3></div><em>{cart.length} línea{cart.length === 1 ? "" : "s"}</em></div>

                <div className="checkout-order-meta">
                  <span>Tipo</span><b>{fulfillmentLabel(fulfillmentType)}</b>
                  {customer && <><span>Cliente</span><b>{customer.name}</b></>}
                  {fulfillmentType === "DELIVERY" && address && <><span>Dirección</span><b>{address}</b></>}
                  {fulfillmentType === "DELIVERY" &&
                    deliveryQuote?.distanceMeters != null && (
                      <>
                        <span>Ruta</span>
                        <b>
                          {deliveryQuote.distanceMeters < 1000
                            ? `${Math.round(deliveryQuote.distanceMeters)} m`
                            : `${(deliveryQuote.distanceMeters / 1000).toFixed(1)} km`}
                        </b>
                      </>
                    )}
                  {scheduleMode === "SCHEDULED" && scheduledForInput && (
                    <>
                      <span>Horario</span>
                      <b className="text-violet-700">🕒 {scheduleLabel(new Date(scheduledForInput))}</b>
                    </>
                  )}
                  {selectedCoupon && discountMode === "COUPON" && <><span>Cupón</span><b>{selectedCoupon.name}</b></>}
                  {selectedPaymentMethod && <><span>Pago</span><b>{selectedPaymentMethod.name}</b></>}
                  {cashPayment && validCashReceived && <><span>Paga con</span><b>{formatCOP(cashReceived)}</b><span>Vueltas</span><b className="green">{formatCOP(changeDue)}</b></>}
                </div>

                <div className="checkout-products alento-scroll">
                  {cart.map((item) => (
                    <CheckoutProductLine key={item.key} item={item} excluded={eligibility.excludedProductIds.includes(item.productId)} />
                  ))}
                </div>

                <div className="checkout-totals">
                  <div><span>Subtotal</span><b>{formatCOP(subtotal)}</b></div>
                  {fulfillmentType === "DELIVERY" && (
                    <div>
                      <span>
                        Domicilio
                        {hasDeliveryFeeOverride && (
                          <small className="ml-1 text-[8px] font-black uppercase tracking-[0.08em] text-[var(--brand-red)]">
                            Manual
                          </small>
                        )}
                      </span>
                      <b>
                        {loadingDeliveryQuote
                          ? "Calculando..."
                          : deliveryQuote?.covered &&
                              deliveryQuote.deliveryFee != null
                            ? formatCOP(deliveryFee)
                            : "Pendiente"}
                      </b>
                    </div>
                  )}
                  {discount > 0 && <div className="discount"><span>{discountMode === "COUPON" ? `Cupón · ${selectedCoupon?.name}` : "Descuento manual"}</span><b>− {formatCOP(discount)}</b></div>}
                  <div className="checkout-grand-total"><span>Total</span><b>{formatCOP(total)}</b></div>
                </div>
              </aside>
            </div>
          )}
          {(error || deliveryQuoteError) && (
            <div className="checkout-error checkout-inline-error">
              {error || deliveryQuoteError}
            </div>
          )}
        </div>

        <footer className="checkout-footer">
          <p>Al crear el pedido se guardan orden, productos, descuento y pago.</p>
          <div><button onClick={onClose} disabled={creatingOrder}>Volver</button><button className="primary" onClick={() => void createOrder()} disabled={loadingSettings || Boolean(settingsError) || creatingOrder}>{creatingOrder ? "Creando pedido..." : "Crear pedido"}</button></div>
        </footer>
      </div>
    </div>
  );
}
