"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CircleDollarSign,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  Trash2,
  Upload,
  WalletCards,
} from "lucide-react";
import { orderCode } from "@/lib/orderCode";
import {
  CASH_EXPENSE_CATEGORIES,
  cashExpenseSubcategories,
} from "@/lib/cashExpenseCatalog";
import { CASH_INCOME_CATEGORIES } from "@/lib/cashIncomeCatalog";

type MethodSummary = {
  method: string;
  amount: number;
  count: number;
};

type ExpenseCategorySummary = {
  category: string;
  amount: number;
  count: number;
};

type IncomeCategorySummary = {
  category: string;
  amount: number;
  count: number;
};

type PaymentRow = {
  id: number;
  orderId: number;
  method: string;
  amount: number;
  reference: string | null;
  paidAt: string | null;
  order: {
    id: number;
    sequenceNumber: number | null;
    source: string;
    fulfillmentType: string;
    total: number;
    customerName: string;
  };
};

type IncomeRow = {
  id: number;
  category: string;
  note: string | null;
  amount: number;
  occurredAt: string;
  source: string;
  createdByName: string;
};

type ExpenseRow = {
  id: number;
  category: string;
  subcategory: string | null;
  note: string | null;
  amount: number;
  occurredAt: string;
  source: string;
  createdByName: string;
};

type Summary = {
  startDate: string;
  endDate: string;
  salesTotal: number;
  orderCount: number;
  receivedTotal: number;
  paymentCount: number;
  otherIncomeTotal: number;
  otherIncomeCount: number;
  totalInflow: number;
  expensesTotal: number;
  expenseCount: number;
  netTotal: number;
  methods: MethodSummary[];
  incomeCategories: IncomeCategorySummary[];
  expenseCategories: ExpenseCategorySummary[];
  payments: PaymentRow[];
  otherIncomes: IncomeRow[];
  expenses: ExpenseRow[];
};

type IncomeImportPreview = {
  summary: {
    totalRows: number;
    toImport: number;
    issues: number;
    totalAmount: number;
    categoryCount: number;
    canImport: boolean;
  };
  preview: Array<{
    rowNumber: number;
    occurredAt: string;
    category: string;
    note: string;
    amount: number;
  }>;
  issues: Array<{ rowNumber: number; reason: string }>;
  blockers: string[];
};

type ImportPreview = {
  summary: {
    totalRows: number;
    toImport: number;
    issues: number;
    totalAmount: number;
    categoryCount: number;
    canImport: boolean;
  };
  preview: Array<{
    rowNumber: number;
    occurredAt: string;
    category: string;
    subcategory: string;
    note: string;
    amount: number;
  }>;
  issues: Array<{ rowNumber: number; reason: string }>;
  blockers: string[];
};

