"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CalendarRange,
  CircleDollarSign,
  Landmark,
  Plus,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react";
import { orderCode } from "@/lib/orderCode";
import {
  CASH_EXPENSE_CATEGORIES,
  cashExpenseSubcategories,
} from "@/lib/cashExpenseCatalog";
import { CASH_INCOME_CATEGORIES } from "@/lib/cashIncomeCatalog";
import CashLoansPanel from "@/components/CashLoansPanel";
import CashRegisterControl from "@/components/CashRegisterControl";

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

type OrderSummaryRow = {
  id: number;
  sequenceNumber: number | null;
  source: string;
  fulfillmentType: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  createdAt: string;
  customerName: string;
  paidAmount: number;
  pendingAmount: number;
  payments: Array<{
    id: number;
    method: string;
    status: string;
    amount: number;
    paidAt: string | null;
  }>;
};

type CashLoanRow = {
  id: number;
  workerName: string;
  amount: number;
  issuedAt: string;
};

type CashLoanRepaymentRow = {
  id: number;
  loanId: number;
  workerName: string;
  amount: number;
  paidAt: string;
  method: string;
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
  payrollPaymentId?: number | null;
};

type DriverPayoutOption = {
  id: number;
  name: string;
  walletBalance: number;
  earnedTotal: number;
  paidTotal: number;
};

type PayrollWorker = {
  id: number;
  name: string;
  active: boolean;
  pendingAmount: number;
  pendingCount: number;
  oldestPendingAt: string;
};

type PayrollShift = {
  id: number;
  userId: number;
  startsAt: string;
  endsAt: string;
  amount: number;
  status: string;
  paidAt: string | null;
  notes: string | null;
  user: {
    id: number;
    name: string;
    active: boolean;
  };
};

type PayrollLoan = {
  id: number;
  workerId: number | null;
  workerName: string;
  note: string | null;
  principal: number;
  issuedAt: string;
  payrollMonth: string;
  repaidAmount: number;
  outstandingAmount: number;
};

type Summary = {
  startDate: string;
  endDate: string;
  scope?: "SESSION" | "NO_SESSION" | "CALENDAR";
  sessionScope?: {
    id: number;
    businessDate: string;
    status: string;
    openedAt: string;
    closedAt: string | null;
    inheritedFromPreviousDay: boolean;
  } | null;
  salesTotal: number;
  orderCount: number;
  receivedTotal: number;
  paymentCount: number;
  otherIncomeTotal: number;
  otherIncomeCount: number;
  totalInflow: number;
  loanDisbursedTotal: number;
  loanRecoveredTotal: number;
  loanRecoveredCashTotal?: number;
  loanRecoveredPayrollTotal?: number;
  expensesTotal: number;
  expenseCount: number;
  netTotal: number;
  payrollTotal: number;
  payrollPaidTotal: number;
  payrollPendingTotal: number;
  payrollShiftCount: number;
  payrollWorkerCount: number;
  payrollMonthActive: boolean;
  payrollMonth: string | null;
  loanReceivableBalance: number;
  methods: MethodSummary[];
  orders: OrderSummaryRow[];
  incomeCategories: IncomeCategorySummary[];
  expenseCategories: ExpenseCategorySummary[];
  payments: PaymentRow[];
  otherIncomes: IncomeRow[];
  loans: CashLoanRow[];
  loanRepayments: CashLoanRepaymentRow[];
  expenses: ExpenseRow[];
};

type CashLoanChange = {
  loanDisbursedDelta?: number;
  loanRecoveredDelta?: number;
};

type Tab = "SUMMARY" | "EXPENSES" | "INCOMES" | "LOANS" | "CASHES";
type SummaryDetail =
  | "SALES"
  | "INFLOW"
  | "INCOMES"
  | "RECOVERIES"
  | "EXPENSES"
  | "LOAN_OUTFLOWS"
  | "NET";
type RangePreset = "TODAY" | "YESTERDAY" | "WEEK" | "MONTH" | "CUSTOM";

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(Number(digits));
}

function printPayrollReceipt(receiptUrl: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.setTimeout(() => iframe.remove(), 300);
  };

  iframe.onload = () => {
    const printWindow = iframe.contentWindow;
    if (!printWindow) {
      cleanup();
      return;
    }

    window.setTimeout(() => {
      try {
        printWindow.addEventListener("afterprint", cleanup, { once: true });
        printWindow.focus();
        printWindow.print();
        window.setTimeout(cleanup, 60_000);
      } catch {
        cleanup();
      }
    }, 250);
  };

  iframe.src = receiptUrl;
  document.body.appendChild(iframe);
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

function shiftDateInput(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function firstDayOfWeek() {
  const today = localDateInput();
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return shiftDateInput(today, mondayOffset);
}

function shortDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
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

function payrollDayLabel(value: string) {
  return new Date(value).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function payrollTimeLabel(value: string) {
  return new Date(value).toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
  });
}

function payrollMonthKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

function payrollMonthLabel(value: string) {
  const label = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    month: "long",
    year: "numeric",
  }).format(new Date(value));

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function cashOrderStatusLabel(value: string) {
  const labels: Record<string, string> = {
    CONFIRMED: "Confirmado",
    PREPARING: "Preparando",
    PREPARED: "Horneando",
    READY: "Listo",
    OUT_FOR_DELIVERY: "En camino",
    ARRIVED: "Llegó",
    DELIVERED: "Entregado",
    COMPLETED: "Finalizado",
  };
  return labels[value] ?? value;
}

