"use client";

import { useEffect, useState } from "react";

type ProviderId = "RAPPI" | "DIDI";
type IntegrationStatus = "NOT_CONFIGURED" | "PENDING" | "ACTIVE";

type ProviderSettings = {
  enabled: boolean;
  storeId: string;
  autoAccept: boolean;
  status: IntegrationStatus;
  connectedAt: string | null;
  commissionEstimatePercent: number;
  commissionTaxEstimatePercent: number;
};

type IntegrationSettings = Record<ProviderId, ProviderSettings>;

type ProviderMeta = {
  id: ProviderId;
  name: string;
  eyebrow: string;
  accent: string;
  soft: string;
  text: string;
  badge: string;
  icon: string;
  description: string;
  requirements: string[];
};

const PROVIDERS: ProviderMeta[] = [
  {
    id: "RAPPI",
    name: "Rappi",
    eyebrow: "Delivery marketplace",
    accent: "border-rose-200",
    soft: "bg-rose-50",
    text: "text-rose-700",
    badge: "bg-rose-100 text-rose-700",
    icon: "R",
    description: "Recibe pedidos de Rappi y llévalos al mismo flujo de Pedidos y Cocina de Alentó, conservando venta bruta y liquidación neta por separado.",
    requirements: [
      "Tienda activa en Rappi Partners.",
      "ID de tienda.",
      "Habilitación oficial de integración POS/Open Orders en Rappi.",
      "Credenciales técnicas de integración entregadas por Rappi; no la contraseña de Partners.",
    ],
  },
  {
    id: "DIDI",
    name: "DiDi Food",
    eyebrow: "Delivery marketplace",
    accent: "border-orange-200",
    soft: "bg-orange-50",
    text: "text-orange-700",
    badge: "bg-orange-100 text-orange-700",
    icon: "D",
    description: "Recibe pedidos de DiDi y centraliza su preparación junto con los pedidos internos.",
    requirements: [
      "Tienda activa en DiDi Food.",
      "Acceso autorizado a la plataforma de integración para la cuenta.",
      "Mapeo de productos y modificadores antes de activar producción.",
    ],
  },
];

function statusLabel(status: IntegrationStatus) {
  if (status === "ACTIVE") return "Activa";
  if (status === "PENDING") return "Pendiente";
  return "Sin configurar";
}

function statusTone(status: IntegrationStatus) {
  if (status === "ACTIVE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "PENDING") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-neutral-200 bg-neutral-100 text-neutral-600";
}

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0));
}

