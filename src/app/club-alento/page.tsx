"use client";

import { useEffect, useMemo, useState } from "react";

type ClubSettings = {
  pointsPerThousand: number;
};

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ClubAlentoAdminPage() {
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/club-settings", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible cargar Club Alentó.");
        setSettings(data.settings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar Club Alentó.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const examples = useMemo(() => {
    const rate = settings?.pointsPerThousand ?? 10;
    return [10000, 39900, 69900].map((amount) => ({
      amount,
      points: Math.floor(amount / 1000) * rate,
    }));
  }, [settings]);

  async function save() {
    if (!settings) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/club-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible guardar Club Alentó.");
      setSettings(data.settings);
      setMessage("Configuración de Club Alentó guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible guardar Club Alentó.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="p-5 lg:p-8">
        <div className="alento-card mx-auto max-w-5xl rounded-[28px] p-8">
          Cargando Club Alentó...
        </div>
      </main>
    );
  }

  if (!settings) {
    return (
      <main className="p-5 lg:p-8">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700">
          {error || "No fue posible cargar Club Alentó."}
        </div>
      </main>
    );
  }

  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">Fidelización</p>
            <h1 className="text-3xl font-black tracking-tight">Club Alentó</h1>
            <p className="mt-1 max-w-2xl text-sm text-neutral-500">
              Define cuántos puntos recibe un cliente por cada $1.000 en compras completadas.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 text-sm font-black text-white disabled:bg-neutral-300"
          >
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>

        {(message || error) && (
          <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${error ? "border border-red-200 bg-red-50 text-red-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {error || message}
          </div>
        )}

        <section className="alento-card overflow-hidden rounded-[28px]">
          <div className="bg-[linear-gradient(135deg,#09090a,#261214)] p-6 text-white md:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">Regla de acumulación</p>
            <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-[28px] font-black tracking-[-0.04em] md:text-[36px]">
                  {settings.pointsPerThousand} puntos
                </h2>
                <p className="mt-1 text-sm text-white/55">por cada $1.000 gastados</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">Estado</span>
                <b className="mt-1 block text-sm text-emerald-300">Activo</b>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-5 md:grid-cols-[1fr_1.1fr] md:p-7">
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.12em] text-neutral-500">
                Puntos por cada $1.000
              </label>
              <input
                type="number"
                min={0}
                max={10000}
                step={1}
                value={settings.pointsPerThousand}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    pointsPerThousand: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                  })
                }
                className="alento-input mt-2 w-full rounded-2xl px-4 py-4 text-[22px] font-black"
              />
              <p className="mt-2 text-xs leading-5 text-neutral-500">
                Por ahora se contabilizan únicamente pedidos en estado <b>COMPLETED</b>.
                Los miles incompletos no generan puntos.
              </p>
            </div>

            <div className="rounded-[22px] border bg-[#faf9f7] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">Ejemplos con la regla actual</p>
              <div className="mt-3 space-y-2">
                {examples.map((example) => (
                  <div key={example.amount} className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                    <span className="text-sm text-neutral-600">{money(example.amount)}</span>
                    <b className="text-sm text-[var(--brand-red)]">{example.points.toLocaleString("es-CO")} pts</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="alento-card rounded-[28px] p-5 md:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Siguiente etapa</p>
          <h2 className="mt-1 text-xl font-black">Catálogo de recompensas</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
            Aquí agregaremos productos, bordes e ingredientes extra canjeables por puntos.
            La estructura de acumulación ya queda separada para poder activar los canjes después.
          </p>
        </section>
      </div>
    </main>
  );
}
