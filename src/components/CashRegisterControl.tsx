"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  Landmark,
  LockKeyhole,
  X,
} from "lucide-react";

type CashRegisterSession = {
  id: number;
  businessDate: string;
  status: "OPEN" | "CLOSED" | string;
  openingBalance: number;
  openingControlledBalance: number | null;
  openingLoanReceivable: number | null;
  openedAt: string;
  openedByName: string;
  netMovement: number | null;
  expectedClosingBalance: number | null;
  closingCash: number | null;
  closingNequi: number | null;
  closingDaviplata: number | null;
  closingCard: number | null;
  closingDavivienda: number | null;
  closingDenominations: Record<string, number> | null;
  closingLoanReceivable: number | null;
  actualClosingBalance: number | null;
  difference: number | null;
  closeNote: string | null;
  closedAt: string | null;
  closedByName: string | null;
};

type Movement = {
  received: number;
  otherIncome: number;
  expensesTotal: number;
  loansTotal: number;
  recovered: number;
  loansReceivable: number;
  netMovement: number;
};

type SessionResponse = {
  session: CashRegisterSession | null;
  movement: Movement;
  suggestedOpeningBalance: number | null;
  previousCloseDate: string | null;
  openingLoansReceivable: number;
};

const BILLS = [2000, 5000, 10000, 20000, 50000, 100000] as const;
const COINS = [50, 100, 200, 500, 1000] as const;
const ALL_DENOMINATIONS = [...COINS, ...BILLS];

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function integerInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 12);
}

