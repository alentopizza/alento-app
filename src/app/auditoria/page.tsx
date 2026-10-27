"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";

type AuditLog = {
  id: number;
  occurredAt: string;
  actorType: string;
  actorUserId: number | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  source: string | null;
};

type AuditResponse = {
  logs: AuditLog[];
  filters: {
    actions: string[];
    entityTypes: string[];
  };
  limit: number;
  error?: string;
};

function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeFilterCount = useMemo(
    () => [action, entityType, actor, from, to].filter(Boolean).length,
    [action, entityType, actor, from, to],
  );

  async function load() {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({ take: "150" });
    if (action) params.set("action", action);
    if (entityType) params.set("entityType", entityType);
    if (actor.trim()) params.set("actor", actor.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    try {
      const response = await fetch(`/api/audit-logs?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as AuditResponse;
      if (!response.ok) {
        throw new Error(data.error || "No fue posible cargar la auditoría.");
      }
      setLogs(data.logs ?? []);
      setActions(data.filters?.actions ?? []);
      setEntityTypes(data.filters?.entityTypes ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar la auditoría.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  function clearFilters() {
    setAction("");
    setEntityType("");
    setActor("");
    setFrom("");
    setTo("");
    window.setTimeout(() => void load(), 0);
  }

  return (
    <main className="min-h-screen bg-[#f5f3ef] px-4 py-6 text-[#171717] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-red-600">
              <ShieldCheck className="h-4 w-4" />
              Control administrativo
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Auditoría
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-black/55">
              Historial inmutable de acciones sensibles sobre pedidos, pagos,
              Caja, usuarios, descuentos y configuración.
            </p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm shadow-sm">
            <b>{logs.length}</b> registros visibles
            {activeFilterCount > 0 && (
              <span className="ml-2 text-black/45">
                · {activeFilterCount} filtros
              </span>
            )}
          </div>
        </div>

        <form
          onSubmit={submit}
          className="mb-5 grid gap-3 rounded-[24px] border border-black/10 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-6"
        >
          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className="h-11 rounded-xl border border-black/10 bg-[#faf9f7] px-3 text-sm font-semibold outline-none focus:border-red-500"
          >
            <option value="">Todas las acciones</option>
            {actions.map((item) => (
              <option key={item} value={item}>
                {label(item)}
              </option>
            ))}
          </select>

          <select
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            className="h-11 rounded-xl border border-black/10 bg-[#faf9f7] px-3 text-sm font-semibold outline-none focus:border-red-500"
          >
            <option value="">Todas las entidades</option>
            {entityTypes.map((item) => (
              <option key={item} value={item}>
                {label(item)}
              </option>
            ))}
          </select>

          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-black/35" />
            <input
              value={actor}
              onChange={(event) => setActor(event.target.value)}
              placeholder="Actor o resumen"
              className="h-11 w-full rounded-xl border border-black/10 bg-[#faf9f7] pl-9 pr-3 text-sm outline-none focus:border-red-500"
            />
          </label>

          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-11 rounded-xl border border-black/10 bg-[#faf9f7] px-3 text-sm outline-none focus:border-red-500"
            aria-label="Desde"
          />

          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-11 rounded-xl border border-black/10 bg-[#faf9f7] px-3 text-sm outline-none focus:border-red-500"
            aria-label="Hasta"
          />

          <div className="flex gap-2">
            <button
              type="submit"
              className="h-11 flex-1 rounded-xl bg-black px-4 text-sm font-black text-white transition hover:bg-black/85"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="h-11 rounded-xl border border-black/10 px-3 text-sm font-bold"
            >
              Limpiar
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-[26px] border border-black/10 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-black/45">
              Cargando auditoría…
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-black/45">
              No hay registros para los filtros seleccionados.
            </div>
          ) : (
            <div className="divide-y divide-black/[0.07]">
              {logs.map((log) => (
                <article key={log.id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">
                          {label(log.action)}
                        </span>
                        <span className="rounded-full border border-black/10 bg-[#f7f5f1] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.07em] text-black/55">
                          {label(log.entityType)}
                          {log.entityId ? ` · #${log.entityId}` : ""}
                        </span>
                      </div>

                      <h2 className="mt-3 text-[15px] font-black leading-5">
                        {log.summary || label(log.action)}
                      </h2>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/48">
                        <span>
                          <b className="text-black/70">
                            {log.actorName || log.actorType}
                          </b>
                          {log.actorEmail ? ` · ${log.actorEmail}` : ""}
                        </span>
                        <span>{dateTime(log.occurredAt)}</span>
                        {log.source && <span>{log.source}</span>}
                      </div>
                    </div>

                    {(log.before != null ||
                      log.after != null ||
                      log.metadata != null) && (
                      <details className="w-full rounded-2xl border border-black/10 bg-[#faf9f7] xl:w-[480px]">
                        <summary className="cursor-pointer px-4 py-3 text-xs font-black uppercase tracking-[0.08em]">
                          Ver detalle
                        </summary>
                        <div className="border-t border-black/10 p-3">
                          {log.before != null && (
                            <div className="mb-3">
                              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.1em] text-black/45">
                                Antes
                              </p>
                              <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-3 text-[11px] leading-5 text-black/65">
                                {json(log.before)}
                              </pre>
                            </div>
                          )}
                          {log.after != null && (
                            <div className="mb-3">
                              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.1em] text-black/45">
                                Después
                              </p>
                              <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-3 text-[11px] leading-5 text-black/65">
                                {json(log.after)}
                              </pre>
                            </div>
                          )}
                          {log.metadata != null && (
                            <div>
                              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.1em] text-black/45">
                                Contexto
                              </p>
                              <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-3 text-[11px] leading-5 text-black/65">
                                {json(log.metadata)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
