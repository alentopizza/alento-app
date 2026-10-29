"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  HeartPulse,
  MapPin,
  RefreshCw,
  Send,
  ShieldAlert,
} from "lucide-react";

type CheckStatus = "ok" | "warning" | "error" | "not_configured";

type Incident = {
  id: string;
  level: "WARNING" | "ERROR";
  category: string;
  code: string;
  message: string;
  source: string | null;
  entityType: string | null;
  entityId: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  lastRequestId: string | null;
  metadata: unknown;
  resolvedAt: string | null;
  resolvedByName: string | null;
};

type Summary = {
  status: "healthy" | "attention" | "critical";
  requestId: string | null;
  generatedAt: string;
  runtime: {
    uptimeSeconds: number;
    nodeVersion: string;
  };
  checks: {
    database: {
      status: CheckStatus;
      latencyMs: number | null;
      detail: string;
    };
    notifier: {
      status: CheckStatus;
      latencyMs: number | null;
      detail: string;
    };
    webPush: {
      status: CheckStatus;
      detail: string;
    };
    googleMaps: {
      status: CheckStatus;
      detail: string;
    };
    notificationJobs: {
      status: CheckStatus;
      detail: string;
    };
  };
  incidents: {
    open: Incident[];
    recentResolved: Incident[];
    openErrorCount: number;
    openWarningCount: number;
  };
  jobs: {
    pendingOverdue: number;
    failed: number;
    sentLast24Hours: number;
    oldestPending: {
      id: number;
      kind: string;
      runAt: string;
      attempts: number;
      lastError: string | null;
    } | null;
  };
  integrations: {
    notifierConfigured: boolean;
    webPushConfigured: boolean;
    googleMapsConfigured: boolean;
    trackingEnabled: boolean;
    configuredTracking: string[];
    trackingUpdatedAt: string | null;
    failedPushCampaignsLast24Hours: number;
    pendingCustomerContactWebhooks: number;
  };
  error?: string;
};

const categoryLabels: Record<string, string> = {
  BACKEND: "Servidor",
  FRONTEND: "Interfaz",
  DATABASE: "Base de datos",
  INTEGRATION: "Integraciones",
  JOBS: "Trabajos programados",
  PUSH: "Notificaciones Push",
  CONFIGURATION: "Configuración",
  SYSTEM: "Sistema",
};

const incidentLabels: Record<string, string> = {
  NEXT_REQUEST_ERROR: "Error no controlado del servidor",
  CLIENT_RUNTIME_ERROR: "Error de interfaz",
  OBSERVABILITY_SUMMARY_FAILED: "Falló la consulta de salud del sistema",
  NOTIFIER_HEALTH_FAILED: "El notificador respondió con error",
  NOTIFIER_UNREACHABLE: "El notificador no está disponible",
  NOTIFIER_DELIVERY_FAILED: "Falló una notificación de WhatsApp",
  NOTIFICATION_JOB_RETRY: "Trabajo de notificación pendiente de reintento",
  NOTIFICATION_JOB_EXHAUSTED: "Trabajo de notificación agotó sus reintentos",
  PUSH_CAMPAIGN_DELIVERY_FAILED: "Falló el envío de una campaña Push",
  PUSH_CAMPAIGN_PARTIAL_FAILURE: "Campaña Push con entregas fallidas",
  PUSH_CAMPAIGN_FAILED: "Campaña Push sin entregas",
  CUSTOMER_CONTACT_WEBHOOK_REJECTED:
    "Sincronización de contacto rechazada",
  CUSTOMER_CONTACT_WEBHOOK_UNREACHABLE:
    "Sincronización de contactos no disponible",
  GOOGLE_MAPS_SERVER_KEY_MISSING: "Falta la clave de Google Maps del servidor",
  OBSERVABILITY_TEST: "Alerta de prueba",
};

const sourceLabels: Record<string, string> = {
  "api/observability/summary": "Salud del sistema",
  "api/observability/test": "Prueba de observabilidad",
  "api/internal/notification-jobs/run": "Trabajos programados",
  "api/push-campaigns": "Campañas Push",
  "lib/notifier": "WhatsApp / Notifier",
  "lib/customerContactWebhook": "Sincronización de clientes",
  instrumentation: "Servidor",
};

