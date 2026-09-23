"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PublicMobileNav from "@/components/PublicMobileNav";
import {
  PUBLIC_CART_STORAGE_KEY,
  type PublicCartItem,
} from "@/lib/publicCart";

const LOGO = "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";
const FALLBACK_HOME_IMAGE =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/CpQ55KIWphJs8CeomkY3.png";

type PublicHomeSettings = {
  landing?: {
    mobileImageUrl?: string;
    desktopImageUrl?: string;
  };
};

type StaffRole = "ADMIN" | "POS" | "KITCHEN" | "CASHIER" | "DRIVER" | "DISPATCH";
type Mode = "customer" | "staff";

function defaultRouteForRoles(roles: StaffRole[]) {
  if (roles.includes("ADMIN") || roles.includes("POS") || roles.includes("CASHIER")) return "/interno";
  if (roles.includes("KITCHEN")) return "/cocina";
  if (roles.includes("DRIVER") || roles.includes("DISPATCH")) return "/repartidor";
  return "/sin-acceso";
}

function canAccessRoute(pathname: string, roles: StaffRole[]) {
  if (roles.includes("ADMIN")) return pathname !== "/";
  if (pathname === "/interno" || pathname.startsWith("/interno/")) {
    return roles.includes("POS") || roles.includes("CASHIER");
  }
  if (pathname === "/cocina" || pathname.startsWith("/cocina/")) return roles.includes("KITCHEN");
  if (pathname === "/caja" || pathname.startsWith("/caja/")) return roles.includes("CASHIER");
  if (pathname === "/clientes" || pathname.startsWith("/clientes/")) return roles.includes("POS");
  if (pathname === "/pedidos" || pathname.startsWith("/pedidos/")) return roles.includes("POS") || roles.includes("CASHIER");
  if (pathname === "/repartidor") return roles.includes("DRIVER") || roles.includes("DISPATCH");
  return false;
}

