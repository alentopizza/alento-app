"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type CouponType = "FIXED" | "PERCENTAGE";
type Coupon = {
  id: number;
  name: string;
  type: CouponType;
  value: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<CouponType>("FIXED");
  const [value, setValue] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadCoupons() {
    setLoading(true);
    try {
      const response = await fetch("/api/coupons", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar los cupones.");
      setCoupons(data.coupons ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar los cupones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCoupons();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return coupons;
    return coupons.filter((coupon) => coupon.name.toLowerCase().includes(q));
  }, [coupons, query]);

  function openNew() {
    setEditing(null);
    setName("");
    setType("FIXED");
    setValue("");
    setActive(true);
    setError("");
    setModalOpen(true);
  }

  function openEdit(coupon: Coupon) {
    setEditing(coupon);
    setName(coupon.name);
    setType(coupon.type);
    setValue(String(coupon.value));
    setActive(coupon.active);
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setError("");
  }

  async function saveCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(editing ? `/api/coupons/${editing.id}` : "/api/coupons", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, value: Number(value), active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible guardar el cupón.");
      setModalOpen(false);
      setEditing(null);
      await loadCoupons();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar el cupón.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!window.confirm(`¿Eliminar el cupón “${coupon.name}”?`)) return;
    const response = await fetch(`/api/coupons/${coupon.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      window.alert(data.error || "No fue posible eliminar el cupón.");
      return;
    }
    await loadCoupons();
  }

  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">Descuentos</p>
            <h1 className="text-3xl font-black tracking-tight">Cupones</h1>
            <p className="mt-1 text-sm text-neutral-500">Crea descuentos fijos o porcentuales para aplicarlos desde el cierre del POS.</p>
          </div>
          <button onClick={openNew} className="rounded-2xl bg-[var(--brand-red)] px-5 py-3 text-sm font-black text-white">+ Nuevo cupón</button>
        </div>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" placeholder="Buscar cupón" />
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200">
          {loading ? <p className="p-6 text-sm text-neutral-500">Cargando cupones...</p> : filtered.length === 0 ? <p className="p-6 text-sm text-neutral-500">No hay cupones para mostrar.</p> : <div className="divide-y divide-neutral-100">
            {filtered.map((coupon) => (
              <article key={coupon.id} className="grid gap-4 p-5 md:grid-cols-[1.2fr_.8fr_.5fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black">{coupon.name}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${coupon.active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>{coupon.active ? "Activo" : "Inactivo"}</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">Disponible para seleccionar en el cierre del POS.</p>
                </div>
                <div><p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">Tipo</p><p className="mt-1 font-black">{coupon.type === "PERCENTAGE" ? "Porcentaje" : "Plano"}</p></div>
                <div><p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">Valor</p><p className="mt-1 text-lg font-black text-[var(--brand-red)]">{coupon.type === "PERCENTAGE" ? `${coupon.value}%` : formatCOP(coupon.value)}</p></div>
                <div className="flex gap-2 md:justify-end"><button onClick={() => openEdit(coupon)} className="rounded-xl border px-3 py-2 text-sm font-bold">Editar</button><button onClick={() => void deleteCoupon(coupon)} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-600">Eliminar</button></div>
              </article>
            ))}
          </div>}
        </section>
      </div>

      {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
        <div className="w-full max-w-lg overflow-hidden rounded-[30px] bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Descuento POS</p><h2 className="mt-1 text-2xl font-black">{editing ? "Editar cupón" : "Nuevo cupón"}</h2></div>
            <button onClick={closeModal} className="rounded-full bg-neutral-100 px-3 py-2 text-sm font-bold">Cerrar</button>
          </div>
          <form onSubmit={saveCoupon}>
            <div className="space-y-4 px-6 py-5">
              <div><label className="mb-1.5 block text-xs font-black">Nombre <span className="text-[var(--brand-red)]">*</span></label><input value={name} onChange={(event) => setName(event.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" placeholder="Ej. Cupón Trabajador" /></div>
              <div><label className="mb-1.5 block text-xs font-black">Tipo <span className="text-[var(--brand-red)]">*</span></label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setType("FIXED")} className={`rounded-2xl border-2 px-4 py-3 text-left ${type === "FIXED" ? "border-[var(--brand-red)] bg-red-50" : "border-neutral-200"}`}><b>Plano</b><span className="mt-1 block text-xs text-neutral-500">Valor fijo en pesos</span></button><button type="button" onClick={() => setType("PERCENTAGE")} className={`rounded-2xl border-2 px-4 py-3 text-left ${type === "PERCENTAGE" ? "border-[var(--brand-red)] bg-red-50" : "border-neutral-200"}`}><b>Porcentaje</b><span className="mt-1 block text-xs text-neutral-500">Porcentaje sobre productos</span></button></div></div>
              <div><label className="mb-1.5 block text-xs font-black">{type === "PERCENTAGE" ? "Porcentaje" : "Valor"} <span className="text-[var(--brand-red)]">*</span></label><div className="relative">{type === "FIXED" && <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-neutral-400">$</span>}<input value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`alento-input w-full rounded-2xl py-3 pr-10 font-black ${type === "FIXED" ? "pl-8" : "pl-4"}`} placeholder={type === "PERCENTAGE" ? "60" : "10000"} />{type === "PERCENTAGE" && <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-neutral-400">%</span>}</div></div>
              <label className="flex items-center justify-between rounded-2xl bg-[#faf9f7] px-4 py-3"><span><b className="text-sm">Cupón activo</b><span className="mt-0.5 block text-xs text-neutral-500">Si está inactivo no aparecerá en el POS.</span></span><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-5 w-5" /></label>
              {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
            </div>
            <div className="flex justify-end gap-2 border-t bg-[#faf9f7] px-6 py-4"><button type="button" onClick={closeModal} className="rounded-2xl border bg-white px-5 py-3 text-sm font-black">Cancelar</button><button disabled={saving} className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 text-sm font-black text-white disabled:bg-neutral-300">{saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear cupón"}</button></div>
          </form>
        </div>
      </div>}
    </main>
  );
}
