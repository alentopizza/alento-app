"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CircleDollarSign,
  HandCoins,
  CheckCircle2,
  Search,
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
  payrollMonth: string;
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
    minimumFractionDigits: 0,
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

function payrollMonthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
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
  const [loanAmount, setLoanAmount] = useState("");
  const [loanNote, setLoanNote] = useState("");
  const [loanDate, setLoanDate] = useState(localDateInput());
  const [loanTime, setLoanTime] = useState(localTimeInput());
  const [loanPayrollMonth, setLoanPayrollMonth] = useState(
    localDateInput().slice(0, 7),
  );
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
    setLoanPayrollMonth(businessDate.slice(0, 7));
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
          payrollMonth: loanPayrollMonth,
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
        payrollMonth: String(
          created.payrollMonth || loanPayrollMonth || loanDate.slice(0, 7),
        ),
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
      setLoanPayrollMonth(localDateInput().slice(0, 7));
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
            <p className="alento-ui-label uppercase text-neutral-400">
              Cartera de trabajadores
            </p>
            <h2 className="alento-ui-title mt-1">Préstamos y vales</h2>
            <p className="alento-ui-body mt-1 max-w-2xl text-neutral-500">
              El préstamo saca dinero disponible de Caja. Los abonos recibidos
              entran nuevamente a Caja; los descuentos de nómina se gestionan
              desde el pago de turnos y reducen el saldo por cobrar sin duplicar
              movimientos de efectivo.
            </p>
          </div>

          {cashDateLocked && (
            <span className="alento-ui-label inline-flex h-10 items-center rounded-xl border border-neutral-200 bg-neutral-100 px-3 uppercase text-neutral-600">
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
            <div className="rounded-[18px] border border-amber-100 bg-amber-50 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <HandCoins className="h-5 w-5" />
              </span>
              <span className="alento-ui-label mt-3 block uppercase text-amber-600">
                Prestado pendiente
              </span>
              <b className="alento-ui-title mt-1 block text-amber-800">
                {formatCOP(data.summary.outstandingTotal)}
              </b>
            </div>

            <div className="rounded-[18px] border border-neutral-200 bg-[#faf9f7] p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                <CircleDollarSign className="h-5 w-5" />
              </span>
              <span className="alento-ui-label mt-3 block uppercase text-neutral-500">
                Total prestado
              </span>
              <b className="alento-ui-title mt-1 block text-neutral-950">
                {formatCOP(data.summary.principalTotal)}
              </b>
            </div>

            <div className="rounded-[18px] border border-emerald-100 bg-emerald-50 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Banknote className="h-5 w-5" />
              </span>
              <span className="alento-ui-label mt-3 block uppercase text-emerald-600">
                Recuperado
              </span>
              <b className="alento-ui-title mt-1 block text-emerald-800">
                {formatCOP(data.summary.repaidTotal)}
              </b>
            </div>

            <div className="rounded-[18px] border border-amber-100 bg-amber-50 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <WalletCards className="h-5 w-5" />
              </span>
              <span className="alento-ui-label mt-3 block uppercase text-amber-600">
                Pendientes
              </span>
              <b className="alento-ui-title mt-1 block text-amber-800">
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
                className={`h-9 rounded-lg px-3 alento-ui-micro font-black transition ${
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

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {filteredLoans.map((loan) => {
            const pending = loan.status === "OPEN" && loan.outstandingAmount > 0;

            return (
              <article
                key={loan.id}
                className={
                  "relative overflow-hidden rounded-[18px] border p-3.5 transition " +
                  (pending
                    ? "border-amber-200 bg-amber-50/45"
                    : "border-emerald-200 bg-emerald-50/45")
                }
              >
                <span
                  className={
                    "absolute inset-x-0 top-0 h-[3px] " +
                    (pending ? "bg-amber-500" : "bg-emerald-500")
                  }
                />

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <b className="alento-ui-control block truncate text-neutral-950">
                      {loan.workerName}
                    </b>
                    <p className="alento-ui-micro mt-1 text-neutral-400">
                      {dateTimeLabel(loan.issuedAt)}
                    </p>
                  </div>

                  <span
                    className={
                      "shrink-0 rounded-full border px-2 py-0.5 alento-ui-micro font-black uppercase tracking-[.05em] " +
                      (pending
                        ? "border-amber-200 bg-amber-100 text-amber-800"
                        : "border-emerald-200 bg-emerald-100 text-emerald-800")
                    }
                  >
                    {pending ? "Pendiente" : "Pagado"}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 alento-ui-micro font-black text-violet-700">
                    Nómina {payrollMonthLabel(loan.payrollMonth)}
                  </span>
                  <p className="alento-ui-micro truncate text-neutral-500">
                    {loan.note || "Sin observación"}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/80 bg-white/75 px-2.5 py-2">
                    <span className="alento-ui-label uppercase text-neutral-400">
                      Prestado
                    </span>
                    <b className="alento-ui-status mt-0.5 block text-neutral-950">
                      {formatCOP(loan.principal)}
                    </b>
                  </div>

                  <div className="rounded-xl border border-white/80 bg-white/75 px-2.5 py-2">
                    <span
                      className={
                        "alento-ui-micro font-black uppercase tracking-[.08em] " +
                        (pending ? "text-amber-600" : "text-emerald-600")
                      }
                    >
                      {pending ? "Saldo" : "Recuperado"}
                    </span>
                    <b
                      className={
                        "mt-0.5 block alento-ui-control " +
                        (pending ? "text-amber-800" : "text-emerald-800")
                      }
                    >
                      {pending
                        ? formatCOP(loan.outstandingAmount)
                        : formatCOP(loan.repaidAmount)}
                    </b>
                  </div>
                </div>

                {loan.repaidAmount > 0 && pending && (
                  <p className="alento-ui-micro mt-2 text-emerald-700">
                    Abonado {formatCOP(loan.repaidAmount)}
                  </p>
                )}

                {!cashDateLocked && pending && (
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-amber-200/70 pt-3">
                    <button
                      type="button"
                      onClick={() => openRepayment(loan, "PARTIAL")}
                      aria-label="Registrar abono"
                      title="Registrar abono"
                      className="alento-ui-control flex h-9 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-white text-amber-800 transition hover:bg-amber-100"
                    >
                      <Banknote className="h-3.5 w-3.5" strokeWidth={2.2} />
                      Abonar
                    </button>

                    <button
                      type="button"
                      onClick={() => openRepayment(loan, "FULL")}
                      aria-label="Marcar pagado"
                      title="Marcar pagado"
                      className="alento-ui-control flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white shadow-[0_6px_14px_rgba(5,150,105,.16)] transition hover:brightness-105"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                      Pagar
                    </button>
                  </div>
                )}

                {!pending && (
                  <div className="alento-ui-label mt-3 flex items-center gap-1.5 border-t border-emerald-200/70 pt-3 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Préstamo pagado
                  </div>
                )}
              </article>
            );
          })}

          {filteredLoans.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">
              No hay préstamos para mostrar.
            </div>
          )}
        </div>
      </section>

      {newOpen && (
        <div className="fixed inset-0 z-[175] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px]">
          <div className="w-full max-w-lg overflow-hidden rounded-[26px] bg-[#f6f3ee] shadow-2xl">
            <header className="bg-[radial-gradient(circle_at_88%_12%,rgba(245,158,11,.22),transparent_32%),linear-gradient(135deg,#080809,#1a1718)] px-6 py-5 text-white">
              <p className="alento-ui-label uppercase text-amber-400">
                Caja · Préstamos
              </p>
              <h3 className="alento-ui-title mt-1">Nuevo préstamo</h3>
              <p className="alento-ui-body mt-1 text-white/50">
                El monto sale del dinero disponible y queda como cartera.
              </p>
            </header>
            <div className="space-y-4 p-5">
              <div>
                <label className="alento-ui-label mb-1.5 block uppercase text-neutral-500">
                  Trabajador
                </label>
                <select
                  value={workerId}
                  onChange={(event) =>
                    setWorkerId(
                      event.target.value ? Number(event.target.value) : "",
                    )
                  }
                  className="alento-ui-control h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 outline-none"
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
                  <label className="alento-ui-label mb-1.5 block uppercase text-neutral-500">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={loanDate}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLoanDate(value);
                      if (value) setLoanPayrollMonth(value.slice(0, 7));
                    }}
                    className="alento-ui-control h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 outline-none"
                  />
                </div>
                <div>
                  <label className="alento-ui-label mb-1.5 block uppercase text-neutral-500">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={loanTime}
                    onChange={(event) => setLoanTime(event.target.value)}
                    className="alento-ui-control h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="alento-ui-label mb-1.5 block uppercase text-neutral-500">
                  Descontar en nómina de
                </label>
                <input
                  type="month"
                  value={loanPayrollMonth}
                  onChange={(event) => setLoanPayrollMonth(event.target.value)}
                  className="alento-ui-control h-11 w-full rounded-xl border border-violet-100 bg-violet-50/45 px-3 font-black text-violet-800 outline-none"
                />
                <p className="alento-ui-micro mt-1 text-neutral-400">
                  Define a qué mes de nómina pertenece este préstamo.
                </p>
              </div>
              <div>
                <label className="alento-ui-label mb-1.5 block uppercase text-neutral-500">
                  Monto
                </label>
                <input
                  inputMode="numeric"
                  value={loanAmount}
                  onChange={(event) =>
                    setLoanAmount(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="0"
                  className="alento-ui-status h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 outline-none"
                />
                {loanAmount && (
                  <p className="alento-ui-control mt-1 text-rose-700">
                    {formatCOP(Number(loanAmount))}
                  </p>
                )}
              </div>
              <div>
                <label className="alento-ui-label mb-1.5 block uppercase text-neutral-500">
                  Nota
                </label>
                <input
                  value={loanNote}
                  onChange={(event) => setLoanNote(event.target.value)}
                  placeholder="Ej. Vale de quincena"
                  className="alento-ui-control h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 outline-none"
                />
              </div>
              {loanMessage && (
                <div className="alento-ui-control rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  {loanMessage}
                </div>
              )}
            </div>
            <footer className="grid grid-cols-2 gap-2 border-t bg-white p-4">
              <button
                type="button"
                disabled={loanBusy}
                onClick={() => setNewOpen(false)}
                className="alento-ui-control h-11 rounded-xl border border-neutral-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loanBusy}
                onClick={() => void saveLoan()}
                className="alento-ui-control h-11 rounded-xl bg-neutral-950 text-white disabled:opacity-50"
              >
                {loanBusy ? "Guardando..." : "Crear préstamo"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {repayLoan && (
        <div className="fixed inset-0 z-[176] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px]">
          <div className="w-full max-w-lg overflow-hidden rounded-[26px] bg-[#f6f3ee] shadow-2xl">
            <header className="bg-[radial-gradient(circle_at_88%_12%,rgba(16,185,129,.22),transparent_32%),linear-gradient(135deg,#080809,#1a1718)] px-6 py-5 text-white">
              <p className="alento-ui-label uppercase text-emerald-400">
                {repayMode === "FULL" ? "Pagar préstamo" : "Registrar abono"}
              </p>
              <h3 className="alento-ui-title mt-1">
                {repayLoan.workerName}
              </h3>
              <p className="alento-ui-body mt-1 text-white/50">
                Saldo actual {formatCOP(repayLoan.outstandingAmount)}.
                {repayMode === "FULL"
                  ? " Este movimiento cerrará el préstamo."
                  : ""}
              </p>
            </header>
            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="alento-ui-label mb-1.5 block uppercase text-neutral-500">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={repayDate}
                    onChange={(event) => setRepayDate(event.target.value)}
                    className="alento-ui-control h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 outline-none"
                  />
                </div>
                <div>
                  <label className="alento-ui-label mb-1.5 block uppercase text-neutral-500">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={repayTime}
                    onChange={(event) => setRepayTime(event.target.value)}
                    className="alento-ui-control h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="alento-ui-label mb-1.5 block uppercase text-neutral-500">
                  Cómo regresó el dinero
                </label>
                <select
                  value={repayMethod}
                  onChange={(event) => setRepayMethod(event.target.value)}
                  className="alento-ui-control h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 outline-none"
                >
                  <option value="PAGO">Pago del trabajador</option>
                </select>
              </div>
              <div>
                <label className="alento-ui-label mb-1.5 block uppercase text-neutral-500">
                  Abono
                </label>
                <input
                  inputMode="numeric"
                  value={repayAmount}
                  onChange={(event) =>
                    setRepayAmount(event.target.value.replace(/\D/g, ""))
                  }
                  className="alento-ui-status h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 outline-none"
                />
              </div>
              <div>
                <label className="alento-ui-label mb-1.5 block uppercase text-neutral-500">
                  Nota
                </label>
                <input
                  value={repayNote}
                  onChange={(event) => setRepayNote(event.target.value)}
                  placeholder="Opcional"
                  className="alento-ui-control h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 outline-none"
                />
              </div>
              {repayMessage && (
                <div className="alento-ui-control rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  {repayMessage}
                </div>
              )}
            </div>
            <footer className="grid grid-cols-2 gap-2 border-t bg-white p-4">
              <button
                type="button"
                disabled={repayBusy}
                onClick={() => setRepayLoan(null)}
                className="alento-ui-control h-11 rounded-xl border border-neutral-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={repayBusy}
                onClick={() => void saveRepayment()}
                className="alento-ui-control h-11 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
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

    </>
  );
}
