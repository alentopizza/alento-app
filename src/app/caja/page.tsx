"use client";

import { useEffect, useMemo, useState } from "react";

type MethodSummary = { method: string; amount: number; count: number };
type PaymentRow = {
  id: number;
  orderId: number;
  method: string;
  amount: number;
  reference: string | null;
  paidAt: string | null;
  order: { id: number; fulfillmentType: string; total: number; customerName: string };
};
type Summary = { date: string; total: number; paymentCount: number; methods: MethodSummary[]; payments: PaymentRow[] };

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function localDateInput() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export default function CashPage() {
  const [date, setDate] = useState(localDateInput());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/caja/summary?date=${date}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar Caja.");
      setSummary(data);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar Caja.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [date]);

  const maxMethod = useMemo(() => Math.max(1, ...(summary?.methods.map((item) => item.amount) ?? [1])), [summary]);

  return (
    <main className="p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="rounded-[28px] bg-[radial-gradient(circle_at_90%_30%,rgba(229,28,17,.18),transparent_28%),linear-gradient(135deg,#0b0b0c,#171718)] px-6 py-6 text-white shadow-[0_22px_55px_rgba(20,16,14,.12)] md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">Operación</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.035em]">Caja</h1>
              <p className="mt-1 text-sm text-white/65">Solo cuenta dinero realmente recibido y registrado.</p>
            </div>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-white/[0.08] px-3 text-sm font-bold text-white outline-none [color-scheme:dark]" />
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">Cargando caja...</div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
        ) : summary ? (
          <>
            <section className="grid gap-3 md:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">Ingresos registrados</p>
                <p className="mt-2 text-4xl font-black tracking-[-0.04em] text-[var(--brand-red)]">{formatCOP(summary.total)}</p>
                <p className="mt-1 text-sm text-neutral-500">{summary.paymentCount} pago{summary.paymentCount === 1 ? "" : "s"} recibido{summary.paymentCount === 1 ? "" : "s"}</p>
              </div>
              <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">Medios usados</p>
                <p className="mt-2 text-3xl font-black">{summary.methods.length}</p>
                <p className="mt-1 text-sm text-neutral-500">Efectivo, billeteras y tarjetas realmente cobradas.</p>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
              <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">Distribución</p>
                    <h2 className="mt-1 text-xl font-black">Por medio de pago</h2>
                  </div>
                  <button onClick={() => void load()} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold">Actualizar</button>
                </div>
                <div className="mt-5 space-y-4">
                  {summary.methods.length === 0 ? <p className="text-sm text-neutral-400">Aún no hay pagos registrados para este día.</p> : summary.methods.map((item) => (
                    <div key={item.method}>
                      <div className="flex items-end justify-between gap-4">
                        <div><b className="text-sm">{item.method}</b><p className="text-[11px] text-neutral-400">{item.count} pago{item.count === 1 ? "" : "s"}</p></div>
                        <b className="text-sm">{formatCOP(item.amount)}</b>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-black" style={{ width: `${Math.max(4, (item.amount / maxMethod) * 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">Movimientos</p>
                <h2 className="mt-1 text-xl font-black">Pagos recibidos</h2>
                <div className="mt-4 space-y-2">
                  {summary.payments.length === 0 ? <p className="text-sm text-neutral-400">No hay movimientos para este día.</p> : summary.payments.map((payment) => (
                    <div key={payment.id} className="grid gap-2 rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2"><b className="text-sm">ALT-{String(payment.orderId).padStart(6, "0")}</b><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-500">{payment.method}</span></div>
                        <p className="mt-1 text-xs text-neutral-500">{payment.order.customerName}</p>
                        {payment.paidAt && <p className="mt-0.5 text-[11px] text-neutral-400">{new Date(payment.paidAt).toLocaleString("es-CO")}</p>}
                        {payment.reference && <p className="mt-0.5 text-[11px] text-neutral-400">Ref. {payment.reference}</p>}
                      </div>
                      <b className="text-base text-emerald-700">{formatCOP(payment.amount)}</b>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
