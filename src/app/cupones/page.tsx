"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Pencil,
  Percent,
  Plus,
  Search,
  TicketPercent,
  Trash2,
  XCircle,
} from "lucide-react";

type CouponType = "FIXED" | "PERCENTAGE";
type Coupon = {
  id: number;
  name: string;
  type: CouponType;
  value: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  totalDiscount: number;
  lastUsedAt: string | null;
};

type CouponSummary = {
  total: number;
  active: number;
  totalUses: number;
  totalDiscount: number;
};

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Sin usos";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [summary, setSummary] = useState<CouponSummary>({
    total: 0,
    active: 0,
    totalUses: 0,
    totalDiscount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
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
      if (!response.ok) {
        throw new Error(data.error || "No fue posible cargar los cupones.");
      }
      setCoupons(data.coupons ?? []);
      setSummary(
        data.summary ?? {
          total: 0,
          active: 0,
          totalUses: 0,
          totalDiscount: 0,
        },
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar los cupones.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCoupons();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return coupons.filter((coupon) => {
      const matchesQuery = !q || coupon.name.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && coupon.active) ||
        (statusFilter === "INACTIVE" && !coupon.active);

      return matchesQuery && matchesStatus;
    });
  }, [coupons, query, statusFilter]);

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
      const response = await fetch(
        editing ? `/api/coupons/${editing.id}` : "/api/coupons",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            type,
            value: Number(value),
            active,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible guardar el cupón.");
      }

      setModalOpen(false);
      setEditing(null);
      await loadCoupons();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible guardar el cupón.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!window.confirm(`¿Eliminar el cupón “${coupon.name}”?`)) return;

    const response = await fetch(`/api/coupons/${coupon.id}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      window.alert(data.error || "No fue posible eliminar el cupón.");
      return;
    }

    await loadCoupons();
  }

  return (
    <main className="min-h-screen w-full p-3 md:p-5 xl:p-6">
      <div className="w-full space-y-4">
        <section className="relative min-h-[116px] w-full overflow-hidden rounded-[24px] border border-black/5 bg-[#0a0a0b] text-white shadow-[0_14px_36px_rgba(20,16,14,.11)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_42%,rgba(226,26,34,.55),transparent_25%),radial-gradient(circle_at_68%_100%,rgba(132,12,16,.36),transparent_34%),linear-gradient(105deg,#111319_0%,#101116_43%,#1a0b0d_67%,#5a090c_100%)]" />
          <div className="absolute inset-y-0 right-0 w-[46%] opacity-70 [background:linear-gradient(115deg,transparent_0%,rgba(255,255,255,.025)_28%,transparent_29%),repeating-linear-gradient(90deg,transparent_0_54px,rgba(255,255,255,.025)_55px_56px)]" />
          <div className="absolute right-[24%] top-[-18px] h-20 w-20 rounded-full bg-red-500/10 blur-2xl" />
          <div className="absolute right-[9%] top-[22px] h-[2px] w-[30%] bg-gradient-to-r from-transparent via-red-300/40 to-transparent" />

          <div className="relative flex min-h-[116px] flex-col justify-between gap-4 px-5 py-4 md:flex-row md:items-center md:px-6 xl:px-7">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="h-[2px] w-7 rounded-full bg-[var(--brand-red)]" />
                <p className="alento-ui-label uppercase tracking-[0.2em] text-white/55">
                  Ventas y promociones
                </p>
              </div>
              <h1 className="alento-ui-hero-title mt-1.5">Cupones</h1>
              <p className="alento-ui-hero-subtitle mt-1.5 text-white/60">
                Administra descuentos y revisa su uso real en los pedidos.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 self-end md:self-auto">
              <div className="flex h-[56px] min-w-[76px] flex-col items-center justify-center rounded-[16px] border border-white/14 bg-white/[0.08] px-3 backdrop-blur-sm">
                <span className="alento-ui-micro uppercase tracking-[0.14em] text-white/50">
                  Activos
                </span>
                <b className="alento-ui-metric mt-0.5 tabular-nums text-white">
                  {summary.active}
                </b>
              </div>

              <div className="flex h-[56px] min-w-[76px] flex-col items-center justify-center rounded-[16px] border border-white/14 bg-white/[0.08] px-3 backdrop-blur-sm">
                <span className="alento-ui-micro uppercase tracking-[0.14em] text-white/50">
                  Usos
                </span>
                <b className="alento-ui-metric mt-0.5 tabular-nums text-white">
                  {summary.totalUses}
                </b>
              </div>

              <button
                type="button"
                onClick={openNew}
                aria-label="Nuevo cupón"
                title="Nuevo cupón"
                className="flex h-[56px] w-[76px] items-center justify-center rounded-[16px] border border-red-400/45 bg-[linear-gradient(135deg,rgba(236,25,31,.96),rgba(119,12,16,.82))] text-white shadow-[0_10px_22px_rgba(168,11,16,.25),inset_0_1px_0_rgba(255,255,255,.13)] transition hover:-translate-y-0.5 hover:brightness-110"
              >
                <Plus className="h-[22px] w-[22px]" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </section>

        {error && !modalOpen && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="alento-ui-body text-red-700">{error}</p>
          </div>
        )}

        <section className="rounded-[22px] border border-neutral-200 bg-white p-3 shadow-[0_8px_24px_rgba(28,23,20,.05)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="group relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 transition group-focus-within:text-neutral-700"
                strokeWidth={2}
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="alento-ui-control h-11 w-full rounded-[14px] border border-neutral-200 bg-[#faf9f7] pl-11 pr-4 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white"
                placeholder="Buscar cupón..."
              />
            </label>

            <div className="flex gap-1.5 rounded-[14px] border border-neutral-200 bg-[#faf9f7] p-1.5">
              {([
                ["ALL", "Todos"],
                ["ACTIVE", "Activos"],
                ["INACTIVE", "Inactivos"],
              ] as [StatusFilter, string][]).map(([filterValue, label]) => (
                <button
                  key={filterValue}
                  type="button"
                  onClick={() => setStatusFilter(filterValue)}
                  className={`alento-ui-control h-8 rounded-[10px] px-3 transition ${statusFilter === filterValue ? "bg-neutral-950 text-white shadow-sm" : "text-neutral-500 hover:bg-white"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[22px] border border-neutral-200 bg-white p-8 text-center">
            <p className="alento-ui-body text-neutral-500">
              Cargando cupones...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-neutral-300 bg-white/70 p-10 text-center">
            <TicketPercent className="mx-auto h-8 w-8 text-neutral-300" />
            <h2 className="alento-ui-title mt-3 text-neutral-900">
              No hay cupones para mostrar
            </h2>
            <p className="alento-ui-body mt-1 text-neutral-500">
              Ajusta los filtros o crea un nuevo cupón.
            </p>
          </div>
        ) : (
          <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((coupon) => (
              <article
                key={coupon.id}
                className={`relative overflow-hidden rounded-[22px] border bg-white p-4 shadow-[0_9px_24px_rgba(28,23,20,.055)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(28,23,20,.09)] ${coupon.active ? "border-emerald-200" : "border-neutral-200"}`}
              >
                <span
                  className={`absolute inset-x-0 top-0 h-[3px] ${coupon.active ? "bg-emerald-500" : "bg-neutral-300"}`}
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${coupon.active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
                    >
                      {coupon.type === "PERCENTAGE" ? (
                        <Percent className="h-4 w-4" strokeWidth={2.1} />
                      ) : (
                        <TicketPercent className="h-4 w-4" strokeWidth={2.1} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h2 className="alento-ui-status truncate text-neutral-950">
                        {coupon.name}
                      </h2>
                      <p className="alento-ui-micro mt-0.5 text-neutral-400">
                        Creado {formatDate(coupon.createdAt)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`alento-ui-label shrink-0 rounded-full px-2.5 py-1 uppercase ${coupon.active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
                  >
                    {coupon.active ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-[14px] bg-[#faf9f7] px-3 py-2.5">
                    <span className="alento-ui-micro uppercase text-neutral-400">
                      Tipo
                    </span>
                    <b className="alento-ui-control mt-1 block text-neutral-950">
                      {coupon.type === "PERCENTAGE" ? "Porcentaje" : "Valor fijo"}
                    </b>
                  </div>

                  <div className="rounded-[14px] bg-red-50 px-3 py-2.5">
                    <span className="alento-ui-micro uppercase text-red-400">
                      Valor
                    </span>
                    <b className="alento-ui-status mt-1 block text-[var(--brand-red)]">
                      {coupon.type === "PERCENTAGE"
                        ? `${coupon.value}%`
                        : formatCOP(coupon.value)}
                    </b>
                  </div>

                  <div className="rounded-[14px] bg-[#faf9f7] px-3 py-2.5">
                    <span className="alento-ui-micro uppercase text-neutral-400">
                      Usos
                    </span>
                    <b className="alento-ui-status mt-1 block text-neutral-950">
                      {coupon.usageCount}
                    </b>
                  </div>

                  <div className="rounded-[14px] bg-[#faf9f7] px-3 py-2.5">
                    <span className="alento-ui-micro uppercase text-neutral-400">
                      Último uso
                    </span>
                    <b className="alento-ui-control mt-1 block text-neutral-950">
                      {formatDate(coupon.lastUsedAt)}
                    </b>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-[14px] border border-neutral-200 bg-white px-3 py-2.5">
                  <div>
                    <span className="alento-ui-micro uppercase text-neutral-400">
                      Descuento aplicado
                    </span>
                    <b className="alento-ui-control mt-0.5 block text-neutral-950">
                      {formatCOP(coupon.totalDiscount)}
                    </b>
                  </div>
                  <div className="text-right">
                    <span className="alento-ui-micro uppercase text-neutral-400">
                      Estado actual
                    </span>
                    <span
                      className={`alento-ui-control mt-0.5 flex items-center justify-end gap-1.5 ${coupon.active ? "text-emerald-700" : "text-neutral-500"}`}
                    >
                      {coupon.active ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      {coupon.active ? "Disponible" : "No disponible"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex justify-end gap-2 border-t border-neutral-100 pt-3">
                  <button
                    type="button"
                    onClick={() => openEdit(coupon)}
                    aria-label="Editar cupón"
                    title="Editar cupón"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2.1} />
                  </button>

                  <button
                    type="button"
                    onClick={() => void deleteCoupon(coupon)}
                    aria-label="Eliminar cupón"
                    title="Eliminar cupón"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2.1} />
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-[3px]">
          <div className="w-full max-w-lg overflow-hidden rounded-[26px] bg-[#f7f6f3] shadow-[0_30px_90px_rgba(0,0,0,.28)]">
            <header className="relative overflow-hidden bg-[#0b0b0c] px-6 py-5 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(226,26,34,.42),transparent_36%),linear-gradient(135deg,#111216,#241114_72%,#640a0e)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="alento-ui-label uppercase text-red-300">
                    Descuento POS
                  </p>
                  <h2 className="alento-ui-title mt-1">
                    {editing ? "Editar cupón" : "Nuevo cupón"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Cerrar"
                  title="Cerrar"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] text-white/70 transition hover:bg-white/[0.14]"
                >
                  ×
                </button>
              </div>
            </header>

            <form onSubmit={saveCoupon}>
              <div className="space-y-4 p-5">
                <div>
                  <label className="alento-ui-label mb-1.5 block text-neutral-500">
                    Nombre <span className="text-[var(--brand-red)]">*</span>
                  </label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="alento-ui-control h-11 w-full rounded-[14px] border border-neutral-200 bg-white px-4 outline-none focus:border-neutral-400"
                    placeholder="Ej. Cupón Trabajador"
                  />
                </div>

                <div>
                  <label className="alento-ui-label mb-1.5 block text-neutral-500">
                    Tipo <span className="text-[var(--brand-red)]">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setType("FIXED")}
                      className={`rounded-[14px] border px-3 py-3 text-left transition ${type === "FIXED" ? "border-red-300 bg-red-50" : "border-neutral-200 bg-white"}`}
                    >
                      <b className="alento-ui-control block">Valor fijo</b>
                      <span className="alento-ui-micro mt-1 block text-neutral-500">
                        Descuento en pesos
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setType("PERCENTAGE")}
                      className={`rounded-[14px] border px-3 py-3 text-left transition ${type === "PERCENTAGE" ? "border-red-300 bg-red-50" : "border-neutral-200 bg-white"}`}
                    >
                      <b className="alento-ui-control block">Porcentaje</b>
                      <span className="alento-ui-micro mt-1 block text-neutral-500">
                        Porcentaje sobre productos
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="alento-ui-label mb-1.5 block text-neutral-500">
                    {type === "PERCENTAGE" ? "Porcentaje" : "Valor"}{" "}
                    <span className="text-[var(--brand-red)]">*</span>
                  </label>
                  <div className="relative">
                    {type === "FIXED" && (
                      <span className="alento-ui-control absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
                        $
                      </span>
                    )}
                    <input
                      value={value}
                      onChange={(event) =>
                        setValue(event.target.value.replace(/\D/g, ""))
                      }
                      inputMode="numeric"
                      className={`alento-ui-status h-11 w-full rounded-[14px] border border-neutral-200 bg-white py-3 pr-10 outline-none focus:border-neutral-400 ${type === "FIXED" ? "pl-8" : "pl-4"}`}
                      placeholder={type === "PERCENTAGE" ? "10" : "10000"}
                    />
                    {type === "PERCENTAGE" && (
                      <span className="alento-ui-control absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                        %
                      </span>
                    )}
                  </div>
                </div>

                <label className="flex items-center justify-between rounded-[16px] border border-neutral-200 bg-white px-4 py-3">
                  <span>
                    <b className="alento-ui-control block text-neutral-950">
                      Cupón activo
                    </b>
                    <span className="alento-ui-micro mt-0.5 block text-neutral-500">
                      Si está inactivo no aparecerá en el POS.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(event) => setActive(event.target.checked)}
                    className="h-5 w-5"
                  />
                </label>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="alento-ui-control text-red-700">{error}</p>
                  </div>
                )}
              </div>

              <footer className="grid grid-cols-2 gap-2 border-t border-neutral-200 bg-white p-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="alento-ui-control h-11 rounded-xl border border-neutral-200 bg-white text-neutral-700"
                >
                  Cancelar
                </button>
                <button
                  disabled={saving}
                  className="alento-ui-control h-11 rounded-xl bg-[var(--brand-red)] text-white shadow-[0_7px_16px_rgba(226,26,34,.18)] disabled:bg-neutral-300"
                >
                  {saving
                    ? "Guardando..."
                    : editing
                      ? "Guardar cambios"
                      : "Crear cupón"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