function fulfillmentLabel(value: string) {
  if (value === "DELIVERY") return "Domicilio";
  if (value === "PICKUP") return "Recoger";
  if (value === "STORE") return "Local";
  return value;
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
  const [rangePreset, setRangePreset] = useState<RangePreset>("TODAY");
  const [tab, setTab] = useState<Tab>("SUMMARY");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cashDayStatus, setCashDayStatus] = useState<
    "NONE" | "OPEN" | "CLOSED"
  >("NONE");
  const [loanCreateSignal, setLoanCreateSignal] = useState(0);
  const [incomeCategoryFilter, setIncomeCategoryFilter] = useState("ALL");
  const [incomeQuery, setIncomeQuery] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("ALL");
  const [expenseQuery, setExpenseQuery] = useState("");
  const [summaryDetail, setSummaryDetail] = useState<SummaryDetail | null>(null);

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
  const [expenseDriverId, setExpenseDriverId] = useState<number | null>(null);
  const [driverPayoutOptions, setDriverPayoutOptions] = useState<DriverPayoutOption[]>([]);
  const [driverPayoutLoading, setDriverPayoutLoading] = useState(false);
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [expenseTime, setExpenseTime] = useState(localTimeInput());
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseMessage, setExpenseMessage] = useState("");

  const [payrollOpen, setPayrollOpen] = useState(false);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollSaving, setPayrollSaving] = useState(false);
  const [payrollWorkers, setPayrollWorkers] = useState<PayrollWorker[]>([]);
  const [payrollShifts, setPayrollShifts] = useState<PayrollShift[]>([]);
  const [payrollLoans, setPayrollLoans] = useState<PayrollLoan[]>([]);
  const [payrollCashAvailable, setPayrollCashAvailable] = useState<number | null>(null);
  const [payrollLoansReceivable, setPayrollLoansReceivable] = useState<number | null>(null);
  const [payrollWorkerId, setPayrollWorkerId] = useState<number | null>(null);
  const [payrollSelectedShiftIds, setPayrollSelectedShiftIds] = useState<number[]>([]);
  const [payrollExpandedMonths, setPayrollExpandedMonths] = useState<string[]>([]);
  const [payrollLoanDeductions, setPayrollLoanDeductions] = useState<Record<number, string>>({});
  const [payrollNote, setPayrollNote] = useState("");
  const [payrollMessage, setPayrollMessage] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const summaryRequestRef = useRef(0);

  async function load(silent = false) {
    const requestId = ++summaryRequestRef.current;

    if (!silent) setLoading(true);

    try {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(
        `/api/caja/summary?${params.toString()}`,
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible cargar Caja.");
      }

      if (requestId !== summaryRequestRef.current) return;

      setSummary(data);
      setError("");
    } catch (loadError) {
      if (requestId !== summaryRequestRef.current) return;

      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar Caja.",
      );
    } finally {
      if (!silent && requestId === summaryRequestRef.current) {
        setLoading(false);
      }
    }
  }

  function handleLoanCashChanged(change: CashLoanChange = {}) {
    const disbursedDelta = Number(change.loanDisbursedDelta ?? 0);
    const recoveredDelta = Number(change.loanRecoveredDelta ?? 0);

    if (disbursedDelta !== 0 || recoveredDelta !== 0) {
      setSummary((current) => {
        if (!current) return current;

        return {
          ...current,
          loanDisbursedTotal: Math.max(
            0,
            current.loanDisbursedTotal + disbursedDelta,
          ),
          loanRecoveredTotal: Math.max(
            0,
            current.loanRecoveredTotal + recoveredDelta,
          ),
          totalInflow: Math.max(
            0,
            current.totalInflow + recoveredDelta,
          ),
          netTotal:
            current.netTotal -
            disbursedDelta +
            recoveredDelta,
        };
      });
    }

    return load(true);
  }

  useEffect(() => {
    void load();
  }, [startDate, endDate]);

  useEffect(() => {
    if (!expenseOpen || expenseCategory !== "Domicilios") return;

    let disposed = false;
    setDriverPayoutLoading(true);

    void fetch("/api/drivers", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data.error || "No fue posible cargar los repartidores.",
          );
        }
        if (!disposed) {
          setDriverPayoutOptions(
            (data.drivers ?? []) as DriverPayoutOption[],
          );
        }
      })
      .catch((loadError) => {
        if (!disposed) {
          setExpenseMessage(
            loadError instanceof Error
              ? loadError.message
              : "No fue posible cargar los repartidores.",
          );
        }
      })
      .finally(() => {
        if (!disposed) setDriverPayoutLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [expenseCategory, expenseOpen]);

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

  const selectedPayrollWorkerShifts = useMemo(
    () =>
      payrollWorkerId == null
        ? []
        : payrollShifts.filter((shift) => shift.userId === payrollWorkerId),
    [payrollShifts, payrollWorkerId],
  );

  const selectedPayrollMonthGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        shifts: PayrollShift[];
        total: number;
      }
    >();

    selectedPayrollWorkerShifts.forEach((shift) => {
      const key = payrollMonthKey(shift.startsAt);
      const current = groups.get(key);

      if (current) {
        current.shifts.push(shift);
        current.total += shift.amount;
        return;
      }

      groups.set(key, {
        key,
        label: payrollMonthLabel(shift.startsAt),
        shifts: [shift],
        total: shift.amount,
      });
    });

    return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [selectedPayrollWorkerShifts]);

  const selectedPayrollTotal = useMemo(
    () =>
      selectedPayrollWorkerShifts
        .filter((shift) => payrollSelectedShiftIds.includes(shift.id))
        .reduce((sum, shift) => sum + shift.amount, 0),
    [payrollSelectedShiftIds, selectedPayrollWorkerShifts],
  );

  const selectedPayrollLoans = useMemo(() => {
    if (payrollWorkerId == null) return [];

    const selectedMonths = new Set(
      selectedPayrollWorkerShifts
        .filter((shift) => payrollSelectedShiftIds.includes(shift.id))
        .map((shift) => payrollMonthKey(shift.startsAt)),
    );

    if (selectedMonths.size === 0) return [];

    return payrollLoans.filter(
      (loan) =>
        loan.workerId === payrollWorkerId &&
        selectedMonths.has(loan.payrollMonth),
    );
  }, [
    payrollLoans,
    payrollSelectedShiftIds,
    payrollWorkerId,
    selectedPayrollWorkerShifts,
  ]);

  const selectedPayrollLoanDeductionTotal = useMemo(
    () =>
      selectedPayrollLoans.reduce(
        (sum, loan) =>
          sum +
          Number(
            String(payrollLoanDeductions[loan.id] ?? "").replace(/\D/g, "") ||
              0,
          ),
        0,
      ),
    [payrollLoanDeductions, selectedPayrollLoans],
  );

  const selectedPayrollNetTotal = Math.max(
    0,
    selectedPayrollTotal - selectedPayrollLoanDeductionTotal,
  );

  const payrollLoanBalanceByWorker = useMemo(() => {
    const balances = new Map<number, number>();

    payrollLoans.forEach((loan) => {
      if (loan.workerId == null) return;
      balances.set(
        loan.workerId,
        (balances.get(loan.workerId) ?? 0) + loan.outstandingAmount,
      );
    });

    return balances;
  }, [payrollLoans]);

  const payrollCashAfterSelection =
    payrollCashAvailable == null
      ? null
      : payrollCashAvailable - selectedPayrollNetTotal;

  function applyRangePreset(preset: Exclude<RangePreset, "CUSTOM">) {
    const current = localDateInput();

    if (preset === "TODAY") {
      setStartDate(current);
      setEndDate(current);
    } else if (preset === "YESTERDAY") {
      const yesterday = shiftDateInput(current, -1);
      setStartDate(yesterday);
      setEndDate(yesterday);
    } else if (preset === "WEEK") {
      setStartDate(firstDayOfWeek());
      setEndDate(current);
    } else {
      setStartDate(firstDayOfMonth());
      setEndDate(current);
    }

    setRangePreset(preset);
  }

  function setCustomStartDate(value: string) {
    setStartDate(value);
    if (value > endDate) setEndDate(value);
    setRangePreset("CUSTOM");
  }

  function setCustomEndDate(value: string) {
    setEndDate(value);
    if (value < startDate) setStartDate(value);
    setRangePreset("CUSTOM");
  }

  function openSummaryDetail(detail: SummaryDetail) {
    setSummaryDetail(detail);
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
      await load(true);
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
      await load(true);
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

  function openExpense() {
    setExpenseCategory("Insumos");
    setExpenseSubcategory("");
    setExpenseDriverId(null);
    setDriverPayoutOptions([]);
    setExpenseNote("");
    setExpenseAmount("");
    setExpenseDate(localDateInput());
    setExpenseTime(localTimeInput());
    setExpenseMessage("");
    setExpenseOpen(true);
  }

  async function openPayroll() {
    setExpenseOpen(false);
    setPayrollOpen(true);
    setPayrollLoading(true);
    setPayrollMessage("");
    setPayrollWorkerId(null);
    setPayrollSelectedShiftIds([]);
    setPayrollExpandedMonths([]);
    setPayrollLoanDeductions({});
    setPayrollCashAvailable(null);
    setPayrollLoansReceivable(null);
    setPayrollNote("");

    try {
      const [response, cashResponse] = await Promise.all([
        fetch("/api/caja/payroll", { cache: "no-store" }),
        fetch(
          "/api/caja/register-session?date=" +
            encodeURIComponent(startDate) +
            "&includeMovement=1",
          { cache: "no-store" },
        ),
      ]);
      const data = await response.json();
      const cashData = await cashResponse.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data.error || "No fue posible cargar la nómina pendiente.");
      }

      if (cashResponse.ok && cashData?.session?.status === "OPEN") {
        const openingLoans = Number(
          cashData.session.openingLoanReceivable ??
            cashData.openingLoansReceivable ??
            0,
        );
        const openingAvailable =
          cashData.session.openingControlledBalance != null
            ? Number(cashData.session.openingBalance ?? 0)
            : Math.max(
                0,
                Number(cashData.session.openingBalance ?? 0) -
                  openingLoans,
              );
        const currentMovement = Number(cashData.movement?.netMovement ?? 0);
        setPayrollCashAvailable(
          Math.round(openingAvailable + currentMovement),
        );
        setPayrollLoansReceivable(
          Math.round(Number(cashData.movement?.loansReceivable ?? 0)),
        );
      }

      const workers = (data.workers ?? []) as PayrollWorker[];
      const shifts = (data.shifts ?? []) as PayrollShift[];
      const loans = (data.loans ?? []) as PayrollLoan[];
      setPayrollWorkers(workers);
      setPayrollShifts(shifts);
      setPayrollLoans(loans);

      if (workers.length === 1) {
        setPayrollWorkerId(workers[0].id);
        const firstShift = shifts.find((shift) => shift.userId === workers[0].id);
        setPayrollExpandedMonths(
          firstShift ? [payrollMonthKey(firstShift.startsAt)] : [],
        );
      }
    } catch (loadError) {
      setPayrollMessage(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar la nómina pendiente.",
      );
    } finally {
      setPayrollLoading(false);
    }
  }

  function selectPayrollWorker(workerId: number | null) {
    setPayrollWorkerId(workerId);
    setPayrollSelectedShiftIds([]);
    setPayrollLoanDeductions({});
    setPayrollMessage("");

    const firstShift =
      workerId == null
        ? null
        : payrollShifts.find((shift) => shift.userId === workerId) ?? null;
    setPayrollExpandedMonths(
      firstShift ? [payrollMonthKey(firstShift.startsAt)] : [],
    );
  }

  function togglePayrollShift(shiftId: number) {
    setPayrollSelectedShiftIds((current) =>
      current.includes(shiftId)
        ? current.filter((id) => id !== shiftId)
        : [...current, shiftId],
    );
  }

  function togglePayrollMonth(monthKey: string) {
    setPayrollExpandedMonths((current) =>
      current.includes(monthKey)
        ? current.filter((key) => key !== monthKey)
        : [...current, monthKey],
    );
  }

  function togglePayrollMonthSelection(monthKey: string) {
    const group = selectedPayrollMonthGroups.find(
      (item) => item.key === monthKey,
    );
    if (!group) return;

    const ids = group.shifts.map((shift) => shift.id);
    const allSelected = ids.every((id) =>
      payrollSelectedShiftIds.includes(id),
    );

    setPayrollSelectedShiftIds((current) =>
      allSelected
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])],
    );
  }

  function toggleAllPayrollShifts() {
    const ids = selectedPayrollWorkerShifts.map((shift) => shift.id);
    const allSelected =
      ids.length > 0 && ids.every((id) => payrollSelectedShiftIds.includes(id));

    setPayrollSelectedShiftIds(allSelected ? [] : ids);
  }

  function togglePayrollLoan(loan: PayrollLoan) {
    const currentValue = payrollLoanDeductions[loan.id];
    if (currentValue != null) {
      setPayrollLoanDeductions((current) => {
        const next = { ...current };
        delete next[loan.id];
        return next;
      });
      return;
    }

    const remainingPayroll = Math.max(
      0,
      selectedPayrollTotal - selectedPayrollLoanDeductionTotal,
    );
    const deduction = Math.min(loan.outstandingAmount, remainingPayroll);

    if (deduction <= 0) {
      setPayrollMessage(
        "Selecciona turnos suficientes antes de aplicar descuentos por préstamo.",
      );
      return;
    }

    setPayrollLoanDeductions((current) => ({
      ...current,
      [loan.id]: String(Math.round(deduction)),
    }));
    setPayrollMessage("");
  }

  function setPayrollLoanDeduction(loan: PayrollLoan, value: string) {
    const numeric = Number(value.replace(/\D/g, ""));
    const bounded = Math.min(
      loan.outstandingAmount,
      Number.isFinite(numeric) ? numeric : 0,
    );

    setPayrollLoanDeductions((current) => ({
      ...current,
      [loan.id]: bounded > 0 ? String(Math.round(bounded)) : "",
    }));
  }

  async function savePayrollPayment() {
    if (
      payrollSaving ||
      payrollWorkerId == null ||
      payrollSelectedShiftIds.length === 0
    ) {
      return;
    }

    if (selectedPayrollLoanDeductionTotal > selectedPayrollTotal) {
      setPayrollMessage(
        "Los descuentos por préstamo no pueden superar la nómina seleccionada.",
      );
      return;
    }

    setPayrollSaving(true);
    setPayrollMessage("");

    try {
      const response = await fetch("/api/caja/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: payrollWorkerId,
          shiftIds: payrollSelectedShiftIds,
          loanDeductions: selectedPayrollLoans
            .map((loan) => ({
              loanId: loan.id,
              amount: Number(
                String(payrollLoanDeductions[loan.id] ?? "").replace(/\D/g, ""),
              ),
            }))
            .filter((deduction) => deduction.amount > 0),
          note: payrollNote,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible pagar la nómina.");
      }

      const receiptUrl = String(data.payment?.receiptUrl || "");
      if (receiptUrl) {
        printPayrollReceipt(receiptUrl);
      }

      setPayrollOpen(false);
      setTab("EXPENSES");
      await load(true);
    } catch (saveError) {
      setPayrollMessage(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible pagar la nómina.",
      );
    } finally {
      setPayrollSaving(false);
    }
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
          driverId:
            expenseCategory === "Domicilios"
              ? expenseDriverId
              : null,
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
      await load(true);
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
      await load(true);
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

  const singleDaySelected = startDate === endDate;
  const selectedDayClosed =
    singleDaySelected && cashDayStatus === "CLOSED";
  const cashOperationsOpen =
    singleDaySelected && cashDayStatus === "OPEN";
  const selectedSubcategories = cashExpenseSubcategories(expenseCategory);
  const selectedSummary =
    summary?.startDate === startDate &&
    summary?.endDate === endDate
      ? summary
      : null;

  return (
    <main className="min-h-screen w-full bg-[#f4f4f2] p-3 md:p-5 xl:p-6">
      <div className="w-full space-y-5">
        <section className="relative min-h-[116px] w-full overflow-hidden rounded-[24px] border border-black/5 bg-[#0a0a0b] text-white shadow-[0_14px_36px_rgba(20,16,14,.11)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_42%,rgba(226,26,34,.55),transparent_25%),radial-gradient(circle_at_68%_100%,rgba(132,12,16,.36),transparent_34%),linear-gradient(105deg,#111319_0%,#101116_43%,#1a0b0d_67%,#5a090c_100%)]" />
          <CircleDollarSign
            className="absolute right-[31%] top-[-24px] h-40 w-40 rotate-[-10deg] text-white/[0.028]"
            strokeWidth={1.1}
          />
          <div className="absolute right-[9%] top-[22px] h-[2px] w-[30%] bg-gradient-to-r from-transparent via-red-300/40 to-transparent" />

          <div className="relative flex min-h-[116px] flex-col justify-between gap-4 px-5 py-4 lg:flex-row lg:items-center lg:px-6 xl:px-7">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-[2px] w-7 rounded-full bg-[var(--brand-red)]" />
                <p className="alento-ui-label uppercase tracking-[0.2em] text-white/55">
                  Finanzas operativas
                </p>
              </div>
              <h1 className="alento-ui-hero-title mt-1.5">
                Caja
              </h1>
              <p className="alento-ui-hero-subtitle mt-1.5 text-white/60">
                Ventas, entradas, préstamos y salidas reales en el período.
              </p>
            </div>

            <div className="w-full self-end lg:w-auto lg:min-w-[560px] lg:self-auto">
              <div className="rounded-[18px] border border-white/10 bg-black/10 p-2.5 backdrop-blur-sm">
                <div className="mb-2 flex items-center justify-between gap-3 px-1">
                  <div className="flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-white/55" strokeWidth={1.9} />
                    <span className="alento-ui-micro uppercase tracking-[0.14em] text-white/45">
                      Período
                    </span>
                  </div>
                  <span className="truncate text-[9px] font-semibold text-white/45">
                    {startDate === endDate
                      ? shortDateLabel(startDate)
                      : `${shortDateLabel(startDate)} — ${shortDateLabel(endDate)}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                  {([
                    ["TODAY", "Hoy"],
                    ["YESTERDAY", "Ayer"],
                    ["WEEK", "Semana"],
                    ["MONTH", "Mes"],
                  ] as [Exclude<RangePreset, "CUSTOM">, string][]).map(
                    ([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => applyRangePreset(value)}
                        className={
                          "h-10 rounded-[11px] border px-3 text-[10px] font-black transition " +
                          (rangePreset === value
                            ? "border-white bg-white text-neutral-950 shadow-[0_5px_16px_rgba(0,0,0,.14)]"
                            : "border-white/10 bg-white/[0.07] text-white/75 hover:bg-white/[0.12]")
                        }
                      >
                        {label}
                      </button>
                    ),
                  )}

                  <button
                    type="button"
                    onClick={() => setRangePreset("CUSTOM")}
                    className={
                      "col-span-2 h-10 rounded-[11px] border px-3 text-[10px] font-black transition sm:col-span-1 " +
                      (rangePreset === "CUSTOM"
                        ? "border-white bg-white text-neutral-950 shadow-[0_5px_16px_rgba(0,0,0,.14)]"
                        : "border-white/10 bg-white/[0.07] text-white/75 hover:bg-white/[0.12]")
                    }
                  >
                    Personalizado
                  </button>
                </div>

                {rangePreset === "CUSTOM" && (
                  <div className="mt-2 grid gap-2 rounded-[13px] border border-white/10 bg-black/15 p-2 sm:grid-cols-2">
                    <label className="min-w-0">
                      <span className="mb-1 block alento-ui-micro uppercase tracking-[0.12em] text-white/40">
                        Desde
                      </span>
                      <input
                        type="date"
                        value={startDate}
                        max={endDate}
                        onChange={(event) => setCustomStartDate(event.target.value)}
                        className="h-11 w-full rounded-[11px] border border-white/12 bg-white/[0.08] px-3 text-[12px] font-bold text-white outline-none transition focus:border-white/30 focus:bg-white/[0.11] [color-scheme:dark]"
                      />
                    </label>

                    <label className="min-w-0">
                      <span className="mb-1 block alento-ui-micro uppercase tracking-[0.12em] text-white/40">
                        Hasta
                      </span>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={(event) => setCustomEndDate(event.target.value)}
                        className="h-11 w-full rounded-[11px] border border-white/12 bg-white/[0.08] px-3 text-[12px] font-bold text-white outline-none transition focus:border-white/30 focus:bg-white/[0.11] [color-scheme:dark]"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-[20px] border border-neutral-200 bg-white p-2.5 shadow-[0_8px_24px_rgba(28,23,20,.045)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-[14px] bg-[#f5f4f2] p-1">
            {([
              ["SUMMARY", "Resumen"],
              ["EXPENSES", "Salidas"],
              ["INCOMES", "Ingresos"],
              ["LOANS", "Préstamos"],
              ["CASHES", "Cajas"],
            ] as [Tab, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`h-10 rounded-[11px] px-4 text-[11px] font-black transition ${
                  tab === value
                    ? "bg-neutral-950 text-white shadow-sm"
                    : "text-neutral-600 hover:bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedDayClosed && (
              <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-100 px-3 alento-ui-label uppercase tracking-[0.08em] text-neutral-600">
                Caja cerrada · solo consulta
              </span>
            )}

            {tab === "INCOMES" && cashOperationsOpen && (
              <button
                type="button"
                onClick={openIncome}
                aria-label="Nuevo ingreso"
                title="Nuevo ingreso"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-[0_8px_18px_rgba(5,150,105,.18)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                <Plus className="h-4 w-4" strokeWidth={2.4} />
              </button>
            )}

            {tab === "LOANS" && cashOperationsOpen && (
              <button
                type="button"
                onClick={() => setLoanCreateSignal((value) => value + 1)}
                aria-label="Nuevo préstamo"
                title="Nuevo préstamo"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 text-white shadow-[0_8px_18px_rgba(17,17,19,.16)] transition hover:-translate-y-0.5 hover:bg-black"
              >
                <Plus className="h-4 w-4" strokeWidth={2.4} />
              </button>
            )}

            {tab === "EXPENSES" && cashOperationsOpen && (
              <>
                <button
                  type="button"
                  onClick={() => void openPayroll()}
                  aria-label="Pagar nómina"
                  title="Pagar nómina"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-violet-100"
                >
                  <Banknote className="h-4 w-4" strokeWidth={2.2} />
                  <span className="hidden alento-ui-label font-black sm:inline">
                    Nómina
                  </span>
                </button>
                <button
                  type="button"
                  onClick={openExpense}
                  aria-label="Nueva salida"
                  title="Nueva salida"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-red)] text-white shadow-[0_8px_18px_rgba(226,26,34,.18)] transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.4} />
                </button>
              </>
            )}
          </div>
        </section>

        <CashRegisterControl
          businessDate={tab === "CASHES" ? today : startDate}
          enabled={singleDaySelected || tab === "CASHES"}
          currentNetMovement={selectedSummary?.netTotal ?? 0}
          currentMovement={
            selectedSummary
              ? {
                  received: selectedSummary.receivedTotal,
                  otherIncome: selectedSummary.otherIncomeTotal,
                  expensesTotal: selectedSummary.expensesTotal,
                  loansTotal: selectedSummary.loanDisbursedTotal,
                  recovered: selectedSummary.loanRecoveredTotal,
                  netMovement: selectedSummary.netTotal,
                }
              : null
          }
          showHistory={tab === "CASHES"}
          onChanged={() => void load(true)}
          onSessionStateChange={setCashDayStatus}
          onSessionClosed={(businessDate) => {
            setStartDate(businessDate);
            setEndDate(businessDate);
            setRangePreset(
              businessDate === localDateInput() ? "TODAY" : "CUSTOM",
            );
          }}
        />

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
            <section
              className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${
                4 +
                  (summary.otherIncomeTotal > 0 ? 1 : 0) +
                  (summary.loanRecoveredTotal > 0 ? 1 : 0) +
                  (summary.loanDisbursedTotal > 0 ? 1 : 0) >=
                7
                  ? "2xl:grid-cols-7"
                  : 4 +
                        (summary.otherIncomeTotal > 0 ? 1 : 0) +
                        (summary.loanRecoveredTotal > 0 ? 1 : 0) +
                        (summary.loanDisbursedTotal > 0 ? 1 : 0) ===
                      6
                    ? "2xl:grid-cols-6"
                    : 4 +
                          (summary.otherIncomeTotal > 0 ? 1 : 0) +
                          (summary.loanRecoveredTotal > 0 ? 1 : 0) +
                          (summary.loanDisbursedTotal > 0 ? 1 : 0) ===
                        5
                      ? "2xl:grid-cols-5"
                      : "2xl:grid-cols-4"
              }`}
            >
              <button
                type="button"
                onClick={() => openSummaryDetail("SALES")}
                className="rounded-[22px] border border-sky-100 bg-[linear-gradient(145deg,#ffffff,#f0f7ff)] p-5 shadow-sm group w-full text-left transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <ReceiptText className="h-5 w-5" />
                  </span>
                  <span className="alento-ui-label uppercase tracking-[0.12em] text-sky-600">
                    Ventas
                  </span>
                </div>
                <b className="mt-4 block text-[28px] font-black tracking-[-0.04em] text-neutral-950">
                  {formatCOP(summary.salesTotal)}
                </b>
              </button>

              {summary.otherIncomeTotal > 0 && (
                <button
                  type="button"
                  onClick={() => openSummaryDetail("INCOMES")}
                  className="rounded-[22px] border border-teal-100 bg-[linear-gradient(145deg,#ffffff,#effcf9)] p-5 shadow-sm group w-full text-left transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                      <Banknote className="h-5 w-5" />
                    </span>
                    <span className="alento-ui-label uppercase tracking-[0.12em] text-teal-600">
                      Otros ingresos
                    </span>
                  </div>
                  <b className="mt-4 block text-[26px] font-black tracking-[-0.04em] text-teal-700">
                    {formatCOP(summary.otherIncomeTotal)}
                  </b>
                </button>
              )}

              {summary.loanRecoveredTotal > 0 && (
                <button
                  type="button"
                  onClick={() => openSummaryDetail("RECOVERIES")}
                  className="group w-full rounded-[22px] border border-violet-100 bg-[linear-gradient(145deg,#ffffff,#f7f4ff)] p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                      <CircleDollarSign className="h-5 w-5" />
                    </span>
                    <span className="alento-ui-label uppercase tracking-[0.12em] text-violet-600">
                      Préstamos recuperados
                    </span>
                  </div>
                  <b className="mt-4 block text-[26px] font-black tracking-[-0.04em] text-violet-700">
                    {formatCOP(summary.loanRecoveredTotal)}
                  </b>
                </button>
              )}

              <button
                type="button"
                onClick={() => openSummaryDetail("INFLOW")}
                className="rounded-[22px] border border-emerald-100 bg-[linear-gradient(145deg,#ffffff,#effcf6)] p-5 shadow-sm group w-full text-left transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <ArrowDownCircle className="h-5 w-5" />
                  </span>
                  <span className="alento-ui-label uppercase tracking-[0.12em] text-emerald-600">
                    Entradas totales
                  </span>
                </div>
                <b className="mt-4 block text-[26px] font-black tracking-[-0.04em] text-emerald-700">
                  {formatCOP(summary.totalInflow)}
                </b>
              </button>

              <button
                type="button"
                onClick={() => openSummaryDetail("EXPENSES")}
                className="rounded-[22px] border border-rose-100 bg-[linear-gradient(145deg,#ffffff,#fff3f4)] p-5 shadow-sm group w-full text-left transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                    <ArrowUpCircle className="h-5 w-5" />
                  </span>
                  <span className="alento-ui-label uppercase tracking-[0.12em] text-rose-600">
                    Salió
                  </span>
                </div>
                <b className="mt-4 block text-[28px] font-black tracking-[-0.04em] text-rose-700">
                  {formatCOP(summary.expensesTotal)}
                </b>
              </button>

              {summary.loanDisbursedTotal > 0 && (
                <button
                  type="button"
                  onClick={() => openSummaryDetail("LOAN_OUTFLOWS")}
                  className="group w-full rounded-[22px] border border-amber-100 bg-[linear-gradient(145deg,#ffffff,#fff9ee)] p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <Landmark className="h-5 w-5" />
                    </span>
                    <span className="alento-ui-label uppercase tracking-[0.12em] text-amber-700">
                      Préstamos otorgados
                    </span>
                  </div>
                  <b className="mt-4 block text-[26px] font-black tracking-[-0.04em] text-amber-700">
                    {formatCOP(summary.loanDisbursedTotal)}
                  </b>
                </button>
              )}

              <button
                type="button"
                onClick={() => openSummaryDetail("NET")}
                className={`group w-full rounded-[22px] border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
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
                  <span className="alento-ui-label uppercase tracking-[0.12em] text-neutral-500">
                    Flujo neto
                  </span>
                </div>
                <b className={`mt-4 block text-[28px] font-black tracking-[-0.04em] ${
                  summary.netTotal >= 0 ? "text-neutral-950" : "text-red-700"
                }`}>
                  {formatCOP(summary.netTotal)}
                </b>

              </button>
            </section>

            {tab === "SUMMARY" && (
              <section className="overflow-hidden rounded-[24px] border border-violet-100 bg-white shadow-[0_8px_24px_rgba(28,23,20,.04)]">
                <div className="flex items-center gap-3 border-b border-violet-100 bg-[linear-gradient(135deg,#fbf9ff,#ffffff)] px-4 py-3.5 sm:px-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-violet-100 text-violet-700">
                    <Users className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="alento-ui-label uppercase tracking-[0.13em] text-violet-500">
                      Nómina del período
                    </p>
                    <h2 className="mt-0.5 text-[16px] font-black tracking-[-0.02em] text-neutral-950">
                      {startDate === endDate
                        ? `Costo laboral · ${shortDateLabel(startDate)}`
                        : `Costo laboral · ${shortDateLabel(startDate)} — ${shortDateLabel(endDate)}`}
                    </h2>
                  </div>
                </div>

                <div className="grid gap-2 p-3 sm:grid-cols-3 sm:p-4">
                  <div className="rounded-[18px] border border-neutral-200 bg-[#fbfbfa] p-3.5">
                    <span className="alento-ui-micro uppercase tracking-[0.1em] text-neutral-400">
                      Nómina programada
                    </span>
                    <b className="mt-2 block text-[22px] font-black tracking-[-0.03em] text-neutral-950">
                      {formatCOP(summary.payrollTotal)}
                    </b>
                  </div>

                  <div className="rounded-[18px] border border-emerald-100 bg-emerald-50/45 p-3.5">
                    <span className="alento-ui-micro uppercase tracking-[0.1em] text-emerald-600">
                      Ya pagado
                    </span>
                    <b className="mt-2 block text-[22px] font-black tracking-[-0.03em] text-emerald-700">
                      {formatCOP(summary.payrollPaidTotal)}
                    </b>
                  </div>

                  <div className="rounded-[18px] border border-amber-100 bg-amber-50/55 p-3.5">
                    <span className="alento-ui-micro uppercase tracking-[0.1em] text-amber-600">
                      Pendiente por pagar
                    </span>
                    <b className="mt-2 block text-[22px] font-black tracking-[-0.03em] text-amber-700">
                      {formatCOP(summary.payrollPendingTotal)}
                    </b>
                  </div>
                </div>
              </section>
            )}

            {tab === "SUMMARY" ? null : tab === "INCOMES" ? (
              <section className="rounded-[24px] border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="alento-ui-label uppercase tracking-[0.12em] text-neutral-400">
                      Otros ingresos
                    </p>
                    <h2 className="mt-1 text-xl font-black">
                      {summary.otherIncomeCount} movimiento{summary.otherIncomeCount === 1 ? "" : "s"} · {formatCOP(summary.otherIncomeTotal)}
                    </h2>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Entradas que no provienen de pagos asociados a pedidos.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="relative min-w-[240px]">
                      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                      <input
                        value={incomeQuery}
                        onChange={(event) => setIncomeQuery(event.target.value)}
                        placeholder="Buscar ingreso..."
                        className="h-11 w-full rounded-xl border border-neutral-200 bg-[#faf9f7] pl-10 pr-3 text-xs outline-none focus:border-neutral-400"
                      />
                    </label>
                    <select
                      value={incomeCategoryFilter}
                      onChange={(event) =>
                        setIncomeCategoryFilter(event.target.value)
                      }
                      className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-700 outline-none"
                    >
                      <option value="ALL">Todos los tipos</option>
                      {CASH_INCOME_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {filteredIncomes.map((income) => (
                    <article
                      key={income.id}
                      className="grid gap-3 rounded-[18px] border border-neutral-200 bg-[#fbfaf8] p-4 md:grid-cols-[170px_1fr_auto] md:items-center"
                    >
                      <div>
                        <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 alento-ui-label uppercase text-emerald-700">
                          {income.category}
                        </span>
                        <p className="mt-2 text-[10px] text-neutral-400">
                          {dateTimeLabel(income.occurredAt)}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <b className="block truncate text-sm text-neutral-900">
                          {income.note || "Ingreso adicional"}
                        </b>
                        <p className="mt-1 alento-ui-label text-neutral-400">
                          {`Registró: ${income.createdByName}`}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 md:justify-end">
                        <b className="text-base font-black text-emerald-700">
                          {formatCOP(income.amount)}
                        </b>
                        <button
                          type="button"
                          onClick={() => setIncomeDeleteTarget(income)}
                          disabled={!cashOperationsOpen}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-300"
                          title={!cashOperationsOpen ? "Caja sin sesión operativa abierta" : "Eliminar ingreso"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  ))}

                  {filteredIncomes.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">
                      No hay otros ingresos para mostrar con estos filtros.
                    </div>
                  )}
                </div>
              </section>
            ) : tab === "LOANS" ? (
              <CashLoansPanel
                cashDateLocked={!cashOperationsOpen}
                businessDate={startDate}
                createSignal={loanCreateSignal}
                onCashChanged={handleLoanCashChanged}
              />
            ) : tab === "EXPENSES" ? (
              <section className="rounded-[24px] border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="alento-ui-label uppercase tracking-[0.12em] text-neutral-400">
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
                        <span className={`inline-flex rounded-full border px-2.5 py-1 alento-ui-label uppercase ${expenseTone(expense.category)}`}>
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
                        <p className="mt-1 alento-ui-label text-neutral-400">
                          {expense.source === "DRIVER_PAYMENT"
                            ? `Pago a repartidor · Registró: ${expense.createdByName}`
                            : expense.source === "PAYROLL"
                              ? `Pago de nómina · Registró: ${expense.createdByName}`
                              : `Registró: ${expense.createdByName}`}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 md:justify-end">
                        <b className="text-base font-black text-rose-700">
                          {formatCOP(expense.amount)}
                        </b>
                        {expense.source === "PAYROLL" &&
                          expense.payrollPaymentId != null && (
                            <button
                              type="button"
                              onClick={() =>
                                printPayrollReceipt(
                                  `/caja/nomina/${expense.payrollPaymentId}/imprimir`,
                                )
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
                              title="Imprimir comprobante de nómina"
                              aria-label="Imprimir comprobante de nómina"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(expense)}
                          disabled={!cashOperationsOpen || expense.source === "PAYROLL"}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-300"
                          title={
                            expense.source === "PAYROLL"
                              ? "Los pagos de nómina conservan el vínculo con sus turnos"
                              : !cashOperationsOpen
                                ? "Caja sin sesión operativa abierta"
                                : "Eliminar salida"
                          }
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
            ) : null}
          </>
        ) : null}
      </div>

      {summaryDetail && summary && (
        <div
          className="fixed inset-0 z-[145] flex items-center justify-center bg-black/72 p-2 backdrop-blur-[5px] sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSummaryDetail(null);
          }}
        >
          <section className="flex max-h-[92dvh] w-[min(97vw,1480px)] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#f5f4f1] shadow-[0_34px_120px_rgba(0,0,0,.42)]">
            <header className="shrink-0 bg-[radial-gradient(circle_at_88%_0%,rgba(226,26,34,.28),transparent_30%),linear-gradient(135deg,#0a0a0b,#171315)] px-5 py-5 text-white sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="alento-ui-label uppercase tracking-[0.18em] text-[#ff6267]">
                    Caja · detalle del período
                  </p>
                  <h2 className="mt-1 truncate text-[24px] font-black tracking-[-0.03em] sm:text-[28px]">
                    {summaryDetail === "SALES"
                      ? "Ventas, pedidos y pagos"
                      : summaryDetail === "INFLOW"
                        ? "Dinero que entró"
                        : summaryDetail === "INCOMES"
                          ? "Otros ingresos"
                          : summaryDetail === "RECOVERIES"
                            ? "Préstamos recuperados"
                            : summaryDetail === "EXPENSES"
                              ? "Salidas"
                              : summaryDetail === "LOAN_OUTFLOWS"
                                ? "Préstamos otorgados"
                                : "Composición del flujo neto"}
                  </h2>
                  <p className="mt-1 text-[10px] font-semibold text-white/45">
                    {summary.startDate === summary.endDate
                      ? summary.startDate
                      : `${summary.startDate} → ${summary.endDate}`}
                    {summary.sessionScope ? " · sesión de caja" : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void load(true)}
                    aria-label="Actualizar detalle"
                    title="Actualizar"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/65 transition hover:bg-white/[0.10]"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSummaryDetail(null)}
                    aria-label="Cerrar detalle"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[22px] text-white/70 transition hover:bg-white/[0.10]"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {summaryDetail === "SALES" && (
                  <>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Ventas</span>
                      <b className="mt-1 block text-lg">{formatCOP(summary.salesTotal)}</b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Pedidos</span>
                      <b className="mt-1 block text-lg">{summary.orderCount}</b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Pagos recibidos</span>
                      <b className="mt-1 block text-lg text-emerald-300">{formatCOP(summary.receivedTotal)}</b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Movimientos de pago</span>
                      <b className="mt-1 block text-lg">{summary.paymentCount}</b>
                    </div>
                  </>
                )}

                {summaryDetail === "INFLOW" && (
                  <>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Entradas totales</span>
                      <b className="mt-1 block text-lg text-emerald-300">{formatCOP(summary.totalInflow)}</b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Cobros de ventas</span>
                      <b className="mt-1 block text-lg">{formatCOP(summary.receivedTotal)}</b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Otros ingresos</span>
                      <b className="mt-1 block text-lg">{formatCOP(summary.otherIncomeTotal)}</b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Préstamos en efectivo</span>
                      <b className="mt-1 block text-lg">{formatCOP(summary.loanRecoveredCashTotal ?? summary.loanRecoveredTotal)}</b>
                    </div>
                  </>
                )}

                {summaryDetail === "INCOMES" && (
                  <>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Otros ingresos</span>
                      <b className="mt-1 block text-lg text-emerald-300">{formatCOP(summary.otherIncomeTotal)}</b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Movimientos</span>
                      <b className="mt-1 block text-lg">{summary.otherIncomeCount}</b>
                    </div>
                  </>
                )}

                {summaryDetail === "RECOVERIES" && (
                  <>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Recuperado total</span>
                      <b className="mt-1 block text-lg text-violet-300">{formatCOP(summary.loanRecoveredTotal)}</b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Entró a caja</span>
                      <b className="mt-1 block text-lg">{formatCOP(summary.loanRecoveredCashTotal ?? summary.loanRecoveredTotal)}</b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Descuento nómina</span>
                      <b className="mt-1 block text-lg">{formatCOP(summary.loanRecoveredPayrollTotal ?? 0)}</b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Abonos</span>
                      <b className="mt-1 block text-lg">{summary.loanRepayments.length}</b>
                    </div>
                  </>
                )}

              {summaryDetail === "EXPENSES" && (
                  <>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Salió</span>
                      <b className="mt-1 block text-lg text-rose-300">{formatCOP(summary.expensesTotal)}</b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Movimientos</span>
                      <b className="mt-1 block text-lg">{summary.expenseCount}</b>
                    </div>
                  </>
                )}

                {summaryDetail === "LOAN_OUTFLOWS" && (
                  <>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">
                        Prestado
                      </span>
                      <b className="mt-1 block text-lg text-amber-300">
                        {formatCOP(summary.loanDisbursedTotal)}
                      </b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">
                        Préstamos
                      </span>
                      <b className="mt-1 block text-lg">
                        {summary.loans.length}
                      </b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">
                        Trabajadores
                      </span>
                      <b className="mt-1 block text-lg">
                        {new Set(summary.loans.map((loan) => loan.workerName)).size}
                      </b>
                    </div>
                  </>
                )}

                {summaryDetail === "NET" && (
                  <>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Flujo neto</span>
                      <b className={`mt-1 block text-lg ${summary.netTotal >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {formatCOP(summary.netTotal)}
                      </b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Prestado</span>
                      <b className="mt-1 block text-lg">{formatCOP(summary.loanDisbursedTotal)}</b>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                      <span className="alento-ui-micro uppercase text-white/35">Recuperado</span>
                      <b className="mt-1 block text-lg text-emerald-300">{formatCOP(summary.loanRecoveredTotal)}</b>
                    </div>
                  </>
                )}
              </div>
            </header>

            <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              {summaryDetail === "SALES" && (
                <div className="grid gap-4 xl:grid-cols-[310px_minmax(0,1fr)]">
                  <aside className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm">
                    <p className="alento-ui-label uppercase tracking-[0.11em] text-neutral-400">
                      Cobros
                    </p>
                    <h3 className="mt-1 text-lg font-black">Por medio de pago</h3>
                    <div className="mt-4 space-y-4">
                      {summary.methods.map((item) => (
                        <div key={item.method}>
                          <div className="flex items-end justify-between gap-3">
                            <div>
                              <b className="text-xs">{item.method}</b>
                              <p className="alento-ui-micro mt-0.5 text-neutral-400">
                                {item.count} pago{item.count === 1 ? "" : "s"}
                              </p>
                            </div>
                            <b className="text-xs text-emerald-700">{formatCOP(item.amount)}</b>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.max(4, (item.amount / maxMethod) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      {summary.methods.length === 0 && (
                        <p className="text-xs text-neutral-400">No hay pagos en este período.</p>
                      )}
                    </div>
                  </aside>

                  <div className="min-w-0 space-y-4">
                    <section className="overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-sm">
                      <div className="flex items-end justify-between gap-4 border-b border-neutral-100 px-4 py-3.5">
                        <div>
                          <p className="alento-ui-label uppercase tracking-[0.11em] text-neutral-400">
                            Pedidos
                          </p>
                          <h3 className="mt-0.5 text-lg font-black">Ventas del período</h3>
                        </div>
                        <b className="text-sm text-neutral-500">{summary.orderCount}</b>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] border-collapse text-left">
                          <thead className="bg-[#faf9f7]">
                            <tr className="alento-ui-label uppercase text-neutral-400">
                              <th className="px-4 py-3">Pedido</th>
                              <th className="px-4 py-3">Cliente</th>
                              <th className="px-4 py-3">Tipo / estado</th>
                              <th className="px-4 py-3">Total</th>
                              <th className="px-4 py-3">Pagado</th>
                              <th className="px-4 py-3">Pagos</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100">
                            {(summary.orders ?? []).map((order) => (
                              <tr key={order.id} className="text-xs text-neutral-700">
                                <td className="px-4 py-3 align-top">
                                  <b className="block text-neutral-950">
                                    {orderCode(order.sequenceNumber ?? order.id, order.source)}
                                  </b>
                                  <span className="mt-1 block text-[10px] text-neutral-400">
                                    {dateTimeLabel(order.createdAt)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <b className="font-bold text-neutral-850">{order.customerName}</b>
                                  {order.discount > 0 && (
                                    <span className="mt-1 block text-[10px] font-bold text-emerald-700">
                                      Descuento − {formatCOP(order.discount)}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <span className="block font-bold">{fulfillmentLabel(order.fulfillmentType)}</span>
                                  <span className="mt-1 block text-[10px] text-neutral-400">{cashOrderStatusLabel(order.status)}</span>
                                </td>
                                <td className="px-4 py-3 align-top font-black text-neutral-950">
                                  {formatCOP(order.total)}
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <b className="text-emerald-700">{formatCOP(order.paidAmount)}</b>
                                  {order.pendingAmount > 0 && (
                                    <span className="mt-1 block text-[10px] font-bold text-rose-600">
                                      Pendiente {formatCOP(order.pendingAmount)}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <div className="flex max-w-[280px] flex-wrap gap-1">
                                    {order.payments.length ? (
                                      order.payments.map((payment) => (
                                        <span
                                          key={payment.id}
                                          className={`rounded-full border px-2 py-1 text-[9px] font-bold ${
                                            payment.status === "PAID"
                                              ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                                              : "border-neutral-200 bg-neutral-50 text-neutral-500"
                                          }`}
                                        >
                                          {payment.method} · {formatCOP(payment.amount)}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-neutral-400">Sin pagos</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {(summary.orders ?? []).length === 0 && (
                          <div className="p-8 text-center text-sm text-neutral-400">
                            No hay pedidos vendidos en este período.
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="alento-ui-label uppercase tracking-[0.11em] text-neutral-400">
                            Pagos recibidos
                          </p>
                          <h3 className="mt-0.5 text-lg font-black">Movimientos de pago</h3>
                        </div>
                        <b className="text-sm text-emerald-700">{formatCOP(summary.receivedTotal)}</b>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                        {summary.payments.map((payment) => (
                          <article
                            key={payment.id}
                            className="grid gap-2 rounded-[15px] border border-neutral-100 bg-[#faf9f7] p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <b className="text-xs">
                                  {orderCode(payment.order.sequenceNumber ?? payment.order.id, payment.order.source)}
                                </b>
                                <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 alento-ui-micro font-bold text-neutral-500">
                                  {payment.method}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-[10px] text-neutral-500">{payment.order.customerName}</p>
                              {payment.paidAt && (
                                <p className="mt-0.5 text-[9px] text-neutral-400">{dateTimeLabel(payment.paidAt)}</p>
                              )}
                            </div>
                            <b className="text-xs text-emerald-700">+ {formatCOP(payment.amount)}</b>
                          </article>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {summaryDetail === "INFLOW" && (
                <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
                  <aside className="space-y-4">
                    <section className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm">
                      <p className="alento-ui-label uppercase tracking-[0.11em] text-neutral-400">Cobros por medio</p>
                      <div className="mt-4 space-y-3">
                        {summary.methods.map((item) => (
                          <div key={item.method} className="flex items-center justify-between gap-3 rounded-xl bg-[#faf9f7] px-3 py-2.5">
                            <div>
                              <b className="text-xs">{item.method}</b>
                              <p className="alento-ui-micro text-neutral-400">{item.count} pagos</p>
                            </div>
                            <b className="text-xs text-emerald-700">{formatCOP(item.amount)}</b>
                          </div>
                        ))}
                      </div>
                    </section>
                    {(summary.loanRecoveredCashTotal ?? summary.loanRecoveredTotal) > 0 && (
                      <section className="rounded-[20px] border border-violet-100 bg-violet-50/45 p-4 shadow-sm">
                        <p className="alento-ui-label uppercase tracking-[0.11em] text-violet-500">
                          Préstamos pagados en efectivo
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-neutral-600">
                            Dinero que sí entró a Caja
                          </span>
                          <b className="text-sm text-violet-700">
                            {formatCOP(summary.loanRecoveredCashTotal ?? summary.loanRecoveredTotal)}
                          </b>
                        </div>
                      </section>
                    )}
                    <section className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm">
                      <p className="alento-ui-label uppercase tracking-[0.11em] text-neutral-400">Otros ingresos por tipo</p>
                      <div className="mt-4 space-y-3">
                        {summary.incomeCategories.map((item) => (
                          <div key={item.category} className="flex items-center justify-between gap-3 rounded-xl bg-[#faf9f7] px-3 py-2.5">
                            <div>
                              <b className="text-xs">{item.category}</b>
                              <p className="alento-ui-micro text-neutral-400">{item.count} movimientos</p>
                            </div>
                            <b className="text-xs text-teal-700">{formatCOP(item.amount)}</b>
                          </div>
                        ))}
                      </div>
                    </section>
                  </aside>

                  <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
                    <section className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-black">Pagos de pedidos</h3>
                        <b className="text-sm text-emerald-700">{formatCOP(summary.receivedTotal)}</b>
                      </div>
                      <div className="mt-3 space-y-2">
                        {summary.payments.map((payment) => (
                          <div key={payment.id} className="grid gap-2 rounded-[14px] border border-neutral-100 bg-[#faf9f7] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                            <div className="min-w-0">
                              <b className="text-xs">{orderCode(payment.order.sequenceNumber ?? payment.order.id, payment.order.source)}</b>
                              <p className="mt-1 truncate text-[10px] text-neutral-500">{payment.order.customerName} · {payment.method}</p>
                              {payment.paidAt && <p className="mt-0.5 text-[9px] text-neutral-400">{dateTimeLabel(payment.paidAt)}</p>}
                            </div>
                            <b className="text-xs text-emerald-700">+ {formatCOP(payment.amount)}</b>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-black">Entradas adicionales</h3>
                        <b className="text-sm text-teal-700">{formatCOP(summary.otherIncomeTotal)}</b>
                      </div>
                      <div className="mt-3 space-y-2">
                        {summary.otherIncomes.map((income) => (
                          <div key={income.id} className="grid gap-2 rounded-[14px] border border-neutral-100 bg-[#faf9f7] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 alento-ui-micro font-bold text-emerald-700">{income.category}</span>
                                <b className="truncate text-xs">{income.note || "Ingreso adicional"}</b>
                              </div>
                              <p className="mt-1 text-[9px] text-neutral-400">{dateTimeLabel(income.occurredAt)}</p>
                            </div>
                            <b className="text-xs text-teal-700">+ {formatCOP(income.amount)}</b>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {summaryDetail === "INCOMES" && (
                <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
                  <aside className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm">
                    <p className="alento-ui-label uppercase tracking-[0.11em] text-neutral-400">Distribución</p>
                    <h3 className="mt-1 text-lg font-black">Por tipo</h3>
                    <div className="mt-4 space-y-4">
                      {summary.incomeCategories.map((item) => (
                        <div key={item.category}>
                          <div className="flex items-end justify-between gap-3">
                            <div>
                              <b className="text-xs">{item.category}</b>
                              <p className="alento-ui-micro text-neutral-400">{item.count} movimientos</p>
                            </div>
                            <b className="text-xs text-teal-700">{formatCOP(item.amount)}</b>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full rounded-full bg-teal-500"
                              style={{ width: `${Math.max(4, (item.amount / maxIncomeCategory) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </aside>

                  <section className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-black">Todos los ingresos adicionales</h3>
                      <b className="text-sm text-teal-700">{summary.otherIncomes.length}</b>
                    </div>
                    <div className="mt-3 grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
                      {summary.otherIncomes.map((income) => (
                        <article key={income.id} className="rounded-[15px] border border-neutral-100 bg-[#faf9f7] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 alento-ui-micro font-bold text-emerald-700">{income.category}</span>
                              <b className="mt-2 block truncate text-xs">{income.note || "Ingreso adicional"}</b>
                              <p className="mt-1 text-[9px] text-neutral-400">{dateTimeLabel(income.occurredAt)} · {income.createdByName}</p>
                            </div>
                            <b className="shrink-0 text-xs text-teal-700">+ {formatCOP(income.amount)}</b>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {summaryDetail === "RECOVERIES" && (
                <section className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="alento-ui-label uppercase tracking-[0.11em] text-neutral-400">
                        Cartera
                      </p>
                      <h3 className="mt-0.5 text-lg font-black">
                        Abonos recibidos de préstamos
                      </h3>
                    </div>
                    <b className="text-sm text-violet-700">
                      + {formatCOP(summary.loanRecoveredTotal)}
                    </b>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                    {summary.loanRepayments.map((repayment) => (
                      <article
                        key={repayment.id}
                        className="rounded-[15px] border border-violet-100 bg-violet-50/35 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <b className="block truncate text-xs text-neutral-950">
                              {repayment.workerName}
                            </b>
                            <p className="mt-1 text-[9px] text-neutral-400">
                              {dateTimeLabel(repayment.paidAt)}
                            </p>
                            <span className="mt-2 inline-flex rounded-full border border-violet-100 bg-white px-2 py-1 alento-ui-micro font-bold text-violet-700">
                              {repayment.method === "DESCUENTO_NOMINA"
                                ? "Descuento nómina"
                                : "Pago recibido"}
                            </span>
                          </div>
                          <b className="shrink-0 text-xs text-violet-700">
                            + {formatCOP(repayment.amount)}
                          </b>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {summaryDetail === "LOAN_OUTFLOWS" && (
                <section className="rounded-[20px] border border-amber-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="alento-ui-label uppercase tracking-[0.11em] text-amber-600">
                        Cartera entregada
                      </p>
                      <h3 className="mt-0.5 text-lg font-black text-neutral-950">
                        Préstamos otorgados en el período
                      </h3>
                      <p className="mt-1 text-[10px] text-neutral-400">
                        Dinero que salió de Caja y quedó como cuenta por cobrar al trabajador.
                      </p>
                    </div>
                    <b className="text-sm text-amber-700">
                      − {formatCOP(summary.loanDisbursedTotal)}
                    </b>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                    {summary.loans.map((loan) => (
                      <article
                        key={loan.id}
                        className="rounded-[16px] border border-amber-100 bg-amber-50/35 p-3.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-amber-100 bg-white px-2 py-0.5 alento-ui-micro font-black text-amber-700">
                                Préstamo #{loan.id}
                              </span>
                              <b className="truncate text-xs text-neutral-950">
                                {loan.workerName}
                              </b>
                            </div>
                            <p className="mt-2 text-[9px] text-neutral-400">
                              {dateTimeLabel(loan.issuedAt)}
                            </p>
                          </div>
                          <b className="shrink-0 text-sm font-black text-amber-700">
                            − {formatCOP(loan.amount)}
                          </b>
                        </div>
                      </article>
                    ))}
                  </div>

                  {summary.loans.length === 0 && (
                    <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400">
                      No se otorgaron préstamos en este período.
                    </div>
                  )}
                </section>
              )}

              {summaryDetail === "EXPENSES" && (
                <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
                  <aside className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm">
                    <p className="alento-ui-label uppercase tracking-[0.11em] text-neutral-400">Distribución</p>
                    <h3 className="mt-1 text-lg font-black">Por categoría</h3>
                    <div className="mt-4 space-y-4">
                      {summary.expenseCategories.map((item) => (
                        <div key={item.category}>
                          <div className="flex items-end justify-between gap-3">
                            <div>
                              <b className="text-xs">{item.category}</b>
                              <p className="alento-ui-micro text-neutral-400">{item.count} movimientos</p>
                            </div>
                            <b className="text-xs text-rose-700">{formatCOP(item.amount)}</b>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full rounded-full bg-rose-500"
                              style={{ width: `${Math.max(4, (item.amount / maxExpenseCategory) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </aside>

                  <section className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-black">Todas las salidas</h3>
                      <b className="text-sm text-rose-700">{summary.expenses.length}</b>
                    </div>
                    <div className="mt-3 grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
                      {summary.expenses.map((expense) => (
                        <article key={expense.id} className="rounded-[15px] border border-neutral-100 bg-[#faf9f7] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-2 py-0.5 alento-ui-micro font-bold ${expenseTone(expense.category)}`}>
                                  {expense.category}
                                </span>
                                {expense.subcategory && <b className="truncate text-xs">{expense.subcategory}</b>}
                              </div>
                              <p className="mt-2 truncate text-[10px] text-neutral-500">{expense.note || "Sin observación"}</p>
                              <p className="mt-1 text-[9px] text-neutral-400">{dateTimeLabel(expense.occurredAt)} · {expense.createdByName}</p>
                            </div>
                            <b className="shrink-0 text-xs text-rose-700">− {formatCOP(expense.amount)}</b>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {summaryDetail === "NET" && (
                <div className="space-y-4">
                  <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {[
                      ["Cobros de ventas", summary.receivedTotal, "text-emerald-700"],
                      ["Otros ingresos", summary.otherIncomeTotal, "text-teal-700"],
                      ["Abonos préstamos en efectivo", summary.loanRecoveredCashTotal ?? summary.loanRecoveredTotal, "text-emerald-700"],
                      ["Salidas reales", -summary.expensesTotal, "text-rose-700"],
                      ["Préstamos entregados", -summary.loanDisbursedTotal, "text-rose-700"],
                    ].map(([label, amount, tone]) => (
                      <div key={String(label)} className="rounded-[18px] border border-neutral-200 bg-white p-4 shadow-sm">
                        <span className="alento-ui-label uppercase text-neutral-400">{String(label)}</span>
                        <b className={`mt-2 block text-lg font-black ${String(tone)}`}>
                          {Number(amount) >= 0 ? "+ " : "− "}
                          {formatCOP(Math.abs(Number(amount)))}
                        </b>
                      </div>
                    ))}
                  </section>

                  {(summary.loanRecoveredPayrollTotal ?? 0) > 0 && (
                    <div className="rounded-[18px] border border-violet-100 bg-violet-50/55 px-4 py-3 text-[11px] text-violet-800">
                      <b>Descuento de nómina a préstamos: {formatCOP(summary.loanRecoveredPayrollTotal ?? 0)}.</b>{" "}
                      Reduce la cartera del trabajador y ya reduce la salida de nómina, por eso no se suma otra vez como entrada de efectivo.
                    </div>
                  )}

                  <div className="grid gap-4 xl:grid-cols-2">
                    <section className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="alento-ui-label uppercase tracking-[0.11em] text-neutral-400">Cartera</p>
                          <h3 className="mt-1 text-lg font-black">Préstamos entregados</h3>
                        </div>
                        <b className="text-sm text-rose-700">− {formatCOP(summary.loanDisbursedTotal)}</b>
                      </div>
                      <div className="mt-3 space-y-2">
                        {(summary.loans ?? []).map((loan) => (
                          <div key={loan.id} className="flex items-center justify-between gap-3 rounded-[14px] bg-[#faf9f7] px-3 py-3">
                            <div>
                              <b className="text-xs">{loan.workerName}</b>
                              <p className="mt-0.5 text-[9px] text-neutral-400">{dateTimeLabel(loan.issuedAt)}</p>
                            </div>
                            <b className="text-xs text-rose-700">− {formatCOP(loan.amount)}</b>
                          </div>
                        ))}
                        {(summary.loans ?? []).length === 0 && (
                          <p className="py-5 text-center text-xs text-neutral-400">No hubo préstamos entregados en el período.</p>
                        )}
                      </div>
                    </section>

                    <section className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="alento-ui-label uppercase tracking-[0.11em] text-neutral-400">Cartera</p>
                          <h3 className="mt-1 text-lg font-black">Dinero recuperado</h3>
                        </div>
                        <b className="text-sm text-emerald-700">+ {formatCOP(summary.loanRecoveredTotal)}</b>
                      </div>
                      <div className="mt-3 space-y-2">
                        {(summary.loanRepayments ?? []).map((repayment) => (
                          <div key={repayment.id} className="flex items-center justify-between gap-3 rounded-[14px] bg-[#faf9f7] px-3 py-3">
                            <div>
                              <b className="text-xs">{repayment.workerName}</b>
                              <p className="mt-0.5 text-[9px] text-neutral-400">
                                {dateTimeLabel(repayment.paidAt)} · {repayment.method === "DESCUENTO_NOMINA" ? "Descuento nómina" : "Pago"}
                              </p>
                            </div>
                            <b className="text-xs text-emerald-700">+ {formatCOP(repayment.amount)}</b>
                          </div>
                        ))}
                        {(summary.loanRepayments ?? []).length === 0 && (
                          <p className="py-5 text-center text-xs text-neutral-400">No hubo recuperaciones en el período.</p>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {incomeOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px]">
          <div className="w-full max-w-xl overflow-hidden rounded-[26px] border border-white/10 bg-[#f6f3ee] shadow-[0_30px_100px_rgba(0,0,0,.34)]">
            <header className="bg-[radial-gradient(circle_at_88%_12%,rgba(16,185,129,.22),transparent_32%),linear-gradient(135deg,#080809,#1a1718)] px-6 py-5 text-white">
              <p className="alento-ui-label uppercase tracking-[0.18em] text-emerald-400">
                Caja · Otros ingresos
              </p>
              <h2 className="mt-1 text-2xl font-black">Registrar ingreso</h2>
              <p className="mt-1 text-[11px] text-white/50">
                Registra dinero que entró y no corresponde a un pago de pedido.
              </p>
            </header>

            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block alento-ui-label uppercase text-neutral-500">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={incomeDate}
                    onChange={(event) => setIncomeDate(event.target.value)}
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block alento-ui-label uppercase text-neutral-500">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={incomeTime}
                    onChange={(event) => setIncomeTime(event.target.value)}
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block alento-ui-label uppercase text-neutral-500">
                  Tipo de ingreso
                </label>
                <input
                  list="cash-income-categories"
                  value={incomeCategory}
                  onChange={(event) => setIncomeCategory(event.target.value)}
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold outline-none"
                  placeholder="Ej. Rappi, préstamo, ajuste..."
                />
                <datalist id="cash-income-categories">
                  {CASH_INCOME_CATEGORIES.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-1.5 block alento-ui-label uppercase text-neutral-500">
                  Observación
                </label>
                <input
                  value={incomeNote}
                  onChange={(event) => setIncomeNote(event.target.value)}
                  placeholder="Ej. Préstamo para caja, retorno de comisión..."
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block alento-ui-label uppercase text-neutral-500">
                  Monto
                </label>
                <input
                  inputMode="numeric"
                  value={incomeAmount}
                  onChange={(event) =>
                    setIncomeAmount(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="0"
                  className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-lg font-black outline-none"
                />
                {incomeAmount && (
                  <p className="mt-1 text-xs font-bold text-emerald-700">
                    {formatCOP(Number(incomeAmount))}
                  </p>
                )}
              </div>

              {incomeMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
                  {incomeMessage}
                </div>
              )}
            </div>

            <footer className="grid grid-cols-2 gap-2 border-t border-neutral-200 bg-white p-4">
              <button
                type="button"
                onClick={() => !incomeSaving && setIncomeOpen(false)}
                disabled={incomeSaving}
                className="h-11 rounded-xl border border-neutral-200 font-bold text-neutral-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveIncome()}
                disabled={incomeSaving}
                className="h-11 rounded-xl bg-emerald-600 font-black text-white disabled:opacity-50"
              >
                {incomeSaving ? "Guardando..." : "Guardar ingreso"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {incomeDeleteTarget && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px]">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="bg-[#111113] px-5 py-4 text-white">
              <p className="alento-ui-label uppercase tracking-[0.16em] text-emerald-400">
                Confirmar
              </p>
              <h3 className="mt-1 text-xl font-black">Eliminar ingreso</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-neutral-600">
                ¿Eliminar <b>{incomeDeleteTarget.category}</b> por{" "}
                <b>{formatCOP(incomeDeleteTarget.amount)}</b>?
              </p>
              <p className="mt-2 text-[11px] text-neutral-400">
                Se descontará inmediatamente de otros ingresos y del flujo neto.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t p-4">
              <button
                type="button"
                disabled={incomeDeleteBusy}
                onClick={() => setIncomeDeleteTarget(null)}
                className="h-11 rounded-xl border border-neutral-200 font-bold"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={incomeDeleteBusy}
                onClick={() => void deleteIncome()}
                className="h-11 rounded-xl bg-red-600 font-black text-white"
              >
                {incomeDeleteBusy ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {expenseOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px]">
          <div className="w-full max-w-xl overflow-hidden rounded-[26px] border border-white/10 bg-[#f6f3ee] shadow-[0_30px_100px_rgba(0,0,0,.34)]">
            <header className="bg-[radial-gradient(circle_at_88%_12%,rgba(226,26,34,.24),transparent_32%),linear-gradient(135deg,#080809,#1a1718)] px-6 py-5 text-white">
              <p className="alento-ui-label uppercase tracking-[0.18em] text-[#ff5a60]">
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
                  <label className="mb-1.5 block alento-ui-label uppercase text-neutral-500">
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
                  <label className="mb-1.5 block alento-ui-label uppercase text-neutral-500">
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
                <label className="mb-1.5 block alento-ui-label uppercase text-neutral-500">
                  Tipo de salida
                </label>
                <select
                  value={expenseCategory}
                  onChange={(event) => {
                    const category = event.target.value;
                    setExpenseCategory(category);
                    setExpenseSubcategory("");
                    setExpenseDriverId(null);
                    setExpenseAmount("");
                    setExpenseMessage("");

                    if (category === "Nomina") {
                      void openPayroll();
                    }
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

              {expenseCategory === "Domicilios" ? (
                <div>
                  <label className="mb-1.5 block alento-ui-label uppercase text-neutral-500">
                    Repartidor
                  </label>
                  <select
                    value={expenseDriverId ?? ""}
                    disabled={driverPayoutLoading}
                    onChange={(event) => {
                      const id = Number(event.target.value);
                      const driver =
                        driverPayoutOptions.find((item) => item.id === id) ??
                        null;
                      setExpenseDriverId(
                        Number.isInteger(id) && id > 0 ? id : null,
                      );
                      setExpenseSubcategory(driver?.name ?? "");
                      setExpenseAmount("");
                      setExpenseMessage("");
                    }}
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold outline-none disabled:bg-neutral-100"
                  >
                    <option value="">
                      {driverPayoutLoading
                        ? "Cargando repartidores..."
                        : "Selecciona un repartidor"}
                    </option>
                    {driverPayoutOptions.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name} · Saldo {formatCOP(driver.walletBalance)}
                      </option>
                    ))}
                  </select>

                  {(() => {
                    const selectedDriver = driverPayoutOptions.find(
                      (driver) => driver.id === expenseDriverId,
                    );
                    if (!selectedDriver) return null;

                    return (
                      <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2.5">
                        <div>
                          <span className="block alento-ui-micro uppercase tracking-[0.08em] text-cyan-700/60">
                            Saldo pendiente
                          </span>
                          <b className="mt-0.5 block text-base text-cyan-800">
                            {formatCOP(selectedDriver.walletBalance)}
                          </b>
                        </div>
                        <button
                          type="button"
                          disabled={selectedDriver.walletBalance <= 0}
                          onClick={() =>
                            setExpenseAmount(
                              String(Math.round(selectedDriver.walletBalance)),
                            )
                          }
                          className="h-9 rounded-xl bg-cyan-700 px-3 alento-ui-label text-white disabled:bg-neutral-300"
                        >
                          Pagar todo
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block alento-ui-label uppercase text-neutral-500">
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
              )}

              <div>
                <label className="mb-1.5 block alento-ui-label uppercase text-neutral-500">
                  Observación
                </label>
                <input
                  value={expenseNote}
                  onChange={(event) => setExpenseNote(event.target.value)}
                  placeholder={
                    expenseCategory === "Domicilios"
                      ? "Ej. Pago parcial de cartera"
                      : "Ej. Compra de queso para la semana"
                  }
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block alento-ui-label uppercase text-neutral-500">
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
                {expenseCategory === "Domicilios" &&
                  expenseDriverId != null && (() => {
                    const selectedDriver = driverPayoutOptions.find(
                      (driver) => driver.id === expenseDriverId,
                    );
                    if (!selectedDriver) return null;

                    const amount = Number(expenseAmount || 0);
                    const exceeds =
                      amount > selectedDriver.walletBalance;

                    return (
                      <p
                        className={
                          "mt-1 alento-ui-label font-semibold " +
                          (exceeds ? "text-red-600" : "text-neutral-400")
                        }
                      >
                        {exceeds
                          ? "El monto supera el saldo disponible."
                          : "Puedes registrar pagos parciales o pagar el saldo completo."}
                      </p>
                    );
                  })()}
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
                disabled={
                  expenseSaving ||
                  (expenseCategory === "Domicilios" &&
                    (expenseDriverId == null ||
                      Number(expenseAmount || 0) <= 0 ||
                      Number(expenseAmount || 0) >
                        (driverPayoutOptions.find(
                          (driver) => driver.id === expenseDriverId,
                        )?.walletBalance ?? 0)))
                }
                className="h-11 rounded-xl bg-[var(--brand-red)] font-black text-white disabled:opacity-50"
              >
                {expenseSaving ? "Guardando..." : "Guardar salida"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {payrollOpen && (
        <div className="fixed inset-0 z-[155] flex items-center justify-center bg-black/72 p-1.5 backdrop-blur-[5px] sm:p-2.5">
          <section className="flex h-[calc(100dvh-12px)] max-h-[calc(100dvh-12px)] w-[min(99vw,1280px)] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#f5f4f1] shadow-[0_34px_120px_rgba(0,0,0,.42)] sm:h-[calc(100dvh-20px)] sm:max-h-[calc(100dvh-20px)]">
            <header className="shrink-0 bg-[radial-gradient(circle_at_86%_0%,rgba(226,26,34,.30),transparent_30%),linear-gradient(135deg,#09090a,#191315)] px-5 py-5 text-white sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="alento-ui-label uppercase tracking-[0.18em] text-[#ff6267]">
                    Caja · Salidas · Nómina
                  </p>
                  <h2 className="mt-1 text-[25px] font-black tracking-[-0.035em] sm:text-[30px]">
                    Pagar turnos pendientes
                  </h2>
                  <p className="mt-1 max-w-2xl text-[11px] leading-5 text-white/50">
                    Selecciona al trabajador y los turnos que vas a liquidar. Al confirmar, se registra una sola salida de caja y los turnos quedan pagados.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={payrollSaving}
                  onClick={() => !payrollSaving && setPayrollOpen(false)}
                  aria-label="Cerrar nómina"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[22px] text-white/70 transition hover:bg-white/[0.10] disabled:opacity-40"
                >
                  ×
                </button>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                  <span className="alento-ui-micro uppercase text-white/35">
                    Turnos seleccionados
                  </span>
                  <b className="mt-1 block text-sm">
                    {payrollSelectedShiftIds.length}
                  </b>
                </div>
                <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
                  <span className="alento-ui-micro uppercase text-white/35">
                    Nómina seleccionada
                  </span>
                  <b className="mt-1 block text-lg text-white">
                    {formatCOP(selectedPayrollTotal)}
                  </b>
                </div>
                <div className="rounded-[14px] border border-violet-300/20 bg-violet-400/[0.08] px-3 py-2.5">
                  <span className="alento-ui-micro uppercase text-violet-200/55">
                    Descuento préstamos
                  </span>
                  <b className="mt-1 block text-lg text-violet-200">
                    − {formatCOP(selectedPayrollLoanDeductionTotal)}
                  </b>
                </div>
                <div className="rounded-[14px] border border-emerald-300/20 bg-emerald-400/[0.08] px-3 py-2.5">
                  <span className="alento-ui-micro uppercase text-emerald-200/55">
                    Salida real de caja
                  </span>
                  <b className="mt-1 block text-lg text-emerald-300">
                    {formatCOP(selectedPayrollNetTotal)}
                  </b>
                </div>
              </div>
            </header>

            <div className="grid min-h-0 flex-1 xl:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col border-b border-neutral-200 bg-white p-4 xl:border-b-0 xl:border-r">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="alento-ui-label uppercase tracking-[0.11em] text-neutral-400">
                      Personal
                    </p>
                    <h3 className="mt-0.5 text-lg font-black text-neutral-950">
                      Nómina pendiente
                    </h3>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 alento-ui-micro font-bold text-neutral-500">
                    {payrollWorkers.length}
                  </span>
                </div>

                <div className="mt-3 rounded-[18px] border border-emerald-100 bg-[linear-gradient(135deg,#f0fdf7,#f8fffb)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="alento-ui-micro uppercase tracking-[0.1em] text-emerald-600">
                      Saldo de caja
                    </span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <Banknote className="h-4 w-4" strokeWidth={2.1} />
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-emerald-100 bg-white/70 px-2.5 py-2">
                      <span className="block alento-ui-micro uppercase tracking-[0.07em] text-emerald-700/55">
                        Disponible
                      </span>
                      <b className="mt-0.5 block text-[15px] font-black tracking-[-0.02em] text-emerald-800">
                        {payrollCashAvailable == null
                          ? "—"
                          : formatCOP(payrollCashAvailable)}
                      </b>
                    </div>
                    <div className="rounded-xl border border-violet-100 bg-violet-50/70 px-2.5 py-2">
                      <span className="block alento-ui-micro uppercase tracking-[0.07em] text-violet-600/65">
                        En préstamos
                      </span>
                      <b className="mt-0.5 block text-[15px] font-black tracking-[-0.02em] text-violet-700">
                        {payrollLoansReceivable == null
                          ? "—"
                          : formatCOP(payrollLoansReceivable)}
                      </b>
                    </div>
                  </div>

                  {payrollCashAfterSelection != null &&
                    payrollSelectedShiftIds.length > 0 && (
                      <div className="mt-2 border-t border-emerald-100 pt-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="alento-ui-micro font-bold text-emerald-700/70">
                            Saldo después del pago
                          </span>
                          <b
                            className={
                              "text-xs font-black " +
                              (payrollCashAfterSelection >= 0
                                ? "text-emerald-800"
                                : "text-red-700")
                            }
                          >
                            {formatCOP(payrollCashAfterSelection)}
                          </b>
                        </div>
                      </div>
                    )}
                </div>

                {payrollLoading ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-xs text-neutral-400">
                    Cargando turnos pendientes...
                  </div>
                ) : payrollWorkers.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-center">
                    <b className="text-sm text-emerald-800">Nómina al día</b>
                    <p className="mt-1 text-[10px] leading-4 text-emerald-700/65">
                      No hay turnos pendientes de pago.
                    </p>
                  </div>
                ) : (
                  <div className="alento-scroll mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {payrollWorkers.map((worker) => (
                      <button
                        key={worker.id}
                        type="button"
                        onClick={() => selectPayrollWorker(worker.id)}
                        className={
                          "w-full rounded-[16px] border p-3 text-left transition " +
                          (payrollWorkerId === worker.id
                            ? "border-neutral-950 bg-neutral-950 text-white shadow-[0_8px_20px_rgba(0,0,0,.12)]"
                            : "border-neutral-200 bg-[#faf9f7] text-neutral-900 hover:border-neutral-300 hover:bg-white")
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <b className="block truncate text-xs font-black">
                              {worker.name}
                            </b>
                            <p
                              className={
                                "mt-1 alento-ui-micro " +
                                (payrollWorkerId === worker.id
                                  ? "text-white/45"
                                  : "text-neutral-400")
                              }
                            >
                              {worker.pendingCount} turno{worker.pendingCount === 1 ? "" : "s"} pendiente{worker.pendingCount === 1 ? "" : "s"}
                            </p>
                          </div>
                          <b
                            className={
                              "shrink-0 text-xs " +
                              (payrollWorkerId === worker.id
                                ? "text-emerald-300"
                                : "text-amber-700")
                            }
                          >
                            {formatCOP(worker.pendingAmount)}
                          </b>
                        </div>
                        {(() => {
                          const loanBalance =
                            payrollLoanBalanceByWorker.get(worker.id) ?? 0;
                          const estimatedCashOut = Math.max(
                            0,
                            worker.pendingAmount -
                              Math.min(worker.pendingAmount, loanBalance),
                          );
                          const enoughCash =
                            payrollCashAvailable == null ||
                            payrollCashAvailable >= estimatedCashOut;

                          return (
                            <>
                              <div
                                className={
                                  "mt-2 grid grid-cols-2 gap-2 rounded-xl border px-2.5 py-2 " +
                                  (payrollWorkerId === worker.id
                                    ? "border-white/10 bg-white/[0.06]"
                                    : "border-neutral-200 bg-white")
                                }
                              >
                                <div>
                                  <span
                                    className={
                                      "block alento-ui-micro uppercase tracking-[0.07em] " +
                                      (payrollWorkerId === worker.id
                                        ? "text-white/35"
                                        : "text-neutral-400")
                                    }
                                  >
                                    Préstamos
                                  </span>
                                  <b
                                    className={
                                      "mt-0.5 block text-[11px] font-black " +
                                      (payrollWorkerId === worker.id
                                        ? loanBalance > 0
                                          ? "text-violet-200"
                                          : "text-white/55"
                                        : loanBalance > 0
                                          ? "text-violet-700"
                                          : "text-neutral-400")
                                    }
                                  >
                                    {formatCOP(loanBalance)}
                                  </b>
                                </div>
                                <div className="text-right">
                                  <span
                                    className={
                                      "block alento-ui-micro uppercase tracking-[0.07em] " +
                                      (payrollWorkerId === worker.id
                                        ? "text-white/35"
                                        : "text-neutral-400")
                                    }
                                  >
                                    Salida estimada
                                  </span>
                                  <b
                                    className={
                                      "mt-0.5 block text-[11px] font-black " +
                                      (payrollWorkerId === worker.id
                                        ? enoughCash
                                          ? "text-emerald-300"
                                          : "text-red-300"
                                        : enoughCash
                                          ? "text-emerald-700"
                                          : "text-red-700")
                                    }
                                  >
                                    {formatCOP(estimatedCashOut)}
                                  </b>
                                </div>
                              </div>


                            </>
                          );
                        })()}
                      </button>
                    ))}
                  </div>
                )}
              </aside>

              <div className="flex min-h-0 flex-col">
                <div className="shrink-0 border-b border-neutral-200 bg-[#faf9f7] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="alento-ui-label uppercase tracking-[0.11em] text-neutral-400">
                        Turnos pendientes
                      </p>
                      <h3 className="mt-0.5 text-base font-black text-neutral-950">
                        {payrollWorkerId == null
                          ? "Selecciona un trabajador"
                          : "Organizados por mes"}
                      </h3>
                    </div>

                    {payrollWorkerId != null && selectedPayrollWorkerShifts.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleAllPayrollShifts}
                        disabled={payrollSaving}
                        className="h-9 rounded-xl border border-neutral-200 bg-white px-3 alento-ui-micro font-black text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-40"
                      >
                        {selectedPayrollWorkerShifts.every((shift) =>
                          payrollSelectedShiftIds.includes(shift.id),
                        )
                          ? "Quitar todos"
                          : "Seleccionar todos"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                  {!payrollWorkerId ? (
                    <div className="flex min-h-[280px] items-center justify-center rounded-[20px] border border-dashed border-neutral-300 bg-white p-8 text-center">
                      <div>
                        <b className="text-sm text-neutral-700">
                          Selecciona un trabajador
                        </b>
                        <p className="mt-1 text-[10px] text-neutral-400">
                          Usa las tarjetas de la izquierda. Los turnos pendientes aparecerán separados por mes.
                        </p>
                      </div>
                    </div>
                  ) : selectedPayrollWorkerShifts.length === 0 ? (
                    <div className="flex min-h-[280px] items-center justify-center rounded-[20px] border border-emerald-100 bg-emerald-50 p-8 text-center">
                      <div>
                        <b className="text-sm text-emerald-800">
                          Este trabajador no tiene turnos pendientes.
                        </b>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedPayrollMonthGroups.map((group) => {
                        const monthShiftIds = group.shifts.map((shift) => shift.id);
                        const selectedCount = monthShiftIds.filter((id) =>
                          payrollSelectedShiftIds.includes(id),
                        ).length;
                        const allSelected =
                          monthShiftIds.length > 0 &&
                          selectedCount === monthShiftIds.length;
                        const expanded = payrollExpandedMonths.includes(group.key);

                        return (
                          <section
                            key={group.key}
                            className={
                              "overflow-hidden rounded-[20px] border bg-white transition " +
                              (selectedCount > 0
                                ? "border-emerald-200 shadow-[0_7px_20px_rgba(5,150,105,.06)]"
                                : "border-neutral-200")
                            }
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#faf9f7] px-4 py-3.5">
                              <button
                                type="button"
                                onClick={() => togglePayrollMonth(group.key)}
                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                              >
                                <span
                                  className={
                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[15px] font-black transition " +
                                    (expanded
                                      ? "bg-neutral-950 text-white"
                                      : "bg-neutral-100 text-neutral-500")
                                  }
                                  aria-hidden="true"
                                >
                                  {expanded ? "−" : "+"}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <b className="text-[14px] font-black text-neutral-950">
                                      {group.label}
                                    </b>
                                    <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 alento-ui-micro font-bold text-neutral-500">
                                      {group.shifts.length} turno{group.shifts.length === 1 ? "" : "s"}
                                    </span>
                                    {selectedCount > 0 && (
                                      <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 alento-ui-micro font-black text-emerald-700">
                                        {selectedCount} seleccionado{selectedCount === 1 ? "" : "s"}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-[10px] text-neutral-400">
                                    {expanded ? "Ocultar turnos" : "Ver turnos del mes"}
                                  </p>
                                </div>
                              </button>

                              <div className="flex shrink-0 items-center gap-3">
                                <div className="text-right">
                                  <span className="block alento-ui-micro uppercase tracking-[0.08em] text-neutral-400">
                                    Total del mes
                                  </span>
                                  <b className="mt-0.5 block text-[15px] font-black text-neutral-950">
                                    {formatCOP(group.total)}
                                  </b>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => togglePayrollMonthSelection(group.key)}
                                  disabled={payrollSaving}
                                  className={
                                    "h-9 rounded-xl border px-3 alento-ui-micro font-black transition disabled:opacity-40 " +
                                    (allSelected
                                      ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300")
                                  }
                                >
                                  {allSelected ? "Quitar mes" : "Seleccionar mes"}
                                </button>
                              </div>
                            </div>

                            {expanded && (
                              <div className="space-y-2 border-t border-neutral-100 p-3">
                                {group.shifts.map((shift) => {
                                  const selected =
                                    payrollSelectedShiftIds.includes(shift.id);

                                  return (
                                    <button
                                      key={shift.id}
                                      type="button"
                                      disabled={payrollSaving}
                                      onClick={() => togglePayrollShift(shift.id)}
                                      className={
                                        "grid w-full gap-3 rounded-[15px] border p-3 text-left transition sm:grid-cols-[28px_190px_minmax(0,1fr)_130px] sm:items-center " +
                                        (selected
                                          ? "border-emerald-200 bg-emerald-50/55"
                                          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-[#faf9f7]")
                                      }
                                    >
                                      <span
                                        className={
                                          "flex h-6 w-6 items-center justify-center rounded-[7px] border text-[13px] font-black " +
                                          (selected
                                            ? "border-emerald-600 bg-emerald-600 text-white"
                                            : "border-neutral-300 bg-white text-transparent")
                                        }
                                        aria-hidden="true"
                                      >
                                        ✓
                                      </span>

                                      <div>
                                        <b className="block text-xs text-neutral-950">
                                          {payrollDayLabel(shift.startsAt)}
                                        </b>
                                        <span className="mt-0.5 block text-[10px] text-neutral-400">
                                          {payrollTimeLabel(shift.startsAt)} – {payrollTimeLabel(shift.endsAt)}
                                        </span>
                                      </div>

                                      <p className="truncate text-[10px] text-neutral-500">
                                        {shift.notes || "Sin observación"}
                                      </p>

                                      <b className="text-right text-sm font-black text-neutral-950">
                                        {formatCOP(shift.amount)}
                                      </b>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </section>
                        );
                      })}

                      <section className="overflow-hidden rounded-[20px] border border-violet-100 bg-white">
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-violet-50/55 px-4 py-3.5">
                          <div>
                            <p className="alento-ui-label uppercase tracking-[0.1em] text-violet-500">
                              Descuentos por préstamo
                            </p>
                            <h4 className="mt-0.5 text-[14px] font-black text-neutral-950">
                              Préstamos pendientes del trabajador
                            </h4>
                          </div>
                          <div className="text-right">
                            <span className="block alento-ui-micro uppercase text-neutral-400">
                              Seleccionado
                            </span>
                            <b className="mt-0.5 block text-sm font-black text-violet-700">
                              {formatCOP(selectedPayrollLoanDeductionTotal)}
                            </b>
                          </div>
                        </div>

                        {selectedPayrollLoans.length === 0 ? (
                          <div className="px-4 py-5 text-center text-[11px] font-semibold text-neutral-400">
                            {payrollSelectedShiftIds.length === 0
                              ? "Selecciona los turnos que vas a pagar para ver los préstamos asignados a esa nómina."
                              : "No hay préstamos pendientes asignados al mes de los turnos seleccionados."}
                          </div>
                        ) : (
                          <div className="space-y-2 border-t border-violet-100 p-3">
                            {selectedPayrollLoans.map((loan) => {
                              const selected =
                                payrollLoanDeductions[loan.id] != null;
                              const deduction = Number(
                                String(payrollLoanDeductions[loan.id] ?? "").replace(/\D/g, "") || 0,
                              );

                              return (
                                <div
                                  key={loan.id}
                                  className={
                                    "grid gap-3 rounded-[15px] border p-3 sm:grid-cols-[28px_minmax(0,1fr)_170px] sm:items-center " +
                                    (selected
                                      ? "border-violet-200 bg-violet-50/45"
                                      : "border-neutral-200 bg-white")
                                  }
                                >
                                  <button
                                    type="button"
                                    disabled={payrollSaving || selectedPayrollTotal <= 0}
                                    onClick={() => togglePayrollLoan(loan)}
                                    className={
                                      "flex h-6 w-6 items-center justify-center rounded-[7px] border text-[13px] font-black transition disabled:opacity-35 " +
                                      (selected
                                        ? "border-violet-600 bg-violet-600 text-white"
                                        : "border-neutral-300 bg-white text-transparent")
                                    }
                                    aria-label={selected ? "Quitar descuento" : "Aplicar descuento"}
                                  >
                                    ✓
                                  </button>

                                  <button
                                    type="button"
                                    disabled={payrollSaving || selectedPayrollTotal <= 0}
                                    onClick={() => togglePayrollLoan(loan)}
                                    className="min-w-0 text-left disabled:opacity-50"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <b className="text-xs font-black text-neutral-950">
                                        Préstamo #{loan.id}
                                      </b>
                                      <span className="rounded-full border border-violet-100 bg-white px-2 py-0.5 alento-ui-micro font-bold text-violet-700">
                                        Saldo {formatCOP(loan.outstandingAmount)}
                                      </span>
                                    </div>
                                    <p className="mt-1 truncate text-[10px] text-neutral-500">
                                      {loan.note || "Sin observación"} · entregado {payrollDayLabel(loan.issuedAt)}
                                    </p>
                                  </button>

                                  <label className="block">
                                    <span className="mb-1 block alento-ui-micro uppercase tracking-[0.08em] text-neutral-400">
                                      Descontar
                                    </span>
                                    <input
                                      inputMode="numeric"
                                      disabled={!selected || payrollSaving}
                                      value={selected ? formatDigits(String(deduction || "")) : ""}
                                      onChange={(event) =>
                                        setPayrollLoanDeduction(loan, event.target.value)
                                      }
                                      placeholder={formatCOP(loan.outstandingAmount)}
                                      className="h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-right text-xs font-black text-violet-700 outline-none disabled:bg-neutral-100 disabled:text-neutral-300"
                                    />
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-neutral-200 bg-white p-3 sm:p-4">
                  <label className="block">
                    <span className="alento-ui-label uppercase text-neutral-500">
                      Nota del pago · opcional
                    </span>
                    <input
                      value={payrollNote}
                      disabled={payrollSaving}
                      onChange={(event) => setPayrollNote(event.target.value)}
                      placeholder="Ej. Nómina primera quincena, pago parcial..."
                      maxLength={240}
                      className="mt-1.5 h-10 w-full rounded-xl border border-neutral-200 bg-[#faf9f7] px-3 text-xs outline-none focus:border-neutral-400"
                    />
                  </label>

                  {payrollMessage && (
                    <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
                      {payrollMessage}
                    </div>
                  )}

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="alento-ui-micro uppercase tracking-[0.1em] text-neutral-400">
                        Pago seleccionado
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-neutral-500">
                        Nómina {formatCOP(selectedPayrollTotal)}
                        {selectedPayrollLoanDeductionTotal > 0
                          ? ` · préstamos − ${formatCOP(selectedPayrollLoanDeductionTotal)}`
                          : ""}
                        <span className="mx-1">·</span>
                        salida real de caja
                        <b className="ml-1 text-neutral-950">{formatCOP(selectedPayrollNetTotal)}</b>
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={payrollSaving}
                        onClick={() => !payrollSaving && setPayrollOpen(false)}
                        className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-xs font-black text-neutral-600 disabled:opacity-40"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => void savePayrollPayment()}
                        disabled={
                          payrollSaving ||
                          payrollWorkerId == null ||
                          payrollSelectedShiftIds.length === 0 ||
                          selectedPayrollTotal <= 0 ||
                          selectedPayrollLoanDeductionTotal > selectedPayrollTotal
                        }
                        className="h-11 rounded-xl bg-[var(--brand-red)] px-5 text-xs font-black text-white shadow-[0_8px_18px_rgba(226,26,34,.18)] disabled:opacity-40"
                      >
                        {payrollSaving
                          ? "Pagando..."
                          : `Pagar nómina · ${formatCOP(selectedPayrollNetTotal)}`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px]">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="bg-[#111113] px-5 py-4 text-white">
              <p className="alento-ui-label uppercase tracking-[0.16em] text-red-400">
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
                {deleteTarget.source === "DRIVER_PAYMENT"
                  ? "Se eliminará de salidas y el monto volverá al saldo de la cartera del repartidor."
                  : "Se descontará inmediatamente del resumen de salidas."}
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

    </main>
  );
}
