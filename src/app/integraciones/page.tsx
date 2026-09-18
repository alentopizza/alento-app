"use client";

import { useEffect, useState } from "react";

type ProviderId = "RAPPI" | "DIDI";
type IntegrationStatus = "NOT_CONFIGURED" | "PENDING" | "ACTIVE" | "ERROR";

type ProviderSettings = {
  enabled: boolean;
  storeId: string;
  autoAccept: boolean;
  status: IntegrationStatus;
  connectedAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  accountLinked: boolean;
  storeName: string;
  storeAddress: string;
};

type IntegrationSettings = Record<ProviderId, ProviderSettings>;
type TechnicalAccess = {
  RAPPI: {
    clientIdConfigured: boolean;
    clientSecretConfigured: boolean;
    apiBaseUrlConfigured: boolean;
    oauthClientConfigured: boolean;
    oauthStoresUrlConfigured: boolean;
  };
};

type RappiStoreOption = {
  id: string;
  name: string;
  address: string;
};

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
    description: "Recibe pedidos de Rappi directamente en Alentó y llévalos al mismo flujo de Pedidos y Cocina con el valor exacto enviado por la plataforma.",
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
  if (status === "ACTIVE") return "Conectada";
  if (status === "PENDING") return "Pendiente";
  if (status === "ERROR") return "Error";
  return "No conectada";
}

