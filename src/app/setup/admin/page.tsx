"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function BootstrapAdminPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", setupKey: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/staff/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible crear el administrador.");
      router.replace("/usuarios");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No fue posible crear el administrador.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0b] p-5">
      <form onSubmit={submit} className="w-full max-w-[520px] overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="border-b-[3px] border-[var(--brand-red)] bg-[linear-gradient(135deg,#09090a,#281516)] px-6 py-5 text-white">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">Configuración inicial</p>
          <h1 className="mt-1 text-[25px] font-semibold">Primer administrador</h1>
          <p className="mt-1 text-[11px] text-white/55">Esta pantalla solo funciona mientras no exista ningún usuario interno.</p>
        </div>
        <div className="grid gap-4 p-6">
          {[
            ["name", "Nombre", "Administrador Alentó", "text"],
            ["email", "Correo", "admin@alentopizza.com", "email"],
            ["password", "Contraseña", "Mínimo 8 caracteres", "password"],
            ["setupKey", "Clave de configuración", "AUTH_BOOTSTRAP_KEY", "password"],
          ].map(([key,label,placeholder,type]) => (
            <label key={key}>
              <span className="text-[12px] font-semibold text-neutral-700">{label}</span>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                className="alento-input mt-2 h-12 w-full rounded-xl px-4 text-sm"
                placeholder={placeholder}
              />
            </label>
          ))}
          {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[11px] text-red-700">{error}</p>}
          <button disabled={busy} className="h-12 rounded-xl bg-[var(--brand-red)] text-[13px] font-semibold text-white disabled:opacity-50">
            {busy ? "Creando..." : "Crear administrador"}
          </button>
        </div>
      </form>
    </main>
  );
}