function humanizeCode(value: string) {
  return value
    .replace(/^frontend:/, "Interfaz · ")
    .replace(/^server:/, "Servidor · ")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function incidentLabel(code: string) {
  return incidentLabels[code] || humanizeCode(code);
}

function sourceLabel(source: string | null) {
  if (!source) return "";
  return sourceLabels[source] || humanizeCode(source);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

function statusText(status: CheckStatus) {
  if (status === "ok") return "Operativo";
  if (status === "warning") return "Revisar";
  if (status === "error") return "Error";
  return "No configurado";
}

function statusClass(status: CheckStatus) {
  if (status === "ok") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "error") {
    return "border-red-200 bg-red-50 text-red-800";
  }
  if (status === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-black/10 bg-[#f5f3ef] text-black/55";
}

function CheckCard({
  title,
  icon: Icon,
  status,
  detail,
  latencyMs,
}: {
  title: string;
  icon: typeof Database;
  status: CheckStatus;
  detail: string;
  latencyMs?: number | null;
}) {
  return (
    <article className="rounded-[22px] border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
          <Icon className="h-5 w-5" />
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${statusClass(
            status,
          )}`}
        >
          {statusText(status)}
        </span>
      </div>
      <h2 className="mt-4 text-[15px] font-black">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-black/50">{detail}</p>
      {latencyMs != null && (
        <p className="mt-3 text-[11px] font-bold text-black/45">
          Respuesta: {latencyMs} ms
        </p>
      )}
    </article>
  );
}

export default function SystemHealthPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/observability/summary", {
        cache: "no-store",
      });
      const data = (await response.json()) as Summary;
      if (!response.ok) {
        throw new Error(data.error || "No fue posible consultar la salud del sistema.");
      }
      setSummary(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible consultar la salud del sistema.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(true);
      }
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [load]);

  async function generateTestAlert() {
    setTesting(true);
    setError("");
    try {
      const response = await fetch("/api/observability/test", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "No fue posible generar la alerta de prueba.",
        );
      }
      await load(true);
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : "No fue posible generar la alerta de prueba.",
      );
    } finally {
      setTesting(false);
    }
  }

  async function resolveIncident(id: string) {
    setResolvingId(id);
    try {
      const response = await fetch(`/api/observability/incidents/${id}`, {
        method: "PATCH",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "No fue posible resolver la alerta.",
        );
      }
      await load(true);
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "No fue posible resolver la alerta.",
      );
    } finally {
      setResolvingId(null);
    }
  }

  const overall = useMemo(() => {
    if (!summary) {
      return {
        title: "Comprobando el sistema",
        detail: "Consultando servicios e incidentes.",
        className: "border-black/10 bg-white text-black",
      };
    }
    if (summary.status === "critical") {
      return {
        title: "Requiere atención",
        detail: "Hay errores operativos activos que deben revisarse.",
        className: "border-red-200 bg-red-50 text-red-900",
      };
    }
    if (summary.status === "attention") {
      return {
        title: "Operativo con alertas",
        detail: "La aplicación está funcionando, pero hay puntos por revisar.",
        className: "border-amber-200 bg-amber-50 text-amber-900",
      };
    }
    return {
      title: "Sistema operativo",
      detail: "No hay alertas operativas activas.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }, [summary]);

  return (
    <main className="min-h-screen bg-[#f5f3ef] px-4 py-6 text-[#171717] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-red-600">
              <HeartPulse className="h-4 w-4" />
              Observabilidad de producción
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Salud del sistema
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-black/55">
              Estado técnico de Alentó App, integraciones, trabajos programados
              y alertas operativas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void generateTestAlert()}
              disabled={testing}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-black shadow-sm disabled:opacity-50"
            >
              <ShieldAlert className="h-4 w-4" />
              {testing ? "Generando…" : "Generar alerta de prueba"}
            </button>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-black text-white shadow-sm disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Actualizar
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading && !summary ? (
          <div className="rounded-[26px] border border-black/10 bg-white p-10 text-center text-sm text-black/45 shadow-sm">
            Comprobando servicios…
          </div>
        ) : summary ? (
          <>
            <section
              className={`mb-5 rounded-[26px] border p-5 shadow-sm ${overall.className}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] opacity-60">
                    Estado general
                  </p>
                  <h2 className="mt-1 text-2xl font-black">{overall.title}</h2>
                  <p className="mt-1 text-sm opacity-65">{overall.detail}</p>
                </div>
                <div className="text-left text-xs opacity-60 sm:text-right">
                  <p>Actualizado: {formatDate(summary.generatedAt)}</p>
                  <p className="mt-1">
                    Aplicación activa: {formatDuration(summary.runtime.uptimeSeconds)}
                  </p>
                  {summary.requestId && (
                    <p className="mt-1 font-mono text-[10px]">
                      Diagnóstico: {summary.requestId}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <CheckCard
                title="Base de datos"
                icon={Database}
                {...summary.checks.database}
              />
              <CheckCard
                title="WhatsApp / Notifier"
                icon={Send}
                {...summary.checks.notifier}
              />
              <CheckCard
                title="Web Push"
                icon={ShieldAlert}
                {...summary.checks.webPush}
              />
              <CheckCard
                title="Google Maps"
                icon={MapPin}
                {...summary.checks.googleMaps}
              />
              <CheckCard
                title="Trabajos programados"
                icon={Clock3}
                {...summary.checks.notificationJobs}
              />
            </section>

            <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-black/10 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold text-black/45">Errores activos</p>
                <p className="mt-2 text-3xl font-black">
                  {summary.incidents.openErrorCount}
                </p>
              </div>
              <div className="rounded-[22px] border border-black/10 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold text-black/45">
                  Advertencias activas
                </p>
                <p className="mt-2 text-3xl font-black">
                  {summary.incidents.openWarningCount}
                </p>
              </div>
              <div className="rounded-[22px] border border-black/10 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold text-black/45">
                  Jobs enviados · 24 h
                </p>
                <p className="mt-2 text-3xl font-black">
                  {summary.jobs.sentLast24Hours}
                </p>
              </div>
              <div className="rounded-[22px] border border-black/10 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold text-black/45">
                  Jobs fallidos · 24 h
                </p>
                <p className="mt-2 text-3xl font-black">
                  {summary.jobs.failed}
                </p>
              </div>
            </section>

            <section className="mb-5 overflow-hidden rounded-[26px] border border-black/10 bg-white shadow-sm">
              <div className="border-b border-black/[0.07] p-5">
                <h2 className="text-lg font-black">Integraciones y colas</h2>
                <p className="mt-1 text-xs text-black/45">
                  Señales que pueden afectar comunicaciones, domicilio o
                  seguimiento externo.
                </p>
              </div>
              <div className="grid gap-px bg-black/[0.06] md:grid-cols-2 xl:grid-cols-4">
                <div className="bg-white p-4">
                  <p className="text-xs font-bold text-black/45">
                    Campañas Push fallidas · 24 h
                  </p>
                  <p className="mt-2 text-2xl font-black">
                    {summary.integrations.failedPushCampaignsLast24Hours}
                  </p>
                </div>
                <div className="bg-white p-4">
                  <p className="text-xs font-bold text-black/45">
                    Contactos pendientes de sincronizar
                  </p>
                  <p className="mt-2 text-2xl font-black">
                    {summary.integrations.pendingCustomerContactWebhooks}
                  </p>
                </div>
                <div className="bg-white p-4">
                  <p className="text-xs font-bold text-black/45">
                    Jobs vencidos pendientes
                  </p>
                  <p className="mt-2 text-2xl font-black">
                    {summary.jobs.pendingOverdue}
                  </p>
                </div>
                <div className="bg-white p-4">
                  <p className="text-xs font-bold text-black/45">
                    Medición externa configurada
                  </p>
                  <p className="mt-2 text-sm font-black leading-5">
                    {summary.integrations.configuredTracking.length > 0
                      ? summary.integrations.configuredTracking.join(", ")
                      : "Ninguna"}
                  </p>
                </div>
              </div>
              {summary.jobs.oldestPending && (
                <div className="border-t border-black/[0.07] px-5 py-4 text-xs text-black/55">
                  Trabajo pendiente más antiguo: #{summary.jobs.oldestPending.id} ·{" "}
                  {summary.jobs.oldestPending.kind} · programado para{" "}
                  {formatDate(summary.jobs.oldestPending.runAt)} ·{" "}
                  {summary.jobs.oldestPending.attempts} intento(s).
                </div>
              )}
            </section>

            <section className="mb-5 overflow-hidden rounded-[26px] border border-black/10 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-black/[0.07] p-5">
                <div>
                  <h2 className="text-lg font-black">Alertas activas</h2>
                  <p className="mt-1 text-xs text-black/45">
                    Se agrupan por causa. Una nueva ocurrencia reabre
                    automáticamente una alerta resuelta.
                  </p>
                </div>
                <span className="rounded-full bg-black px-3 py-1.5 text-xs font-black text-white">
                  {summary.incidents.open.length}
                </span>
              </div>

              {summary.incidents.open.length === 0 ? (
                <div className="flex items-center gap-3 p-6 text-sm text-black/55">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  No hay alertas operativas activas.
                </div>
              ) : (
                <div className="divide-y divide-black/[0.07]">
                  {summary.incidents.open.map((incident) => (
                    <article key={incident.id} className="p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
                                incident.level === "ERROR"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                              }`}
                            >
                              {incident.level === "ERROR"
                                ? "Error"
                                : "Advertencia"}
                            </span>
                            <span className="rounded-full border border-black/10 bg-[#f7f5f1] px-2.5 py-1 text-[10px] font-bold text-black/55">
                              {categoryLabels[incident.category] ||
                                incident.category}
                            </span>
                            <span className="text-[11px] font-bold text-black/40">
                              {incident.occurrenceCount} ocurrencia(s)
                            </span>
                          </div>
                          <h3 className="mt-3 text-[15px] font-black">
                            {incident.message}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/45">
                            <span>{incidentLabel(incident.code)}</span>
                            <span>
                              Última: {formatDate(incident.lastSeenAt)}
                            </span>
                            <span>
                              Primera: {formatDate(incident.firstSeenAt)}
                            </span>
                            {incident.source && (
                              <span>{sourceLabel(incident.source)}</span>
                            )}
                          </div>
                          {(incident.lastRequestId ||
                            incident.source ||
                            incident.code) && (
                            <details className="mt-3 text-[11px] text-black/40">
                              <summary className="cursor-pointer font-bold">
                                Ver diagnóstico técnico
                              </summary>
                              <div className="mt-2 space-y-1 font-mono text-[10px]">
                                <p>Código: {incident.code}</p>
                                {incident.source && (
                                  <p>Origen: {incident.source}</p>
                                )}
                                {incident.lastRequestId && (
                                  <p>Request ID: {incident.lastRequestId}</p>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void resolveIncident(incident.id)}
                          disabled={resolvingId === incident.id}
                          className="h-10 shrink-0 rounded-xl border border-black/10 px-4 text-xs font-black transition hover:bg-black hover:text-white disabled:opacity-50"
                        >
                          {resolvingId === incident.id
                            ? "Guardando…"
                            : "Marcar resuelto"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {summary.incidents.recentResolved.length > 0 && (
              <details className="rounded-[26px] border border-black/10 bg-white shadow-sm">
                <summary className="cursor-pointer p-5 text-sm font-black">
                  Ver alertas resueltas recientemente (
                  {summary.incidents.recentResolved.length})
                </summary>
                <div className="divide-y divide-black/[0.07] border-t border-black/[0.07]">
                  {summary.incidents.recentResolved.map((incident) => (
                    <div key={incident.id} className="p-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <b>{incident.message}</b>
                      </div>
                      <p className="mt-1 text-xs text-black/45">
                        Resuelto {formatDate(incident.resolvedAt)}
                        {incident.resolvedByName
                          ? ` por ${incident.resolvedByName}`
                          : ""}
                        .
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        ) : (
          <div className="rounded-[26px] border border-black/10 bg-white p-10 text-center shadow-sm">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
            <p className="mt-3 text-sm font-bold">
              No hay información de salud disponible.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