function statusTone(status: IntegrationStatus) {
  if (status === "ACTIVE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "PENDING") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "ERROR") return "border-red-200 bg-red-50 text-red-700";
  return "border-neutral-200 bg-neutral-100 text-neutral-600";
}

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [technicalAccess, setTechnicalAccess] = useState<TechnicalAccess | null>(null);
  const [openProvider, setOpenProvider] = useState<ProviderId | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<ProviderId | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [rappiOAuthSession, setRappiOAuthSession] = useState("");
  const [rappiStores, setRappiStores] = useState<RappiStoreOption[]>([]);
  const [selectedRappiStoreId, setSelectedRappiStoreId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/integrations", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible cargar las integraciones.");
        setSettings(data.settings);
        setTechnicalAccess(data.technicalAccess ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar las integraciones.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  useEffect(() => {
    function handleRappiMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || !event.data || typeof event.data !== "object") return;

      const payload = event.data as {
        type?: string;
        sessionId?: string;
        stores?: RappiStoreOption[];
        message?: string;
      };

      if (payload.type === "rappi-oauth-error") {
        setConnecting(false);
        setError(payload.message || "Rappi no pudo autorizar la conexión.");
        return;
      }

      if (
        payload.type === "rappi-oauth-stores" &&
        typeof payload.sessionId === "string" &&
        Array.isArray(payload.stores)
      ) {
        setConnecting(false);
        setRappiOAuthSession(payload.sessionId);
        setRappiStores(payload.stores);
        setSelectedRappiStoreId(payload.stores.length === 1 ? payload.stores[0].id : "");
        setError("");
      }
    }

    window.addEventListener("message", handleRappiMessage);
    return () => window.removeEventListener("message", handleRappiMessage);
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

  function connectRappi() {
    setMessage("");
    setError("");
    setConnecting(true);

    const width = 620;
    const height = 760;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);

    const popup = window.open(
      "/api/integrations/rappi/oauth/start",
      "alento-rappi-oauth",
      `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=yes`,
    );

    if (!popup) {
      setConnecting(false);
      setError("El navegador bloqueó la ventana de Rappi. Habilita las ventanas emergentes para Alentó e intenta nuevamente.");
      return;
    }

    popup.focus();

    const watcher = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(watcher);
        setConnecting(false);
      }
    }, 700);
  }

  async function completeRappiStore() {
    if (!rappiOAuthSession || !selectedRappiStoreId) return;

    setConnecting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/integrations/rappi/oauth/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: rappiOAuthSession,
          storeId: selectedRappiStoreId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible integrar la tienda de Rappi.");

      const refresh = await fetch("/api/integrations", { cache: "no-store" });
      const refreshData = await refresh.json();
      if (refresh.ok) {
        setSettings(refreshData.settings);
        setTechnicalAccess(refreshData.technicalAccess ?? null);
      }

      setRappiOAuthSession("");
      setRappiStores([]);
      setSelectedRappiStoreId("");
      setMessage(`Rappi conectado · ${data.store?.name ?? "Tienda integrada"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible integrar la tienda de Rappi.");
    } finally {
      setConnecting(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f4f4f2] p-5 lg:p-6"><div className="mx-auto max-w-[1500px] rounded-2xl border bg-white p-8 text-sm text-neutral-500">Cargando integraciones...</div></main>;
  }

  if (!settings) {
    return <main className="min-h-screen bg-[#f4f4f2] p-5 lg:p-6"><div className="mx-auto max-w-[1500px] rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error || "No fue posible cargar las integraciones."}</div></main>;
  }

  const configured = PROVIDERS.filter((provider) => settings[provider.id].status === "ACTIVE").length;

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
              <span className="block text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">Conectadas</span>
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
                          <p className="mt-1 text-[10.5px] leading-4 text-sky-800">{provider.id === "RAPPI" ? "Cada pedido entrará a Pedidos y Cocina con los productos y el valor exacto recibido desde Rappi. Ese mismo total será el que se muestre en el comprobante de Alentó." : "Los pedidos externos entrarán a Pedidos y Cocina. El objetivo es que el equipo no tenga que operar dos flujos separados."}</p>
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
                                  <b className="block text-[11px] text-rose-950">Portal técnico de Rappi</b>
                                  <p className="mt-1 text-[10px] leading-4 text-rose-800">Este portal no conecta automáticamente tu tienda con Alentó. Sirve para soporte técnico, estado de API, POS Tester y documentación de la integración.</p>
                                </div>
                                <a
                                  href="https://integrations-manager.rappi.com/"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 rounded-xl bg-rose-600 px-4 py-2.5 text-center text-[10px] font-bold text-white shadow-sm hover:bg-rose-700"
                                >
                                  Abrir portal técnico
                                </a>
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
                          {provider.id === "RAPPI" ? (
                            <div className={`rounded-xl border p-3.5 ${providerSettings.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50" : providerSettings.status === "ERROR" ? "border-red-200 bg-red-50" : "border-neutral-200 bg-[#faf9f7]"}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <b className="block text-[11px] text-neutral-900">Estado de conexión</b>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.04em] ${statusTone(providerSettings.status)}`}>
                                      {statusLabel(providerSettings.status)}
                                    </span>
                                    {providerSettings.lastCheckedAt && (
                                      <span className="text-[9px] text-neutral-400">
                                        Verificado {new Date(providerSettings.lastCheckedAt).toLocaleString("es-CO")}
                                      </span>
                                    )}
                                  </div>
                                  {providerSettings.lastError && (
                                    <p className="mt-2 text-[10px] leading-4 text-red-700">{providerSettings.lastError}</p>
                                  )}
                                </div>
                                <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${providerSettings.status === "ACTIVE" ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,.6)]" : providerSettings.status === "ERROR" ? "bg-red-500" : "bg-amber-400"}`} />
                              </div>
                            </div>
                          ) : (
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
                          )}

                          {provider.id === "RAPPI" ? (
                            <div className="rounded-xl border border-neutral-200 bg-[#faf9f7] px-3.5 py-3">
                              <span className="block text-[9px] font-bold uppercase tracking-[0.06em] text-neutral-400">Tienda Rappi</span>
                              <b className="mt-1 block text-[12px] text-neutral-900">
                                {providerSettings.accountLinked ? providerSettings.storeName || `ID ${providerSettings.storeId}` : "Se seleccionará después de iniciar sesión"}
                              </b>
                              {providerSettings.accountLinked && providerSettings.storeAddress && (
                                <p className="mt-1 text-[10px] text-neutral-500">{providerSettings.storeAddress}</p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.05em] text-neutral-500">ID de tienda / referencia</label>
                              <input
                                value={providerSettings.storeId}
                                onChange={(event) => updateProvider(provider.id, { storeId: event.target.value })}
                                className="alento-input w-full rounded-xl px-3.5 py-3 text-sm"
                                placeholder="Identificador de tienda"
                              />
                            </div>
                          )}



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

                          {provider.id === "RAPPI" && (
                            <div className="rounded-xl border border-neutral-200 bg-white p-3.5">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <b className="block text-[11px] text-neutral-900">Conexión de la tienda</b>
                                  <p className="mt-1 text-[10px] leading-4 text-neutral-500">Inicia sesión directamente en Rappi y selecciona la tienda que deseas vincular.</p>
                                </div>
                                <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase ${providerSettings.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-neutral-50 text-neutral-500"}`}>
                                  {providerSettings.status === "ACTIVE" ? "Vinculada" : "Pendiente"}
                                </span>
                              </div>

                              {providerSettings.accountLinked ? (
                                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                                  <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-emerald-600">Tienda conectada</span>
                                  <b className="mt-1 block text-[12px] text-emerald-950">{providerSettings.storeName || "Rappi"}</b>
                                  <p className="mt-0.5 text-[10px] text-emerald-800">
                                    {providerSettings.storeAddress ? `${providerSettings.storeAddress} · ` : ""}ID {providerSettings.storeId}
                                  </p>
                                </div>
                              ) : (
                                <div className="mt-3 grid gap-2">
                                  <div className="flex items-center gap-3 rounded-xl bg-[#faf9f7] px-3 py-2.5">
                                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-black ${technicalAccess?.RAPPI.oauthClientConfigured ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                      {technicalAccess?.RAPPI.oauthClientConfigured ? "✓" : "1"}
                                    </span>
                                    <div>
                                      <b className="block text-[10.5px] text-neutral-800">Autorización Rappi</b>
                                      <p className="text-[9.5px] text-neutral-500">{technicalAccess?.RAPPI.oauthClientConfigured ? "Cliente de autorización configurado" : "Rappi debe habilitar el cliente de Alentó"}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 rounded-xl bg-[#faf9f7] px-3 py-2.5">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-neutral-200 text-[11px] font-black text-neutral-500">2</span>
                                    <div>
                                      <b className="block text-[10.5px] text-neutral-800">Login oficial</b>
                                      <p className="text-[9.5px] text-neutral-500">Rappi abrirá su propia pantalla de inicio de sesión.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 rounded-xl bg-[#faf9f7] px-3 py-2.5">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-neutral-200 text-[11px] font-black text-neutral-500">3</span>
                                    <div>
                                      <b className="block text-[10.5px] text-neutral-800">Seleccionar tienda</b>
                                      <p className="text-[9.5px] text-neutral-500">Alentó mostrará únicamente las tiendas autorizadas por Rappi.</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <b className="block text-[10.5px] text-amber-900">{provider.id === "RAPPI" ? "Tu contraseña permanece en Rappi" : "Credenciales protegidas"}</b>
                            <p className="mt-1 text-[10px] leading-4 text-amber-800">{provider.id === "RAPPI" ? "Alentó abre el login oficial en una ventana separada. El usuario y la contraseña nunca se escriben ni se almacenan en Alentó." : "Tokens, secretos y firmas no se guardarán en esta pantalla. Se configurarán en servidor cuando tengamos acceso oficial."}</p>
                          </div>

                          {provider.id === "RAPPI" ? (
                            <button
                              type="button"
                              onClick={() => connectRappi()}
                              disabled={connecting}
                              className={`w-full rounded-xl px-4 py-3 text-[11px] font-bold text-white disabled:bg-neutral-300 ${providerSettings.status === "ACTIVE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-neutral-950 hover:bg-neutral-800"}`}
                            >
                              {connecting
                                ? "Esperando a Rappi..."
                                : providerSettings.status === "ACTIVE"
                                  ? "Cambiar / reconectar tienda"
                                  : "Conectar Rappi"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void saveProvider(provider.id)}
                              disabled={saving === provider.id}
                              className="w-full rounded-xl bg-neutral-950 px-4 py-3 text-[11px] font-bold text-white disabled:bg-neutral-300"
                            >
                              {saving === provider.id ? "Guardando..." : "Guardar configuración"}
                            </button>
                          )}
                        </div>
                      </section>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        {rappiOAuthSession && rappiStores.length > 0 && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-[560px] overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_30px_90px_rgba(0,0,0,.28)]">
              <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-rose-500">Rappi autorizado</p>
                  <h2 className="mt-1 text-[21px] font-bold tracking-[-0.025em] text-neutral-950">Seleccionar tienda de Rappi</h2>
                  <p className="mt-1 text-[12px] text-neutral-500">Selecciona la tienda que deseas integrar con Alentó.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRappiOAuthSession("");
                    setRappiStores([]);
                    setSelectedRappiStoreId("");
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-lg text-neutral-500"
                >
                  ×
                </button>
              </div>

              <div className="max-h-[420px] space-y-2 overflow-y-auto p-5">
                {rappiStores.map((store) => {
                  const active = selectedRappiStoreId === store.id;
                  return (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => setSelectedRappiStoreId(store.id)}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${active ? "border-rose-300 bg-rose-50 ring-1 ring-rose-200" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? "border-rose-500" : "border-neutral-300"}`}>
                        {active && <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />}
                      </span>
                      <span className="min-w-0">
                        <b className="block text-[13px] text-neutral-950">{store.name}</b>
                        <span className="mt-1 block text-[10.5px] text-neutral-500">
                          {store.address ? `${store.address} · ` : ""}ID {store.id}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 border-t border-neutral-100 bg-[#faf9f7] px-5 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setRappiOAuthSession("");
                    setRappiStores([]);
                    setSelectedRappiStoreId("");
                  }}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-[11px] font-bold text-neutral-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedRappiStoreId || connecting}
                  onClick={() => void completeRappiStore()}
                  className="rounded-xl bg-rose-600 px-5 py-2.5 text-[11px] font-bold text-white disabled:bg-neutral-300"
                >
                  {connecting ? "Integrando..." : "Integrar"}
                </button>
              </div>
            </div>
          </div>
        )}

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
