"use client";

import { useState } from "react";

export default function CustomerAccountHeader({
  name,
  phone,
}: {
  name: string;
  phone: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/customer/logout", {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("No fue posible cerrar la sesión.");
      }

      window.location.href = "/";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible cerrar la sesión.",
      );
      setBusy(false);
    }
  }

  return (
    <>
      <header className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(226,26,34,.16),transparent_34%),linear-gradient(145deg,#171717,#090909_72%)] p-5 shadow-[0_20px_60px_rgba(0,0,0,.34)] sm:p-6">
        <button
          type="button"
          onClick={() => {
            setError("");
            setConfirmOpen(true);
          }}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/65 transition hover:border-[#e21a22]/50 hover:bg-[#e21a22]/12 hover:text-white sm:right-5 sm:top-5"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-[18px] w-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
            <path d="M14 3h4a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-4" />
          </svg>
        </button>

        <p className="pr-12 text-[10px] font-black uppercase tracking-[0.18em] text-[#ff454b]">
          Mi cuenta
        </p>
        <h1 className="mt-2 pr-12 text-[28px] font-black tracking-[-0.035em] text-white">
          {name}
        </h1>
        <p className="mt-1 pr-12 text-[12px] font-medium text-white/48">
          {phone}
        </p>
      </header>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[170] flex items-center justify-center bg-black/72 p-4 backdrop-blur-[4px]"
          onClick={() => !busy && setConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[360px] overflow-hidden rounded-[24px] border border-white/10 bg-[#111] text-white shadow-[0_30px_90px_rgba(0,0,0,.45)]"
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#e21a22]/25 bg-[#e21a22]/10 text-[#ff454b]">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 17l5-5-5-5" />
                    <path d="M15 12H3" />
                    <path d="M14 3h4a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-4" />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ff454b]">
                    Mi cuenta
                  </p>
                  <h2
                    id="logout-title"
                    className="mt-1 text-[20px] font-black tracking-[-0.025em]"
                  >
                    ¿Cerrar sesión?
                  </h2>
                  <p className="mt-2 text-[12px] leading-5 text-white/55">
                    Tendrás que ingresar nuevamente con tu número para ver tu
                    cuenta y tus pedidos.
                  </p>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-[#e21a22]/25 bg-[#e21a22]/10 px-3 py-2.5 text-[10px] font-semibold text-[#ff7a7e]">
                  {error}
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmOpen(false)}
                  className="h-11 rounded-xl border border-white/10 bg-white/[0.04] text-[11px] font-bold text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void logout()}
                  className="h-11 rounded-xl bg-[#e21a22] text-[11px] font-black text-white transition hover:bg-[#c9151c] disabled:opacity-50"
                >
                  {busy ? "Saliendo..." : "Cerrar sesión"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