function dateLabel(value: string | null) {
  if (!value) return "";
  const date = new Date(value + "T12:00:00-05:00");
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateTimeLabel(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CashRegisterControl({
  businessDate,
  enabled,
  currentNetMovement,
  onChanged,
}: {
  businessDate: string;
  enabled: boolean;
  currentNetMovement: number;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [editingOpening, setEditingOpening] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [nequi, setNequi] = useState("");
  const [daviplata, setDaviplata] = useState("");
  const [card, setCard] = useState("");
  const [davivienda, setDavivienda] = useState("");
  const [closeNote, setCloseNote] = useState("");

  async function load() {
    if (!enabled) {
      setData(null);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        "/api/caja/register-session?date=" + encodeURIComponent(businessDate),
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "No fue posible cargar la apertura de caja.");
      }
      setData(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar la apertura de caja.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [businessDate, enabled]);

  useEffect(() => {
    if (!data || data.session || openingBalance) return;
    if (data.suggestedOpeningBalance != null) {
      setOpeningBalance(String(Math.round(data.suggestedOpeningBalance)));
    }
  }, [data, openingBalance]);

  const session = data?.session ?? null;
  const liveMovement = data?.movement?.netMovement ?? currentNetMovement;
  const openingLoansReceivable =
    session?.openingLoanReceivable ??
    data?.openingLoansReceivable ??
    0;
  const openingControlledBalance = session
    ? session.openingControlledBalance ?? session.openingBalance
    : Number(openingBalance || data?.suggestedOpeningBalance || 0);
  const openingAvailableBalance = session
    ? session.openingControlledBalance != null
      ? session.openingBalance
      : Math.max(0, session.openingBalance - openingLoansReceivable)
    : Math.max(0, openingControlledBalance - openingLoansReceivable);
  const expectedNow = openingAvailableBalance + liveMovement;
  const loansReceivable =
    session?.status === "CLOSED" && session.closingLoanReceivable != null
      ? session.closingLoanReceivable
      : data?.movement?.loansReceivable ?? 0;

  const cashTotal = useMemo(
    () =>
      ALL_DENOMINATIONS.reduce(
        (sum, denomination) =>
          sum + denomination * Math.max(0, Number(counts[String(denomination)] || 0)),
        0,
      ),
    [counts],
  );

  const countedTotal =
    cashTotal +
    Number(nequi || 0) +
    Number(daviplata || 0) +
    Number(card || 0) +
    Number(davivienda || 0);

  const previewDifference = countedTotal - expectedNow;

  function prepareOpen() {
    const suggested = data?.suggestedOpeningBalance;
    setEditingOpening(false);
    setOpeningBalance(
      suggested != null ? String(Math.round(suggested)) : "",
    );
    setError("");
    setOpenModal(true);
  }

  function prepareEditOpening() {
    if (!session || session.status !== "OPEN") return;
    setEditingOpening(true);
    setOpeningBalance(
      String(
        Math.round(
          session.openingControlledBalance ?? session.openingBalance,
        ),
      ),
    );
    setError("");
    setOpenModal(true);
  }

  function prepareClose() {
    setCounts(
      Object.fromEntries(ALL_DENOMINATIONS.map((value) => [String(value), ""])),
    );
    setNequi("");
    setDaviplata("");
    setCard("");
    setDavivienda("");
    setCloseNote("");
    setError("");
    setCloseModal(true);
  }

  async function saveOpening() {
    if (actionBusy) return;
    const amount = Number(openingBalance || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Ingresa un saldo inicial total válido.");
      return;
    }
    if (amount < openingLoansReceivable) {
      setError(
        "El saldo inicial total no puede ser menor a los préstamos por cobrar al iniciar el día.",
      );
      return;
    }

    setActionBusy(true);
    setError("");
    try {
      const response = await fetch("/api/caja/register-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editingOpening ? "EDIT_OPENING" : "OPEN",
          businessDate,
          openingControlledBalance: amount,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.error ||
            (editingOpening
              ? "No fue posible actualizar la apertura."
              : "No fue posible abrir la caja."),
        );
      }

      setOpenModal(false);
      setEditingOpening(false);
      await load();
      onChanged?.();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : editingOpening
            ? "No fue posible actualizar la apertura."
            : "No fue posible abrir la caja.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function closeCash() {
    if (actionBusy) return;

    setActionBusy(true);
    setError("");
    try {
      const denominations = Object.fromEntries(
        ALL_DENOMINATIONS.map((value) => [
          String(value),
          Math.max(0, Number(counts[String(value)] || 0)),
        ]),
      );

      const response = await fetch("/api/caja/register-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLOSE",
          businessDate,
          denominations,
          nequi: Number(nequi || 0),
          daviplata: Number(daviplata || 0),
          card: Number(card || 0),
          davivienda: Number(davivienda || 0),
          note: closeNote,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "No fue posible cerrar la caja.");
      }

      setCloseModal(false);
      await load();
      onChanged?.();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "No fue posible cerrar la caja.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  if (!enabled) {
    return (
      <section className="rounded-[20px] border border-dashed border-neutral-300 bg-white/70 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <div>
            <b className="text-sm text-neutral-800">Apertura y cierre por día</b>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              Selecciona la misma fecha en Desde y Hasta para abrir o cerrar esa caja.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="rounded-[20px] border border-neutral-200 bg-white px-5 py-5 text-sm font-semibold text-neutral-400 shadow-sm">
        Cargando estado de caja...
      </section>
    );
  }

  if (error && !openModal && !closeModal) {
    return (
      <section className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
        {error}
      </section>
    );
  }

  return (
    <>
      {!session ? (
        <section className="overflow-hidden rounded-[22px] border border-amber-200 bg-white shadow-[0_10px_30px_rgba(28,23,20,.05)]">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <CircleDollarSign className="h-6 w-6" strokeWidth={2} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[16px] font-black text-neutral-950">Caja sin abrir</b>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-amber-700">
                    {dateLabel(businessDate)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Registra el saldo con el que inició el día. Se tendrán en cuenta todos los movimientos de esta fecha.
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-neutral-500">
                  <span>Flujo del día: <b className={liveMovement >= 0 ? "text-emerald-700" : "text-red-700"}>{money(liveMovement)}</b></span>
                  {!editingOpening && data?.suggestedOpeningBalance != null && (
                    <span>
                      Último cierre: <b className="text-neutral-800">{money(data.suggestedOpeningBalance)}</b>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={prepareOpen}
              className="h-12 rounded-2xl bg-neutral-950 px-5 text-[11px] font-black text-white shadow-[0_10px_24px_rgba(0,0,0,.16)] transition hover:-translate-y-0.5"
            >
              Abrir caja
            </button>
          </div>
        </section>
      ) : session.status === "OPEN" ? (
        <section className="overflow-hidden rounded-[22px] border border-emerald-200 bg-white shadow-[0_10px_30px_rgba(28,23,20,.05)]">
          <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[1fr_auto_auto_auto_auto_auto] xl:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" strokeWidth={2} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[16px] font-black text-neutral-950">Caja abierta</b>
                  <span className="rounded-full bg-emerald-600 px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-white">
                    Activa
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-neutral-400">
                  Abrió {session.openedByName} · {dateTimeLabel(session.openedAt)}
                </p>
                {session.openingControlledBalance == null && (
                  <p className="mt-1 text-[9px] font-bold text-amber-600">
                    Apertura anterior al nuevo desglose · se interpreta como total incluyendo préstamos.
                  </p>
                )}
              </div>
            </div>

            <MiniMetric label="Total inicial" value={money(openingControlledBalance)} />
            <MiniMetric label="Préstamos iniciales" value={money(openingLoansReceivable)} />
            <MiniMetric label="Disponible inicial" value={money(openingAvailableBalance)} />
            <MiniMetric label="Disponible esperado" value={money(expectedNow)} strong />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={prepareEditOpening}
                className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-[10px] font-black text-neutral-700 transition hover:bg-neutral-50"
              >
                Editar apertura
              </button>
              <button
                type="button"
                onClick={prepareClose}
                className="h-12 rounded-2xl bg-[var(--brand-red)] px-5 text-[11px] font-black text-white shadow-[0_10px_24px_rgba(226,26,34,.20)] transition hover:-translate-y-0.5"
              >
                Cerrar caja
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-[0_10px_30px_rgba(28,23,20,.05)]">
          <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[1.2fr_repeat(5,auto)] xl:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-white">
                <LockKeyhole className="h-5 w-5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[16px] font-black text-neutral-950">Caja cerrada</b>
                  <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-neutral-600">
                    {dateLabel(session.businessDate)}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-neutral-400">
                  Cerró {session.closedByName || "—"} · {dateTimeLabel(session.closedAt)}
                </p>
                <p className="mt-1 text-[9px] text-neutral-400">
                  Efectivo {money(session.closingCash || 0)} · Nequi {money(session.closingNequi || 0)} · DaviPlata {money(session.closingDaviplata || 0)} · Tarjeta {money(session.closingCard || 0)} · Davivienda {money(session.closingDavivienda || 0)} · Préstamos {money(session.closingLoanReceivable || 0)}
                </p>
              </div>
            </div>

            <MiniMetric
              label="Total inicial"
              value={money(
                session.openingControlledBalance ?? session.openingBalance,
              )}
            />
            <MiniMetric label="Flujo" value={money(session.netMovement || 0)} />
            <MiniMetric label="Disponible teórico" value={money(session.expectedClosingBalance || 0)} />
            <MiniMetric label="En préstamos" value={money(session.closingLoanReceivable || 0)} />
            <MiniMetric
              label="Total controlado"
              value={money(
                (session.actualClosingBalance || 0) +
                  (session.closingLoanReceivable || 0),
              )}
              difference={session.difference || 0}
            />
          </div>
        </section>
      )}

      {openModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !actionBusy) setOpenModal(false);
          }}
        >
          <div className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_30px_100px_rgba(0,0,0,.35)]">
            <div className="relative overflow-hidden bg-[#0b0b0c] p-5 text-white sm:p-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_25%,rgba(226,26,34,.34),transparent_30%),linear-gradient(120deg,#111319,#1a0b0d)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/45">Caja · {dateLabel(businessDate)}</p>
                  <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em]">
                    {editingOpening ? "Editar apertura" : "Abrir caja"}
                  </h2>
                  <p className="mt-1 text-[11px] leading-5 text-white/50">
                    Ingresa el valor total al iniciar el día. Los préstamos por cobrar ya están incluidos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenModal(false);
                    setEditingOpening(false);
                  }}
                  disabled={actionBusy}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div>
              )}

              {data?.suggestedOpeningBalance != null && (
                <button
                  type="button"
                  onClick={() => setOpeningBalance(String(Math.round(data.suggestedOpeningBalance || 0)))}
                  className="mb-4 w-full rounded-[18px] border border-neutral-200 bg-[#faf9f7] p-4 text-left transition hover:border-neutral-300"
                >
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">Cierre anterior · {dateLabel(data.previousCloseDate)}</span>
                  <b className="mt-1 block text-[20px] font-black text-neutral-950">{money(data.suggestedOpeningBalance)}</b>
                  <span className="mt-1 block text-[10px] text-neutral-500">Toca para usarlo como saldo inicial.</span>
                </button>
              )}

              <label className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
                Saldo inicial total · incluye préstamos
              </label>
              <div className="mt-2 flex h-16 items-center rounded-2xl border border-neutral-200 bg-[#faf9f7] px-4 focus-within:border-neutral-400 focus-within:bg-white">
                <span className="mr-2 text-xl font-black text-neutral-400">$</span>
                <input
                  value={openingBalance}
                  onChange={(event) => setOpeningBalance(integerInput(event.target.value))}
                  inputMode="numeric"
                  autoFocus
                  placeholder="0"
                  className="min-w-0 flex-1 bg-transparent text-[28px] font-black tracking-[-0.04em] outline-none"
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">Préstamos al iniciar</span>
                  <b className="mt-1 block text-[16px] font-black text-neutral-800">
                    {money(openingLoansReceivable)}
                  </b>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">Disponible inicial</span>
                  <b className="mt-1 block text-[16px] font-black text-neutral-800">
                    {money(
                      Math.max(
                        0,
                        Number(openingBalance || 0) -
                          openingLoansReceivable,
                      ),
                    )}
                  </b>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-950 p-4 text-white">
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/40">Disponible esperado</span>
                  <b className="mt-1 block text-[16px] font-black">
                    {money(
                      Math.max(
                        0,
                        Number(openingBalance || 0) -
                          openingLoansReceivable,
                      ) + liveMovement,
                    )}
                  </b>
                </div>
              </div>

              <p className="mt-4 text-[10px] leading-5 text-neutral-500">
                El sistema separa automáticamente el saldo total entre dinero disponible y préstamos por cobrar. Los movimientos del día se aplican únicamente al dinero disponible.
              </p>
            </div>

            <div className="flex gap-2 border-t border-neutral-200 bg-[#faf9f7] p-4 sm:justify-end">
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                disabled={actionBusy}
                className="h-11 flex-1 rounded-xl border border-neutral-200 bg-white px-5 text-[11px] font-black text-neutral-600 sm:flex-none"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveOpening()}
                disabled={actionBusy}
                className="h-11 flex-1 rounded-xl bg-neutral-950 px-6 text-[11px] font-black text-white disabled:bg-neutral-300 sm:flex-none"
              >
                {actionBusy
                  ? editingOpening
                    ? "Guardando..."
                    : "Abriendo..."
                  : editingOpening
                    ? "Guardar apertura"
                    : "Abrir caja"}
              </button>
            </div>
          </div>
        </div>
      )}

      {closeModal && session && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 backdrop-blur-[3px] sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !actionBusy) setCloseModal(false);
          }}
        >
          <div className="flex max-h-[96dvh] w-full max-w-[1280px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#f6f5f2] shadow-[0_30px_100px_rgba(0,0,0,.38)]">
            <div className="relative shrink-0 overflow-hidden bg-[#0b0b0c] px-5 py-4 text-white sm:px-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_30%,rgba(226,26,34,.38),transparent_28%),linear-gradient(120deg,#111319,#1a0b0d)]" />
              <div className="relative flex items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/45">Cuadre · {dateLabel(businessDate)}</p>
                  <h2 className="mt-1.5 text-[27px] font-black tracking-[-0.04em]">Cerrar caja</h2>
                  <p className="mt-1 text-[11px] text-white/50">Cuenta efectivo y cuentas. Los préstamos no se cuentan aquí.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCloseModal(false)}
                  disabled={actionBusy}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative mt-3 grid grid-cols-3 gap-2 xl:absolute xl:right-20 xl:top-1/2 xl:mt-0 xl:w-[530px] xl:-translate-y-1/2">
                <CloseMetric label="Debe haber" value={money(expectedNow)} />
                <CloseMetric label="Contaste" value={money(countedTotal)} />
                <CloseMetric
                  label="Diferencia"
                  value={(previewDifference > 0 ? "+" : "") + money(previewDifference)}
                  tone={previewDifference === 0 ? "ok" : previewDifference > 0 ? "positive" : "negative"}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3.5 sm:p-4">
              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div>
              )}

              <div className="grid gap-3 xl:grid-cols-[1.4fr_.9fr]">
                <section className="rounded-[22px] border border-neutral-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">Efectivo</p>
                      <h3 className="mt-1 text-[19px] font-black">Conteo por denominación</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">Total efectivo</span>
                      <b className="mt-1 block text-[18px] font-black text-neutral-950">{money(cashTotal)}</b>
                    </div>
                  </div>

                  <p className="mt-3 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">Billetes</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {BILLS.map((denomination) => (
                      <DenominationRow
                        key={denomination}
                        denomination={denomination}
                        value={counts[String(denomination)] || ""}
                        onChange={(value) =>
                          setCounts((current) => ({
                            ...current,
                            [String(denomination)]: integerInput(value).slice(0, 5),
                          }))
                        }
                      />
                    ))}
                  </div>

                  <p className="mt-4 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">Monedas</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {COINS.map((denomination) => (
                      <DenominationRow
                        key={denomination}
                        denomination={denomination}
                        value={counts[String(denomination)] || ""}
                        onChange={(value) =>
                          setCounts((current) => ({
                            ...current,
                            [String(denomination)]: integerInput(value).slice(0, 5),
                          }))
                        }
                      />
                    ))}
                  </div>
                </section>

                <div className="grid content-start gap-3">
                  <section className="rounded-[22px] border border-neutral-200 bg-white p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                        <Landmark className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">Saldos digitales</p>
                        <h3 className="mt-0.5 text-[18px] font-black">Cuentas y datáfono</h3>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <MoneyField label="Nequi" value={nequi} onChange={setNequi} />
                      <MoneyField label="DaviPlata" value={daviplata} onChange={setDaviplata} />
                      <MoneyField label="Tarjeta" value={card} onChange={setCard} />
                      <MoneyField label="Davivienda" value={davivienda} onChange={setDavivienda} />
                    </div>
                  </section>

                                    <section className="rounded-[22px] border border-neutral-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">Cuadre</p>
                        <h3 className="mt-0.5 text-[18px] font-black">Resumen simple</h3>
                      </div>
                      <span className="text-[9px] font-bold text-neutral-400">{dateLabel(businessDate)}</span>
                    </div>

                    <div className="mt-4 rounded-[18px] border border-neutral-200 bg-[#faf9f7] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[11px] font-medium text-neutral-500">Disponible al iniciar</span>
                        <b className="text-[12px] font-black text-neutral-800">{money(openingAvailableBalance)}</b>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-4">
                        <span className="text-[11px] font-medium text-neutral-500">Movimiento del día</span>
                        <b className={"text-[12px] font-black " + (liveMovement >= 0 ? "text-emerald-700" : "text-red-700")}>
                          {liveMovement >= 0 ? "+" : ""}{money(liveMovement)}
                        </b>
                      </div>
                      <div className="my-3 h-px bg-neutral-200" />
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[12px] font-black text-neutral-800">Debe haber disponible</span>
                        <b className="text-[18px] font-black text-neutral-950">{money(expectedNow)}</b>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-[16px] border border-neutral-200 bg-white px-3 py-3">
                        <span className="text-[8px] font-black uppercase tracking-[0.11em] text-neutral-400">Efectivo</span>
                        <b className="mt-1 block text-[15px] font-black text-neutral-900">{money(cashTotal)}</b>
                      </div>
                      <div className="rounded-[16px] border border-neutral-200 bg-white px-3 py-3">
                        <span className="text-[8px] font-black uppercase tracking-[0.11em] text-neutral-400">En cuentas</span>
                        <b className="mt-1 block text-[15px] font-black text-neutral-900">{money(countedTotal - cashTotal)}</b>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-4 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3">
                      <div>
                        <span className="text-[8px] font-black uppercase tracking-[0.11em] text-amber-700">Préstamos por cobrar</span>
                        <p className="mt-0.5 text-[9px] text-amber-700/70">Es dinero de Alentó, pero no se cuenta en caja.</p>
                      </div>
                      <b className="shrink-0 text-[15px] font-black text-amber-800">{money(loansReceivable)}</b>
                    </div>

                    <details className="mt-3 rounded-[14px] border border-neutral-200 bg-white px-3 py-2.5">
                      <summary className="cursor-pointer text-[10px] font-black text-neutral-500">
                        Ver detalle del movimiento del día
                      </summary>
                      <div className="mt-3 space-y-2 text-[10px]">
                        <SummaryLine label="Ventas cobradas" value={money(data?.movement?.received ?? 0)} />
                        <SummaryLine label="Otros ingresos" value={money(data?.movement?.otherIncome ?? 0)} />
                        <SummaryLine label="Abonos de préstamos" value={money(data?.movement?.recovered ?? 0)} />
                        <SummaryLine label="Salidas" value={"- " + money(data?.movement?.expensesTotal ?? 0)} />
                        <SummaryLine label="Préstamos entregados" value={"- " + money(data?.movement?.loansTotal ?? 0)} />
                      </div>
                    </details>

                    <div className={"mt-3 rounded-2xl border px-4 py-3 " + (
                      previewDifference === 0
                        ? "border-emerald-200 bg-emerald-50"
                        : previewDifference > 0
                          ? "border-sky-200 bg-sky-50"
                          : "border-red-200 bg-red-50"
                    )}>
                      <span className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-500">
                        {previewDifference === 0 ? "Caja cuadrada" : previewDifference > 0 ? "Sobra" : "Falta"}
                      </span>
                      <b className={"mt-0.5 block text-[22px] font-black " + (
                        previewDifference === 0
                          ? "text-emerald-700"
                          : previewDifference > 0
                            ? "text-sky-700"
                            : "text-red-700"
                      )}>
                        {previewDifference > 0 ? "+" : ""}{money(previewDifference)}
                      </b>
                    </div>

                    <label className="mt-3 block text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">Observación opcional</label>
                    <textarea
                      value={closeNote}
                      onChange={(event) => setCloseNote(event.target.value)}
                      rows={1}
                      placeholder="Ej. pendiente confirmar transferencia..."
                      className="mt-2 w-full resize-none rounded-xl border border-neutral-200 bg-[#faf9f7] px-3 py-2.5 text-[11px] outline-none focus:border-neutral-400"
                    />
                  </section>                  </section>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-neutral-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-[10px] text-neutral-400">
                Solo compara el dinero disponible que debes tener contra lo que realmente contaste.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCloseModal(false)}
                  disabled={actionBusy}
                  className="h-11 flex-1 rounded-xl border border-neutral-200 bg-white px-5 text-[11px] font-black text-neutral-600 sm:flex-none"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void closeCash()}
                  disabled={actionBusy}
                  className="h-11 flex-1 rounded-xl bg-[var(--brand-red)] px-6 text-[11px] font-black text-white disabled:bg-neutral-300 sm:flex-none"
                >
                  {actionBusy ? "Cerrando..." : "Confirmar cierre"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MiniMetric({
  label,
  value,
  tone,
  strong = false,
  difference,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  strong?: boolean;
  difference?: number;
}) {
  return (
    <div className="min-w-[116px] rounded-2xl border border-neutral-200 bg-[#faf9f7] px-4 py-3">
      <span className="text-[8px] font-black uppercase tracking-[0.12em] text-neutral-400">{label}</span>
      <b className={"mt-1 block text-[15px] font-black " + (
        difference != null
          ? difference === 0
            ? "text-emerald-700"
            : difference > 0
              ? "text-sky-700"
              : "text-red-700"
          : tone === "positive"
            ? "text-emerald-700"
            : tone === "negative"
              ? "text-red-700"
              : strong
                ? "text-neutral-950"
                : "text-neutral-700"
      )}>
        {value}
      </b>
      {difference != null && (
        <span className="mt-1 block text-[8px] font-bold text-neutral-400">
          {difference === 0 ? "Cuadrada" : difference > 0 ? "Sobra " + money(difference) : "Falta " + money(Math.abs(difference))}
        </span>
      )}
    </div>
  );
}

function CloseMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "positive" | "negative";
}) {
  return (
    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
      <span className="text-[8px] font-black uppercase tracking-[0.12em] text-white/35">{label}</span>
      <b className={"mt-1 block truncate text-[15px] font-black sm:text-[18px] " + (
        tone === "ok"
          ? "text-emerald-300"
          : tone === "positive"
            ? "text-sky-300"
            : tone === "negative"
              ? "text-red-300"
              : "text-white"
      )}>{value}</b>
    </div>
  );
}

