"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CircleDollarSign,
  HandCoins,
  CheckCircle2,
  Pencil,
  Search,
  Trash2,
  WalletCards,
} from "lucide-react";

type Repayment = {
  id: number;
  amount: number;
  paidAt: string;
  method: string;
  note: string | null;
  source: string;
  createdByName: string;
};

type WorkerOption = {
  id: number;
  name: string;
  email: string;
};

type Loan = {
  id: number;
  workerId: number | null;
  workerName: string;
  note: string | null;
  principal: number;
  issuedAt: string;
  status: "OPEN" | "PAID";
  source: string;
  createdByName: string;
  historicalPaidWithoutRepayment: boolean;
  repaidAmount: number;
  trackedRepaidAmount: number;
  outstandingAmount: number;
  repayments: Repayment[];
};

type CashLoanChange = {
  loanDisbursedDelta?: number;
  loanRecoveredDelta?: number;
};

type LoansResponse = {
  summary: {
    loanCount: number;
    openCount: number;
    principalTotal: number;
    repaidTotal: number;
    outstandingTotal: number;
  };
  loans: Loan[];
  workers: WorkerOption[];
};

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function localDateInput() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function localTimeInput() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.hour}:${map.minute}`;
}

function dateTimeLabel(value: string) {
  return new Date(value).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CashLoansPanel({
  cashDateLocked,
  businessDate,
  onCashChanged,
  createSignal = 0,
}: {
  cashDateLocked: boolean;
  businessDate: string;
  createSignal?: number;
  onCashChanged: (
    change?: CashLoanChange,
  ) => void | Promise<void>;
}) {
  const [data, setData] = useState<LoansResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "PAID">(
    "OPEN",
  );

  const [newOpen, setNewOpen] = useState(false);
  const [workerId, setWorkerId] = useState<number | "">("");
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [editWorkerId, setEditWorkerId] = useState<number | "">("");
  const [editNote, setEditNote] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanNote, setLoanNote] = useState("");
  const [loanDate, setLoanDate] = useState(localDateInput());
  const [loanTime, setLoanTime] = useState(localTimeInput());
  const [loanBusy, setLoanBusy] = useState(false);
  const [loanMessage, setLoanMessage] = useState("");

  const [repayLoan, setRepayLoan] = useState<Loan | null>(null);
  const [repayMode, setRepayMode] = useState<"PARTIAL" | "FULL">("PARTIAL");
  const [repayAmount, setRepayAmount] = useState("");
  const [repayMethod, setRepayMethod] = useState("PAGO");
  const [repayNote, setRepayNote] = useState("");
  const [repayDate, setRepayDate] = useState(localDateInput());
  const [repayTime, setRepayTime] = useState(localTimeInput());
  const [repayBusy, setRepayBusy] = useState(false);
  const [repayMessage, setRepayMessage] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Loan | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/caja/loans", {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "No fue posible cargar los préstamos.");
      }
      setData(body);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar los préstamos.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (createSignal <= 0 || cashDateLocked) return;
    setLoanDate(businessDate);
    setLoanTime(localTimeInput());
    setLoanMessage("");
    setNewOpen(true);
  }, [businessDate, cashDateLocked, createSignal]);

  const filteredLoans = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.loans ?? []).filter((loan) => {
      if (statusFilter !== "ALL" && loan.status !== statusFilter) return false;
      if (!normalized) return true;
      return [loan.workerName, loan.note, loan.createdByName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [data, query, statusFilter]);

  async function saveLoan() {
    if (loanBusy || cashDateLocked) return;
    setLoanBusy(true);
    setLoanMessage("");

    try {
      const issuedAt = new Date(
        `${loanDate}T${loanTime || "12:00"}:00-05:00`,
      ).toISOString();
      const response = await fetch("/api/caja/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId,
          amount: Number(loanAmount.replace(/\D/g, "")),
          note: loanNote,
          issuedAt,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "No fue posible registrar el préstamo.");
      }

      const created = body.loan;
      const principal = Number(created?.principal ?? 0);
      const normalizedLoan: Loan = {
        id: Number(created.id),
        workerId: Number(created.workerId || workerId),
        workerName: String(
          created.workerName ||
            data?.workers.find((worker) => worker.id === Number(workerId))
              ?.name ||
            "",
        ),
        note: created.note ?? (loanNote.trim() || null),
        principal,
        issuedAt: String(created.issuedAt || issuedAt),
        status: "OPEN",
        source: String(created.source || "MANUAL"),
        createdByName: String(created.createdByName || ""),
        historicalPaidWithoutRepayment: false,
        repaidAmount: 0,
        trackedRepaidAmount: 0,
        outstandingAmount: principal,
        repayments: [],
      };

      setData((current) =>
        current
          ? {
              ...current,
              summary: {
                loanCount: current.summary.loanCount + 1,
                openCount: current.summary.openCount + 1,
                principalTotal:
                  current.summary.principalTotal + principal,
                repaidTotal: current.summary.repaidTotal,
                outstandingTotal:
                  current.summary.outstandingTotal + principal,
              },
              loans: [normalizedLoan, ...current.loans],
            }
          : current,
      );

      setNewOpen(false);
      setWorkerId("");
      setLoanAmount("");
      setLoanNote("");
      void Promise.resolve(
        onCashChanged({ loanDisbursedDelta: principal }),
      );
    } catch (saveError) {
      setLoanMessage(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible registrar el préstamo.",
      );
    } finally {
      setLoanBusy(false);
    }
  }

  function openRepayment(
    loan: Loan,
    mode: "PARTIAL" | "FULL" = "PARTIAL",
  ) {
    setRepayLoan(loan);
    setRepayMode(mode);
    setRepayAmount(
      mode === "FULL"
        ? String(Math.round(loan.outstandingAmount))
        : "",
    );
    setRepayMethod("PAGO");
    setRepayNote("");
    setRepayDate(businessDate);
    setRepayTime(localTimeInput());
    setRepayMessage("");
  }

  async function saveRepayment() {
    if (!repayLoan || repayBusy || cashDateLocked) return;
    setRepayBusy(true);
    setRepayMessage("");

    try {
      const paidAt = new Date(
        `${repayDate}T${repayTime || "12:00"}:00-05:00`,
      ).toISOString();
      const response = await fetch(
        `/api/caja/loans/${repayLoan.id}/repayments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(repayAmount.replace(/\D/g, "")),
            method: repayMethod,
            note: repayNote,
            paidAt,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "No fue posible registrar el abono.");
      }

      const repayment = body.repayment as Repayment;
      const paidAmount = Number(repayment.amount ?? 0);
      const remaining = Math.max(0, Number(body.remaining ?? 0));
      const repaidLoanId = repayLoan.id;

      setData((current) => {
        if (!current) return current;

        const previousLoan = current.loans.find(
          (loan) => loan.id === repaidLoanId,
        );
        const closesLoan =
          previousLoan != null &&
          previousLoan.outstandingAmount > 0 &&
          remaining <= 0;

        return {
          ...current,
          summary: {
            ...current.summary,
            openCount: Math.max(
              0,
              current.summary.openCount - (closesLoan ? 1 : 0),
            ),
            repaidTotal:
              current.summary.repaidTotal + paidAmount,
            outstandingTotal: Math.max(
              0,
              current.summary.outstandingTotal - paidAmount,
            ),
          },
          loans: current.loans.map((loan) =>
            loan.id === repaidLoanId
              ? {
                  ...loan,
                  status: remaining <= 0 ? "PAID" : "OPEN",
                  repaidAmount: loan.repaidAmount + paidAmount,
                  trackedRepaidAmount:
                    loan.trackedRepaidAmount + paidAmount,
                  outstandingAmount: remaining,
                  repayments: [repayment, ...loan.repayments],
                }
              : loan,
          ),
        };
      });

      setRepayLoan(null);
      void Promise.resolve(
        onCashChanged({ loanRecoveredDelta: paidAmount }),
      );
    } catch (saveError) {
      setRepayMessage(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible registrar el abono.",
      );
    } finally {
      setRepayBusy(false);
    }
  }

  function openEditLoan(loan: Loan) {
    setEditLoan(loan);
    setEditWorkerId(loan.workerId ?? "");
    setEditNote(loan.note ?? "");
    setEditMessage("");
  }

  async function saveLoanAssignment() {
    if (!editLoan || editBusy) return;

    setEditBusy(true);
    setEditMessage("");

    try {
      const response = await fetch(`/api/caja/loans/${editLoan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: editWorkerId,
          note: editNote,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error || "No fue posible actualizar el préstamo.",
        );
      }

      const updated = body.loan;

      setData((current) =>
        current
          ? {
              ...current,
              loans: current.loans.map((loan) =>
                loan.id === editLoan.id
                  ? {
                      ...loan,
                      workerId: Number(updated.workerId),
                      workerName: String(
                        updated.worker?.name || updated.workerName,
                      ),
                      note: updated.note ?? null,
                    }
                  : loan,
              ),
            }
          : current,
      );

      setEditLoan(null);
    } catch (saveError) {
      setEditMessage(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible actualizar el préstamo.",
      );
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteLoan() {
    if (!deleteTarget || deleteBusy || cashDateLocked) return;
    setDeleteBusy(true);

    try {
      const response = await fetch(
        `/api/caja/loans/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "No fue posible eliminar el préstamo.");
      }
      const deletedLoan = deleteTarget;

      setData((current) =>
        current
          ? {
              ...current,
              summary: {
                loanCount: Math.max(
                  0,
                  current.summary.loanCount - 1,
                ),
                openCount: Math.max(
                  0,
                  current.summary.openCount -
                    (deletedLoan.outstandingAmount > 0 ? 1 : 0),
                ),
                principalTotal: Math.max(
                  0,
                  current.summary.principalTotal -
                    deletedLoan.principal,
                ),
                repaidTotal: Math.max(
                  0,
                  current.summary.repaidTotal -
                    deletedLoan.repaidAmount,
                ),
                outstandingTotal: Math.max(
                  0,
                  current.summary.outstandingTotal -
                    deletedLoan.outstandingAmount,
                ),
              },
              loans: current.loans.filter(
                (loan) => loan.id !== deletedLoan.id,
              ),
            }
          : current,
      );

      setDeleteTarget(null);
      void Promise.resolve(
        onCashChanged({
          loanDisbursedDelta: -deletedLoan.principal,
        }),
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No fue posible eliminar el préstamo.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-[24px] border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
        Cargando préstamos...
      </div>
    );
  }

  return (
    <>
      <section className="rounded-[24px] border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
              Cartera de trabajadores
            </p>
            <h2 className="mt-1 text-2xl font-black">Préstamos y vales</h2>
            <p className="mt-1 max-w-2xl text-[11px] text-neutral-500">
              El préstamo saca dinero disponible de Caja. Cada abono o descuento
              de nómina devuelve ese dinero al flujo neto.
            </p>
          </div>

          {cashDateLocked && (
            <span className="inline-flex h-10 items-center rounded-xl border border-neutral-200 bg-neutral-100 px-3 text-[9px] font-black uppercase tracking-[0.08em] text-neutral-600">
              Caja cerrada · solo consulta
            </span>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        {data && (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[18px] border border-rose-100 bg-rose-50 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <HandCoins className="h-5 w-5" />
              </span>
              <span className="mt-3 block text-[8px] font-black uppercase tracking-[.1em] text-rose-600">
                Prestado pendiente
              </span>
              <b className="mt-1 block text-[24px] font-black text-rose-800">
                {formatCOP(data.summary.outstandingTotal)}
              </b>
            </div>

            <div className="rounded-[18px] border border-neutral-200 bg-[#faf9f7] p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                <CircleDollarSign className="h-5 w-5" />
              </span>
              <span className="mt-3 block text-[8px] font-black uppercase tracking-[.1em] text-neutral-500">
                Total prestado
              </span>
              <b className="mt-1 block text-[24px] font-black text-neutral-950">
                {formatCOP(data.summary.principalTotal)}
              </b>
            </div>

            <div className="rounded-[18px] border border-emerald-100 bg-emerald-50 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Banknote className="h-5 w-5" />
              </span>
              <span className="mt-3 block text-[8px] font-black uppercase tracking-[.1em] text-emerald-600">
                Recuperado
              </span>
              <b className="mt-1 block text-[24px] font-black text-emerald-800">
                {formatCOP(data.summary.repaidTotal)}
              </b>
            </div>

            <div className="rounded-[18px] border border-sky-100 bg-sky-50 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <WalletCards className="h-5 w-5" />
              </span>
              <span className="mt-3 block text-[8px] font-black uppercase tracking-[.1em] text-sky-600">
                Pendientes
              </span>
              <b className="mt-1 block text-[24px] font-black text-sky-800">
                {data.summary.openCount}
              </b>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar trabajador o nota..."
              className="h-11 w-full rounded-xl border border-neutral-200 bg-[#faf9f7] pl-10 pr-3 text-xs outline-none focus:border-neutral-400"
            />
          </label>
          <div className="flex gap-1 rounded-xl bg-[#f5f4f2] p-1">
            {([
              ["OPEN", "Pendientes"],
              ["PAID", "Pagados"],
              ["ALL", "Todos"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`h-9 rounded-lg px-3 text-[10px] font-black transition ${
                  statusFilter === value
                    ? "bg-neutral-950 text-white"
                    : "text-neutral-600 hover:bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {filteredLoans.map((loan) => (
            <article
              key={loan.id}
              className="overflow-hidden rounded-[20px] border border-neutral-200 bg-[#fbfaf8]"
            >
              <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_.8fr_.8fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-base text-neutral-950">
                      {loan.workerName}
                    </b>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${
                        loan.status === "OPEN"
                          ? "border-amber-100 bg-amber-50 text-amber-700"
                          : "border-emerald-100 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {loan.status === "OPEN" ? "PENDIENTE" : "PAGADO"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-neutral-400">
                    {dateTimeLabel(loan.issuedAt)}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-neutral-500">
                    {loan.note || "Sin observación"}
                  </p>
                </div>

                <div>
                  <span className="text-[8px] font-black uppercase text-neutral-400">
                    Prestado
                  </span>
                  <b className="mt-1 block text-sm text-neutral-950">
                    {formatCOP(loan.principal)}
                  </b>
                </div>

                <div>
                  <span className="text-[8px] font-black uppercase text-neutral-400">
                    Saldo
                  </span>
                  <b
                    className={`mt-1 block text-sm ${
                      loan.outstandingAmount > 0
                        ? "text-rose-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {formatCOP(loan.outstandingAmount)}
                  </b>
                  {loan.repaidAmount > 0 && (
                    <span className="mt-1 block text-[9px] text-neutral-400">
                      Recuperado {formatCOP(loan.repaidAmount)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditLoan(loan)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50"
                    title="Editar trabajador"
                    aria-label="Editar trabajador"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {!cashDateLocked && loan.outstandingAmount > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => openRepayment(loan, "PARTIAL")}
                        aria-label="Registrar abono"
                        title="Registrar abono"
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <Banknote className="h-4 w-4" strokeWidth={2.2} />
                      </button>

                      <button
                        type="button"
                        onClick={() => openRepayment(loan, "FULL")}
                        aria-label="Marcar pagado"
                        title="Marcar pagado"
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-[0_8px_18px_rgba(5,150,105,.18)] transition hover:-translate-y-0.5 hover:brightness-105"
                      >
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} />
                      </button>
                    </>
                  )}
                  {!cashDateLocked &&
                    loan.repayments.length === 0 &&
                    !loan.historicalPaidWithoutRepayment && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(loan)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600"
                        title="Eliminar préstamo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                </div>
              </div>

              {loan.repayments.length > 0 && (
                <div className="border-t border-neutral-200 bg-white px-4 py-3">
                  <p className="text-[8px] font-black uppercase tracking-[.1em] text-neutral-400">
                    Abonos
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {loan.repayments.map((repayment) => (
                      <span
                        key={repayment.id}
                        className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[9px] text-emerald-800"
                      >
                        <b>{formatCOP(repayment.amount)}</b> ·{" "}
                        {repayment.method === "DESCUENTO_NOMINA"
                          ? "Descuento nómina"
                          : "Pago"}{" "}
                        · {dateTimeLabel(repayment.paidAt)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {loan.historicalPaidWithoutRepayment && (
                <div className="border-t border-neutral-200 bg-amber-50 px-4 py-2.5 text-[9px] text-amber-700">
                  Registro anterior a la operación actual. No existe una fecha
                  verificable de devolución, por eso no se genera un movimiento
                  sintético en Caja.
                </div>
              )}
            </article>
          ))}

          {filteredLoans.length === 0 && (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">
              No hay préstamos para mostrar.
            </div>
          )}
        </div>
      </section>

      {newOpen && (
        <div className="fixed inset-0 z-[175] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px]">
          <div className="w-full max-w-lg overflow-hidden rounded-[26px] bg-[#f6f3ee] shadow-2xl">
            <header className="bg-[radial-gradient(circle_at_88%_12%,rgba(245,158,11,.22),transparent_32%),linear-gradient(135deg,#080809,#1a1718)] px-6 py-5 text-white">
              <p className="text-[9px] font-black uppercase tracking-[.18em] text-amber-400">
                Caja · Préstamos
              </p>
              <h3 className="mt-1 text-2xl font-black">Nuevo préstamo</h3>
              <p className="mt-1 text-[11px] text-white/50">
                El monto sale del dinero disponible y queda como cartera.
              </p>
            </header>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                  Trabajador
                </label>
                <select
                  value={workerId}
                  onChange={(event) =>
                    setWorkerId(
                      event.target.value ? Number(event.target.value) : "",
                    )
                  }
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold outline-none"
                >
                  <option value="">Selecciona trabajador</option>
                  {(data?.workers ?? []).map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={loanDate}
                    onChange={(event) => setLoanDate(event.target.value)}
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={loanTime}
                    onChange={(event) => setLoanTime(event.target.value)}
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                  Monto
                </label>
                <input
                  inputMode="numeric"
                  value={loanAmount}
                  onChange={(event) =>
                    setLoanAmount(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="0"
                  className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-lg font-black outline-none"
                />
                {loanAmount && (
                  <p className="mt-1 text-xs font-bold text-rose-700">
                    {formatCOP(Number(loanAmount))}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                  Nota
                </label>
                <input
                  value={loanNote}
                  onChange={(event) => setLoanNote(event.target.value)}
                  placeholder="Ej. Vale de quincena"
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                />
              </div>
              {loanMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
                  {loanMessage}
                </div>
              )}
            </div>
            <footer className="grid grid-cols-2 gap-2 border-t bg-white p-4">
              <button
                type="button"
                disabled={loanBusy}
                onClick={() => setNewOpen(false)}
                className="h-11 rounded-xl border border-neutral-200 font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loanBusy}
                onClick={() => void saveLoan()}
                className="h-11 rounded-xl bg-neutral-950 font-black text-white disabled:opacity-50"
              >
                {loanBusy ? "Guardando..." : "Crear préstamo"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {editLoan && (
        <div className="fixed inset-0 z-[176] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px]">
          <div className="w-full max-w-lg overflow-hidden rounded-[26px] bg-[#f6f3ee] shadow-2xl">
            <header className="bg-[radial-gradient(circle_at_88%_12%,rgba(245,158,11,.18),transparent_32%),linear-gradient(135deg,#080809,#1a1718)] px-6 py-5 text-white">
              <p className="text-[9px] font-black uppercase tracking-[.18em] text-amber-400">
                Caja · Préstamos
              </p>
              <h3 className="mt-1 text-2xl font-black">
                Editar préstamo
              </h3>
              <p className="mt-1 text-[11px] text-white/50">
                Vincula este registro histórico a un trabajador del sistema.
              </p>
            </header>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                  Trabajador
                </label>
                <select
                  value={editWorkerId}
                  onChange={(event) =>
                    setEditWorkerId(
                      event.target.value ? Number(event.target.value) : "",
                    )
                  }
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold outline-none"
                >
                  <option value="">Selecciona trabajador</option>
                  {(data?.workers ?? []).map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name}
                    </option>
                  ))}
                </select>
                {!editLoan.workerId && (
                  <p className="mt-1.5 text-[9px] text-amber-700">
                    Registro actual: {editLoan.workerName}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                  Nota
                </label>
                <input
                  value={editNote}
                  onChange={(event) => setEditNote(event.target.value)}
                  placeholder="Nota opcional"
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                />
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3">
                <span className="text-[8px] font-black uppercase text-neutral-400">
                  Valor del préstamo
                </span>
                <b className="mt-1 block text-lg font-black text-neutral-950">
                  {formatCOP(editLoan.principal)}
                </b>
              </div>

              {editMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
                  {editMessage}
                </div>
              )}
            </div>

            <footer className="grid grid-cols-2 gap-2 border-t bg-white p-4">
              <button
                type="button"
                disabled={editBusy}
                onClick={() => setEditLoan(null)}
                className="h-11 rounded-xl border border-neutral-200 font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={editBusy || !editWorkerId}
                onClick={() => void saveLoanAssignment()}
                className="h-11 rounded-xl bg-neutral-950 font-black text-white disabled:opacity-40"
              >
                {editBusy ? "Guardando..." : "Guardar"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {repayLoan && (
        <div className="fixed inset-0 z-[176] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px]">
          <div className="w-full max-w-lg overflow-hidden rounded-[26px] bg-[#f6f3ee] shadow-2xl">
            <header className="bg-[radial-gradient(circle_at_88%_12%,rgba(16,185,129,.22),transparent_32%),linear-gradient(135deg,#080809,#1a1718)] px-6 py-5 text-white">
              <p className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-400">
                {repayMode === "FULL" ? "Pagar préstamo" : "Registrar abono"}
              </p>
              <h3 className="mt-1 text-2xl font-black">
                {repayLoan.workerName}
              </h3>
              <p className="mt-1 text-[11px] text-white/50">
                Saldo actual {formatCOP(repayLoan.outstandingAmount)}.
                {repayMode === "FULL"
                  ? " Este movimiento cerrará el préstamo."
                  : ""}
              </p>
            </header>
            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={repayDate}
                    onChange={(event) => setRepayDate(event.target.value)}
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={repayTime}
                    onChange={(event) => setRepayTime(event.target.value)}
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                  Cómo regresó el dinero
                </label>
                <select
                  value={repayMethod}
                  onChange={(event) => setRepayMethod(event.target.value)}
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold outline-none"
                >
                  <option value="PAGO">Pago del trabajador</option>
                  <option value="DESCUENTO_NOMINA">Descuento de nómina</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                  Abono
                </label>
                <input
                  inputMode="numeric"
                  value={repayAmount}
                  onChange={(event) =>
                    setRepayAmount(event.target.value.replace(/\D/g, ""))
                  }
                  className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-lg font-black outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                  Nota
                </label>
                <input
                  value={repayNote}
                  onChange={(event) => setRepayNote(event.target.value)}
                  placeholder="Opcional"
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                />
              </div>
              {repayMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
                  {repayMessage}
                </div>
              )}
            </div>
            <footer className="grid grid-cols-2 gap-2 border-t bg-white p-4">
              <button
                type="button"
                disabled={repayBusy}
                onClick={() => setRepayLoan(null)}
                className="h-11 rounded-xl border border-neutral-200 font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={repayBusy}
                onClick={() => void saveRepayment()}
                className="h-11 rounded-xl bg-emerald-600 font-black text-white disabled:opacity-50"
              >
                {repayBusy
                  ? "Guardando..."
                  : repayMode === "FULL"
                    ? "Marcar pagado"
                    : "Registrar abono"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[177] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px]">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="bg-[#111113] px-5 py-4 text-white">
              <p className="text-[9px] font-black uppercase tracking-[.16em] text-red-400">
                Confirmar
              </p>
              <h3 className="mt-1 text-xl font-black">Eliminar préstamo</h3>
            </div>
            <div className="p-5 text-sm text-neutral-600">
              ¿Eliminar el préstamo de <b>{deleteTarget.workerName}</b> por{" "}
              <b>{formatCOP(deleteTarget.principal)}</b>?
            </div>
            <div className="grid grid-cols-2 gap-2 border-t p-4">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
                className="h-11 rounded-xl border border-neutral-200 font-bold"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void deleteLoan()}
                className="h-11 rounded-xl bg-red-600 font-black text-white"
              >
                {deleteBusy ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