export default function UnifiedLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("customer");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [countryCode, setCountryCode] = useState("+57");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [home, setHome] = useState<PublicHomeSettings | null>(null);
  const [cart, setCart] = useState<PublicCartItem[]>([]);

  useEffect(() => {
    fetch("/api/auth/staff/bootstrap")
      .then((response) => response.json())
      .then((result) => setNeedsBootstrap(Boolean(result.needsBootstrap)))
      .catch(() => {});

    fetch("/api/public-home", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => setHome(result?.settings ?? null))
      .catch(() => {});

    try {
      const savedCart = window.localStorage.getItem(PUBLIC_CART_STORAGE_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {
      // El login no debe bloquearse si el carrito local está corrupto.
    }
  }, []);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setBusy(false);
    if (nextMode === "customer") {
      setStep("phone");
      setCode("");
    }
  }

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/customer/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode, phone }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible enviar el código.");
      setStep("code");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible enviar el código.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCustomer(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/customer/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode, phone, code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Código inválido.");
      router.replace("/cuenta");
      router.refresh();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "No fue posible validar el código.");
    } finally {
      setBusy(false);
    }
  }

  async function loginStaff(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible iniciar sesión.");

      const roles = (result.user?.roles ?? []) as StaffRole[];
      const requestedRoute = new URLSearchParams(window.location.search).get("next");
      const destination =
        requestedRoute && canAccessRoute(requestedRoute, roles)
          ? requestedRoute
          : defaultRouteForRoles(roles);

      router.replace(destination);
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No fue posible iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  );

  const customerTitle = step === "phone" ? "Ingresa con tu celular" : "Revisa tu WhatsApp";
  const mobileBackground = home?.landing?.mobileImageUrl || FALLBACK_HOME_IMAGE;
  const desktopBackground =
    home?.landing?.desktopImageUrl ||
    home?.landing?.mobileImageUrl ||
    FALLBACK_HOME_IMAGE;

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-black px-5 pb-28 pt-5 md:p-5">
      <picture className="absolute inset-0">
        <source media="(min-width: 900px)" srcSet={desktopBackground} />
        <img
          src={mobileBackground}
          alt=""
          className="h-full w-full object-cover object-center"
          aria-hidden="true"
        />
      </picture>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      <div className="relative z-10 w-full max-w-[430px] overflow-hidden rounded-[30px] border border-white/10 bg-[#0d0d0e]/95 shadow-[0_32px_90px_rgba(0,0,0,.55)] backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-[#e21a22] to-transparent" />
        <div className="px-6 pb-2 pt-7 text-center">
          <div className="mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.04] shadow-[0_12px_30px_rgba(0,0,0,.35)]">
            <img src={LOGO} alt="Alentó Pizza" className="h-[56px] w-[56px] rounded-2xl object-cover" />
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ef3a40]">
            {mode === "customer" ? "Tu cuenta Alentó" : "Acceso colaboradores"}
          </p>
          <h1 className="mt-1 text-[27px] font-semibold tracking-[-0.03em] text-white">
            {mode === "customer" ? customerTitle : "Iniciar sesión"}
          </h1>
          <p className="mx-auto mt-2 max-w-[330px] text-[12px] leading-5 text-white/48">
            {mode === "customer"
              ? step === "phone"
                ? "Ingresa con tu celular. Te enviaremos un código por WhatsApp."
                : `Enviamos un código de 6 dígitos al número ${countryCode} ${phone}.`
              : "Ingresa con el correo y contraseña asignados por un administrador."}
          </p>
        </div>

        {mode === "customer" ? (
          <form onSubmit={step === "phone" ? requestCode : verifyCustomer} className="p-6">
            {step === "phone" ? (
              <div className="flex gap-2">
                <input
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value)}
                  className="h-12 w-20 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-center text-sm text-white outline-none transition focus:border-[#e21a22] focus:ring-2 focus:ring-[#e21a22]/20"
                />
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  inputMode="tel"
                  className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#e21a22] focus:ring-2 focus:ring-[#e21a22]/20"
                  placeholder="300 000 0000"
                />
              </div>
            ) : (
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                className="h-14 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-center text-[26px] font-semibold tracking-[0.28em] text-white outline-none transition placeholder:text-white/22 focus:border-[#e21a22] focus:ring-2 focus:ring-[#e21a22]/20"
                placeholder="000000"
              />
            )}

            {error && <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[11px] leading-4 text-red-300">{error}</p>}

            <button disabled={busy} className="mt-4 h-12 w-full rounded-xl bg-[#e21a22] text-[13px] font-bold text-white shadow-[0_10px_26px_rgba(226,26,34,.24)] transition hover:bg-[#ef1c25] disabled:opacity-50">
              {busy ? "Procesando..." : step === "phone" ? "Enviar código por WhatsApp" : "Validar e ingresar"}
            </button>

            {step === "code" && (
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError("");
                }}
                className="mt-2 h-10 w-full text-[11px] font-semibold text-white/48 transition hover:text-white"
              >
                Cambiar número
              </button>
            )}

            {step === "phone" && (
              <div className="mt-5 border-t border-white/10 pt-5">
                <button
                  type="button"
                  onClick={() => switchMode("staff")}
                  className="h-11 w-full rounded-xl border border-white/12 bg-white/[0.05] text-[11px] font-semibold text-white/78 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                >
                  Iniciar como colaborador
                </button>
              </div>
            )}

            <button type="button" onClick={() => router.push("/menu")} className="mt-2 h-10 w-full text-[11px] font-medium text-white/38 transition hover:text-white/70">
              Volver A Menu
            </button>
          </form>
        ) : (
          <form onSubmit={loginStaff} className="p-6">
            <label className="block">
              <span className="text-[12px] font-semibold text-white/70">Correo</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#e21a22] focus:ring-2 focus:ring-[#e21a22]/20"
                placeholder="colaborador@alento.com"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-[12px] font-semibold text-white/70">Contraseña</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#e21a22] focus:ring-2 focus:ring-[#e21a22]/20"
                placeholder="••••••••"
              />
            </label>

            {error && <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[11px] text-red-300">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="mt-5 h-12 w-full rounded-xl bg-[#e21a22] text-[13px] font-bold text-white shadow-[0_10px_26px_rgba(226,26,34,.24)] transition hover:bg-[#ef1c25] disabled:opacity-50"
            >
              {busy ? "Ingresando..." : "Ingresar como colaborador"}
            </button>

            {needsBootstrap && (
              <button
                type="button"
                onClick={() => router.push("/setup/admin")}
                className="mt-3 w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3 text-[11px] font-semibold text-white/65 transition hover:bg-white/[0.08] hover:text-white"
              >
                Configurar primer administrador
              </button>
            )}

            <button
              type="button"
              onClick={() => switchMode("customer")}
              className="mt-5 h-11 w-full rounded-xl border border-white/12 bg-white/[0.05] text-[11px] font-semibold text-white/78 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              Volver al acceso de clientes
            </button>

            <button
              type="button"
              onClick={() => router.push("/menu")}
              className="mt-2 h-10 w-full text-[11px] font-medium text-white/38 transition hover:text-white/70"
            >
              Volver A Menu
            </button>
          </form>
        )}
      </div>

      <PublicMobileNav active="profile" cartCount={cartCount} />
    </main>
  );
}
