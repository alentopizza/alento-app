"use client";

import { useEffect, useMemo, useState } from "react";

type FulfillmentType = "DELIVERY" | "PICKUP" | "STORE";
type DiscountMode = "NONE" | "COUPON" | "MANUAL";
type CouponType = "FIXED" | "PERCENTAGE";

type CustomerAddress = { id: number; address: string; neighborhood: string | null; city: string | null; notes: string | null };
type Customer = { id: number; name: string; countryCode: string; phone: string | null; email: string | null; notes: string | null; addresses: CustomerAddress[] };
type CartItem = { key: string; productId: number; name: string; detail: string; unitPrice: number; quantity: number };
type DeliveryBand = { id: string; name: string; minMeters: number; maxMeters: number; fee: number; active: boolean };
type PaymentMethodSetting = { id: string; name: string; active: boolean };
type PosSettings = { store: { address: string; mapsUrl: string }; deliveryBands: DeliveryBand[]; paymentMethods: PaymentMethodSetting[] };
type Coupon = { id: number; name: string; type: CouponType; value: number; active: boolean };

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
};

type Props = {
  open: boolean;
  fulfillmentType: FulfillmentType | null;
  customer: Customer | null;
  cart: CartItem[];
  subtotal: number;
  onClose: () => void;
  onValidated: (result: CheckoutResult) => void;
};

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function fulfillmentLabel(type: FulfillmentType | null) {
  if (type === "DELIVERY") return "Domicilio";
  if (type === "PICKUP") return "Recoger en tienda";
  if (type === "STORE") return "Local";
  return "Pedido";
}

