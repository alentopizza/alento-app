"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LOGO = "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

type StaffRole = "ADMIN" | "POS" | "KITCHEN" | "CASHIER" | "DRIVER" | "DISPATCH";
type Mode = "customer" | "staff";

function defaultRouteForRoles(roles: StaffRole[]) {
  if (roles.includes("ADMIN") || roles.includes("POS") || roles.includes("CASHIER")) return "/interno";
  if (roles.includes("KITCHEN")) return "/cocina";
  if (roles.includes("DRIVER") || roles.includes("DISPATCH")) return "/sin-acceso";
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

  useEffect(() => {
    fetch("/api/auth/staff/bootstrap")
      .then((response) => response.json())
      .then((result) => setNeedsBootstrap(Boolean(result.needsBootstrap)))
      .catch(() => {});
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

  const customerTitle = step === "phone" ? "Ingresa con tu celular" : "Revisa tu WhatsApp";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_0%,rgba(229,28,17,.12),transparent_32%),#f7f4ef] p-5">
      <div className="w-full max-w-[430px] overflow-hidden rounded-[30px] border border-neutral-200 bg-white shadow-[0_30px_80px_rgba(28,23,20,.16)]">
        <div className="px-6 pb-2 pt-6 text-center">
          <img src={LOGO} alt="Alentó Pizza" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
          <p className="mt-4 text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
            {mode === "customer" ? "Tu cuenta Alentó" : "Acceso colaboradores"}
          </p>
          <h1 className="mt-1 text-[25px] font-semibold tracking-[-0.025em] text-neutral-950">
            {mode === "customer" ? customerTitle : "Iniciar sesión"}
          </h1>
          <p className="mx-auto mt-2 max-w-[330px] text-[12px] leading-5 text-neutral-500">
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
                  className="alento-input h-12 w-20 rounded-xl px-3 text-center text-sm"
                />
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  inputMode="tel"
                  className="alento-input h-12 min-w-0 flex-1 rounded-xl px-4 text-sm"
                  placeholder="300 000 0000"
                  autoFocus
                />
              </div>
            ) : (
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                className="alento-input h-14 w-full rounded-xl px-4 text-center text-[26px] font-semibold tracking-[0.28em]"
                placeholder="000000"
                autoFocus
              />
            )}

            {error && <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[11px] leading-4 text-red-700">{error}</p>}

            <button disabled={busy} className="mt-4 h-12 w-full rounded-xl bg-[var(--brand-red)] text-[13px] font-semibold text-white disabled:opacity-50">
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
                className="mt-2 h-10 w-full text-[11px] font-semibold text-neutral-500"
              >
                Cambiar número
              </button>
            )}

            {step === "phone" && (
              <div className="mt-5 border-t border-neutral-100 pt-5">
                <button
                  type="button"
                  onClick={() => switchMode("staff")}
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white text-[11px] font-semibold text-neutral-700"
                >
                  Iniciar como colaborador
                </button>
              </div>
            )}

            <button type="button" onClick={() => router.push("/")} className="mt-2 h-10 w-full text-[11px] text-neutral-400">
              Volver al inicio
            </button>
          </form>
        ) : (
          <form onSubmit={loginStaff} className="p-6">
            <label className="block">
              <span className="text-[12px] font-semibold text-neutral-700">Correo</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="alento-input mt-2 h-12 w-full rounded-xl px-4 text-sm"
                placeholder="colaborador@alento.com"
                autoFocus
              />
            </label>

            <label className="mt-4 block">
              <span className="text-[12px] font-semibold text-neutral-700">Contraseña</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="alento-input mt-2 h-12 w-full rounded-xl px-4 text-sm"
                placeholder="••••••••"
              />
            </label>

            {error && <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[11px] text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="mt-5 h-12 w-full rounded-xl bg-neutral-950 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Ingresando..." : "Ingresar como colaborador"}
            </button>

            {needsBootstrap && (
              <button
                type="button"
                onClick={() => router.push("/setup/admin")}
                className="mt-3 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[11px] font-semibold text-neutral-600"
              >
                Configurar primer administrador
              </button>
            )}

            <button
              type="button"
              onClick={() => switchMode("customer")}
              className="mt-5 h-11 w-full rounded-xl border border-neutral-200 bg-white text-[11px] font-semibold text-neutral-700"
            >
              Volver al acceso de clientes
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
