"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { PublicCartItem } from "@/lib/publicCart";
import type { PublicCheckoutSelection } from "@/components/PublicCheckoutDelivery";

type PaymentMethod = {
  id: string;
  name: string;
};

type CustomerData = {
  id?: number;
  name: string;
  countryCode: string;
  phone: string;
  email: string;
};

type CreatedOrder = {
  id: number;
  code: string;
  status: string;
  fulfillmentType: "DELIVERY" | "PICKUP";
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  trackingPath?: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
}

function isCash(method?: PaymentMethod | null) {
  if (!method) return false;
  return (
    method.id.toLowerCase() === "cash" ||
    method.name.trim().toLowerCase() === "efectivo"
  );
}

export default function PublicCheckoutCustomer({
  cart,
  selection,
  onBack,
  onComplete,
  fullPage = false,
}: {
  cart: PublicCartItem[];
  selection: PublicCheckoutSelection;
  onBack: () => void;
  onComplete: (order: CreatedOrder) => void;
  fullPage?: boolean;
}) {
  const [customer, setCustomer] = useState<CustomerData>({
    name: "",
    countryCode: "+57",
    phone: "",
    email: "",
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyStep, setVerifyStep] = useState<"send" | "code">("send");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState("");

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart],
  );
  const deliveryFee =
    selection.fulfillmentType === "DELIVERY" ? selection.deliveryFee : 0;
  const total = subtotal + deliveryFee;
  const selectedPayment =
    paymentMethods.find((method) => method.id === paymentMethodId) ?? null;
  const cashPayment = isCash(selectedPayment);
  const hasCashAmount = cashReceived.trim().length > 0;
  const cashValue = Number(cashReceived || 0);
  const cashValid =
    !cashPayment ||
    !hasCashAmount ||
    (Number.isFinite(cashValue) && cashValue >= total);
  const change =
    cashPayment && hasCashAmount && cashValid ? cashValue - total : 0;

  async function loadAuthenticatedCustomer() {
    const response = await fetch("/api/auth/customer/me", { cache: "no-store" });
    if (!response.ok) {
      setSignedIn(false);
      return;
    }

    const data = await response.json();
    if (!data?.authenticated || !data?.customer) {
      setSignedIn(false);
      return;
    }

    setSignedIn(true);
    setCustomer({
      id: data.customer.id,
      name: data.customer.name === "NUEVO" ? "" : data.customer.name || "",
      countryCode: data.customer.countryCode || "+57",
      phone: data.customer.phone || "",
      email: data.customer.email || "",
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [checkoutResponse] = await Promise.all([
          fetch("/api/public-checkout", { cache: "no-store" }),
          loadAuthenticatedCustomer(),
        ]);

        const checkoutData = await checkoutResponse.json();
        if (!checkoutResponse.ok) {
          throw new Error(
            checkoutData.error || "No fue posible cargar el cierre del pedido.",
          );
        }

        if (!cancelled) {
          setPaymentMethods(checkoutData.paymentMethods ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No fue posible cargar el cierre del pedido.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendVerificationCode() {
    if (phoneDigits(customer.phone).length < 7) {
      setVerifyNotice("Escribe primero un número de teléfono válido.");
      return;
    }

    setVerifyBusy(true);
    setVerifyNotice("");

    try {
      const response = await fetch("/api/auth/customer/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode: customer.countryCode,
          phone: customer.phone,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible enviar el código.");
      }
      setVerifyStep("code");
      setVerifyNotice("Te enviamos un código por WhatsApp.");
    } catch (requestError) {
      setVerifyNotice(
        requestError instanceof Error
          ? requestError.message
          : "No fue posible enviar el código.",
      );
    } finally {
      setVerifyBusy(false);
    }
  }

  async function verifyPhone(event: FormEvent) {
    event.preventDefault();
    setVerifyBusy(true);
    setVerifyNotice("");

    try {
      const response = await fetch("/api/auth/customer/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode: customer.countryCode,
          phone: customer.phone,
          code: verifyCode,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "El código no es válido.");
      }

      await loadAuthenticatedCustomer();
      setVerifyOpen(false);
      setVerifyStep("send");
      setVerifyCode("");
      setVerifyNotice("");
      setError("");
    } catch (verifyError) {
      setVerifyNotice(
        verifyError instanceof Error
          ? verifyError.message
          : "No fue posible validar el número.",
      );
    } finally {
      setVerifyBusy(false);
    }
  }

  async function createOrder() {
    setError("");

    if (!customer.name.trim()) {
      setError("Escribe tu nombre.");
      return;
    }
    if (phoneDigits(customer.phone).length < 7) {
      setError("Ingresa un teléfono válido.");
      return;
    }
    if (!paymentMethodId) {
      setError("Selecciona una forma de pago.");
      return;
    }
    if (cashPayment && hasCashAmount && !cashValid) {
      setError(`Si indicas "Paga con", el valor debe ser igual o mayor a ${money(total)}.`);
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/public-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillmentType: selection.fulfillmentType,
          customer: {
            name: customer.name,
            countryCode: customer.countryCode,
            phone: customer.phone,
            email: customer.email,
          },
          destination:
            selection.fulfillmentType === "DELIVERY"
              ? selection.destination
              : null,
          paymentMethodId,
          cashReceived: cashPayment && hasCashAmount ? cashValue : null,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            configuration: item.configuration,
            notes: item.notes ?? null,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible crear el pedido.");
      }

      onComplete(data.order);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No fue posible crear el pedido.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className={
        fullPage
          ? "w-full bg-[#090909]"
          : "fixed inset-0 z-[145] flex items-end justify-center bg-black/82 backdrop-blur-sm sm:items-center sm:p-5"
      }
    >
      <div
        className={
          fullPage
            ? "mx-auto flex min-h-[calc(100dvh-72px)] w-full max-w-[1080px] flex-col bg-[#101010] text-white"
            : "flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#101010] text-white shadow-[0_28px_90px_rgba(0,0,0,.58)] sm:max-h-[92vh] sm:max-w-[680px] sm:rounded-[30px]"
        }
      >
        <header
          className={
            "border-b border-white/10 px-4 py-4 sm:px-5 " +
            (fullPage ? "sticky top-0 z-20 bg-[#101010]/95 backdrop-blur-xl" : "")
          }
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#ff3439]">
                Finaliza tu pedido
              </p>
              <h2 className="mt-1 text-[22px] font-bold tracking-[-0.03em]">
                Tus datos
              </h2>
              <p className="mt-1 text-[10px] leading-4 text-white/40">
                Puedes comprar como invitado. Iniciar sesión no es obligatorio.
              </p>
            </div>
            <button
              type="button"
              onClick={onBack}
              disabled={creating}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-xl text-white/55"
              aria-label="Volver"
            >
              ×
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.035] text-center">
            <div className="px-2 py-2.5">
              <span className="block text-[7px] uppercase tracking-[0.12em] text-white/30">
                Pedido
              </span>
              <b className="mt-0.5 block text-[10px]">
                {selection.fulfillmentType === "DELIVERY"
                  ? "Domicilio"
                  : "Recoger"}
              </b>
            </div>
            <div className="border-l border-white/10 px-2 py-2.5">
              <span className="block text-[7px] uppercase tracking-[0.12em] text-white/30">
                Domicilio
              </span>
              <b className="mt-0.5 block text-[10px] text-[#ff454b]">
                {money(deliveryFee)}
              </b>
            </div>
            <div className="border-l border-white/10 px-2 py-2.5">
              <span className="block text-[7px] uppercase tracking-[0.12em] text-white/30">
                Total
              </span>
              <b className="mt-0.5 block text-[10px]">{money(total)}</b>
            </div>
          </div>
        </header>

        <div
          className={
            "min-h-0 flex-1 p-4 sm:p-5 " +
            (fullPage ? "mx-auto w-full max-w-[900px] overflow-visible py-6 sm:py-8" : "overflow-y-auto")
          }
        >
          {loading ? (
            <div className="rounded-[20px] border border-white/10 bg-white/[0.035] p-6 text-center text-[11px] text-white/40">
              Preparando el cierre del pedido...
            </div>
          ) : (
            <div className="space-y-4">
              <section className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.13em] text-white/30">
                      1. Cliente
                    </p>
                    <h3 className="mt-1 text-[16px] font-bold">
                      ¿A nombre de quién?
                    </h3>
                  </div>

                  {signedIn && (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[8px] font-bold text-emerald-300">
                      Cuenta identificada
                    </span>
                  )}
                </div>

                <label className="mt-4 block">
                  <span className="text-[9px] font-semibold text-white/45">
                    Nombre
                  </span>
                  <input
                    value={customer.name}
                    onChange={(event) =>
                      setCustomer((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    autoComplete="name"
                    className="mt-1.5 h-11 w-full rounded-[13px] border border-white/10 bg-black/25 px-3.5 text-[12px] text-white outline-none focus:border-[#e21a22]"
                    placeholder="Tu nombre"
                  />
                </label>

                <div className="mt-3 grid grid-cols-[78px_1fr] gap-2">
                  <label>
                    <span className="text-[9px] font-semibold text-white/45">
                      País
                    </span>
                    <input
                      value={customer.countryCode}
                      onChange={(event) =>
                        setCustomer((current) => ({
                          ...current,
                          countryCode: event.target.value,
                        }))
                      }
                      className="mt-1.5 h-11 w-full rounded-[13px] border border-white/10 bg-black/25 px-2 text-center text-[12px] text-white outline-none focus:border-[#e21a22]"
                    />
                  </label>
                  <label>
                    <span className="text-[9px] font-semibold text-white/45">
                      WhatsApp / celular
                    </span>
                    <input
                      value={customer.phone}
                      onChange={(event) =>
                        setCustomer((current) => ({
                          ...current,
                          phone: phoneDigits(event.target.value),
                        }))
                      }
                      inputMode="tel"
                      autoComplete="tel"
                      readOnly={signedIn}
                      className={
                        "mt-1.5 h-11 w-full rounded-[13px] border border-white/10 px-3.5 text-[12px] text-white outline-none " +
                        (signedIn
                          ? "cursor-not-allowed bg-white/[0.04] text-white/55"
                          : "bg-black/25 focus:border-[#e21a22]")
                      }
                      placeholder="300 000 0000"
                    />
                  </label>
                </div>

                {!signedIn && phoneDigits(customer.phone).length >= 7 && (
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyOpen(true);
                      setVerifyStep("send");
                      setVerifyNotice("");
                    }}
                    className="mt-2 flex w-full items-center justify-between rounded-[13px] border border-[#e21a22]/25 bg-[#e21a22]/10 px-3.5 py-2.5 text-left"
                  >
                    <span>
                      <b className="block text-[10px] text-white/85">
                        ¿Ya has comprado con este número?
                      </b>
                      <span className="mt-0.5 block text-[8px] text-white/35">
                        Verifica tu WhatsApp y autocompletamos tus datos.
                      </span>
                    </span>
                    <span className="text-[9px] font-bold text-[#ff454b]">
                      Recuperar
                    </span>
                  </button>
                )}

                <label className="mt-3 block">
                  <span className="text-[9px] font-semibold text-white/45">
                    Correo <span className="text-white/25">(opcional)</span>
                  </span>
                  <input
                    value={customer.email}
                    onChange={(event) =>
                      setCustomer((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    type="email"
                    autoComplete="email"
                    className="mt-1.5 h-11 w-full rounded-[13px] border border-white/10 bg-black/25 px-3.5 text-[12px] text-white outline-none focus:border-[#e21a22]"
                    placeholder="correo@ejemplo.com"
                  />
                </label>

                {!signedIn && (
                  <p className="mt-3 text-[9px] leading-4 text-white/30">
                    Si ya has comprado antes, puedes verificar tu número por WhatsApp
                    para recuperar tus datos. También puedes continuar como invitado.
                  </p>
                )}
              </section>

              <section className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.13em] text-white/30">
                  2. Forma de pago
                </p>
                <h3 className="mt-1 text-[16px] font-bold">
                  ¿Cómo vas a pagar?
                </h3>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {paymentMethods.map((method) => {
                    const active = paymentMethodId === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethodId(method.id);
                          setCashReceived("");
                          setError("");
                        }}
                        className={
                          "rounded-[15px] border px-3 py-3 text-left transition " +
                          (active
                            ? "border-[#e21a22] bg-[#e21a22]/15"
                            : "border-white/10 bg-black/20")
                        }
                      >
                        <b className="text-[11px]">{method.name}</b>
                        {active && (
                          <span className="float-right text-[#ff454b]">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {cashPayment && (
                  <div className="mt-3 rounded-[16px] border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-white/40">
                        ¿Con cuánto pagas? <span className="text-white/25">(opcional)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setCashReceived(String(total))}
                        className="text-[9px] font-bold text-[#ff454b]"
                      >
                        Pago exacto
                      </button>
                    </div>
                    <input
                      value={cashReceived}
                      onChange={(event) =>
                        setCashReceived(event.target.value.replace(/\D/g, ""))
                      }
                      inputMode="numeric"
                      className="mt-2 h-11 w-full rounded-[13px] border border-white/10 bg-white px-3.5 text-[14px] font-bold text-black outline-none"
                      placeholder="0"
                    />
                    {hasCashAmount && (
                      <div className="mt-2 flex items-center justify-between text-[9px]">
                        <span className="text-white/35">
                          {cashValid ? "Vueltas" : "Falta"}
                        </span>
                        <b className={cashValid ? "text-emerald-300" : "text-amber-300"}>
                          {cashValid
                            ? money(change)
                            : money(Math.max(0, total - cashValue))}
                        </b>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {selection.fulfillmentType === "DELIVERY" &&
                selection.destination && (
                  <section className="rounded-[18px] border border-white/10 bg-white/[0.025] px-4 py-3">
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-white/28">
                      Entrega
                    </span>
                    <b className="mt-1 block text-[11px] leading-5 text-white/75">
                      {selection.destination.formattedAddress}
                    </b>
                  </section>
                )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-[15px] border border-red-500/25 bg-red-500/10 p-3 text-[10px] font-semibold leading-5 text-red-100">
              {error}
            </div>
          )}
        </div>

        <footer
          className={
            "border-t border-white/10 bg-[#0c0c0c] p-3 sm:p-4 " +
            (fullPage ? "sticky bottom-0 z-20 mt-auto" : "")
          }
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] text-white/40">Total del pedido</span>
            <b className="text-[22px]">{money(total)}</b>
          </div>
          <button
            type="button"
            onClick={() => void createOrder()}
            disabled={loading || creating}
            className="h-12 w-full rounded-full bg-[#e21a22] text-[11px] font-bold uppercase tracking-[0.05em] text-white disabled:bg-white/10 disabled:text-white/30"
          >
            {creating ? "Creando pedido..." : "Confirmar compra"}
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={creating}
            className="mt-1 h-9 w-full text-[9px] font-semibold text-white/35"
          >
            Volver a entrega
          </button>
        </footer>
      </div>

      {verifyOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[410px] rounded-[26px] border border-white/10 bg-[#131313] p-5 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#ff3439]">
                  Recuperar mis datos
                </p>
                <h3 className="mt-1 text-[19px] font-bold">
                  Verifica tu WhatsApp
                </h3>
                <p className="mt-1 text-[10px] leading-4 text-white/40">
                  Solo mostramos datos guardados después de validar que el número es tuyo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVerifyOpen(false)}
                className="h-8 w-8 rounded-full border border-white/10 bg-white/[0.05] text-lg text-white/50"
              >
                ×
              </button>
            </div>

            {verifyStep === "send" ? (
              <>
                <div className="mt-4 rounded-[15px] border border-white/10 bg-white/[0.035] px-4 py-3 text-[12px] font-bold">
                  {customer.countryCode} {customer.phone || "—"}
                </div>
                <button
                  type="button"
                  onClick={() => void sendVerificationCode()}
                  disabled={verifyBusy}
                  className="mt-3 h-11 w-full rounded-full bg-[#e21a22] text-[10px] font-bold text-white disabled:opacity-40"
                >
                  {verifyBusy ? "Enviando..." : "Enviar código por WhatsApp"}
                </button>
              </>
            ) : (
              <form onSubmit={verifyPhone}>
                <input
                  value={verifyCode}
                  onChange={(event) =>
                    setVerifyCode(
                      event.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  inputMode="numeric"
                  maxLength={6}
                  className="mt-4 h-14 w-full rounded-[15px] border border-white/10 bg-white/[0.05] px-4 text-center text-[25px] font-bold tracking-[0.28em] outline-none focus:border-[#e21a22]"
                  placeholder="000000"
                />
                <button
                  disabled={verifyBusy || verifyCode.length !== 6}
                  className="mt-3 h-11 w-full rounded-full bg-[#e21a22] text-[10px] font-bold text-white disabled:opacity-40"
                >
                  {verifyBusy ? "Validando..." : "Validar y autocompletar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVerifyStep("send");
                    setVerifyCode("");
                    setVerifyNotice("");
                  }}
                  className="mt-1 h-9 w-full text-[9px] text-white/40"
                >
                  Enviar otro código
                </button>
              </form>
            )}

            {verifyNotice && (
              <p className="mt-3 rounded-[13px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[10px] leading-4 text-white/65">
                {verifyNotice}
              </p>
            )}

            <button
              type="button"
              onClick={() => setVerifyOpen(false)}
              className="mt-2 h-9 w-full text-[9px] font-semibold text-white/35"
            >
              Seguir como invitado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