function DenominationRow({
  denomination,
  value,
  onChange,
}: {
  denomination: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const subtotal = denomination * Number(value || 0);
  return (
    <label className="grid min-h-[52px] grid-cols-[1fr_68px_88px] items-center gap-2 rounded-xl border border-neutral-200 bg-[#faf9f7] px-3 py-1.5 xl:grid-cols-[1fr_74px_98px]">
      <div>
        <span className="text-[9px] font-bold text-neutral-400">$</span>
        <b className="ml-1 text-[12px] text-neutral-800">{denomination.toLocaleString("es-CO")}</b>
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="numeric"
        placeholder="0"
        className="h-8 w-full rounded-lg border border-neutral-200 bg-white px-2 text-center text-[12px] font-black outline-none focus:border-neutral-400"
      />
      <span className="truncate text-right text-[10px] font-black text-neutral-500">{money(subtotal)}</span>
    </label>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[9px] font-black uppercase tracking-[0.11em] text-neutral-400">{label}</span>
      <div className="mt-1 flex h-10 items-center rounded-xl border border-neutral-200 bg-[#faf9f7] px-3 focus-within:border-neutral-400 focus-within:bg-white">
        <span className="mr-1.5 text-[12px] font-black text-neutral-400">$</span>
        <input
          value={value}
          onChange={(event) => onChange(integerInput(event.target.value))}
          inputMode="numeric"
          placeholder="0"
          className="min-w-0 flex-1 bg-transparent text-right text-[14px] font-black text-neutral-900 outline-none"
        />
      </div>
    </label>
  );
}

function SummaryLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "font-black text-neutral-700" : "text-neutral-500"}>{label}</span>
      <b className={strong ? "text-[13px] font-black text-neutral-950" : "font-bold text-neutral-700"}>{value}</b>
    </div>
  );
}
