"use client";

import { useState } from "react";

type Preview = {
  summary: {
    totalRows: number;
    toImport: number;
    issues: number;
    uniqueCustomers: number;
    matchedCustomers: number;
    customersToCreate: number;
    correctedPayments: number;
    totalSales: number;
    totalItems: number;
    firstSequence: number;
    lastSequence: number;
    canImport: boolean;
  };
  preview: Array<{
    sequenceNumber: number;
    source: string;
    createdAt: string;
    customerName: string;
    fulfillmentType: string;
    total: number;
    itemCount: number;
  }>;
  issues: Array<{
    rowNumber: number;
    reason: string;
  }>;
  blockers: string[];
};

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function typeLabel(value: string) {
  if (value === "DELIVERY") return "Domicilio";
  if (value === "PICKUP") return "Recoger";
  return "Local";
}

export default function HistoricalOrdersImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"preview" | "import" | null>(null);
  const [message, setMessage] = useState("");

  if (!open) return null;

  async function analyze(nextFile: File) {
    setBusy(true);
    setStage("preview");
    setMessage("");
    setPreview(null);

    try {
      const body = new FormData();
      body.set("file", nextFile);
      body.set("action", "preview");
      const response = await fetch("/api/orders/history-import", {
        method: "POST",
        body,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible analizar el archivo.");
      }

      setPreview(data);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible analizar el archivo.",
      );
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  async function confirmImport() {
    if (!file || !preview?.summary.canImport || busy) return;

    setBusy(true);
    setStage("import");
    setMessage("");

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("action", "import");
      const response = await fetch("/api/orders/history-import", {
        method: "POST",
        body,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible importar el historial.",
        );
      }

      onImported();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible importar el historial.",
      );
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  function close() {
    if (busy) return;
    setFile(null);
    setPreview(null);
    setMessage("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px] md:p-5">
      <div className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#f6f3ee] shadow-[0_30px_100px_rgba(0,0,0,.34)]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-[radial-gradient(circle_at_88%_12%,rgba(226,26,34,.20),transparent_28%),linear-gradient(135deg,#080809,#1a1718)] px-5 py-5 text-white md:px-7">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ff5a60]">
              Migración única
            </p>
            <h2 className="mt-1 text-[26px] font-black tracking-[-0.03em]">
              Importar historial de pedidos
            </h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-white/52">
              El consecutivo antiguo de Glide se ignora. Alentó ordenará las
              ventas por fecha y creará un historial nuevo desde 0001.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] text-xl text-white/65"
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <label className="block cursor-pointer rounded-[22px] border border-dashed border-neutral-300 bg-white p-6 text-center shadow-sm transition hover:border-neutral-400">
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setFile(nextFile);
                setPreview(null);
                setMessage("");
                if (nextFile) void analyze(nextFile);
              }}
            />
            <span className="block text-[15px] font-black text-neutral-950">
              {file ? file.name : "Seleccionar Pedidos.csv"}
            </span>
            <span className="mt-1.5 block text-[11px] text-neutral-500">
              Esta herramienta está diseñada para la migración histórica
              única desde la estructura actual de Glide.
            </span>
          </label>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <span className="text-[8px] font-black uppercase tracking-[.1em] text-neutral-400">
                Consecutivo
              </span>
              <b className="mt-1 block text-[16px] text-neutral-950">
                0001 → nuevo historial
              </b>
              <p className="mt-1 text-[10px] leading-4 text-neutral-500">
                N° Pedido y Row ID de Glide no se guardan ni se reutilizan.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <span className="text-[8px] font-black uppercase tracking-[.1em] text-neutral-400">
                Operación actual
              </span>
              <b className="mt-1 block text-[16px] text-neutral-950">
                Sin Cocina ni repartos
              </b>
              <p className="mt-1 text-[10px] leading-4 text-neutral-500">
                Todo entra FINALIZADO con su fecha original.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <span className="text-[8px] font-black uppercase tracking-[.1em] text-neutral-400">
                Pagos antiguos
              </span>
              <b className="mt-1 block text-[16px] text-neutral-950">
                Saldo corregido
              </b>
              <p className="mt-1 text-[10px] leading-4 text-neutral-500">
                Los NO PAGADO se completan como Efectivo.
              </p>
            </div>
          </div>

          {busy && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--brand-red)]" />
              <div>
                <b className="block text-[11px] text-neutral-900">
                  {stage === "import"
                    ? "Importando historial..."
                    : "Analizando archivo..."}
                </b>
                <span className="text-[10px] text-neutral-500">
                  {stage === "import"
                    ? "Creando clientes faltantes, pedidos, productos y pagos históricos."
                    : "Validando productos, totales, fechas y clientes."}
                </span>
              </div>
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-bold leading-5 text-red-700">
              {message}
            </div>
          )}

          {preview && (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                {[
                  ["Pedidos", preview.summary.toImport],
                  ["Unidades", preview.summary.totalItems],
                  ["Clientes", preview.summary.uniqueCustomers],
                  ["Ventas", money(preview.summary.totalSales)],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-2xl border border-neutral-200 bg-white p-3.5"
                  >
                    <span className="block text-[8px] font-black uppercase tracking-[.09em] text-neutral-400">
                      {label}
                    </span>
                    <b className="mt-1 block text-[16px] text-neutral-950">
                      {String(value)}
                    </b>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3.5">
                  <span className="text-[8px] font-black uppercase text-emerald-600">
                    Clientes encontrados
                  </span>
                  <b className="mt-1 block text-[15px] text-emerald-950">
                    {preview.summary.matchedCustomers}
                  </b>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3.5">
                  <span className="text-[8px] font-black uppercase text-sky-600">
                    Clientes nuevos
                  </span>
                  <b className="mt-1 block text-[15px] text-sky-950">
                    {preview.summary.customersToCreate}
                  </b>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3.5">
                  <span className="text-[8px] font-black uppercase text-amber-600">
                    Pagos corregidos
                  </span>
                  <b className="mt-1 block text-[15px] text-amber-950">
                    {preview.summary.correctedPayments}
                  </b>
                </div>
              </div>

              {preview.blockers.length > 0 && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <b className="text-[11px] text-red-900">
                    La importación todavía está bloqueada
                  </b>
                  <div className="mt-2 space-y-1.5">
                    {preview.blockers.map((blocker) => (
                      <p
                        key={blocker}
                        className="text-[10px] leading-4 text-red-700"
                      >
                        • {blocker}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {preview.preview.length > 0 && (
                <section className="mt-4 overflow-hidden rounded-[20px] border border-neutral-200 bg-white">
                  <div className="border-b border-neutral-100 bg-[#faf9f7] px-4 py-3">
                    <b className="text-[11px] text-neutral-900">
                      Primeros pedidos con el nuevo consecutivo
                    </b>
                  </div>
                  <div className="divide-y divide-neutral-100">
                    {preview.preview.slice(0, 8).map((order) => (
                      <div
                        key={order.sequenceNumber}
                        className="grid gap-2 px-4 py-3 sm:grid-cols-[100px_1fr_auto] sm:items-center"
                      >
                        <div>
                          <b className="text-[12px] text-neutral-950">
                            {order.source}-
                            {String(order.sequenceNumber).padStart(4, "0")}
                          </b>
                          <span className="mt-0.5 block text-[9px] text-neutral-400">
                            {new Date(order.createdAt).toLocaleDateString(
                              "es-CO",
                            )}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <b className="block truncate text-[11px] text-neutral-800">
                            {order.customerName}
                          </b>
                          <span className="text-[9px] text-neutral-400">
                            {typeLabel(order.fulfillmentType)} ·{" "}
                            {order.itemCount} unidad(es)
                          </span>
                        </div>
                        <b className="text-[11px] text-neutral-950">
                          {money(order.total)}
                        </b>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {preview.issues.length > 0 && (
                <section className="mt-4 overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/60">
                  <div className="border-b border-rose-100 px-4 py-3">
                    <b className="text-[11px] text-rose-950">
                      Filas con problemas
                    </b>
                  </div>
                  <div className="max-h-52 divide-y divide-rose-100 overflow-y-auto">
                    {preview.issues.map((issue) => (
                      <div
                        key={issue.rowNumber}
                        className="px-4 py-3 text-[10px] leading-4 text-rose-700"
                      >
                        <b>Fila {issue.rowNumber}</b> · {issue.reason}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 bg-white px-4 py-3 md:px-6">
          <p className="max-w-xl text-[10px] leading-4 text-neutral-500">
            Al confirmar se crea un bloqueo permanente para que esta migración
            no pueda ejecutarse dos veces.
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-xs font-bold text-neutral-700 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void confirmImport()}
              disabled={busy || !preview?.summary.canImport}
              className="h-11 rounded-xl bg-[var(--brand-red)] px-5 text-xs font-black text-white shadow-[0_8px_20px_rgba(226,26,34,.20)] disabled:bg-neutral-300 disabled:shadow-none"
            >
              {busy && stage === "import"
                ? "Importando..."
                : preview
                  ? "Importar " + preview.summary.toImport + " pedidos"
                  : "Importar historial"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
