"use client";

import { useEffect, useMemo, useState } from "react";

type DeliveryBand = {
  id: string;
  minMeters: number;
  maxMeters: number;
  fee: number;
  active: boolean;
};

type PaymentMethodSetting = {
  id: string;
  name: string;
  active: boolean;
};

type PosSettings = {
  store: { address: string; mapsUrl: string };
  deliveryBands: DeliveryBand[];
  paymentMethods: PaymentMethodSetting[];
};

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value || 0);
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PosSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible cargar la configuración.");
        setSettings(data.settings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar la configuración.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const maxCoverage = useMemo(() => {
    if (!settings) return 0;
    return Math.max(0, ...settings.deliveryBands.filter((band) => band.active).map((band) => band.maxMeters));
  }, [settings]);

  function updateBand(id: string, patch: Partial<DeliveryBand>) {
    setSettings((current) => current ? { ...current, deliveryBands: current.deliveryBands.map((band) => band.id === id ? { ...band, ...patch } : band) } : current);
  }

  function addBand() {
    setSettings((current) => {
      if (!current) return current;
      const highest = Math.max(0, ...current.deliveryBands.map((band) => band.maxMeters));
      return {
        ...current,
        deliveryBands: [...current.deliveryBands, { id: `band-${Date.now()}`, minMeters: highest + 1, maxMeters: highest + 500, fee: 0, active: true }],
      };
    });
  }

  function removeBand(id: string) {
    setSettings((current) => current ? { ...current, deliveryBands: current.deliveryBands.filter((band) => band.id !== id) } : current);
  }

  function updatePayment(id: string, patch: Partial<PaymentMethodSetting>) {
    setSettings((current) => current ? { ...current, paymentMethods: current.paymentMethods.map((method) => method.id === id ? { ...method, ...patch } : method) } : current);
  }

  function addPayment() {
    setSettings((current) => current ? { ...current, paymentMethods: [...current.paymentMethods, { id: `payment-${Date.now()}`, name: "Nuevo medio de pago", active: true }] } : current);
  }

  function removePayment(id: string) {
    setSettings((current) => current ? { ...current, paymentMethods: current.paymentMethods.filter((method) => method.id !== id) } : current);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible guardar la configuración.");
      setSettings(data.settings);
      setMessage("Configuración guardada correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="p-5 lg:p-8"><div className="alento-card mx-auto max-w-6xl rounded-[28px] p-8">Cargando configuración...</div></main>;
  if (!settings) return <main className="p-5 lg:p-8"><div className="mx-auto max-w-6xl rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700">{error || "No fue posible cargar la configuración."}</div></main>;

  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">Operación</p>
            <h1 className="text-3xl font-black tracking-tight">Configuración</h1>
            <p className="mt-1 text-sm text-neutral-500">Administra cobertura, tarifas de domicilio y medios de pago del POS.</p>
          </div>
          <button onClick={() => void save()} disabled={saving} className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 text-sm font-black text-white disabled:bg-neutral-300">{saving ? "Guardando..." : "Guardar configuración"}</button>
        </div>

        {(message || error) && <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${error ? "border border-red-200 bg-red-50 text-red-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}

        <section className="alento-card rounded-[28px] p-5 md:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Punto de origen</p>
              <h2 className="mt-1 text-xl font-black">Ubicación de Alentó Pizza</h2>
              <p className="mt-1 text-sm text-neutral-500">Esta es la referencia desde la que se calculará la distancia del domicilio.</p>
            </div>
            <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-600">Cobertura actual: hasta {maxCoverage} m</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="mb-1.5 block text-xs font-black">Dirección del local</label><input value={settings.store.address} onChange={(event) => setSettings({ ...settings, store: { ...settings.store, address: event.target.value } })} className="alento-input w-full rounded-2xl px-4 py-3" /></div>
            <div><label className="mb-1.5 block text-xs font-black">Enlace de Google Maps</label><input value={settings.store.mapsUrl} onChange={(event) => setSettings({ ...settings, store: { ...settings.store, mapsUrl: event.target.value } })} className="alento-input w-full rounded-2xl px-4 py-3" /></div>
          </div>
        </section>

        <section className="alento-card rounded-[28px] p-5 md:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Cobertura y domicilio</p>
              <h2 className="mt-1 text-xl font-black">Tarifas por distancia</h2>
              <p className="mt-1 text-sm text-neutral-500">Cada rango define cuánto cobrar cuando la dirección está a esa distancia del local.</p>
            </div>
            <button onClick={addBand} className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-black">+ Agregar rango</button>
          </div>

          <div className="space-y-2">
            {settings.deliveryBands.map((band, index) => (
              <div key={band.id} className="grid gap-3 rounded-2xl border bg-[#faf9f7] p-3 md:grid-cols-[70px_1fr_1fr_1fr_auto] md:items-end">
                <div><label className="mb-1.5 block text-[10px] font-black uppercase text-neutral-400">Activo</label><button onClick={() => updateBand(band.id, { active: !band.active })} className={`w-full rounded-xl px-3 py-3 text-xs font-black ${band.active ? "bg-black text-white" : "bg-neutral-200 text-neutral-500"}`}>{band.active ? "Sí" : "No"}</button></div>
                <div><label className="mb-1.5 block text-xs font-black">Desde (m)</label><input type="number" min={0} value={band.minMeters} onChange={(event) => updateBand(band.id, { minMeters: Number(event.target.value) })} className="alento-input w-full rounded-xl px-3 py-3" /></div>
                <div><label className="mb-1.5 block text-xs font-black">Hasta (m)</label><input type="number" min={0} value={band.maxMeters} onChange={(event) => updateBand(band.id, { maxMeters: Number(event.target.value) })} className="alento-input w-full rounded-xl px-3 py-3" /></div>
                <div><label className="mb-1.5 block text-xs font-black">Costo domicilio</label><input type="number" min={0} step={500} value={band.fee} onChange={(event) => updateBand(band.id, { fee: Number(event.target.value) })} className="alento-input w-full rounded-xl px-3 py-3" /><p className="mt-1 text-[10px] text-neutral-400">{formatCOP(band.fee)}</p></div>
                <button onClick={() => removeBand(band.id)} disabled={settings.deliveryBands.length === 1} className="rounded-xl border border-red-200 bg-white px-3 py-3 text-xs font-black text-red-600 disabled:border-neutral-200 disabled:text-neutral-300">Eliminar</button>
                <div className="md:col-span-5 text-[10px] font-semibold text-neutral-400">Rango {index + 1}: {band.minMeters}–{band.maxMeters} m · {formatCOP(band.fee)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><b>Importante:</b> una dirección que quede fuera de todos los rangos activos se considerará fuera de cobertura.</div>
        </section>

        <section className="alento-card rounded-[28px] p-5 md:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Caja</p>
              <h2 className="mt-1 text-xl font-black">Medios de pago</h2>
              <p className="mt-1 text-sm text-neutral-500">Solo los medios activos aparecerán durante el cierre de un pedido.</p>
            </div>
            <button onClick={addPayment} className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-black">+ Agregar medio</button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {settings.paymentMethods.map((method) => (
              <div key={method.id} className="flex items-center gap-2 rounded-2xl border bg-[#faf9f7] p-3">
                <button onClick={() => updatePayment(method.id, { active: !method.active })} className={`shrink-0 rounded-xl px-3 py-2.5 text-xs font-black ${method.active ? "bg-black text-white" : "bg-neutral-200 text-neutral-500"}`}>{method.active ? "Activo" : "Inactivo"}</button>
                <input value={method.name} onChange={(event) => updatePayment(method.id, { name: event.target.value })} className="alento-input min-w-0 flex-1 rounded-xl px-3 py-2.5" />
                <button onClick={() => removePayment(method.id)} disabled={settings.paymentMethods.length === 1} className="rounded-xl border border-red-200 bg-white px-3 py-2.5 text-xs font-black text-red-600 disabled:border-neutral-200 disabled:text-neutral-300">Eliminar</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
