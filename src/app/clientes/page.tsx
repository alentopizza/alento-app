"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { orderCode } from "@/lib/orderCode";
import { fulfillmentLabel, statusLabel, type FulfillmentType, type OrderStatus } from "@/lib/orderWorkflow";

type CustomerAddress = {
  id: number;
  label?: string | null;
  address: string;
  neighborhood: string | null;
  city: string | null;
  notes: string | null;
  isDefault: boolean;
};

type CustomerMetrics = {
  purchaseCount: number;
  totalSpent: number;
  averageTicket: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  frequencyDays: number | null;
};

type Customer = {
  id: number;
  name: string;
  countryCode: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt?: string;
  addresses: CustomerAddress[];
  _count: { orders: number };
  metrics: CustomerMetrics;
};

type CustomerOrder = {
  id: number;
  sequenceNumber: number | null;
  source: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  total: number | string;
  createdAt: string;
  items: {
    id: number;
    productName: string;
    quantity: number;
    lineTotal: number | string;
  }[];
};

type CustomerDetail = Customer & {
  orders: CustomerOrder[];
};

type CustomerStatusFilter = "ALL" | "Nuevo" | "Activo" | "Frecuente" | "Por recuperar" | "Sin compras";

type ImportPreviewRow = {
  rowNumber: number;
  name: string;
  countryCode: string;
  phone: string;
  email: string;
  address: string;
};

type ImportIssue = {
  rowNumber: number;
  name: string;
  phone: string;
  reason: string;
};

type ImportPreview = {
  summary: {
    totalRows: number;
    toCreate: number;
    skipped: number;
  };
  preview: ImportPreviewRow[];
  issues: ImportIssue[];
};

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

const shortDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Sin compras";

const dateTime = (value: string) =>
  new Date(value).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function daysSince(value: string | null) {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
}

