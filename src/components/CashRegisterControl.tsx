"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  Eye,
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
  requestedBusinessDate: string;
  inheritedOpenSession: boolean;
  session: CashRegisterSession | null;
  movement: Movement;
  suggestedOpeningBalance: number | null;
  suggestedOpeningAvailableBalance?: number | null;
  previousCloseDate: string | null;
  openingLoansReceivable: number;
  history: CashRegisterSession[];
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
  currentMovement,
  onChanged,
  onSessionStateChange,
  onSessionClosed,
}: {
  businessDate: string;
  enabled: boolean;
  currentNetMovement: number;
  currentMovement?: Pick<
    Movement,
    | "received"
    | "otherIncome"
    | "expensesTotal"
    | "loansTotal"
    | "recovered"
    | "netMovement"
  > | null;
  onChanged?: () => void;
  onSessionStateChange?: (status: "NONE" | "OPEN" | "CLOSED") => void;
  onSessionClosed?: (businessDate: string) => void;
}) {
  const [data, setData] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [editingOpening, setEditingOpening] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [historySession, setHistorySession] =
    useState<CashRegisterSession | null>(null);
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
      onSessionStateChange?.("NONE");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        "/api/caja/register-session?date=" +
          encodeURIComponent(businessDate) +
          "&includeMovement=0",
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "No fue posible cargar la apertura de caja.");
      }
      setData(result);
      onSessionStateChange?.(
        result.session?.status === "CLOSED"
          ? "CLOSED"
          : result.session?.status === "OPEN"
            ? "OPEN"
            : "NONE",
      );
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
    const suggested =
      data.suggestedOpeningAvailableBalance ??
      data.suggestedOpeningBalance;
    if (suggested != null) {
      setOpeningBalance(String(Math.round(suggested)));
    }
  }, [data, openingBalance]);

  const session = data?.session ?? null;
  const liveSummaryReady =
    session?.status !== "OPEN" || currentMovement != null;
  const effectiveMovement = {
    received:
      currentMovement?.received ??
      data?.movement?.received ??
      0,
    otherIncome:
      currentMovement?.otherIncome ??
      data?.movement?.otherIncome ??
      0,
    expensesTotal:
      currentMovement?.expensesTotal ??
      data?.movement?.expensesTotal ??
      0,
    loansTotal:
      currentMovement?.loansTotal ??
      data?.movement?.loansTotal ??
      0,
    recovered:
      currentMovement?.recovered ??
      data?.movement?.recovered ??
      0,
    netMovement:
      currentMovement?.netMovement ??
      data?.movement?.netMovement ??
      currentNetMovement,
  };
  const liveMovement = effectiveMovement.netMovement;
  const openingLoansReceivable =
    session?.openingLoanReceivable ??
    data?.openingLoansReceivable ??
    0;
  const suggestedOpeningAvailable =
    data?.suggestedOpeningAvailableBalance ??
    data?.suggestedOpeningBalance ??
    0;
  const openingAvailableBalance = session
    ? session.openingControlledBalance != null
      ? session.openingBalance
      : Math.max(0, session.openingBalance - openingLoansReceivable)
    : Number(openingBalance || suggestedOpeningAvailable || 0);
  const openingControlledBalance = session
    ? session.openingControlledBalance ??
      openingAvailableBalance + openingLoansReceivable
    : openingAvailableBalance + openingLoansReceivable;
  const expectedNow = openingAvailableBalance + liveMovement;
  const loansReceivable =
    session?.status === "CLOSED" && session.closingLoanReceivable != null
      ? session.closingLoanReceivable
      : currentMovement && session?.status === "OPEN"
        ? Math.max(
            0,
            openingLoansReceivable +
              effectiveMovement.loansTotal -
              effectiveMovement.recovered,
          )
        : data?.movement?.loansReceivable ??
          openingLoansReceivable;

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

  function openingSnapshot(item: CashRegisterSession) {
    const openingLoans = Number(item.openingLoanReceivable ?? 0);
    const openingAvailable =
      item.openingControlledBalance != null
        ? Number(item.openingBalance ?? 0)
        : Math.max(
            0,
            Number(item.openingBalance ?? 0) - openingLoans,
          );
    const openingTotal =
      item.openingControlledBalance != null
        ? Number(item.openingControlledBalance)
        : openingAvailable + openingLoans;

    return {
      openingLoans,
      openingAvailable,
      openingTotal,
    };
  }

  function denominationCount(
    item: CashRegisterSession,
    denomination: number,
  ) {
    const raw = item.closingDenominations?.[String(denomination)];
    const count = Number(raw ?? 0);
    return Number.isFinite(count) && count >= 0 ? count : 0;
  }

  function prepareOpen() {
    const suggested =
      data?.suggestedOpeningAvailableBalance ??
      data?.suggestedOpeningBalance;
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
          session.openingControlledBalance != null
            ? session.openingBalance
            : Math.max(
                0,
                session.openingBalance - openingLoansReceivable,
              ),
        ),
      ),
    );
    setError("");
    setOpenModal(true);
  }

  function prepareClose() {
    if (!liveSummaryReady) return;

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
      setError("Ingresa un valor de dinero disponible válido.");
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
          businessDate:
            editingOpening && session
              ? session.businessDate
              : businessDate,
          openingAvailableBalance: amount,
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
          sessionId: session?.id,
          businessDate: session?.businessDate ?? businessDate,
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
      onSessionClosed?.(result.session?.businessDate ?? session?.businessDate ?? businessDate);
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
            <b className="text-sm text-neutral-800">Apertura y cierre por sesión</b>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              Selecciona un solo día para consultar su apertura. Una sesión puede continuar después de medianoche hasta que se cierre.
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
          <div className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
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
                <p className="mt-1 max-w-xl text-[11px] text-neutral-500">
                  Parte del dinero disponible del cierre anterior. La cartera de préstamos se trae por separado y se suma automáticamente al total de apertura.
                </p>
              </div>
            </div>

            {data?.suggestedOpeningBalance != null ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <MiniMetric
                  label="Disponible cierre"
                  value={money(
                    data.suggestedOpeningAvailableBalance ??
                      data.suggestedOpeningBalance,
                  )}
                />
                <MiniMetric
                  label="Préstamos actuales"
                  value={money(openingLoansReceivable)}
                />
                <MiniMetric
                  label="Total apertura"
                  value={money(
                    (data.suggestedOpeningAvailableBalance ??
                      data.suggestedOpeningBalance) +
                      openingLoansReceivable,
                  )}
                  strong
                />
                <button
                  type="button"
                  onClick={prepareOpen}
                  className="h-12 rounded-2xl bg-neutral-950 px-5 text-[11px] font-black text-white shadow-[0_10px_24px_rgba(0,0,0,.16)] transition hover:-translate-y-0.5"
                >
                  Abrir con cierre anterior
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={prepareOpen}
                className="h-12 rounded-2xl bg-neutral-950 px-5 text-[11px] font-black text-white shadow-[0_10px_24px_rgba(0,0,0,.16)] transition hover:-translate-y-0.5"
              >
                Abrir caja
              </button>
            )}
          </div>
        </section>
      ) : session.status === "OPEN" ? (
        <section className="overflow-hidden rounded-[20px] border border-emerald-200 bg-[linear-gradient(135deg,#ffffff,#fbfffd)] shadow-[0_8px_24px_rgba(28,23,20,.045)]">
          <div className="grid gap-3 p-3.5 xl:grid-cols-[minmax(260px,.9fr)_minmax(0,1.6fr)_auto] xl:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[14px] font-black text-neutral-950">Caja abierta</b>
                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-white">
                    Activa
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[9px] text-neutral-400">
                  Abrió {session.openedByName} · {dateTimeLabel(session.openedAt)}
                </p>
                {data?.inheritedOpenSession && (
                  <p className="mt-1 text-[8px] font-black text-amber-600">
                    Abierta desde {dateLabel(session.businessDate)}.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MiniMetric label="Disponible inicial" value={money(openingAvailableBalance)} />
              <MiniMetric label="Préstamos iniciales" value={money(openingLoansReceivable)} />
              <MiniMetric label="Total apertura" value={money(openingControlledBalance)} />
              <MiniMetric
                label="Disponible esperado"
                value={liveSummaryReady ? money(expectedNow) : "Actualizando…"}
                strong
              />
            </div>

            <div className="flex gap-2 xl:justify-end">
              <button
                type="button"
                onClick={prepareEditOpening}
                className="h-10 rounded-xl border border-neutral-200 bg-white px-3.5 text-[9px] font-black text-neutral-700 transition hover:bg-neutral-50"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={prepareClose}
                disabled={!liveSummaryReady}
                className="h-10 rounded-xl bg-[var(--brand-red)] px-4 text-[9px] font-black text-white shadow-[0_8px_18px_rgba(226,26,34,.16)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-45 disabled:hover:translate-y-0"
              >
                {liveSummaryReady ? "Cerrar caja" : "Actualizando…"}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-[20px] border border-neutral-200 bg-[linear-gradient(135deg,#ffffff,#fafafa)] shadow-[0_8px_24px_rgba(28,23,20,.04)]">
          <div className="grid gap-3 p-3.5 xl:grid-cols-[minmax(300px,1fr)_minmax(0,1.2fr)_auto] xl:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-neutral-950 text-white">
                <LockKeyhole className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[14px] font-black text-neutral-950">Caja cerrada</b>
                  <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-neutral-600">
                    {dateLabel(session.businessDate)}
                  </span>
                  <span
                    className={
                      "rounded-full border px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] " +
                      ((session.difference || 0) === 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : (session.difference || 0) > 0
                          ? "border-sky-200 bg-sky-50 text-sky-700"
                          : "border-red-200 bg-red-50 text-red-700")
                    }
                  >
                    {(session.difference || 0) === 0
                      ? "Cuadrada"
                      : (session.difference || 0) > 0
                        ? "Sobra " + money(session.difference || 0)
                        : "Falta " + money(Math.abs(session.difference || 0))}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[9px] text-neutral-400">
                  Cerró {session.closedByName || "—"} · {dateTimeLabel(session.closedAt)}
                </p>
                <p className="mt-0.5 text-[8px] font-semibold text-neutral-500">
                  Sesión bloqueada · solo consulta
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <MiniMetric
                label="Disponible al cierre"
                value={money(session.actualClosingBalance || 0)}
              />
              <MiniMetric
                label="Préstamos por cobrar"
                value={money(session.closingLoanReceivable || 0)}
              />
              <MiniMetric
                label="Total de Alentó"
                value={money(
                  (session.actualClosingBalance || 0) +
                    (session.closingLoanReceivable || 0),
                )}
                strong
              />
            </div>

            <button
              type="button"
              onClick={() => setHistorySession(session)}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 text-[9px] font-black text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              <Eye className="h-3.5 w-3.5" strokeWidth={2} />
              Detalle
            </button>
          </div>
        </section>
      )}

      {(data?.history?.length ?? 0) > 0 && (
        <section className="overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-[0_8px_24px_rgba(28,23,20,.04)]">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3.5 sm:px-5">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-neutral-400">
                Historial
              </p>
              <h3 className="mt-0.5 text-[15px] font-black text-neutral-950">
                Aperturas y cierres de caja
              </h3>
            </div>
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[8px] font-black text-neutral-500">
              {data?.history.length ?? 0} sesiones
            </span>
          </div>

          <div className="divide-y divide-neutral-100">
            {data?.history.map((item) => {
              const isOpen = item.status === "OPEN";
              const difference = Number(item.difference ?? 0);

              return (
                <button
                  type="button"
                  key={item.id}
                  disabled={isOpen}
                  onClick={() => {
                    if (!isOpen) setHistorySession(item);
                  }}
                  className={
                    "grid w-full gap-3 px-4 py-3.5 text-left sm:px-5 lg:grid-cols-[150px_1fr_auto_auto] lg:items-center " +
                    (isOpen
                      ? "cursor-default"
                      : "cursor-pointer transition hover:bg-neutral-50 active:bg-neutral-100")
                  }
                >
                  <div>
                    <span
                      className={
                        "inline-flex rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] " +
                        (isOpen
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-neutral-100 text-neutral-600")
                      }
                    >
                      {isOpen ? "Abierta" : "Cerrada"}
                    </span>
                    <b className="mt-1.5 block text-[11px] text-neutral-900">
                      {dateLabel(item.businessDate)}
                    </b>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-neutral-600">
                      Apertura · {dateTimeLabel(item.openedAt)}
                    </p>
                    <p className="mt-0.5 text-[9px] text-neutral-400">
                      {item.closedAt
                        ? "Cierre · " + dateTimeLabel(item.closedAt)
                        : "Sigue abierta"}
                    </p>
                  </div>

                  <div className="lg:text-right">
                    <span className="block text-[8px] font-black uppercase tracking-[0.09em] text-neutral-400">
                      Esperado
                    </span>
                    <b className="mt-0.5 block text-[12px] text-neutral-800">
                      {item.expectedClosingBalance == null
                        ? "—"
                        : money(item.expectedClosingBalance)}
                    </b>
                  </div>

                  <div className="lg:min-w-[130px] lg:text-right">
                    <span className="block text-[8px] font-black uppercase tracking-[0.09em] text-neutral-400">
                      Resultado
                    </span>
                    {isOpen ? (
                      <b className="mt-0.5 block text-[12px] text-emerald-700">
                        En curso
                      </b>
                    ) : (
                      <>
                        <b className="mt-0.5 block text-[12px] text-neutral-900">
                          {money(item.actualClosingBalance ?? 0)}
                        </b>
                        <span
                          className={
                            "mt-0.5 block text-[8px] font-black " +
                            (difference === 0
                              ? "text-emerald-600"
                              : difference > 0
                                ? "text-sky-600"
                                : "text-red-600")
                          }
                        >
                          {difference === 0
                            ? "Cuadrada"
                            : difference > 0
                              ? "Sobra " + money(difference)
                              : "Falta " + money(Math.abs(difference))}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {historySession && historySession.status === "CLOSED" && (() => {
        const snapshot = openingSnapshot(historySession);
        const cashAtClose = Number(historySession.closingCash ?? 0);
        const accountsAtClose =
          Number(historySession.closingNequi ?? 0) +
          Number(historySession.closingDaviplata ?? 0) +
          Number(historySession.closingCard ?? 0) +
          Number(historySession.closingDavivienda ?? 0);
        const countedAtClose =
          Number(
            historySession.actualClosingBalance ??
              cashAtClose + accountsAtClose,
          );
        const expectedAtClose = Number(
          historySession.expectedClosingBalance ?? 0,
        );
        const differenceAtClose = Number(
          historySession.difference ??
            countedAtClose - expectedAtClose,
        );

        return (
          <div
            className="fixed inset-0 z-[105] flex items-center justify-center bg-black/70 p-2 backdrop-blur-[3px] sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setHistorySession(null);
              }
            }}
          >
            <div className="flex max-h-[96dvh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#f6f5f2] shadow-[0_30px_100px_rgba(0,0,0,.38)]">
              <div className="relative shrink-0 overflow-hidden bg-[#0b0b0c] px-5 py-4 text-white sm:px-6">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_30%,rgba(226,26,34,.34),transparent_28%),linear-gradient(120deg,#111319,#1a0b0d)]" />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/45">
                      Historial de caja · solo consulta
                    </p>
                    <h2 className="mt-1.5 text-[27px] font-black tracking-[-0.04em]">
                      {dateLabel(historySession.businessDate)}
                    </h2>
                    <p className="mt-1 text-[11px] text-white/50">
                      Abrió {historySession.openedByName} · {dateTimeLabel(historySession.openedAt)}
                      {" · "}
                      Cerró {historySession.closedByName || "—"} · {dateTimeLabel(historySession.closedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistorySession(null)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07]"
                    aria-label="Cerrar detalle de caja"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="relative mt-3 grid grid-cols-3 gap-2 lg:absolute lg:right-20 lg:top-1/2 lg:mt-0 lg:w-[500px] lg:-translate-y-1/2">
                  <CloseMetric
                    label="Esperado"
                    value={money(expectedAtClose)}
                  />
                  <CloseMetric
                    label="Contado"
                    value={money(countedAtClose)}
                  />
                  <CloseMetric
                    label="Diferencia"
                    value={
                      (differenceAtClose > 0 ? "+" : "") +
                      money(differenceAtClose)
                    }
                    tone={
                      differenceAtClose === 0
                        ? "ok"
                        : differenceAtClose > 0
                          ? "positive"
                          : "negative"
                    }
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3.5 sm:p-4">
                <section className="mb-3 rounded-[22px] border border-neutral-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                        Apertura registrada
                      </p>
                      <h3 className="mt-1 text-[18px] font-black text-neutral-950">
                        Con qué inició esta sesión
                      </h3>
                    </div>
                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[9px] font-bold text-neutral-500">
                      {dateTimeLabel(historySession.openedAt)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <ReadOnlyMetric
                      label="Disponible inicial"
                      value={money(snapshot.openingAvailable)}
                    />
                    <ReadOnlyMetric
                      label="Préstamos iniciales"
                      value={money(snapshot.openingLoans)}
                      tone="amber"
                    />
                    <ReadOnlyMetric
                      label="Total apertura"
                      value={money(snapshot.openingTotal)}
                      strong
                    />
                  </div>

                  {historySession.openingControlledBalance == null && (
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[9px] font-semibold text-amber-700">
                      Esta apertura pertenece al formato anterior: no guardaba el disponible y los préstamos por separado.
                    </p>
                  )}
                </section>

                <div className="grid gap-3 xl:grid-cols-[1.35fr_.85fr]">
                  <section className="rounded-[22px] border border-neutral-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                          Efectivo registrado al cierre
                        </p>
                        <h3 className="mt-1 text-[19px] font-black text-neutral-950">
                          Billetes y monedas
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] font-black uppercase tracking-[0.11em] text-neutral-400">
                          Total efectivo
                        </span>
                        <b className="mt-1 block text-[18px] font-black text-neutral-950">
                          {money(cashAtClose)}
                        </b>
                      </div>
                    </div>

                    <p className="mt-4 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                      Billetes
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {BILLS.map((denomination) => (
                        <ReadOnlyDenominationRow
                          key={denomination}
                          denomination={denomination}
                          count={denominationCount(
                            historySession,
                            denomination,
                          )}
                        />
                      ))}
                    </div>

                    <p className="mt-4 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                      Monedas
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {COINS.map((denomination) => (
                        <ReadOnlyDenominationRow
                          key={denomination}
                          denomination={denomination}
                          count={denominationCount(
                            historySession,
                            denomination,
                          )}
                        />
                      ))}
                    </div>
                  </section>

                  <div className="grid content-start gap-3">
                    <section className="rounded-[22px] border border-neutral-200 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                          <Landmark className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                            Cuentas registradas
                          </p>
                          <h3 className="mt-0.5 text-[18px] font-black">
                            Saldos digitales y datáfono
                          </h3>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <ReadOnlyMetric
                          label="Nequi"
                          value={money(historySession.closingNequi ?? 0)}
                        />
                        <ReadOnlyMetric
                          label="DaviPlata"
                          value={money(historySession.closingDaviplata ?? 0)}
                        />
                        <ReadOnlyMetric
                          label="Tarjeta"
                          value={money(historySession.closingCard ?? 0)}
                        />
                        <ReadOnlyMetric
                          label="Davivienda"
                          value={money(historySession.closingDavivienda ?? 0)}
                        />
                      </div>

                      <div className="mt-3 rounded-[16px] border border-neutral-200 bg-neutral-950 px-4 py-3 text-white">
                        <span className="text-[8px] font-black uppercase tracking-[0.11em] text-white/45">
                          Total en cuentas
                        </span>
                        <b className="mt-1 block text-[18px] font-black">
                          {money(accountsAtClose)}
                        </b>
                      </div>
                    </section>

                    <section className="rounded-[22px] border border-neutral-200 bg-white p-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                        Resumen del cierre
                      </p>
                      <div className="mt-3 space-y-2.5">
                        <SummaryLine
                          label="Efectivo"
                          value={money(cashAtClose)}
                        />
                        <SummaryLine
                          label="Cuentas"
                          value={money(accountsAtClose)}
                        />
                        <SummaryLine
                          label="Total contado"
                          value={money(countedAtClose)}
                          strong
                        />
                        <div className="h-px bg-neutral-200" />
                        <SummaryLine
                          label="Esperado"
                          value={money(expectedAtClose)}
                        />
                        <SummaryLine
                          label="Diferencia"
                          value={
                            (differenceAtClose > 0 ? "+" : "") +
                            money(differenceAtClose)
                          }
                          strong
                        />
                      </div>

                      <div className="mt-3 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3">
                        <span className="text-[8px] font-black uppercase tracking-[0.11em] text-amber-700">
                          Préstamos por cobrar al cierre
                        </span>
                        <b className="mt-1 block text-[16px] font-black text-amber-800">
                          {money(historySession.closingLoanReceivable ?? 0)}
                        </b>
                        <p className="mt-1 text-[9px] leading-4 text-amber-700/75">
                          No forman parte del efectivo o las cuentas disponibles.
                        </p>
                      </div>

                      <div className="mt-3 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <span className="text-[8px] font-black uppercase tracking-[0.11em] text-emerald-700">
                          Disponible que pasa a la siguiente apertura
                        </span>
                        <b className="mt-1 block text-[18px] font-black text-emerald-800">
                          {money(countedAtClose)}
                        </b>
                        <p className="mt-1 text-[9px] leading-4 text-emerald-700/75">
                          Este es el valor disponible que el sistema propone al abrir la siguiente caja.
                        </p>
                      </div>

                      {historySession.closeNote && (
                        <div className="mt-3 rounded-[14px] border border-neutral-200 bg-[#faf9f7] px-3 py-3">
                          <span className="text-[8px] font-black uppercase tracking-[0.11em] text-neutral-400">
                            Observación del cierre
                          </span>
                          <p className="mt-1 text-[10px] font-semibold leading-4 text-neutral-700">
                            {historySession.closeNote}
                          </p>
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 bg-white px-4 py-3 sm:px-5">
                <p className="hidden text-[9px] text-neutral-400 sm:block">
                  Sesión cerrada · este detalle es únicamente de consulta.
                </p>
                <button
                  type="button"
                  onClick={() => setHistorySession(null)}
                  className="ml-auto h-11 rounded-xl bg-neutral-950 px-6 text-[11px] font-black text-white"
                >
                  Cerrar detalle
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                    Ingresa únicamente el dinero disponible. Alentó suma automáticamente los préstamos por cobrar para formar el total de apertura.
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
                  onClick={() =>
                    setOpeningBalance(
                      String(
                        Math.round(
                          data.suggestedOpeningAvailableBalance ??
                            data.suggestedOpeningBalance ??
                            0,
                        ),
                      ),
                    )
                  }
                  className="mb-4 w-full rounded-[18px] border border-neutral-200 bg-[#faf9f7] p-4 text-left transition hover:border-neutral-300"
                >
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">Disponible del cierre anterior · {dateLabel(data.previousCloseDate)}</span>
                  <b className="mt-1 block text-[20px] font-black text-neutral-950">
                    {money(
                      data.suggestedOpeningAvailableBalance ??
                        data.suggestedOpeningBalance,
                    )}
                  </b>
                  <span className="mt-1 block text-[10px] text-neutral-500">
                    Toca para usar este dinero disponible en la nueva apertura.
                  </span>
                </button>
              )}

              <label className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
                Dinero disponible al abrir
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
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">Disponible</span>
                  <b className="mt-1 block text-[16px] font-black text-neutral-800">
                    {money(Number(openingBalance || 0))}
                  </b>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-700">Préstamos por cobrar</span>
                  <b className="mt-1 block text-[16px] font-black text-amber-800">
                    {money(openingLoansReceivable)}
                  </b>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-950 p-4 text-white">
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/40">Total apertura</span>
                  <b className="mt-1 block text-[16px] font-black">
                    {money(
                      Number(openingBalance || 0) +
                        openingLoansReceivable,
                    )}
                  </b>
                </div>
              </div>

              <p className="mt-4 text-[10px] leading-5 text-neutral-500">
                Solo ingresas el dinero realmente disponible. La cartera de préstamos se trae automáticamente y se suma para mostrar el valor total de Alentó al abrir.
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
                        <span className="text-[11px] font-medium text-neutral-500">Movimiento de la sesión</span>
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
                        Ver detalle del movimiento de la sesión
                      </summary>
                      <div className="mt-3 space-y-2 text-[10px]">
                        <SummaryLine label="Ventas cobradas" value={money(effectiveMovement.received)} />
                        <SummaryLine label="Otros ingresos" value={money(effectiveMovement.otherIncome)} />
                        <SummaryLine label="Abonos de préstamos" value={money(effectiveMovement.recovered)} />
                        <SummaryLine label="Salidas" value={"- " + money(effectiveMovement.expensesTotal)} />
                        <SummaryLine label="Préstamos entregados" value={"- " + money(effectiveMovement.loansTotal)} />
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
                  </section>
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
    <div className="min-w-[0] rounded-[14px] border border-neutral-200 bg-[#faf9f7] px-3 py-2.5">
      <span className="text-[7px] font-black uppercase tracking-[0.11em] text-neutral-400">{label}</span>
      <b className={"mt-0.5 block text-[13px] font-black " + (
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

function ReadOnlyMetric({
  label,
  value,
  tone,
  strong = false,
}: {
  label: string;
  value: string;
  tone?: "amber";
  strong?: boolean;
}) {
  return (
    <div
      className={
        "rounded-[16px] border px-3 py-3 " +
        (tone === "amber"
          ? "border-amber-200 bg-amber-50"
          : strong
            ? "border-neutral-900 bg-neutral-950 text-white"
            : "border-neutral-200 bg-[#faf9f7]")
      }
    >
      <span
        className={
          "text-[8px] font-black uppercase tracking-[0.11em] " +
          (tone === "amber"
            ? "text-amber-700"
            : strong
              ? "text-white/45"
              : "text-neutral-400")
        }
      >
        {label}
      </span>
      <b
        className={
          "mt-1 block text-[15px] font-black " +
          (tone === "amber"
            ? "text-amber-800"
            : strong
              ? "text-white"
              : "text-neutral-900")
        }
      >
        {value}
      </b>
    </div>
  );
}

function ReadOnlyDenominationRow({
  denomination,
  count,
}: {
  denomination: number;
  count: number;
}) {
  const subtotal = denomination * count;

  return (
    <div className="grid min-h-[52px] grid-cols-[1fr_68px_96px] items-center gap-2 rounded-xl border border-neutral-200 bg-[#faf9f7] px-3 py-1.5">
      <div>
        <span className="text-[9px] font-bold text-neutral-400">$</span>
        <b className="ml-1 text-[12px] text-neutral-800">
          {denomination.toLocaleString("es-CO")}
        </b>
      </div>
      <div className="flex h-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-[12px] font-black text-neutral-700">
        {count}
      </div>
      <span className="truncate text-right text-[10px] font-black text-neutral-500">
        {money(subtotal)}
      </span>
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