function rappiEstimate(gross: number, commissionPercent: number, commissionTaxPercent: number) {
  const commission = Math.max(0, gross) * Math.max(0, commissionPercent) / 100;
  const commissionTax = commission * Math.max(0, commissionTaxPercent) / 100;
  return {
    commission,
    commissionTax,
    net: Math.max(0, gross - commission - commissionTax),
  };
}

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [openProvider, setOpenProvider] = useState<ProviderId | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<ProviderId | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rappiGrossPreview, setRappiGrossPreview] = useState("50000");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/integrations", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible cargar las integraciones.");
        setSettings(data.settings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar las integraciones.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function updateProvider(id: ProviderId, patch: Partial<ProviderSettings>) {
    setSettings((current) => current ? {
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    } : current);
  }

  async function saveProvider(id: ProviderId) {
    if (!settings) return;
    setSaving(id);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible guardar la integración.");
      setSettings(data.settings);
      setMessage(`${PROVIDERS.find((provider) => provider.id === id)?.name ?? id}: configuración guardada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible guardar la integración.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f4f4f2] p-5 lg:p-6"><div className="mx-auto max-w-[1500px] rounded-2xl border bg-white p-8 text-sm text-neutral-500">Cargando integraciones...</div></main>;
  }

  if (!settings) {
    return <main className="min-h-screen bg-[#f4f4f2] p-5 lg:p-6"><div className="mx-auto max-w-[1500px] rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error || "No fue posible cargar las integraciones."}</div></main>;
  }

  const configured = PROVIDERS.filter((provider) => settings[provider.id].enabled).length;

  return (
    <main className="min-h-screen bg-[#f4f4f2] p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <section className="alento-dark rounded-[28px] px-7 py-5 md:px-8 md:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Canales externos</p>
              <h1 className="mt-0.5 text-3xl font-black tracking-[-0.035em]">Integraciones</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/65">Centraliza pedidos de plataformas externas dentro del mismo flujo operativo de Alentó.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2.5 text-center shadow-inner">
              <span className="block text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">Configuradas</span>
              <b className="mt-0.5 block text-[28px] font-black leading-none tabular-nums text-white">{configured}</b>
            </div>
          </div>
        </section>

        {(message || error) && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {error || message}
          </div>
        )}

        <section className="grid gap-3">
          {PROVIDERS.map((provider) => {
            const providerSettings = settings[provider.id];
            const open = openProvider === provider.id;

            return (
              <article key={provider.id} className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_12px_30px_rgba(28,23,20,.055)]">
                <button
                  type="button"
                  onClick={() => setOpenProvider(open ? null : provider.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-[16px] font-black ${provider.accent} ${provider.soft} ${provider.text}`}>
                      {provider.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-neutral-950">{provider.name}</h2>
                        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.04em] ${statusTone(providerSettings.status)}`}>
                          {statusLabel(providerSettings.status)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-neutral-400">{provider.eyebrow}</p>
                    </div>
                  </div>
                  <span className={`text-xl text-neutral-400 transition ${open ? "rotate-180" : ""}`}>⌄</span>
                </button>

                {open && (
                  <div className="border-t border-neutral-100 bg-[#faf9f7] p-4 md:p-5">
                    <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
                      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[22px] font-black ${provider.soft} ${provider.text}`}>{provider.icon}</div>
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400">{provider.name}</p>
                            <h3 className="mt-0.5 text-[20px] font-bold tracking-[-0.025em] text-neutral-950">Conectar con Alentó</h3>
                            <p className="mt-1 text-[12px] leading-5 text-neutral-500">{provider.description}</p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-3">
                          <b className="block text-[11px] text-sky-900">Qué hará esta integración</b>
                          <p className="mt-1 text-[10.5px] leading-4 text-sky-800">Los pedidos externos entrarán a Pedidos y Cocina. El objetivo es que el equipo no tenga que operar dos flujos separados.</p>
                        </div>

                        <div className="mt-3 rounded-xl border border-neutral-200 bg-[#fcfbf9] p-3.5">
                          <b className="text-[11px] text-neutral-900">Requisitos previos</b>
                          <ul className="mt-2 grid gap-1.5">
                            {provider.requirements.map((requirement) => (
                              <li key={requirement} className="flex gap-2 text-[10.5px] leading-4 text-neutral-600">
                                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                                <span>{requirement}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {provider.id === "RAPPI" && (
                          <>
                            <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/60 p-3.5">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <b className="block text-[11px] text-rose-950">Portal Rappi Partners</b>
                                  <p className="mt-1 text-[10px] leading-4 text-rose-800">Usa tu usuario y contraseña directamente en Rappi. No los guardes ni los copies dentro de Alentó.</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => window.open("https://login.partners.rappi.com/", "_blank", "noopener,noreferrer")}
                                  className="shrink-0 rounded-xl bg-rose-600 px-4 py-2.5 text-[10px] font-bold text-white shadow-sm hover:bg-rose-700"
                                >
                                  Abrir Partners
                                </button>
                              </div>
                            </div>

                            <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3.5">
                              <b className="block text-[11px] text-violet-950">Vinculación de productos</b>
                              <p className="mt-1 text-[10px] leading-4 text-violet-800">Como los productos de Rappi usan los mismos nombres de Alentó, el primer criterio de mapeo será nombre normalizado. Antes de activar producción validaremos excepciones, tamaños, bordes y toppings.</p>
                            </div>
                          </>
                        )}
                      </section>

                      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400">Configuración</p>
                        <h3 className="mt-0.5 text-[17px] font-bold text-neutral-950">Ingreso de pedidos</h3>

                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-[#faf9f7] p-3">
                            <div>
                              <b className="block text-[11px] text-neutral-900">Preparar integración</b>
                              <p className="mt-1 text-[10px] leading-4 text-neutral-500">Activa la configuración local mientras gestionamos el acceso oficial del proveedor.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateProvider(provider.id, { enabled: !providerSettings.enabled })}
                              className={`relative h-8 w-14 shrink-0 rounded-full transition ${providerSettings.enabled ? "bg-emerald-500" : "bg-neutral-300"}`}
                              aria-pressed={providerSettings.enabled}
                            >
                              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${providerSettings.enabled ? "left-7" : "left-1"}`} />
                            </button>
                          </div>

                          <div>
                            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.05em] text-neutral-500">ID de tienda / referencia</label>
                            <input
                              value={providerSettings.storeId}
                              onChange={(event) => updateProvider(provider.id, { storeId: event.target.value })}
                              className="alento-input w-full rounded-xl px-3.5 py-3 text-sm"
                              placeholder={provider.id === "RAPPI" ? "ID de la tienda en Rappi" : "Identificador de tienda"}
                            />
                          </div>

                          {provider.id === "RAPPI" && (() => {
                            const gross = Number(rappiGrossPreview.replace(/\D/g, "")) || 0;
                            const estimate = rappiEstimate(gross, providerSettings.commissionEstimatePercent, providerSettings.commissionTaxEstimatePercent);
                            return (
                              <div className="rounded-xl border border-neutral-200 bg-[#faf9f7] p-3.5">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <b className="block text-[11px] text-neutral-900">Conciliación Rappi</b>
                                    <p className="mt-1 text-[10px] leading-4 text-neutral-500">Estos porcentajes sirven solo como estimación mientras Rappi no entregue el detalle financiero real por pedido.</p>
                                  </div>
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[8px] font-bold uppercase text-amber-700">Estimación</span>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  <label className="block">
                                    <span className="mb-1 block text-[9px] font-bold uppercase text-neutral-400">Comisión estimada %</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step="0.01"
                                      value={providerSettings.commissionEstimatePercent}
                                      onChange={(event) => updateProvider(provider.id, { commissionEstimatePercent: Number(event.target.value) })}
                                      className="alento-input w-full rounded-xl px-3 py-2.5 text-sm"
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="mb-1 block text-[9px] font-bold uppercase text-neutral-400">Impuesto sobre comisión %</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step="0.01"
                                      value={providerSettings.commissionTaxEstimatePercent}
                                      onChange={(event) => updateProvider(provider.id, { commissionTaxEstimatePercent: Number(event.target.value) })}
                                      className="alento-input w-full rounded-xl px-3 py-2.5 text-sm"
                                    />
                                  </label>
                                </div>

                                <label className="mt-3 block">
                                  <span className="mb-1 block text-[9px] font-bold uppercase text-neutral-400">Probar con venta bruta</span>
                                  <input
                                    inputMode="numeric"
                                    value={rappiGrossPreview}
                                    onChange={(event) => setRappiGrossPreview(event.target.value)}
                                    className="alento-input w-full rounded-xl px-3 py-2.5 text-sm"
                                  />
                                </label>

                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                                    <span className="block text-[8px] font-bold uppercase text-neutral-400">Venta bruta</span>
                                    <b className="mt-1 block text-[15px] text-neutral-950">{money(gross)}</b>
                                  </div>
                                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                    <span className="block text-[8px] font-bold uppercase text-emerald-600">Neto estimado</span>
                                    <b className="mt-1 block text-[15px] text-emerald-900">{money(estimate.net)}</b>
                                  </div>
                                </div>
                                <div className="mt-2 flex justify-between text-[9px] text-neutral-500">
                                  <span>Comisión: {money(estimate.commission)}</span>
                                  <span>Impuesto: {money(estimate.commissionTax)}</span>
                                </div>
                              </div>
                            );
                          })()}

                          <div className="rounded-xl border border-neutral-200 p-3">
                            <b className="block text-[11px] text-neutral-900">Estado de ingreso</b>
                            <label className="mt-2 flex cursor-pointer items-start gap-2 text-[10.5px] leading-4 text-neutral-600">
                              <input
                                type="radio"
                                name={`${provider.id}-order-mode`}
                                checked={!providerSettings.autoAccept}
                                onChange={() => updateProvider(provider.id, { autoAccept: false })}
                                className="mt-0.5"
                              />
                              <span>Los pedidos ingresan pendientes para revisión manual.</span>
                            </label>
                            <label className="mt-2 flex cursor-pointer items-start gap-2 text-[10.5px] leading-4 text-neutral-600">
                              <input
                                type="radio"
                                name={`${provider.id}-order-mode`}
                                checked={providerSettings.autoAccept}
                                onChange={() => updateProvider(provider.id, { autoAccept: true })}
                                className="mt-0.5"
                              />
                              <span>Aceptar automáticamente cuando el proveedor lo permita.</span>
                            </label>
                          </div>

                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <b className="block text-[10.5px] text-amber-900">Credenciales protegidas</b>
                            <p className="mt-1 text-[10px] leading-4 text-amber-800">{provider.id === "RAPPI" ? "El usuario y contraseña de Partners no sirven como credenciales de API y no se almacenan aquí. Cuando Rappi habilite Open Orders/Integrations Manager, las credenciales técnicas se configurarán únicamente en servidor." : "Tokens, secretos y firmas no se guardarán en esta pantalla. Se configurarán en servidor cuando tengamos acceso oficial."}</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => void saveProvider(provider.id)}
                            disabled={saving === provider.id}
                            className="w-full rounded-xl bg-neutral-950 px-4 py-3 text-[11px] font-bold text-white disabled:bg-neutral-300"
                          >
                            {saving === provider.id ? "Guardando..." : "Guardar configuración"}
                          </button>
                        </div>
                      </section>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400">Arquitectura prevista</p>
          <div className="mt-3 grid gap-2 md:grid-cols-5">
            {["Rappi / DiDi", "Webhook / API", "Alentó", "Pedidos", "Cocina"].map((step, index) => (
              <div key={step} className="flex items-center gap-2 md:block">
                <div className="rounded-xl border border-neutral-200 bg-[#faf9f7] px-3 py-3 text-center text-[11px] font-bold text-neutral-800">{step}</div>
                {index < 4 && <span className="text-neutral-300 md:mt-1 md:block md:text-center">↓</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
