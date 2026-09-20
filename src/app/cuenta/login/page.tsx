"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const LOGO = "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

export default function CustomerLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [countryCode, setCountryCode] = useState("+57");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/customer/request-code", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ countryCode, phone }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible enviar el código.");
      setStep("code");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible enviar el código.");
    } finally { setBusy(false); }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/customer/verify-code", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ countryCode, phone, code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Código inválido.");
      router.replace("/cuenta");
      router.refresh();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "No fue posible validar el código.");
    } finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_0%,rgba(229,28,17,.12),transparent_32%),#f7f4ef] p-5">
      <div className="w-full max-w-[430px] overflow-hidden rounded-[30px] border border-neutral-200 bg-white shadow-[0_30px_80px_rgba(28,23,20,.16)]">
        <div className="px-6 pb-2 pt-6 text-center">
          <img src={LOGO} alt="Alentó Pizza" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
          <p className="mt-4 text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Tu cuenta Alentó</p>
          <h1 className="mt-1 text-[25px] font-semibold tracking-[-0.025em] text-neutral-950">{step === "phone" ? "Ingresa con tu celular" : "Revisa tu WhatsApp"}</h1>
          <p className="mx-auto mt-2 max-w-[330px] text-[12px] leading-5 text-neutral-500">
            {step === "phone" ? "No necesitas contraseña. Te enviaremos un código para consultar tu información, direcciones e historial." : `Enviamos un código de 6 dígitos al número ${countryCode} ${phone}.`}
          </p>
        </div>

        <form onSubmit={step === "phone" ? requestCode : verify} className="p-6">
          {step === "phone" ? (
            <div className="flex gap-2">
              <input value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="alento-input h-12 w-20 rounded-xl px-3 text-center text-sm" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="alento-input h-12 min-w-0 flex-1 rounded-xl px-4 text-sm" placeholder="300 000 0000" autoFocus />
            </div>
          ) : (
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0,6))} inputMode="numeric" maxLength={6} className="alento-input h-14 w-full rounded-xl px-4 text-center text-[26px] font-semibold tracking-[0.28em]" placeholder="000000" autoFocus />
          )}

          {error && <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[11px] leading-4 text-red-700">{error}</p>}

          <button disabled={busy} className="mt-4 h-12 w-full rounded-xl bg-[var(--brand-red)] text-[13px] font-semibold text-white disabled:opacity-50">
            {busy ? "Procesando..." : step === "phone" ? "Enviar código por WhatsApp" : "Validar e ingresar"}
          </button>

          {step === "code" && <button type="button" onClick={() => { setStep("phone"); setCode(""); setError(""); }} className="mt-2 h-10 w-full text-[11px] font-semibold text-neutral-500">Cambiar número</button>}
          <button type="button" onClick={() => router.back()} className="mt-2 h-10 w-full text-[11px] text-neutral-400">Ahora no</button>
        </form>
      </div>
    </main>
  );
}