type Tab = "SUMMARY" | "INCOMES" | "EXPENSES";

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function localDateInput(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
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

function firstDayOfMonth() {
  const today = localDateInput();
  return `${today.slice(0, 8)}01`;
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

function expenseTone(category: string) {
  const tones: Record<string, string> = {
    Insumos: "border-emerald-100 bg-emerald-50 text-emerald-700",
    Maquinaria: "border-sky-100 bg-sky-50 text-sky-700",
    Publicidad: "border-violet-100 bg-violet-50 text-violet-700",
    "Servicios Públicos": "border-amber-100 bg-amber-50 text-amber-700",
    Nomina: "border-rose-100 bg-rose-50 text-rose-700",
    Domicilios: "border-cyan-100 bg-cyan-50 text-cyan-700",
    Arriendo: "border-orange-100 bg-orange-50 text-orange-700",
    Plataformas: "border-indigo-100 bg-indigo-50 text-indigo-700",
    Parqueadero: "border-lime-100 bg-lime-50 text-lime-700",
    "Consumo Interno": "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-700",
  };
  return tones[category] ?? "border-neutral-200 bg-neutral-100 text-neutral-700";
}

export default function CashPage() {
  const today = localDateInput();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [tab, setTab] = useState<Tab>("SUMMARY");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [incomeCategoryFilter, setIncomeCategoryFilter] = useState("ALL");
  const [incomeQuery, setIncomeQuery] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("ALL");
  const [expenseQuery, setExpenseQuery] = useState("");

  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeCategory, setIncomeCategory] = useState("Otros");
  const [incomeNote, setIncomeNote] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDate, setIncomeDate] = useState(today);
  const [incomeTime, setIncomeTime] = useState(localTimeInput());
  const [incomeSaving, setIncomeSaving] = useState(false);
  const [incomeMessage, setIncomeMessage] = useState("");

  const [incomeDeleteTarget, setIncomeDeleteTarget] = useState<IncomeRow | null>(null);
  const [incomeDeleteBusy, setIncomeDeleteBusy] = useState(false);

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState("Insumos");
  const [expenseSubcategory, setExpenseSubcategory] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [expenseTime, setExpenseTime] = useState(localTimeInput());
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseMessage, setExpenseMessage] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importCompleted, setImportCompleted] = useState(false);
  const [incomeImportOpen, setIncomeImportOpen] = useState(false);
  const [incomeImportCompleted, setIncomeImportCompleted] = useState(false);
  const [incomeImportFile, setIncomeImportFile] = useState<File | null>(null);
  const [incomeImportPreview, setIncomeImportPreview] = useState<IncomeImportPreview | null>(null);
  const [incomeImportBusy, setIncomeImportBusy] = useState(false);
  const [incomeImportMessage, setIncomeImportMessage] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(`/api/caja/summary?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible cargar Caja.");
      }
      setSummary(data);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar Caja.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [startDate, endDate]);

  useEffect(() => {
    async function loadStaff() {
      try {
        const response = await fetch("/api/auth/staff/me", {
          cache: "no-store",
        });
        const data = await response.json();
        setIsAdmin(Boolean(response.ok && data.user?.isAdmin));
      } catch {
        setIsAdmin(false);
      }
    }

    void loadStaff();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    async function loadImportStatus() {
      try {
        const [expensesResponse, incomesResponse] = await Promise.all([
          fetch("/api/caja/expenses/import", { cache: "no-store" }),
          fetch("/api/caja/incomes/import", { cache: "no-store" }),
        ]);
        const [expensesData, incomesData] = await Promise.all([
          expensesResponse.json(),
          incomesResponse.json(),
        ]);
        if (expensesResponse.ok) {
          setImportCompleted(Boolean(expensesData.completed));
        }
        if (incomesResponse.ok) {
          setIncomeImportCompleted(Boolean(incomesData.completed));
        }
      } catch {}
    }

    void loadImportStatus();
  }, [isAdmin]);

  const maxMethod = useMemo(
    () =>
      Math.max(
        1,
        ...(summary?.methods.map((item) => item.amount) ?? [1]),
      ),
    [summary],
  );

  const maxIncomeCategory = useMemo(
    () =>
      Math.max(
        1,
        ...(summary?.incomeCategories.map((item) => item.amount) ?? [1]),
      ),
    [summary],
  );

  const filteredIncomes = useMemo(() => {
    const query = incomeQuery.trim().toLowerCase();
    return (summary?.otherIncomes ?? []).filter((income) => {
      if (
        incomeCategoryFilter !== "ALL" &&
        income.category !== incomeCategoryFilter
      ) {
        return false;
      }
      if (!query) return true;

      return [income.category, income.note, income.createdByName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [summary, incomeCategoryFilter, incomeQuery]);

  const maxExpenseCategory = useMemo(
    () =>
      Math.max(
        1,
        ...(summary?.expenseCategories.map((item) => item.amount) ?? [1]),
      ),
    [summary],
  );

  const filteredExpenses = useMemo(() => {
    const query = expenseQuery.trim().toLowerCase();
    return (summary?.expenses ?? []).filter((expense) => {
      if (
        expenseCategoryFilter !== "ALL" &&
        expense.category !== expenseCategoryFilter
      ) {
        return false;
      }
      if (!query) return true;

      return [
        expense.category,
        expense.subcategory,
        expense.note,
        expense.createdByName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [summary, expenseCategoryFilter, expenseQuery]);

  function setTodayRange() {
    const value = localDateInput();
    setStartDate(value);
    setEndDate(value);
  }

  function setMonthRange() {
    setStartDate(firstDayOfMonth());
    setEndDate(localDateInput());
  }

  function openIncome() {
    setIncomeCategory("Otros");
    setIncomeNote("");
    setIncomeAmount("");
    setIncomeDate(localDateInput());
    setIncomeTime(localTimeInput());
    setIncomeMessage("");
    setIncomeOpen(true);
  }

  async function saveIncome() {
    if (incomeSaving) return;

    setIncomeSaving(true);
    setIncomeMessage("");
    try {
      const occurredAt = new Date(
        `${incomeDate}T${incomeTime || "12:00"}:00-05:00`,
      ).toISOString();

      const response = await fetch("/api/caja/incomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: incomeCategory,
          note: incomeNote,
          amount: Number(incomeAmount.replace(/\D/g, "")),
          occurredAt,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible registrar el ingreso.");
      }

      setIncomeOpen(false);
      setTab("INCOMES");
      await load();
    } catch (saveError) {
      setIncomeMessage(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible registrar el ingreso.",
      );
    } finally {
      setIncomeSaving(false);
    }
  }

  async function deleteIncome() {
    if (!incomeDeleteTarget || incomeDeleteBusy) return;

    setIncomeDeleteBusy(true);
    try {
      const response = await fetch(
        `/api/caja/incomes/${incomeDeleteTarget.id}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible eliminar el ingreso.");
      }
      setIncomeDeleteTarget(null);
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No fue posible eliminar el ingreso.",
      );
    } finally {
      setIncomeDeleteBusy(false);
    }
  }

  async function analyzeIncomeImport(file: File) {
    setIncomeImportBusy(true);
    setIncomeImportMessage("");
    setIncomeImportPreview(null);

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("action", "preview");
      const response = await fetch("/api/caja/incomes/import", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible analizar los ingresos.",
        );
      }
      setIncomeImportPreview(data);
    } catch (importError) {
      setIncomeImportMessage(
        importError instanceof Error
          ? importError.message
          : "No fue posible analizar los ingresos.",
      );
    } finally {
      setIncomeImportBusy(false);
    }
  }

  async function confirmIncomeImport() {
    if (
      !incomeImportFile ||
      !incomeImportPreview?.summary.canImport ||
      incomeImportBusy
    ) {
      return;
    }

    setIncomeImportBusy(true);
    setIncomeImportMessage("");
    try {
      const body = new FormData();
      body.set("file", incomeImportFile);
      body.set("action", "import");
      const response = await fetch("/api/caja/incomes/import", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible importar los ingresos.",
        );
      }

      setIncomeImportCompleted(true);
      setIncomeImportOpen(false);
      setIncomeImportFile(null);
      setIncomeImportPreview(null);
      setTab("INCOMES");
      await load();
    } catch (importError) {
      setIncomeImportMessage(
        importError instanceof Error
          ? importError.message
          : "No fue posible importar los ingresos.",
      );
    } finally {
      setIncomeImportBusy(false);
    }
  }

  function openExpense() {
    setExpenseCategory("Insumos");
    setExpenseSubcategory("");
    setExpenseNote("");
    setExpenseAmount("");
    setExpenseDate(localDateInput());
    setExpenseTime(localTimeInput());
    setExpenseMessage("");
    setExpenseOpen(true);
  }

  async function saveExpense() {
    if (expenseSaving) return;

    setExpenseSaving(true);
    setExpenseMessage("");
    try {
      const occurredAt = new Date(
        `${expenseDate}T${expenseTime || "12:00"}:00-05:00`,
      ).toISOString();

      const response = await fetch("/api/caja/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: expenseCategory,
          subcategory: expenseSubcategory,
          note: expenseNote,
          amount: Number(expenseAmount.replace(/\D/g, "")),
          occurredAt,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible registrar la salida.");
      }

      setExpenseOpen(false);
      setTab("EXPENSES");
      await load();
    } catch (saveError) {
      setExpenseMessage(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible registrar la salida.",
      );
    } finally {
      setExpenseSaving(false);
    }
  }

  async function deleteExpense() {
    if (!deleteTarget || deleteBusy) return;

    setDeleteBusy(true);
    try {
      const response = await fetch(
        `/api/caja/expenses/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible eliminar la salida.");
      }
      setDeleteTarget(null);
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No fue posible eliminar la salida.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  async function analyzeImport(file: File) {
    setImportBusy(true);
    setImportMessage("");
    setImportPreview(null);

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("action", "preview");
      const response = await fetch("/api/caja/expenses/import", {
        method: "POST",
        body,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible analizar las salidas.",
        );
      }

      setImportPreview(data);
    } catch (importError) {
      setImportMessage(
        importError instanceof Error
          ? importError.message
          : "No fue posible analizar las salidas.",
      );
    } finally {
      setImportBusy(false);
    }
  }

  async function confirmImport() {
    if (
      !importFile ||
      !importPreview?.summary.canImport ||
      importBusy
    ) {
      return;
    }

    setImportBusy(true);
    setImportMessage("");
    try {
      const body = new FormData();
      body.set("file", importFile);
      body.set("action", "import");
      const response = await fetch("/api/caja/expenses/import", {
        method: "POST",
        body,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible importar las salidas.",
        );
      }

      setImportCompleted(true);
      setImportOpen(false);
      setImportFile(null);
      setImportPreview(null);
      setTab("EXPENSES");
      await load();
    } catch (importError) {
      setImportMessage(
        importError instanceof Error
          ? importError.message
          : "No fue posible importar las salidas.",
      );
    } finally {
      setImportBusy(false);
    }
  }

  const selectedSubcategories = cashExpenseSubcategories(expenseCategory);

  return (
    <main className="min-h-screen w-full bg-[#f4f4f2] p-3 md:p-5 xl:p-6">
      <div className="w-full space-y-5">
        <section className="relative min-h-[164px] w-full overflow-hidden rounded-[26px] border border-black/5 bg-[#0a0a0b] text-white shadow-[0_18px_45px_rgba(20,16,14,.12)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_38%,rgba(226,26,34,.48),transparent_24%),radial-gradient(circle_at_68%_110%,rgba(132,12,16,.34),transparent_34%),linear-gradient(105deg,#111319_0%,#101116_43%,#1a0b0d_67%,#5a090c_100%)]" />
          <CircleDollarSign
            className="absolute right-[30%] top-[-38px] h-52 w-52 rotate-[-10deg] text-white/[0.03]"
            strokeWidth={1.1}
          />

          <div className="relative flex min-h-[164px] flex-col justify-between gap-5 px-6 py-5 lg:flex-row lg:items-center lg:px-8 xl:px-10">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-[3px] w-8 rounded-full bg-[var(--brand-red)]" />
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/58">
                  Finanzas operativas
                </p>
              </div>
              <h1 className="mt-2 text-[40px] font-black leading-none tracking-[-0.045em] md:text-[46px]">
                Caja
              </h1>
              <p className="mt-2 text-[13px] font-medium text-white/65 md:text-[14px]">
                Ventas, dinero recibido y salidas reales en el período.
              </p>
            </div>

            <div className="flex flex-wrap items-end justify-end gap-2 self-end lg:self-auto">
              <div>
                <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.14em] text-white/42">
                  Desde
                </span>
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-11 rounded-xl border border-white/12 bg-white/[0.08] px-3 text-[11px] font-bold text-white outline-none [color-scheme:dark]"
                />
              </div>
              <div>
                <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.14em] text-white/42">
                  Hasta
                </span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-11 rounded-xl border border-white/12 bg-white/[0.08] px-3 text-[11px] font-bold text-white outline-none [color-scheme:dark]"
                />
              </div>
              <button
                type="button"
                onClick={setTodayRange}
                className="h-11 rounded-xl border border-white/12 bg-white/[0.08] px-3 text-[10px] font-black text-white/85 transition hover:bg-white/[0.13]"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={setMonthRange}
                className="h-11 rounded-xl border border-white/12 bg-white/[0.08] px-3 text-[10px] font-black text-white/85 transition hover:bg-white/[0.13]"
              >
                Este mes
              </button>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-[20px] border border-neutral-200 bg-white p-2.5 shadow-[0_8px_24px_rgba(28,23,20,.045)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-[14px] bg-[#f5f4f2] p-1">
            <button
              type="button"
              onClick={() => setTab("SUMMARY")}
              className={`h-10 rounded-[11px] px-4 text-[11px] font-black transition ${
                tab === "SUMMARY"
                  ? "bg-neutral-950 text-white shadow-sm"
                  : "text-neutral-600 hover:bg-white"
              }`}
            >
              Resumen
            </button>
            <button
              type="button"
              onClick={() => setTab("EXPENSES")}
              className={`h-10 rounded-[11px] px-4 text-[11px] font-black transition ${
                tab === "EXPENSES"
                  ? "bg-neutral-950 text-white shadow-sm"
                  : "text-neutral-600 hover:bg-white"
              }`}
            >
              Salidas
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {isAdmin && !importCompleted && (
              <button
                type="button"
                onClick={() => {
                  setImportFile(null);
                  setImportPreview(null);
                  setImportMessage("");
                  setImportOpen(true);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-[10px] font-black text-neutral-700 transition hover:bg-neutral-50"
              >
                <Upload className="h-4 w-4" />
                Importar histórico
              </button>
            )}
            <button
              type="button"
              onClick={openExpense}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--brand-red)] px-4 text-[10px] font-black text-white shadow-[0_7px_18px_rgba(226,26,34,.20)]"
            >
              <Plus className="h-4 w-4" />
              Nueva salida
            </button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[24px] border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500">
            Cargando caja...
          </div>
        ) : error ? (
          <div className="rounded-[24px] border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : summary ? (
          <>
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[22px] border border-sky-100 bg-[linear-gradient(145deg,#ffffff,#f0f7ff)] p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <ReceiptText className="h-5 w-5" />
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-600">
                    Ventas
                  </span>
                </div>
                <b className="mt-4 block text-[28px] font-black tracking-[-0.04em] text-neutral-950">
                  {formatCOP(summary.salesTotal)}
                </b>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {summary.orderCount} pedido{summary.orderCount === 1 ? "" : "s"} vendido{summary.orderCount === 1 ? "" : "s"}
                </p>
              </article>

              <article className="rounded-[22px] border border-emerald-100 bg-[linear-gradient(145deg,#ffffff,#effcf6)] p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <ArrowDownCircle className="h-5 w-5" />
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-600">
                    Ingresó
                  </span>
                </div>
                <b className="mt-4 block text-[28px] font-black tracking-[-0.04em] text-emerald-700">
                  {formatCOP(summary.receivedTotal)}
                </b>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {summary.paymentCount} movimiento{summary.paymentCount === 1 ? "" : "s"} PAID
                </p>
              </article>

              <article className="rounded-[22px] border border-rose-100 bg-[linear-gradient(145deg,#ffffff,#fff3f4)] p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                    <ArrowUpCircle className="h-5 w-5" />
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-rose-600">
                    Salió
                  </span>
                </div>
                <b className="mt-4 block text-[28px] font-black tracking-[-0.04em] text-rose-700">
                  {formatCOP(summary.expensesTotal)}
                </b>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {summary.expenseCount} salida{summary.expenseCount === 1 ? "" : "s"} registrada{summary.expenseCount === 1 ? "" : "s"}
                </p>
              </article>

              <article className={`rounded-[22px] border p-5 shadow-sm ${
                summary.netTotal >= 0
                  ? "border-neutral-200 bg-[linear-gradient(145deg,#ffffff,#f7f7f6)]"
                  : "border-red-200 bg-red-50"
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    summary.netTotal >= 0
                      ? "bg-neutral-950 text-white"
                      : "bg-red-100 text-red-700"
                  }`}>
                    <WalletCards className="h-5 w-5" />
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-500">
                    Flujo neto
                  </span>
                </div>
                <b className={`mt-4 block text-[28px] font-black tracking-[-0.04em] ${
                  summary.netTotal >= 0 ? "text-neutral-950" : "text-red-700"
                }`}>
                  {formatCOP(summary.netTotal)}
                </b>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Ingresos recibidos − salidas
                </p>
              </article>
            </section>

            {tab === "SUMMARY" ? (
              <div className="space-y-4">
                <section className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
                          Ingresos
                        </p>
                        <h2 className="mt-1 text-xl font-black">
                          Por medio de pago
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => void load()}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500"
                        title="Actualizar"
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-5 space-y-4">
                      {summary.methods.length === 0 ? (
                        <p className="text-sm text-neutral-400">
                          No hay ingresos registrados en este período.
                        </p>
                      ) : (
                        summary.methods.map((item) => (
                          <div key={item.method}>
                            <div className="flex items-end justify-between gap-4">
                              <div>
                                <b className="text-sm">{item.method}</b>
                                <p className="text-[10px] text-neutral-400">
                                  {item.count} pago{item.count === 1 ? "" : "s"}
                                </p>
                              </div>
                              <b className="text-sm text-emerald-700">
                                {formatCOP(item.amount)}
                              </b>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{
                                  width: `${Math.max(
                                    4,
                                    (item.amount / maxMethod) * 100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
                        Salidas
                      </p>
                      <h2 className="mt-1 text-xl font-black">
                        Por categoría
                      </h2>
                    </div>

                    <div className="mt-5 space-y-4">
                      {summary.expenseCategories.length === 0 ? (
                        <p className="text-sm text-neutral-400">
                          No hay salidas registradas en este período.
                        </p>
                      ) : (
                        summary.expenseCategories.map((item) => (
                          <div key={item.category}>
                            <div className="flex items-end justify-between gap-4">
                              <div>
                                <b className="text-sm">{item.category}</b>
                                <p className="text-[10px] text-neutral-400">
                                  {item.count} movimiento{item.count === 1 ? "" : "s"}
                                </p>
                              </div>
                              <b className="text-sm text-rose-700">
                                {formatCOP(item.amount)}
                              </b>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                              <div
                                className="h-full rounded-full bg-rose-500"
                                style={{
                                  width: `${Math.max(
                                    4,
                                    (item.amount / maxExpenseCategory) * 100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
                      Últimos ingresos
                    </p>
                    <h2 className="mt-1 text-xl font-black">
                      Pagos recibidos
                    </h2>
                    <div className="mt-4 space-y-2">
                      {summary.payments.slice(0, 8).map((payment) => (
                        <div
                          key={payment.id}
                          className="grid gap-2 rounded-2xl border border-neutral-100 bg-[#faf9f7] p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <b className="text-sm">
                                {orderCode(
                                  payment.order.sequenceNumber ??
                                    payment.order.id,
                                  payment.order.source,
                                )}
                              </b>
                              <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[9px] font-bold text-neutral-500">
                                {payment.method}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-neutral-500">
                              {payment.order.customerName}
                            </p>
                            {payment.paidAt && (
                              <p className="mt-0.5 text-[10px] text-neutral-400">
                                {dateTimeLabel(payment.paidAt)}
                              </p>
                            )}
                          </div>
                          <b className="text-sm text-emerald-700">
                            + {formatCOP(payment.amount)}
                          </b>
                        </div>
                      ))}
                      {summary.payments.length === 0 && (
                        <p className="text-sm text-neutral-400">
                          No hay pagos en este período.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
                      Últimas salidas
                    </p>
                    <h2 className="mt-1 text-xl font-black">
                      Dinero que salió
                    </h2>
                    <div className="mt-4 space-y-2">
                      {summary.expenses.slice(0, 8).map((expense) => (
                        <div
                          key={expense.id}
                          className="grid gap-2 rounded-2xl border border-neutral-100 bg-[#faf9f7] p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${expenseTone(expense.category)}`}>
                                {expense.category}
                              </span>
                              {expense.subcategory && (
                                <b className="truncate text-xs">
                                  {expense.subcategory}
                                </b>
                              )}
                            </div>
                            <p className="mt-1 truncate text-[11px] text-neutral-500">
                              {expense.note || "Sin observación"}
                            </p>
                            <p className="mt-0.5 text-[10px] text-neutral-400">
                              {dateTimeLabel(expense.occurredAt)}
                            </p>
                          </div>
                          <b className="text-sm text-rose-700">
                            − {formatCOP(expense.amount)}
                          </b>
                        </div>
                      ))}
                      {summary.expenses.length === 0 && (
                        <p className="text-sm text-neutral-400">
                          No hay salidas en este período.
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <section className="rounded-[24px] border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
                      Control de salidas
                    </p>
                    <h2 className="mt-1 text-xl font-black">
                      {summary.expenseCount} movimiento{summary.expenseCount === 1 ? "" : "s"} · {formatCOP(summary.expensesTotal)}
                    </h2>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="relative min-w-[240px]">
                      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                      <input
                        value={expenseQuery}
                        onChange={(event) => setExpenseQuery(event.target.value)}
                        placeholder="Buscar salida..."
                        className="h-11 w-full rounded-xl border border-neutral-200 bg-[#faf9f7] pl-10 pr-3 text-xs outline-none focus:border-neutral-400"
                      />
                    </label>
                    <select
                      value={expenseCategoryFilter}
                      onChange={(event) =>
                        setExpenseCategoryFilter(event.target.value)
                      }
                      className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-700 outline-none"
                    >
                      <option value="ALL">Todas las categorías</option>
                      {CASH_EXPENSE_CATEGORIES.map((category) => (
                        <option key={category.name} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {filteredExpenses.map((expense) => (
                    <article
                      key={expense.id}
                      className="grid gap-3 rounded-[18px] border border-neutral-200 bg-[#fbfaf8] p-4 md:grid-cols-[170px_1fr_auto] md:items-center"
                    >
                      <div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${expenseTone(expense.category)}`}>
                          {expense.category}
                        </span>
                        <p className="mt-2 text-[10px] text-neutral-400">
                          {dateTimeLabel(expense.occurredAt)}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <b className="block truncate text-sm text-neutral-900">
                          {expense.subcategory || "Salida general"}
                        </b>
                        <p className="mt-1 truncate text-[11px] text-neutral-500">
                          {expense.note || "Sin observación"}
                        </p>
                        <p className="mt-1 text-[9px] text-neutral-400">
                          {expense.source === "GLIDE_IMPORT"
                            ? "Histórico importado"
                            : `Registró: ${expense.createdByName}`}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 md:justify-end">
                        <b className="text-base font-black text-rose-700">
                          {formatCOP(expense.amount)}
                        </b>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(expense)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
                          title="Eliminar salida"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  ))}

                  {filteredExpenses.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">
                      No hay salidas para mostrar con estos filtros.
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>

      {expenseOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px]">
          <div className="w-full max-w-xl overflow-hidden rounded-[26px] border border-white/10 bg-[#f6f3ee] shadow-[0_30px_100px_rgba(0,0,0,.34)]">
            <header className="bg-[radial-gradient(circle_at_88%_12%,rgba(226,26,34,.24),transparent_32%),linear-gradient(135deg,#080809,#1a1718)] px-6 py-5 text-white">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ff5a60]">
                Caja · Salidas
              </p>
              <h2 className="mt-1 text-2xl font-black">Registrar salida</h2>
              <p className="mt-1 text-[11px] text-white/50">
                Registra el dinero que realmente salió de la operación.
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
                    value={expenseDate}
                    onChange={(event) => setExpenseDate(event.target.value)}
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={expenseTime}
                    onChange={(event) => setExpenseTime(event.target.value)}
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                  Tipo de salida
                </label>
                <select
                  value={expenseCategory}
                  onChange={(event) => {
                    setExpenseCategory(event.target.value);
                    setExpenseSubcategory("");
                  }}
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold outline-none"
                >
                  {CASH_EXPENSE_CATEGORIES.map((category) => (
                    <option key={category.name} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                  Subtipo
                </label>
                <input
                  list="cash-expense-subcategories"
                  value={expenseSubcategory}
                  onChange={(event) => setExpenseSubcategory(event.target.value)}
                  placeholder={
                    selectedSubcategories.length
                      ? "Selecciona o escribe una opción"
                      : "Opcional"
                  }
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                />
                <datalist id="cash-expense-subcategories">
                  {selectedSubcategories.map((subcategory) => (
                    <option key={subcategory} value={subcategory} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                  Observación
                </label>
                <input
                  value={expenseNote}
                  onChange={(event) => setExpenseNote(event.target.value)}
                  placeholder="Ej. Compra de queso para la semana"
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase text-neutral-500">
                  Monto
                </label>
                <input
                  inputMode="numeric"
                  value={expenseAmount}
                  onChange={(event) =>
                    setExpenseAmount(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="0"
                  className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-lg font-black outline-none"
                />
                {expenseAmount && (
                  <p className="mt-1 text-xs font-bold text-rose-600">
                    {formatCOP(Number(expenseAmount))}
                  </p>
                )}
              </div>

              {expenseMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
                  {expenseMessage}
                </div>
              )}
            </div>

            <footer className="grid grid-cols-2 gap-2 border-t border-neutral-200 bg-white p-4">
              <button
                type="button"
                onClick={() => !expenseSaving && setExpenseOpen(false)}
                disabled={expenseSaving}
                className="h-11 rounded-xl border border-neutral-200 font-bold text-neutral-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveExpense()}
                disabled={expenseSaving}
                className="h-11 rounded-xl bg-[var(--brand-red)] font-black text-white disabled:opacity-50"
              >
                {expenseSaving ? "Guardando..." : "Guardar salida"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px]">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="bg-[#111113] px-5 py-4 text-white">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-400">
                Confirmar
              </p>
              <h3 className="mt-1 text-xl font-black">Eliminar salida</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-neutral-600">
                ¿Eliminar <b>{deleteTarget.category}</b> por{" "}
                <b>{formatCOP(deleteTarget.amount)}</b>?
              </p>
              <p className="mt-2 text-[11px] text-neutral-400">
                Se descontará inmediatamente del resumen de salidas.
              </p>
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
                onClick={() => void deleteExpense()}
                className="h-11 rounded-xl bg-red-600 font-black text-white"
              >
                {deleteBusy ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px]">
          <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[26px] bg-[#f6f3ee] shadow-2xl">
            <header className="shrink-0 bg-[radial-gradient(circle_at_88%_12%,rgba(226,26,34,.24),transparent_32%),linear-gradient(135deg,#080809,#1a1718)] px-6 py-5 text-white">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ff5a60]">
                Migración única
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Importar salidas históricas
              </h2>
              <p className="mt-1 text-[11px] text-white/50">
                Carga el CSV preparado desde tu historial de Glide.
              </p>
            </header>

            <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-5">
              <label className="block cursor-pointer rounded-[20px] border border-dashed border-neutral-300 bg-white p-6 text-center">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setImportFile(file);
                    setImportPreview(null);
                    setImportMessage("");
                    if (file) void analyzeImport(file);
                  }}
                />
                <Upload className="mx-auto h-6 w-6 text-neutral-400" />
                <b className="mt-2 block text-sm">
                  {importFile?.name || "Seleccionar CSV de salidas"}
                </b>
                <span className="mt-1 block text-[10px] text-neutral-400">
                  Fecha · Tipo De Gasto · Observación · Monto · Sub Tipo De Gasto
                </span>
              </label>

              {importBusy && (
                <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs font-bold text-neutral-600">
                  Analizando archivo...
                </div>
              )}

              {importMessage && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
                  {importMessage}
                </div>
              )}

              {importPreview && (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded-xl border border-neutral-200 bg-white p-3">
                      <span className="text-[8px] font-black uppercase text-neutral-400">
                        Registros
                      </span>
                      <b className="mt-1 block text-lg">
                        {importPreview.summary.toImport}
                      </b>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-white p-3">
                      <span className="text-[8px] font-black uppercase text-neutral-400">
                        Total salidas
                      </span>
                      <b className="mt-1 block text-lg text-rose-700">
                        {formatCOP(importPreview.summary.totalAmount)}
                      </b>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-white p-3">
                      <span className="text-[8px] font-black uppercase text-neutral-400">
                        Categorías
                      </span>
                      <b className="mt-1 block text-lg">
                        {importPreview.summary.categoryCount}
                      </b>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-white p-3">
                      <span className="text-[8px] font-black uppercase text-neutral-400">
                        Errores
                      </span>
                      <b className={`mt-1 block text-lg ${
                        importPreview.summary.issues
                          ? "text-red-600"
                          : "text-emerald-600"
                      }`}>
                        {importPreview.summary.issues}
                      </b>
                    </div>
                  </div>

                  {importPreview.blockers.length > 0 && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-bold text-red-700">
                      {importPreview.blockers.map((blocker) => (
                        <p key={blocker}>• {blocker}</p>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 overflow-hidden rounded-[18px] border border-neutral-200 bg-white">
                    <div className="border-b bg-[#faf9f7] px-4 py-3 text-[10px] font-black uppercase text-neutral-500">
                      Vista previa
                    </div>
                    <div className="divide-y divide-neutral-100">
                      {importPreview.preview.slice(0, 8).map((expense) => (
                        <div
                          key={expense.rowNumber}
                          className="grid gap-2 px-4 py-3 sm:grid-cols-[120px_1fr_auto] sm:items-center"
                        >
                          <div>
                            <b className="text-[11px]">
                              {expense.category}
                            </b>
                            <p className="text-[9px] text-neutral-400">
                              {dateTimeLabel(expense.occurredAt)}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-bold text-neutral-700">
                              {expense.subcategory || expense.note || "—"}
                            </p>
                            {expense.note && expense.subcategory && (
                              <p className="truncate text-[9px] text-neutral-400">
                                {expense.note}
                              </p>
                            )}
                          </div>
                          <b className="text-[11px] text-rose-700">
                            {formatCOP(expense.amount)}
                          </b>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t bg-white p-4">
              <p className="text-[9px] text-neutral-400">
                La importación se bloquea después de ejecutarse correctamente.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={importBusy}
                  onClick={() => setImportOpen(false)}
                  className="h-10 rounded-xl border border-neutral-200 px-4 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={
                    importBusy || !importPreview?.summary.canImport
                  }
                  onClick={() => void confirmImport()}
                  className="h-10 rounded-xl bg-[var(--brand-red)] px-4 text-xs font-black text-white disabled:bg-neutral-300"
                >
                  {importBusy
                    ? "Importando..."
                    : importPreview
                      ? `Importar ${importPreview.summary.toImport}`
                      : "Importar"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}
