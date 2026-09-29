"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DollarSign,
  Search,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

type ShiftUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

type Shift = {
  id: number;
  startsAt: string;
  endsAt: string;
  amount: number;
  status: string;
  paidAt: string | null;
  notes: string | null;
  user: {
    id: number;
    name: string;
    email: string;
    active: boolean;
  };
};

type Summary = {
  shifts: number;
  total: number;
  paid: number;
  pending: number;
};

type Editor = {
  id?: number;
  userId: number | "";
  startsAt: string;
  endsAt: string;
  amount: string;
  notes: string;
};

const EMPLOYEE_COLORS = [
  "bg-sky-500",
  "bg-fuchsia-500",
  "bg-amber-500",
  "bg-lime-600",
  "bg-orange-600",
  "bg-violet-500",
  "bg-emerald-600",
  "bg-rose-500",
];

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function monthKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
  ].join("-");
}

function monthTitle(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function dayKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function localInputValue(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function bogotaIso(value: string) {
  if (!value) return "";
  return new Date(`${value}:00-05:00`).toISOString();
}

function datePart(value: string) {
  return value.includes("T") ? value.split("T")[0] : "";
}

function timePart(value: string) {
  return value.includes("T") ? value.split("T")[1] : "";
}

function combineDateTime(date: string, time: string) {
  if (!date && !time) return "";
  return `${date || ""}T${time || ""}`;
}

function employeeColor(userId: number) {
  return EMPLOYEE_COLORS[Math.abs(userId) % EMPLOYEE_COLORS.length];
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "T"
  );
}

export default function ShiftsManager() {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<ShiftUser[]>([]);
  const [loanBalances, setLoanBalances] = useState<Record<number, number>>({});
  const [summary, setSummary] = useState<Summary>({
    shifts: 0,
    total: 0,
    paid: 0,
    pending: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [userFilter, setUserFilter] = useState("ALL");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/turnos?month=${encodeURIComponent(month)}`,
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible cargar los turnos.");
      }

      setShifts(data.shifts ?? []);
      setUsers(data.users ?? []);
      setLoanBalances(data.loanBalances ?? {});
      setSummary(
        data.summary ?? {
          shifts: 0,
          total: 0,
          paid: 0,
          pending: 0,
        },
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar los turnos.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [month]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const filteredShifts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");

    return shifts.filter((shift) => {
      if (statusFilter !== "ALL" && shift.status !== statusFilter) {
        return false;
      }

      if (
        userFilter !== "ALL" &&
        shift.user.id !== Number(userFilter)
      ) {
        return false;
      }

      if (
        normalized &&
        !(
          shift.user.name +
          " " +
          (shift.notes ?? "")
        )
          .toLocaleLowerCase("es")
          .includes(normalized)
      ) {
        return false;
      }

      return true;
    });
  }, [query, shifts, statusFilter, userFilter]);

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, Shift[]>();

    for (const shift of filteredShifts) {
      const key = dayKey(shift.startsAt);
      const current = map.get(key) ?? [];
      current.push(shift);
      map.set(key, current);
    }

    return map;
  }, [filteredShifts]);

  const workerTotals = useMemo(() => {
    const grouped = new Map<
      number,
      {
        userId: number;
        name: string;
        shifts: number;
        total: number;
        paid: number;
        pending: number;
        loanBalance: number;
        netToPay: number;
      }
    >();

    for (const shift of shifts) {
      const current = grouped.get(shift.user.id) ?? {
        userId: shift.user.id,
        name: shift.user.name,
        shifts: 0,
        total: 0,
        paid: 0,
        pending: 0,
        loanBalance: loanBalances[shift.user.id] ?? 0,
        netToPay: 0,
      };

      current.shifts += 1;
      current.total += shift.amount;
      if (shift.status === "PAID") current.paid += shift.amount;
      else current.pending += shift.amount;

      current.netToPay = Math.max(0, current.total - current.loanBalance);
      grouped.set(shift.user.id, current);
    }

    return [...grouped.values()].sort(
      (a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"),
    );
  }, [loanBalances, shifts]);

  const selectedWorker = useMemo(
    () =>
      selectedWorkerId == null
        ? null
        : workerTotals.find((worker) => worker.userId === selectedWorkerId) ?? null,
    [selectedWorkerId, workerTotals],
  );

  const selectedWorkerShifts = useMemo(
    () =>
      selectedWorkerId == null
        ? []
        : shifts
            .filter((shift) => shift.user.id === selectedWorkerId)
            .sort(
              (a, b) =>
                new Date(a.startsAt).getTime() -
                new Date(b.startsAt).getTime(),
            ),
    [selectedWorkerId, shifts],
  );

  const calendarDays = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const first = new Date(year, monthNumber - 1, 1);
    const last = new Date(year, monthNumber, 0);
    const mondayIndex = (first.getDay() + 6) % 7;
    const totalCells = Math.ceil((mondayIndex + last.getDate()) / 7) * 7;
    const result: Array<{
      date: Date;
      key: string;
      inMonth: boolean;
    }> = [];

    for (let index = 0; index < totalCells; index += 1) {
      const date = new Date(
        year,
        monthNumber - 1,
        1 - mondayIndex + index,
      );
      result.push({
        date,
        key: [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-"),
        inMonth: date.getMonth() === monthNumber - 1,
      });
    }

    return result;
  }, [month]);

  function moveMonth(offset: number) {
    const [year, currentMonth] = month.split("-").map(Number);
    setMonth(monthKey(new Date(year, currentMonth - 1 + offset, 1)));
  }

  function openCreate() {
    setNotice("");
    setError("");
    setEditor({
      userId: "",
      startsAt: "",
      endsAt: "",
      amount: "",
      notes: "",
    });
  }

  function openEdit(shift: Shift) {
    setNotice("");
    setError("");
    setEditor({
      id: shift.id,
      userId: shift.user.id,
      startsAt: localInputValue(shift.startsAt),
      endsAt: localInputValue(shift.endsAt),
      amount: String(Math.round(shift.amount)),
      notes: shift.notes ?? "",
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor || saving) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        editor.id ? `/api/turnos/${editor.id}` : "/api/turnos",
        {
          method: editor.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: editor.userId,
            startsAt: bogotaIso(editor.startsAt),
            endsAt: bogotaIso(editor.endsAt),
            amount: Number(editor.amount),
            notes: editor.notes,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible guardar el turno.");
      }

      setEditor(null);
      setNotice(editor.id ? "Turno actualizado." : "Turno creado.");
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible guardar el turno.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePayment(shift: Shift) {
    if (busyId) return;
    setBusyId(shift.id);
    setError("");

    try {
      const response = await fetch(`/api/turnos/${shift.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-payment" }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible cambiar el estado de pago.",
        );
      }

      setNotice(
        data.shift?.status === "PAID"
          ? "Turno marcado como pagado."
          : "Turno marcado como pendiente.",
      );
      await load();
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "No fue posible cambiar el pago.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function removeShift() {
    if (!editor?.id || saving) return;

    const accepted = window.confirm(
      "¿Eliminar este turno? Esta acción no se puede deshacer.",
    );
    if (!accepted) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/turnos/${editor.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible eliminar el turno.");
      }

      setEditor(null);
      setNotice("Turno eliminado.");
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No fue posible eliminar el turno.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen p-3 md:p-5 xl:p-6">
      <div className="space-y-4">
        <header className="relative min-h-[116px] overflow-hidden rounded-[24px] border border-black/5 bg-[#0a0a0b] text-white shadow-[0_14px_36px_rgba(20,16,14,.11)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_42%,rgba(226,26,34,.55),transparent_25%),radial-gradient(circle_at_68%_100%,rgba(132,12,16,.36),transparent_34%),linear-gradient(105deg,#111319_0%,#101116_43%,#1a0b0d_67%,#5a090c_100%)]" />
          <div className="absolute inset-y-0 right-0 w-[46%] opacity-70 [background:linear-gradient(115deg,transparent_0%,rgba(255,255,255,.025)_28%,transparent_29%),repeating-linear-gradient(90deg,transparent_0_54px,rgba(255,255,255,.025)_55px_56px)]" />
          <div className="absolute right-[24%] top-[-18px] h-20 w-20 rounded-full bg-red-500/10 blur-2xl" />
          <div className="absolute right-[9%] top-[22px] h-[2px] w-[30%] bg-gradient-to-r from-transparent via-red-300/40 to-transparent" />

          <div className="relative flex min-h-[116px] flex-col justify-between gap-4 px-5 py-4 md:flex-row md:items-center md:px-6 xl:px-7">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="h-[2px] w-7 rounded-full bg-[var(--brand-red)]" />
                <p className="alento-ui-label uppercase tracking-[0.2em] text-white/55">
                  Personal
                </p>
              </div>

              <h1 className="alento-ui-hero-title mt-1.5">
                Turnos
              </h1>

              <p className="alento-ui-hero-subtitle mt-1.5 text-white/60">
                Programa al equipo, controla el valor de cada turno y su estado de pago.
              </p>
            </div>

            <div className="flex items-center justify-end self-end md:self-auto">
              <button
                type="button"
                onClick={openCreate}
                aria-label="Crear turno"
                title="Crear turno"
                className="group inline-flex h-[56px] w-[76px] shrink-0 items-center justify-center rounded-[16px] border border-red-400/45 bg-[linear-gradient(135deg,rgba(236,25,31,.96),rgba(119,12,16,.82))] text-white shadow-[0_10px_22px_rgba(168,11,16,.25),inset_0_1px_0_rgba(255,255,255,.13)] transition hover:-translate-y-0.5 hover:border-red-300/70 hover:brightness-110 active:translate-y-0"
              >
                <CalendarDays
                  className="h-[22px] w-[22px]"
                  strokeWidth={2.15}
                />
              </button>
            </div>
          </div>
        </header>

        {(error || notice) && (
          <div className="fixed right-4 top-4 z-[220] max-w-[360px] animate-[fadeIn_.18s_ease-out]">
            <div
              className={
                "flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 shadow-[0_18px_50px_rgba(0,0,0,.18)] backdrop-blur " +
                (error
                  ? "border-red-200 bg-red-50/95 text-red-700"
                  : "border-emerald-200 bg-emerald-50/95 text-emerald-700")
              }
            >
              <span
                className={
                  "mt-0.5 h-2 w-2 shrink-0 rounded-full " +
                  (error ? "bg-red-500" : "bg-emerald-500")
                }
              />
              <p className="min-w-0 flex-1 alento-ui-micro font-bold leading-4">
                {error || notice}
              </p>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setNotice("");
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-current/55 hover:bg-black/5 hover:text-current"
                aria-label="Cerrar notificación"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Turnos del mes"
            value={String(summary.shifts)}
            note={monthTitle(month)}
            icon={<CalendarDays className="h-4 w-4" />}
          />
          <SummaryCard
            label="Valor programado"
            value={money(summary.total)}
            note="Costo total de los turnos del mes."
            icon={<DollarSign className="h-4 w-4" />}
          />
          <SummaryCard
            label="Pagado"
            value={money(summary.paid)}
            note="Turnos marcados como pagados."
            icon={<WalletCards className="h-4 w-4" />}
            positive
          />
          <SummaryCard
            label="Pendiente"
            value={money(summary.pending)}
            note="Valor que todavía falta pagar."
            icon={<Clock3 className="h-4 w-4" />}
            alert
          />
        </section>

        <section className="rounded-[24px] border border-neutral-200 bg-white p-3 shadow-[0_10px_30px_rgba(28,23,20,.04)]">
          <div className="grid gap-2 xl:grid-cols-[1fr_220px_180px_auto]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar trabajador o nota..."
                className="alento-input h-11 w-full rounded-xl pl-11 pr-4 alento-ui-control"
              />
            </div>

            <select
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              className="alento-input h-11 rounded-xl px-3 alento-ui-label font-semibold"
            >
              <option value="ALL">Todos los trabajadores</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="alento-input h-11 rounded-xl px-3 alento-ui-label font-semibold"
            >
              <option value="ALL">Todos los pagos</option>
              <option value="PENDING">Pendientes</option>
              <option value="PAID">Pagados</option>
            </select>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-[150px] text-center">
                <b className="block alento-ui-control capitalize text-neutral-900">
                  {monthTitle(month)}
                </b>
              </div>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_12px_34px_rgba(28,23,20,.045)]">
          <div className="grid grid-cols-7 border-b border-neutral-200 bg-[#faf9f7]">
            {["lun.", "mar.", "mié.", "jue.", "vie.", "sáb.", "dom."].map(
              (day) => (
                <div
                  key={day}
                  className="border-r border-neutral-200 px-2 py-2.5 text-center alento-ui-label uppercase tracking-[.08em] text-neutral-400 last:border-r-0"
                >
                  {day}
                </div>
              ),
            )}
          </div>

          {loading ? (
            <div className="flex min-h-[520px] items-center justify-center text-sm font-semibold text-neutral-400">
              Cargando calendario...
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                const dayShifts = shiftsByDay.get(day.key) ?? [];
                const today = day.key === dayKey(new Date().toISOString());

                return (
                  <div
                    key={day.key}
                    className={
                      "min-h-[138px] border-b border-r border-neutral-200 p-1.5 last:border-r-0 " +
                      (!day.inMonth
                        ? "bg-neutral-50/65"
                        : today
                          ? "bg-red-50/45"
                          : "bg-white")
                    }
                  >
                    <div className="mb-1 flex justify-end">
                      <span
                        className={
                          "flex h-6 min-w-6 items-center justify-center rounded-full px-1 alento-ui-micro font-bold " +
                          (today
                            ? "bg-[var(--brand-red)] text-white"
                            : day.inMonth
                              ? "text-neutral-700"
                              : "text-neutral-300")
                        }
                      >
                        {day.date.getDate()}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {dayShifts.map((shift) => (
                        <button
                          type="button"
                          key={shift.id}
                          onClick={() => openEdit(shift)}
                          className={
                            "block w-full overflow-hidden rounded-lg px-2 py-1.5 text-left text-white shadow-sm transition hover:brightness-95 " +
                            employeeColor(shift.user.id)
                          }
                        >
                          <div className="flex items-center justify-between gap-1">
                            <b className="truncate alento-ui-label">
                              {shift.user.name}
                            </b>
                            <span
                              className={
                                "h-1.5 w-1.5 shrink-0 rounded-full " +
                                (shift.status === "PAID"
                                  ? "bg-emerald-200"
                                  : "bg-amber-200")
                              }
                            />
                          </div>
                          <span className="mt-0.5 block truncate alento-ui-micro font-semibold text-white/80">
                            {timeLabel(shift.startsAt)}–{timeLabel(shift.endsAt)} · {money(shift.amount)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-[24px] border border-neutral-200 bg-white p-4 shadow-[0_10px_30px_rgba(28,23,20,.04)]">
          <div className="flex items-end justify-between gap-3 border-b border-neutral-100 pb-3">
            <div>
              <p className="alento-ui-label uppercase tracking-[.14em] text-neutral-400">
                Consolidado
              </p>
              <h2 className="mt-1 text-xl font-black">
                Personal de {monthTitle(month)}
              </h2>
              <p className="mt-1 alento-ui-micro text-neutral-400">
                Toca un trabajador para ver todos sus turnos del mes.
              </p>
            </div>
            <b className="alento-ui-control text-neutral-400">
              {workerTotals.length}
            </b>
          </div>

          {workerTotals.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-neutral-200 py-8 text-center alento-ui-label text-neutral-400">
              No hay turnos programados para este mes.
            </div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {workerTotals.map((worker) => (
                <button
                  type="button"
                  key={worker.userId}
                  onClick={() => setSelectedWorkerId(worker.userId)}
                  className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3.5 text-left transition hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-white hover:shadow-[0_10px_24px_rgba(28,23,20,.07)]"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl alento-ui-micro font-black text-white " +
                        employeeColor(worker.userId)
                      }
                    >
                      {initials(worker.name)}
                    </span>
                    <div className="min-w-0">
                      <b className="block truncate alento-ui-label text-neutral-950">
                        {worker.name}
                      </b>
                      <span className="alento-ui-micro text-neutral-400">
                        {worker.shifts} turno{worker.shifts === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  <b className="mt-3 block text-[18px] font-black text-neutral-950">
                    {money(worker.total)}
                  </b>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 alento-ui-micro font-semibold">
                    <span className="text-emerald-700">
                      Pagado {money(worker.paid)}
                    </span>
                    <span className="text-amber-700">
                      Pendiente {money(worker.pending)}
                    </span>
                  </div>

                  <div className="mt-2 border-t border-neutral-200 pt-2">
                    <div className="flex items-center justify-between gap-2 alento-ui-micro font-semibold">
                      <span className="text-rose-600">Préstamos</span>
                      <b className="text-rose-700">
                        {money(worker.loanBalance)}
                      </b>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 alento-ui-label">
                      <span className="text-neutral-500">Neto estimado</span>
                      <b className="text-neutral-950">
                        {money(worker.netToPay)}
                      </b>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedWorker && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/65 p-3 backdrop-blur-[3px]">
          <section className="flex max-h-[92dvh] w-full max-w-[980px] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_100px_rgba(0,0,0,.34)]">
            <header className="relative overflow-hidden bg-[radial-gradient(circle_at_88%_18%,rgba(226,26,34,.36),transparent_28%),linear-gradient(135deg,#09090a,#1a1112)] px-5 py-5 text-white">
              <button
                type="button"
                onClick={() => setSelectedWorkerId(null)}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[.07]"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3">
                <span
                  className={
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl alento-ui-label font-black text-white " +
                    employeeColor(selectedWorker.userId)
                  }
                >
                  {initials(selectedWorker.name)}
                </span>
                <div className="min-w-0">
                  <p className="alento-ui-label uppercase tracking-[.16em] text-white/40">
                    Historial de turnos
                  </p>
                  <h2 className="mt-1 truncate text-[24px] font-black tracking-[-.03em]">
                    {selectedWorker.name}
                  </h2>
                  <p className="mt-1 alento-ui-micro capitalize text-white/55">
                    {monthTitle(month)} · {selectedWorker.shifts} turno{selectedWorker.shifts === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-2 gap-2 border-b border-neutral-100 bg-[#faf9f7] p-3 sm:grid-cols-5">
              <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
                <span className="alento-ui-micro uppercase tracking-[.1em] text-neutral-400">
                  Total
                </span>
                <b className="mt-1 block text-[15px] font-black text-neutral-950">
                  {money(selectedWorker.total)}
                </b>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">
                <span className="alento-ui-micro uppercase tracking-[.1em] text-emerald-600">
                  Pagado
                </span>
                <b className="mt-1 block text-[15px] font-black text-emerald-700">
                  {money(selectedWorker.paid)}
                </b>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                <span className="alento-ui-micro uppercase tracking-[.1em] text-amber-600">
                  Pendiente
                </span>
                <b className="mt-1 block text-[15px] font-black text-amber-700">
                  {money(selectedWorker.pending)}
                </b>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="space-y-2">
                {selectedWorkerShifts.map((shift) => (
                  <article
                    key={shift.id}
                    className="grid gap-3 rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3 md:grid-cols-[140px_1fr_150px_130px_100px] md:items-center"
                  >
                    <div>
                      <b className="block alento-ui-label text-neutral-950">
                        {dayKey(shift.startsAt)}
                      </b>
                      <span className="mt-0.5 block alento-ui-label text-neutral-400">
                        {timeLabel(shift.startsAt)} – {timeLabel(shift.endsAt)}
                      </span>
                    </div>

                    <p className="truncate alento-ui-micro text-neutral-500">
                      {shift.notes || "Sin nota"}
                    </p>

                    <b className="alento-ui-control text-neutral-900">
                      {money(shift.amount)}
                    </b>

                    <button
                      type="button"
                      disabled={busyId === shift.id}
                      onClick={() => void togglePayment(shift)}
                      className={
                        "h-9 rounded-xl px-3 alento-ui-label disabled:opacity-50 " +
                        (shift.status === "PAID"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700")
                      }
                    >
                      {busyId === shift.id
                        ? "Guardando..."
                        : shift.status === "PAID"
                          ? "PAGADO"
                          : "PENDIENTE"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWorkerId(null);
                        openEdit(shift);
                      }}
                      className="h-9 rounded-xl border border-neutral-200 bg-white px-3 alento-ui-label text-neutral-600"
                    >
                      Editar
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {editor && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/65 p-3 backdrop-blur-[3px]">
          <form
            onSubmit={save}
            className="flex max-h-[94dvh] w-full max-w-[920px] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_100px_rgba(0,0,0,.34)]"
          >
            <header className="relative overflow-hidden bg-[radial-gradient(circle_at_90%_15%,rgba(226,26,34,.36),transparent_28%),linear-gradient(135deg,#09090a,#1a1112)] px-5 py-5 text-white">
              <button
                type="button"
                onClick={() => !saving && setEditor(null)}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[.07]"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>

              <p className="alento-ui-label uppercase tracking-[.16em] text-white/40">
                {editor.id ? "Editar turno" : "Nuevo turno"}
              </p>
              <h2 className="mt-1 text-[26px] font-black tracking-[-.035em]">
                Registro de turno
              </h2>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid gap-4">
                <label>
                  <span className="alento-ui-label font-bold text-neutral-700">
                    Trabajador
                  </span>
                  <div className="relative mt-2">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <select
                      required
                      value={editor.userId}
                      onChange={(event) =>
                        setEditor({
                          ...editor,
                          userId: event.target.value
                            ? Number(event.target.value)
                            : "",
                        })
                      }
                      className="alento-input h-12 w-full rounded-xl pl-11 pr-4 text-sm"
                    >
                      <option value="">Selecciona trabajador</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <section className="rounded-[20px] border border-neutral-200 bg-[#faf9f7] p-4">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-[var(--brand-red)]" />
                    <div>
                      <p className="alento-ui-micro font-black uppercase tracking-[.12em] text-neutral-500">
                        Horario
                      </p>
                      <p className="mt-0.5 alento-ui-micro text-neutral-400">
                        Selecciona primero la fecha y luego la hora.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-3.5">
                      <p className="alento-ui-micro font-black uppercase tracking-[.1em] text-neutral-500">
                        Entrada
                      </p>

                      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
                        <label>
                          <span className="alento-ui-micro font-bold text-neutral-600">
                            Fecha
                          </span>
                          <input
                            required
                            type="date"
                            value={datePart(editor.startsAt)}
                            onChange={(event) => {
                              const nextDate = event.target.value;
                              const nextStart = combineDateTime(
                                nextDate,
                                timePart(editor.startsAt),
                              );
                              const shouldCopyDate =
                                !datePart(editor.endsAt) ||
                                datePart(editor.endsAt) ===
                                  datePart(editor.startsAt);

                              setEditor({
                                ...editor,
                                startsAt: nextStart,
                                endsAt: shouldCopyDate
                                  ? combineDateTime(
                                      nextDate,
                                      timePart(editor.endsAt),
                                    )
                                  : editor.endsAt,
                              });
                            }}
                            className="alento-input mt-1.5 h-12 w-full rounded-xl px-3 text-sm font-semibold"
                          />
                        </label>

                        <label>
                          <span className="alento-ui-micro font-bold text-neutral-600">
                            Hora
                          </span>
                          <input
                            required
                            type="time"
                            step={300}
                            value={timePart(editor.startsAt)}
                            onChange={(event) =>
                              setEditor({
                                ...editor,
                                startsAt: combineDateTime(
                                  datePart(editor.startsAt),
                                  event.target.value,
                                ),
                              })
                            }
                            className="alento-input mt-1.5 h-12 w-full rounded-xl px-3 text-sm font-black"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-neutral-200 bg-white p-3.5">
                      <p className="alento-ui-micro font-black uppercase tracking-[.1em] text-neutral-500">
                        Salida
                      </p>

                      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]">
                        <label>
                          <span className="alento-ui-micro font-bold text-neutral-600">
                            Fecha
                          </span>
                          <input
                            required
                            type="date"
                            value={datePart(editor.endsAt)}
                            onChange={(event) =>
                              setEditor({
                                ...editor,
                                endsAt: combineDateTime(
                                  event.target.value,
                                  timePart(editor.endsAt),
                                ),
                              })
                            }
                            className="alento-input mt-1.5 h-12 w-full rounded-xl px-3 text-sm font-semibold"
                          />
                        </label>

                        <label>
                          <span className="alento-ui-micro font-bold text-neutral-600">
                            Hora
                          </span>
                          <input
                            required
                            type="time"
                            step={300}
                            value={timePart(editor.endsAt)}
                            onChange={(event) =>
                              setEditor({
                                ...editor,
                                endsAt: combineDateTime(
                                  datePart(editor.endsAt) ||
                                    datePart(editor.startsAt),
                                  event.target.value,
                                ),
                              })
                            }
                            className="alento-input mt-1.5 h-12 w-full rounded-xl px-3 text-sm font-black"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </section>

                <label>
                  <span className="alento-ui-label font-bold text-neutral-700">
                    Valor del turno
                  </span>
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-neutral-400">
                      $
                    </span>
                    <input
                      required
                      min={0}
                      step={100}
                      type="number"
                      value={editor.amount}
                      onChange={(event) =>
                        setEditor({
                          ...editor,
                          amount: event.target.value,
                        })
                      }
                      placeholder="0"
                      className="alento-input h-12 w-full rounded-xl pl-8 pr-4 text-lg font-black"
                    />
                  </div>
                </label>

                <label>
                  <span className="alento-ui-label font-bold text-neutral-700">
                    Nota · opcional
                  </span>
                  <textarea
                    value={editor.notes}
                    maxLength={240}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        notes: event.target.value,
                      })
                    }
                    className="alento-input mt-2 min-h-[84px] w-full resize-none rounded-xl px-4 py-3 text-sm"
                    placeholder="Ej. turno de cierre, reemplazo, festivo..."
                  />
                </label>
              </div>
            </div>

            <footer className="flex flex-col gap-2 border-t border-neutral-100 bg-[#faf9f7] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {editor.id && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void removeShift()}
                    className="h-11 rounded-xl border border-red-200 bg-red-50 px-4 alento-ui-micro font-black text-red-700"
                  >
                    Eliminar turno
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditor(null)}
                  className="h-11 rounded-xl border border-neutral-200 bg-white px-5 alento-ui-label font-black text-neutral-600"
                >
                  Cancelar
                </button>
                <button
                  disabled={saving}
                  className="h-11 rounded-xl bg-[var(--brand-red)] px-5 alento-ui-label font-black text-white disabled:opacity-50"
                >
                  {saving
                    ? "Guardando..."
                    : editor.id
                      ? "Guardar cambios"
                      : "Crear turno"}
                </button>
              </div>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  note,
  icon,
  positive = false,
  alert = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  positive?: boolean;
  alert?: boolean;
}) {
  return (
    <article className="rounded-[18px] border border-neutral-200 bg-white px-4 py-3.5 shadow-[0_8px_22px_rgba(28,23,20,.035)]">
      <div className="flex items-center justify-between">
        <span className="alento-ui-label uppercase tracking-[.13em] text-neutral-400">
          {label}
        </span>
        <span
          className={
            "flex h-8 w-8 items-center justify-center rounded-[10px] " +
            (positive
              ? "bg-emerald-50 text-emerald-600"
              : alert
                ? "bg-amber-50 text-amber-600"
                : "bg-neutral-100 text-neutral-500")
          }
        >
          {icon}
        </span>
      </div>
      <b
        className={
          "mt-2 block text-[22px] font-black leading-none tracking-[-.04em] " +
          (positive
            ? "text-emerald-700"
            : alert
              ? "text-amber-700"
              : "text-neutral-950")
        }
      >
        {value}
      </b>
      <p className="mt-1.5 alento-ui-label leading-4 text-neutral-400">{note}</p>
    </article>
  );
}