function customerSignal(metrics: CustomerMetrics) {
  if (metrics.purchaseCount === 0) {
    return { label: "Sin compras", tone: "bg-neutral-100 text-neutral-600 border-neutral-200" };
  }

  const inactiveDays = daysSince(metrics.lastOrderAt);
  if (metrics.purchaseCount === 1) {
    return { label: "Nuevo", tone: "bg-sky-50 text-sky-700 border-sky-200" };
  }

  const expected = metrics.frequencyDays ?? 30;
  const rescueThreshold = Math.max(21, Math.round(expected * 1.6));
  if (inactiveDays !== null && inactiveDays > rescueThreshold) {
    return { label: "Por recuperar", tone: "bg-rose-50 text-rose-700 border-rose-200" };
  }

  if (metrics.purchaseCount >= 4) {
    return { label: "Frecuente", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }

  return { label: "Activo", tone: "bg-amber-50 text-amber-700 border-amber-200" };
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-neutral-200 bg-[#faf9f7] px-3.5 py-3 [font-synthesis:none]">
      <span className="block text-[9px] font-semibold uppercase tracking-[0.085em] text-neutral-400">{label}</span>
      <b className="mt-1.5 block truncate text-[17px] font-bold leading-none tracking-[-0.015em] text-neutral-950">{value}</b>
      {hint && <span className="mt-1.5 block truncate text-[10px] text-neutral-400">{hint}</span>}
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatusFilter>("ALL");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [selected, setSelected] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+57");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  async function loadCustomers() {
    setLoading(true);
    try {
      const response = await fetch("/api/customers?all=1", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar los clientes.");
      setCustomers(data.customers ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCustomers();
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<Exclude<CustomerStatusFilter, "ALL">, number> = {
      Nuevo: 0,
      Activo: 0,
      Frecuente: 0,
      "Por recuperar": 0,
      "Sin compras": 0,
    };

    customers.forEach((customer) => {
      const label = customerSignal(customer.metrics).label as Exclude<CustomerStatusFilter, "ALL">;
      counts[label] += 1;
    });

    return counts;
  }, [customers]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();

    return customers.filter((customer) => {
      const signal = customerSignal(customer.metrics).label;
      if (statusFilter !== "ALL" && signal !== statusFilter) return false;
      if (!value) return true;

      return [
        customer.name,
        customer.phone,
        customer.email,
        customer.addresses?.[0]?.address,
        customer.notes,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    });
  }, [customers, query, statusFilter]);

  async function openCustomer(customer: Customer) {
    setDetailLoading(true);
    setDetailError("");
    try {
      const response = await fetch(`/api/customers/${customer.id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar el cliente.");
      setSelected(data.customer);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No fue posible cargar el cliente.");
    } finally {
      setDetailLoading(false);
    }
  }

  function openEdit(customer: Customer | CustomerDetail) {
    setEditing(customer);
    setName(customer.name);
    setCountryCode(customer.countryCode || "+57");
    setPhone(customer.phone || "");
    setAddress(customer.addresses?.[0]?.address || "");
    setEmail(customer.email || "");
    setNotes(customer.notes || "");
    setMessage("");
  }

  function closeEdit() {
    if (saving) return;
    setEditing(null);
    setMessage("");
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/customers/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, countryCode, phone, address, email, notes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible actualizar el cliente.");
      setEditing(null);
      await loadCustomers();
      if (selected?.id === editing.id) {
        await openCustomer({ ...editing, ...data.customer, metrics: editing.metrics });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible actualizar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function exportCustomers() {
    setDetailError("");
    try {
      const response = await fetch("/api/customers/export", { cache: "no-store" });
      if (!response.ok) throw new Error("No fue posible exportar los clientes.");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "clientes-alento.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No fue posible exportar los clientes.");
    }
  }

  async function downloadCustomerTemplate() {
    try {
      const response = await fetch("/api/customers/import/template", { cache: "no-store" });
      if (!response.ok) throw new Error("No fue posible descargar la plantilla.");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "template-clientes-alento.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "No fue posible descargar la plantilla.");
    }
  }

  async function deleteCustomer(customer: Customer | CustomerDetail) {
    const orderCount = customer._count.orders;
    const warning = orderCount > 0
      ? `¿Eliminar a ${customer.name}? Sus ${orderCount} pedido(s) se conservarán, pero quedarán sin cliente asociado. Esta acción no se puede deshacer.`
      : `¿Eliminar a ${customer.name}? Esta acción no se puede deshacer.`;

    if (!window.confirm(warning)) return;

    try {
      const response = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible eliminar el cliente.");
      setSelected(null);
      await loadCustomers();
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No fue posible eliminar el cliente.");
    }
  }

  function closeImport() {
    if (importBusy) return;
    setImportOpen(false);
    setImportFile(null);
    setImportPreview(null);
    setImportMessage("");
  }

  async function previewImport(file: File) {
    setImportBusy(true);
    setImportMessage("");
    setImportPreview(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("action", "preview");
      const response = await fetch("/api/customers/import", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible analizar el archivo.");
      setImportPreview(data);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "No fue posible analizar el archivo.");
    } finally {
      setImportBusy(false);
    }
  }

  async function confirmImport() {
    if (!importFile || !importPreview || importPreview.summary.toCreate === 0) return;
    setImportBusy(true);
    setImportMessage("");
    try {
      const formData = new FormData();
      formData.set("file", importFile);
      formData.set("action", "import");
      const response = await fetch("/api/customers/import", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible importar los clientes.");
      await loadCustomers();
      setImportMessage(`Importación terminada: ${data.imported} clientes creados y ${data.skipped} omitidos.`);
      setImportPreview(null);
      setImportFile(null);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "No fue posible importar los clientes.");
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f4f2] p-4 lg:p-6">
      <div className="mx-auto max-w-[1540px] space-y-4">
        <section className="alento-dark rounded-[28px] px-7 py-5 md:px-8 md:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Relación con clientes</p>
              <h1 className="mt-0.5 text-3xl font-black tracking-[-0.035em]">Clientes</h1>
              <p className="mt-1 text-sm text-white/65">Conoce quién compra, cuánto vuelve y dónde existe una oportunidad de recuperar ventas.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] px-3.5 text-[10px] font-bold uppercase tracking-[0.05em] text-white transition hover:bg-white/[0.13]"
              >
                Importar
              </button>
              <button
                type="button"
                onClick={() => void exportCustomers()}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] px-3.5 text-[10px] font-bold uppercase tracking-[0.05em] text-white transition hover:bg-white/[0.13]"
              >
                Exportar
              </button>
              <div className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2.5 text-center shadow-inner">
                <span className="block text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">Clientes</span>
                <b className="mt-0.5 block text-[28px] font-black leading-none tabular-nums text-white">{customers.length}</b>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-sm">
          <div className="relative">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-xl border border-neutral-200 bg-[#faf9f7] pl-11 pr-4 text-sm outline-none transition focus:border-neutral-400 focus:bg-white"
              placeholder="Buscar por nombre, teléfono, correo, dirección o nota"
            />
          </div>

          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
            {([
              ["ALL", "Todos", customers.length],
              ["Nuevo", "Nuevo", statusCounts.Nuevo],
              ["Activo", "Activo", statusCounts.Activo],
              ["Frecuente", "Frecuente", statusCounts.Frecuente],
              ["Por recuperar", "Por recuperar", statusCounts["Por recuperar"]],
              ["Sin compras", "Sin compras", statusCounts["Sin compras"]],
            ] as [CustomerStatusFilter, string, number][]).map(([value, label, count]) => {
              const active = statusFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.035em] transition ${active ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}
                >
                  <span>{label}</span>
                  <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${active ? "bg-white/15 text-white" : "bg-neutral-100 text-neutral-500"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">Cargando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-400">No hay clientes para mostrar.</div>
        ) : (
          <section className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((customer) => {
              const signal = customerSignal(customer.metrics);

              return (
                <article
                  key={customer.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void openCustomer(customer)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") void openCustomer(customer);
                  }}
                  className="group cursor-pointer overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-[0_10px_26px_rgba(28,23,20,.045)] transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_16px_34px_rgba(28,23,20,.08)]"
                >
                  <div className="p-5 [font-synthesis:none]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-[#f8f7f5] p-3.5 shadow-[0_6px_18px_rgba(28,23,20,.035)]">
                        <div className="flex min-w-0 items-center gap-3.5">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-[17px] font-bold text-neutral-900 shadow-sm">
                            {customer.name.trim().charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h2 className="truncate text-[18px] font-bold leading-6 tracking-[-0.02em] text-neutral-950">{customer.name}</h2>
                            <div className="mt-1.5 grid gap-1">
                              <p className="relative truncate pl-3 text-[12px] font-medium leading-4 text-neutral-500 before:absolute before:left-0 before:top-[6px] before:h-1 before:w-1 before:rounded-full before:bg-neutral-400">
                                {customer.countryCode} {customer.phone || "Sin teléfono"}
                              </p>
                              <p className="relative truncate pl-3 text-[12px] font-medium leading-4 text-neutral-500 before:absolute before:left-0 before:top-[6px] before:h-1 before:w-1 before:rounded-full before:bg-neutral-400">
                                {customer.addresses?.[0]?.address || "Sin dirección registrada"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.06em] ${signal.tone}`}>{signal.label}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2.5">
                      <Metric label="Compras" value={String(customer.metrics.purchaseCount)} />
                      <Metric label="Ticket promedio" value={money(customer.metrics.averageTicket)} />
                      <Metric label="Total comprado" value={money(customer.metrics.totalSpent)} />
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {importOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[3px]">
            <div className="max-h-[94vh] w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4 md:px-6">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-400">Base de clientes</p>
                  <h2 className="mt-0.5 text-2xl font-black tracking-[-0.025em]">Importar CSV</h2>
                  <p className="mt-1 text-xs text-neutral-500">Revisa los registros antes de agregarlos a Alentó. Los duplicados se omiten automáticamente.</p>
                </div>
                <button type="button" onClick={closeImport} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-lg font-bold text-neutral-700">×</button>
              </div>

              <div className="alento-scroll max-h-[68vh] overflow-y-auto px-5 py-4 md:px-6">
                <label className="block rounded-2xl border border-dashed border-neutral-300 bg-[#faf9f7] p-5 text-center transition hover:border-neutral-400">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setImportFile(file);
                      setImportPreview(null);
                      setImportMessage("");
                      if (file) void previewImport(file);
                    }}
                  />
                  <span className="block text-sm font-bold text-neutral-800">{importFile ? importFile.name : "Seleccionar archivo CSV"}</span>
                  <span className="mt-1 block text-[11px] text-neutral-500">Nombre, indicativo y teléfono son suficientes. Máximo 5 MB.</span>
                </label>

                <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <b className="block text-[12px] text-sky-950">¿No tienes el archivo preparado?</b>
                      <p className="mt-1 text-[10px] leading-4 text-sky-800">
                        Descarga la plantilla oficial con las columnas exactas y una fila de ejemplo.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void downloadCustomerTemplate()}
                      className="shrink-0 rounded-xl border border-sky-200 bg-white px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.04em] text-sky-700"
                    >
                      Descargar template
                    </button>
                  </div>

                  <div className="mt-3 overflow-x-auto rounded-xl border border-sky-100 bg-white">
                    <div className="min-w-[760px] px-3 py-2.5 font-mono text-[9px] leading-4 text-neutral-600">
                      Cliente/Nombre · Cliente/Indicativo · Cliente/Telefono · Cliente/Correo · Cliente/Dirección · Cliente/Complemento · Cliente/GPS Link · Cliente/Notas
                    </div>
                  </div>
                </div>

                {importBusy && (
                  <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-600">Analizando archivo...</div>
                )}

                {importMessage && (
                  <div className="mt-3 rounded-xl border border-neutral-200 bg-[#faf9f7] px-4 py-3 text-sm font-semibold text-neutral-700">{importMessage}</div>
                )}

                {importPreview && (
                  <>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <Metric label="Filas" value={String(importPreview.summary.totalRows)} />
                      <Metric label="Nuevos" value={String(importPreview.summary.toCreate)} />
                      <Metric label="Omitidos" value={String(importPreview.summary.skipped)} />
                    </div>

                    {importPreview.preview.length > 0 && (
                      <section className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
                        <div className="border-b border-neutral-100 bg-[#faf9f7] px-4 py-3">
                          <b className="text-xs text-neutral-800">Vista previa de clientes nuevos</b>
                        </div>
                        <div className="divide-y divide-neutral-100">
                          {importPreview.preview.map((row) => (
                            <div key={row.rowNumber} className="grid gap-1 px-4 py-3 sm:grid-cols-[1.2fr_.8fr_1.4fr] sm:items-center">
                              <div>
                                <b className="block text-[12px] text-neutral-900">{row.name}</b>
                                <span className="text-[10px] text-neutral-400">Fila {row.rowNumber}</span>
                              </div>
                              <span className="text-[11px] text-neutral-600">{row.countryCode} {row.phone}</span>
                              <span className="truncate text-[11px] text-neutral-500">{row.address || "Sin dirección"}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {importPreview.issues.length > 0 && (
                      <section className="mt-4 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60">
                        <div className="border-b border-amber-100 px-4 py-3">
                          <b className="text-xs text-amber-900">Registros que no se importarán</b>
                        </div>
                        <div className="max-h-52 divide-y divide-amber-100 overflow-y-auto">
                          {importPreview.issues.map((issue, index) => (
                            <div key={`${issue.rowNumber}-${index}`} className="px-4 py-2.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <b className="block truncate text-[11px] text-amber-950">{issue.name || "Sin nombre"}</b>
                                  <p className="mt-0.5 text-[10px] leading-4 text-amber-800">{issue.reason}</p>
                                </div>
                                <span className="shrink-0 text-[9px] font-semibold text-amber-600">Fila {issue.rowNumber}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-neutral-100 bg-[#faf9f7] px-5 py-4 md:px-6">
                <p className="text-[10px] leading-4 text-neutral-500">Los clientes existentes se conservan sin cambios para proteger su historial.</p>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={closeImport} className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700">Cancelar</button>
                  <button
                    type="button"
                    onClick={() => void confirmImport()}
                    disabled={importBusy || !importPreview || importPreview.summary.toCreate === 0}
                    className="rounded-xl bg-[var(--brand-red)] px-4 py-2.5 text-xs font-bold text-white disabled:bg-neutral-300"
                  >
                    {importBusy ? "Importando..." : importPreview ? `Importar ${importPreview.summary.toCreate}` : "Importar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {detailLoading && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 backdrop-blur-[2px]">
            <div className="rounded-2xl bg-white px-5 py-4 text-sm font-semibold shadow-2xl">Cargando perfil...</div>
          </div>
        )}

        {detailError && (
          <div className="fixed bottom-5 right-5 z-[100] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-lg">
            {detailError}
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-[3px]" onClick={() => setSelected(null)}>
            <aside
              onClick={(event) => event.stopPropagation()}
              className="absolute inset-y-0 right-0 flex w-full max-w-[720px] flex-col overflow-hidden bg-[#f5f2ee] shadow-[-24px_0_70px_rgba(0,0,0,.24)]"
            >
              <header className="alento-dark rounded-none px-5 py-5 md:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">Perfil del cliente</p>
                    <h2 className="mt-1 truncate text-2xl font-black tracking-[-0.03em]">{selected.name}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                      <span>{selected.countryCode} {selected.phone || "Sin teléfono"}</span>
                      {selected.email && <span>• {selected.email}</span>}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] text-lg text-white">×</button>
                </div>
              </header>

              <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
                <section className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                  <Metric label="Compras" value={String(selected.metrics.purchaseCount)} />
                  <Metric label="Ticket promedio" value={money(selected.metrics.averageTicket)} />
                  <Metric label="Total comprado" value={money(selected.metrics.totalSpent)} />
                  <Metric
                    label="Frecuencia"
                    value={selected.metrics.frequencyDays ? `Cada ${selected.metrics.frequencyDays} d` : "Sin patrón"}
                  />
                </section>

                <section className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm [font-synthesis:none]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-400">Seguimiento comercial</p>
                      <h3 className="mt-1 text-lg font-bold tracking-[-0.02em] text-neutral-950">
                        {customerSignal(selected.metrics).label}
                      </h3>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.06em] ${customerSignal(selected.metrics).tone}`}>
                      {selected.metrics.purchaseCount} compras
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl bg-[#faf9f7] p-3">
                      <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Primera compra</span>
                      <b className="mt-1 block text-[12px] text-neutral-800">{shortDate(selected.metrics.firstOrderAt)}</b>
                    </div>
                    <div className="rounded-xl bg-[#faf9f7] p-3">
                      <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Última compra</span>
                      <b className="mt-1 block text-[12px] text-neutral-800">{shortDate(selected.metrics.lastOrderAt)}</b>
                    </div>
                    <div className="rounded-xl bg-[#faf9f7] p-3">
                      <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Sin comprar</span>
                      <b className="mt-1 block text-[12px] text-neutral-800">
                        {daysSince(selected.metrics.lastOrderAt) === null ? "—" : `${daysSince(selected.metrics.lastOrderAt)} días`}
                      </b>
                    </div>
                  </div>
                </section>

                <section className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-400">Datos del cliente</p>
                      <h3 className="mt-1 text-base font-bold">Contacto y entrega</h3>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(selected)} className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[10px] font-bold text-neutral-700 shadow-sm">
                        Editar
                      </button>
                      <button
                        onClick={() => void deleteCustomer(selected)}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700 shadow-sm"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-[#faf9f7] p-3 text-[11px] text-neutral-600">
                      <span className="block text-[8px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Teléfono</span>
                      <b className="mt-1 block text-[12px] text-neutral-850">{selected.countryCode} {selected.phone || "Sin teléfono"}</b>
                    </div>
                    <div className="rounded-xl bg-[#faf9f7] p-3 text-[11px] text-neutral-600">
                      <span className="block text-[8px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Correo</span>
                      <b className="mt-1 block truncate text-[12px] text-neutral-850">{selected.email || "Sin correo"}</b>
                    </div>
                  </div>

                  <div className="mt-2 space-y-2">
                    {selected.addresses.length > 0 ? selected.addresses.map((item) => (
                      <div key={item.id} className="rounded-xl border border-neutral-100 bg-[#fcfbf9] px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <b className="text-[11px] text-neutral-850">{item.address}</b>
                          {item.isDefault && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[7px] font-bold uppercase text-neutral-500">Principal</span>}
                        </div>
                        {(item.neighborhood || item.city) && <p className="mt-1 text-[10px] text-neutral-500">{[item.neighborhood, item.city].filter(Boolean).join(" · ")}</p>}
                      </div>
                    )) : (
                      <div className="rounded-xl border border-dashed border-neutral-200 px-3 py-3 text-[11px] text-neutral-400">Sin dirección registrada.</div>
                    )}
                  </div>

                  {selected.notes && (
                    <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                      <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-amber-600">Nota</span>
                      <p className="mt-1 text-[11px] leading-4 text-amber-900">{selected.notes}</p>
                    </div>
                  )}
                </section>

                <section className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-400">Historial</p>
                      <h3 className="mt-0.5 text-base font-bold">Pedidos del cliente</h3>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-bold text-neutral-600">{selected.orders.length}</span>
                  </div>

                  {selected.orders.length === 0 ? (
                    <p className="p-5 text-sm text-neutral-400">Este cliente todavía no tiene compras registradas.</p>
                  ) : (
                    <div className="divide-y divide-neutral-100">
                      {selected.orders.map((order) => (
                        <div key={order.id} className="p-4 [font-synthesis:none]">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <b className="text-[13px] text-neutral-950">{orderCode(order.sequenceNumber ?? order.id, order.source)}</b>
                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[8px] font-semibold uppercase text-neutral-600">{fulfillmentLabel(order.fulfillmentType)}</span>
                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[8px] font-semibold uppercase text-neutral-600">{statusLabel(order.status)}</span>
                              </div>
                              <p className="mt-1 text-[10px] text-neutral-400">{dateTime(order.createdAt)}</p>
                            </div>
                            <b className="shrink-0 text-[14px] font-bold tabular-nums text-neutral-900">{money(order.total)}</b>
                          </div>
                          <p className="mt-2 line-clamp-2 text-[10.5px] leading-4 text-neutral-500">
                            {order.items.map((item) => `${item.quantity}× ${item.productName}`).join(" · ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </aside>
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 p-4">
            <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-[30px] bg-white shadow-2xl ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-5 md:px-7">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">Cliente #{editing.id}</p>
                  <h2 className="mt-0.5 text-2xl font-black">Editar cliente</h2>
                  <p className="mt-0.5 text-xs text-neutral-500">Actualiza sus datos sin perder el historial.</p>
                </div>
                <button onClick={closeEdit} className="rounded-full bg-neutral-100 px-3 py-2 text-sm font-bold">Cerrar</button>
              </div>

              <form onSubmit={saveCustomer}>
                <div className="space-y-4 px-6 py-5 md:px-7">
                  <div>
                    <label className="mb-1.5 block text-xs font-black">Nombre <span className="text-[var(--brand-red)]">*</span></label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" placeholder="Nombre del cliente" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
                    <div>
                      <label className="mb-1.5 block text-xs font-black">Indicativo</label>
                      <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="alento-input w-full rounded-2xl px-3 py-3">
                        <option>+57</option><option>+1</option><option>+34</option><option>+52</option><option>+51</option><option>+593</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black">Teléfono <span className="text-[var(--brand-red)]">*</span></label>
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" placeholder="Número de teléfono" />
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#faf9f7] p-3">
                    <label className="mb-1.5 block text-xs font-black">Dirección <span className="font-medium text-neutral-400">(opcional)</span></label>
                    <input value={address} onChange={(e) => setAddress(e.target.value)} className="alento-input w-full rounded-xl bg-white px-4 py-3" placeholder="Ej. Av. Calle 43 Sur #79A-33" />
                    <p className="mt-1.5 text-[10px] text-neutral-500">Se guardará como dirección principal.</p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-black">Correo <span className="font-medium text-neutral-400">(opcional)</span></label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" placeholder="correo@ejemplo.com" />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-black">Notas <span className="font-medium text-neutral-400">(opcional)</span></label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="alento-input w-full resize-none rounded-2xl px-4 py-3" placeholder="Información útil del cliente" />
                  </div>

                  {message && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div>}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 bg-[#faf9f7] px-6 py-4 sm:flex-row sm:justify-end md:px-7">
                  <button type="button" onClick={closeEdit} className="rounded-2xl border bg-white px-5 py-3 text-sm font-black">Cancelar</button>
                  <button type="submit" disabled={saving} className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 text-sm font-black text-white disabled:bg-neutral-300">{saving ? "Guardando..." : "Guardar cambios"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