export default function OrderCheckoutModal({ open, fulfillmentType, customer, cart, subtotal, onClose, onValidated }: Props) {
  const [settings, setSettings] = useState<PosSettings | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [deliveryZoneId, setDeliveryZoneId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("NONE");
  const [couponId, setCouponId] = useState<number | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setDeliveryZoneId("");
    setPaymentMethodId("");
    setDiscountMode("NONE");
    setCouponId(null);
    setDiscountInput("");

    async function loadCheckoutData() {
      setLoadingSettings(true);
      setSettingsError("");
      try {
        const [settingsResponse, couponsResponse] = await Promise.all([
          fetch("/api/settings", { cache: "no-store" }),
          fetch("/api/coupons?active=1", { cache: "no-store" }),
        ]);
        const settingsData = await settingsResponse.json();
        const couponsData = await couponsResponse.json();
        if (!settingsResponse.ok) throw new Error(settingsData.error || "No fue posible cargar la configuración.");
        if (!couponsResponse.ok) throw new Error(couponsData.error || "No fue posible cargar los cupones.");
        setSettings(settingsData.settings);
        setCoupons(couponsData.coupons ?? []);
      } catch (loadError) {
        setSettingsError(loadError instanceof Error ? loadError.message : "No fue posible cargar el cierre del pedido.");
      } finally {
        setLoadingSettings(false);
      }
    }

    void loadCheckoutData();
  }, [open]);

  const activeDeliveryZones = useMemo(() => settings?.deliveryBands.filter((zone) => zone.active) ?? [], [settings]);
  const activePaymentMethods = useMemo(() => settings?.paymentMethods.filter((method) => method.active) ?? [], [settings]);
  const selectedDeliveryZone = activeDeliveryZones.find((zone) => zone.id === deliveryZoneId) ?? null;
  const selectedCoupon = coupons.find((coupon) => coupon.id === couponId) ?? null;
  const deliveryFee = fulfillmentType === "DELIVERY" ? Number(selectedDeliveryZone?.fee ?? 0) : 0;

  const manualRaw = Number(discountInput || 0);
  const manualDiscount = Number.isFinite(manualRaw) && manualRaw > 0 ? Math.floor(manualRaw) : 0;
  const couponDiscount = selectedCoupon
    ? selectedCoupon.type === "PERCENTAGE"
      ? Math.round(subtotal * (selectedCoupon.value / 100))
      : Math.min(selectedCoupon.value, subtotal)
    : 0;
  const discount = discountMode === "COUPON" ? couponDiscount : discountMode === "MANUAL" ? manualDiscount : 0;
  const maximumManualDiscount = subtotal + deliveryFee;
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const address = customer?.addresses?.[0]?.address ?? "";

  function chooseDiscountMode(mode: DiscountMode) {
    setDiscountMode(mode);
    setError("");
    if (mode !== "COUPON") setCouponId(null);
    if (mode !== "MANUAL") setDiscountInput("");
  }

  function validateCheckout() {
    setError("");
    if (!fulfillmentType) return setError("Falta definir el tipo de pedido.");
    if (fulfillmentType === "DELIVERY") {
      if (!customer || !address) return setError("El domicilio necesita un cliente con dirección registrada.");
      if (!selectedDeliveryZone) return setError("Selecciona una tarifa de domicilio.");
    }
    if (discountMode === "COUPON" && !selectedCoupon) return setError("Selecciona un cupón.");
    if (discountMode === "MANUAL" && manualDiscount > maximumManualDiscount) return setError(`El descuento no puede superar ${formatCOP(maximumManualDiscount)}.`);
    if (!paymentMethodId) return setError("Selecciona un medio de pago.");

    const paymentMethod = activePaymentMethods.find((method) => method.id === paymentMethodId);
    if (!paymentMethod) return setError("El medio de pago seleccionado ya no está disponible.");

    onValidated({
      deliveryFee,
      discount,
      discountMode,
      couponId: discountMode === "COUPON" ? selectedCoupon?.id ?? null : null,
      couponName: discountMode === "COUPON" ? selectedCoupon?.name ?? null : null,
      distanceMeters: null,
      deliveryZoneId: fulfillmentType === "DELIVERY" ? selectedDeliveryZone?.id ?? null : null,
      deliveryZoneName: fulfillmentType === "DELIVERY" ? selectedDeliveryZone?.name ?? null : null,
      paymentMethodId,
      paymentMethodName: paymentMethod.name,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 sm:p-4">
      <div className="alento-card flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-[30px] shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-100 bg-white px-5 py-4 md:px-7">
          <div>
            <div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Cierre del pedido</p><span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black text-[var(--brand-red)]">{fulfillmentLabel(fulfillmentType)}</span></div>
            <h2 className="mt-1 text-2xl font-black">Domicilio, descuento y pago</h2>
            <p className="mt-1 text-xs text-neutral-500">Selecciona tarifa, descuento y forma de pago antes de validar.</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-neutral-100 px-3 py-2 text-sm font-bold">Cerrar</button>
        </div>

        <div className="alento-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7">
          {loadingSettings ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-neutral-500">Cargando cierre...</div> : settingsError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{settingsError}</div> : (
            <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
              <div className="space-y-5">
                {fulfillmentType === "DELIVERY" && <section className="rounded-[22px] border border-neutral-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">1. Domicilio</p><h3 className="mt-1 text-lg font-black">Dirección y tarifa</h3>
                  <div className="mt-3 rounded-2xl bg-[#faf9f7] p-3"><p className="text-xs font-black">{customer?.name}</p><p className="mt-1 text-sm text-neutral-600">{address || "Sin dirección"}</p></div>
                  <label className="mb-2 mt-4 block text-xs font-black">Selecciona la tarifa <span className="text-[var(--brand-red)]">*</span></label>
                  <div className="grid gap-2 sm:grid-cols-2">{activeDeliveryZones.map((zone) => { const selected = deliveryZoneId === zone.id; return <button key={zone.id} onClick={() => { setDeliveryZoneId(zone.id); setError(""); }} className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left ${selected ? "border-[var(--brand-red)] bg-red-50" : "border-neutral-200 bg-white"}`}><div><p className="text-sm font-black">{zone.name}</p><p className="mt-0.5 text-xs text-neutral-500">{formatCOP(zone.fee)}</p></div><span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-black ${selected ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white" : "border-neutral-300 text-transparent"}`}>✓</span></button>; })}</div>
                </section>}

                <section className="rounded-[22px] border border-neutral-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">{fulfillmentType === "DELIVERY" ? "2" : "1"}. Descuento</p><h3 className="mt-1 text-lg font-black">¿Aplica descuento?</h3>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[{ mode: "NONE" as const, label: "Sin descuento" }, { mode: "COUPON" as const, label: "Cupón" }, { mode: "MANUAL" as const, label: "Manual" }].map((option) => <button key={option.mode} onClick={() => chooseDiscountMode(option.mode)} className={`rounded-xl border-2 px-3 py-2 text-xs font-black ${discountMode === option.mode ? "border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]" : "border-neutral-200"}`}>{option.label}</button>)}
                  </div>

                  {discountMode === "COUPON" && <div className="mt-3">
                    {coupons.length ? <div className="grid gap-2 sm:grid-cols-2">{coupons.map((coupon) => { const selected = couponId === coupon.id; return <button key={coupon.id} onClick={() => { setCouponId(coupon.id); setError(""); }} className={`rounded-2xl border-2 p-3 text-left ${selected ? "border-[var(--brand-red)] bg-red-50" : "border-neutral-200"}`}><div className="flex items-center justify-between gap-2"><b className="text-sm">{coupon.name}</b><span className="text-xs font-black text-[var(--brand-red)]">{coupon.type === "PERCENTAGE" ? `${coupon.value}%` : formatCOP(coupon.value)}</span></div><p className="mt-1 text-[10px] text-neutral-500">{coupon.type === "PERCENTAGE" ? "Sobre subtotal de productos" : "Descuento fijo sobre productos"}</p></button>; })}</div> : <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">No hay cupones activos. Créalo en la pestaña Cupones.</p>}
                  </div>}

                  {discountMode === "MANUAL" && <div className="mt-3"><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-neutral-400">$</span><input value={discountInput} onChange={(event) => { setDiscountInput(event.target.value.replace(/\D/g, "")); setError(""); }} inputMode="numeric" className="alento-input w-full rounded-2xl py-3 pl-8 pr-4 font-black" placeholder="0" /></div><p className="mt-2 text-[10px] text-neutral-400">Usa manual solo para excepciones. No se combina con un cupón.</p></div>}
                </section>

                <section className="rounded-[22px] border border-neutral-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">{fulfillmentType === "DELIVERY" ? "3" : "2"}. Forma de pago</p><h3 className="mt-1 text-lg font-black">¿Cómo paga el cliente?</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">{activePaymentMethods.map((method) => { const selected = paymentMethodId === method.id; return <button key={method.id} onClick={() => { setPaymentMethodId(method.id); setError(""); }} className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left ${selected ? "border-[var(--brand-red)] bg-red-50" : "border-neutral-200"}`}><span className="text-sm font-black">{method.name}</span><span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-black ${selected ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white" : "border-neutral-300 text-transparent"}`}>✓</span></button>; })}</div>
                </section>
              </div>

              <section className="h-fit rounded-[22px] border border-neutral-200 bg-[#faf9f7] p-4 lg:sticky lg:top-0">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">Resumen</p><h3 className="mt-1 text-lg font-black">Revisión del pedido</h3>
                <div className="mt-4 space-y-3 border-b border-neutral-200 pb-4"><div className="flex justify-between gap-4 text-xs"><span className="text-neutral-500">Tipo</span><b>{fulfillmentLabel(fulfillmentType)}</b></div>{customer && <div className="flex justify-between gap-4 text-xs"><span className="text-neutral-500">Cliente</span><b>{customer.name}</b></div>}{fulfillmentType === "DELIVERY" && <div className="flex justify-between gap-4 text-xs"><span className="text-neutral-500">Dirección</span><b className="max-w-[220px] text-right">{address}</b></div>}{selectedDeliveryZone && <div className="flex justify-between gap-4 text-xs"><span className="text-neutral-500">Zona</span><b>{selectedDeliveryZone.name}</b></div>}{selectedCoupon && discountMode === "COUPON" && <div className="flex justify-between gap-4 text-xs"><span className="text-neutral-500">Cupón</span><b>{selectedCoupon.name}</b></div>}{paymentMethodId && <div className="flex justify-between gap-4 text-xs"><span className="text-neutral-500">Pago</span><b>{activePaymentMethods.find((method) => method.id === paymentMethodId)?.name}</b></div>}</div>
                <div className="alento-scroll mt-4 max-h-44 space-y-2 overflow-y-auto pr-1">{cart.map((item) => <div key={item.key} className="rounded-xl border border-neutral-200 bg-white p-2.5"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-black">{item.quantity} × {item.name}</p><p className="mt-0.5 line-clamp-2 text-[10px] text-neutral-500">{item.detail}</p></div><b className="whitespace-nowrap text-xs">{formatCOP(item.unitPrice * item.quantity)}</b></div></div>)}</div>
                <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4 text-sm"><div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><b>{formatCOP(subtotal)}</b></div>{fulfillmentType === "DELIVERY" && <div className="flex justify-between"><span className="text-neutral-500">Domicilio</span><b>{selectedDeliveryZone ? formatCOP(deliveryFee) : "Pendiente"}</b></div>}{discount > 0 && <div className="flex justify-between text-emerald-700"><span>{discountMode === "COUPON" && selectedCoupon ? `Cupón · ${selectedCoupon.name}` : "Descuento manual"}</span><b>− {formatCOP(discount)}</b></div>}<div className="flex items-end justify-between border-t border-dashed pt-3"><span className="font-black">Total</span><b className="text-2xl font-black text-[var(--brand-red)]">{formatCOP(total)}</b></div></div>
              </section>
            </div>
          )}
          {error && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-neutral-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
          <p className="text-[10px] text-neutral-400">Solo se permite una fuente de descuento por pedido: cupón o manual.</p>
          <div className="flex gap-2"><button onClick={onClose} className="rounded-2xl border bg-white px-5 py-3 text-sm font-black">Volver</button><button onClick={validateCheckout} disabled={loadingSettings || Boolean(settingsError)} className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 text-sm font-black text-white disabled:bg-neutral-300">Validar cierre</button></div>
        </div>
      </div>
    </div>
  );
}
