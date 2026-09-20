"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LOGO = "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

type StaffRole = "ADMIN" | "POS" | "KITCHEN" | "CASHIER" | "DRIVER" | "DISPATCH";

function defaultRouteForRoles(roles: StaffRole[]) {
  if (roles.includes("ADMIN") || roles.includes("POS")) return "/";
  if (roles.includes("KITCHEN")) return "/cocina";
  if (roles.includes("CASHIER")) return "/caja";
  if (roles.includes("DRIVER") || roles.includes("DISPATCH")) return "/sin-acceso";
  return "/sin-acceso";
}

function canAccessRoute(pathname: string, roles: StaffRole[]) {
  if (roles.includes("ADMIN")) return true;

  if (pathname === "/") {
    return roles.includes("POS") || roles.includes("CASHIER");
  }

  if (pathname === "/cocina" || pathname.startsWith("/cocina/")) {
    return roles.includes("KITCHEN");
  }

  if (pathname === "/caja" || pathname.startsWith("/caja/")) {
    return roles.includes("CASHIER");
  }

  if (pathname === "/clientes" || pathname.startsWith("/clientes/")) {
    return roles.includes("POS");
  }

  if (pathname === "/pedidos" || pathname.startsWith("/pedidos/")) {
    return roles.includes("POS") || roles.includes("CASHIER");
  }

  return false;
}

export default function StaffLoginPage() {
  const router = useRouter();
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

  async function submit(event: FormEvent) {
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_0%,rgba(229,28,17,.18),transparent_28%),#0a0a0b] p-5">
      <div className="w-full max-w-[430px] overflow-hidden rounded-[30px] border border-white/10 bg-white shadow-[0_30px_90px_rgba(0,0,0,.38)]">
        <div className="bg-[linear-gradient(135deg,#0a0a0b,#241516)] px-7 py-7 text-white">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-black">
              <img src={LOGO} alt="Alentó Pizza" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/45">Acceso colaboradores</p>
              <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.025em]">Alentó App</h1>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="p-6">
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-neutral-950">Iniciar sesión</h2>
            <p className="mt-1 text-[12px] leading-5 text-neutral-500">Ingresa con el correo y contraseña asignados por un administrador.</p>
          </div>

          <label className="mt-5 block">
            <span className="text-[12px] font-semibold text-neutral-700">Correo</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="alento-input mt-2 h-12 w-full rounded-xl px-4 text-sm"
              placeholder="colaborador@alento.com"
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
            className="mt-5 h-12 w-full rounded-xl bg-[var(--brand-red)] text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(229,28,17,.22)] disabled:opacity-50"
          >
            {busy ? "Ingresando..." : "Ingresar"}
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
        </form>
      </div>
    </main>
  );
}
