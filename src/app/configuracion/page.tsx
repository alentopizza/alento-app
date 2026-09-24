"use client";

import { useCallback, useEffect, useState } from "react";
import StoreOriginMapPicker, {
  type StoreOriginLocation,
} from "@/components/StoreOriginMapPicker";

type DeliveryBand = {
  id: string;
  name: string;
  minMeters: number;
  maxMeters: number;
  fee: number;
  active: boolean;
};

type PaymentMethodSetting = {
  id: string;
  name: string;
  active: boolean;
};

type PosSettings = {
  store: {
    address: string;
    mapsUrl: string;
    placeId: string;
    latitude: number | null;
    longitude: number | null;
    formattedAddress: string;
  };
  deliveryBands: DeliveryBand[];
  paymentMethods: PaymentMethodSetting[];
  customerManagement: {
    bulkDeleteEnabled: boolean;
  };
  driverManagement: {
    maxConcurrentDeliveries: number;
    acceptanceRadiusMeters: number;
  };
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<PosSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validatingStore, setValidatingStore] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [storePinAdjusted, setStorePinAdjusted] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible cargar la configuración.");
        setSettings(data.settings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar la configuración.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function updatePayment(id: string, patch: Partial<PaymentMethodSetting>) {
    setSettings((current) => current ? { ...current, paymentMethods: current.paymentMethods.map((method) => method.id === id ? { ...method, ...patch } : method) } : current);
  }

  function addPayment() {
    setSettings((current) => current ? { ...current, paymentMethods: [...current.paymentMethods, { id: `payment-${Date.now()}`, name: "Nuevo medio de pago", active: true }] } : current);
  }

  function removePayment(id: string) {
    setSettings((current) => current ? { ...current, paymentMethods: current.paymentMethods.filter((method) => method.id !== id) } : current);
  }

  function updateDeliveryBand(id: string, patch: Partial<DeliveryBand>) {
    setSettings((current) =>
      current
        ? {
            ...current,
            deliveryBands: current.deliveryBands.map((band) =>
              band.id === id ? { ...band, ...patch } : band,
            ),
          }
        : current,
    );
  }

  function addDeliveryBand() {
    setSettings((current) => {
      if (!current) return current;

      const ordered = [...current.deliveryBands].sort(
        (a, b) => a.minMeters - b.minMeters,
      );
      const last = ordered[ordered.length - 1];
      const minMeters = last ? Math.max(0, last.maxMeters + 1) : 0;
      const maxMeters = minMeters + 999;

      return {
        ...current,
        deliveryBands: [
          ...current.deliveryBands,
          {
            id: `band-${Date.now()}`,
            name: `Zona ${current.deliveryBands.length + 1}`,
            minMeters,
            maxMeters,
            fee: last?.fee ?? 0,
            active: false,
          },
        ],
      };
    });
  }

  function removeDeliveryBand(id: string) {
    setSettings((current) =>
      current
        ? {
            ...current,
            deliveryBands: current.deliveryBands.filter(
              (band) => band.id !== id,
            ),
          }
        : current,
    );
  }

  async function validateStoreLocation() {
    if (!settings?.store.address.trim()) return;
    setValidatingStore(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/settings/store-geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: settings.store.address }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible validar la dirección.");

      setSettings((current) =>
        current
          ? {
              ...current,
              store: {
                ...current.store,
                placeId: data.location.placeId,
                latitude: data.location.latitude,
                longitude: data.location.longitude,
                formattedAddress: data.location.formattedAddress,
              },
            }
          : current,
      );
      setMessage("Ubicación validada con Google Maps. Guarda la configuración para conservarla.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible validar la dirección.");
    } finally {
      setValidatingStore(false);
    }
  }

  const handleStoreOriginChange = useCallback(
    (location: StoreOriginLocation) => {
      setSettings((current) =>
        current
          ? {
              ...current,
              store: {
                ...current.store,
                formattedAddress: location.formattedAddress,
                placeId: location.placeId,
                latitude: location.latitude,
                longitude: location.longitude,
              },
            }
          : current,
      );
      setStorePinAdjusted(true);
      setMessage(
        "Origen ajustado manualmente en el mapa. Guarda la configuración para conservarlo.",
      );
      setError("");
    },
    [],
  );

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible guardar la configuración.");
      setSettings(data.settings);
      setStorePinAdjusted(false);
      setMessage("Configuración guardada correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="p-5 lg:p-8"><div className="alento-card mx-auto max-w-6xl rounded-[28px] p-8">Cargando configuración...</div></main>;
  if (!settings) return <main className="p-5 lg:p-8"><div className="mx-auto max-w-6xl rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700">{error || "No fue posible cargar la configuración."}</div></main>;

  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">Operación</p>
            <h1 className="text-3xl font-black tracking-tight">Configuración</h1>
            <p className="mt-1 text-sm text-neutral-500">Administra la sede, funciones operativas y medios de pago.</p>
          </div>
          <button onClick={() => void save()} disabled={saving} className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 text-sm font-black text-white disabled:bg-neutral-300">{saving ? "Guardando..." : "Guardar configuración"}</button>
        </div>

        {(message || error) && <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${error ? "border border-red-200 bg-red-50 text-red-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}

        <section className="alento-card rounded-[28px] p-5 md:p-6">
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Punto de origen</p>
            <h2 className="mt-1 text-xl font-black">Ubicación de Alentó Pizza</h2>
            <p className="mt-1 text-sm text-neutral-500">Define el origen oficial usado por Google Maps para calcular rutas y domicilios.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-black">Dirección del local</label>
              <input
                value={settings.store.address}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    store: {
                      ...settings.store,
                      address: event.target.value,
                      placeId: "",
                      latitude: null,
                      longitude: null,
                      formattedAddress: "",
                    },
                  })
                }
                className="alento-input w-full rounded-2xl px-4 py-3"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black">Enlace de Google Maps</label>
              <input value={settings.store.mapsUrl} onChange={(event) => setSettings({ ...settings, store: { ...settings.store, mapsUrl: event.target.value } })} className="alento-input w-full rounded-2xl px-4 py-3" />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-[#faf9f7] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <b className="block text-sm">Origen oficial para domicilios</b>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Validamos la dirección con Google para guardar coordenadas exactas y usarla como origen de Routes API.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void validateStoreLocation()}
                disabled={validatingStore}
                className="shrink-0 rounded-2xl bg-black px-4 py-3 text-xs font-black text-white disabled:bg-neutral-300"
              >
                {validatingStore ? "Validando..." : "Validar con Google Maps"}
              </button>
            </div>

            {settings.store.latitude != null && settings.store.longitude != null ? (
              <>
                <div className="mt-3 grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 md:grid-cols-2">
                  <div>
                    <b>Dirección validada</b>
                    <p className="mt-1">
                      {settings.store.formattedAddress || settings.store.address}
                    </p>
                  </div>
                  <div>
                    <b>Coordenadas</b>
                    <p className="mt-1">
                      {settings.store.latitude.toFixed(6)},{" "}
                      {settings.store.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <StoreOriginMapPicker
                    latitude={settings.store.latitude}
                    longitude={settings.store.longitude}
                    onChange={handleStoreOriginChange}
                  />
                </div>

                {storePinAdjusted && (
                  <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-[11px] font-semibold text-blue-800">
                    Ubicación ajustada manualmente. Estas coordenadas serán el
                    origen exacto usado por Google Routes cuando guardes la
                    configuración.
                  </div>
                )}
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                Pendiente validar la ubicación oficial de la sede.
              </div>
            )}
          </div>
        </section>

        <section className="alento-card rounded-[28px] p-5 md:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                Domicilios
              </p>
              <h2 className="mt-1 text-xl font-black">
                Cobertura y tarifas
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-neutral-500">
                Define cuánto se cobra según la distancia real por carretera calculada desde Alentó. La última zona activa marca el límite máximo de cobertura.
              </p>
            </div>

            <button
              type="button"
              onClick={addDeliveryBand}
              className="shrink-0 rounded-2xl bg-black px-4 py-3 text-xs font-black text-white"
            >
              + Agregar zona
            </button>
          </div>

          <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
            Los rangos activos deben ser continuos: por ejemplo 0–2000 m, 2001–4000 m y 4001–6000 m. Si reduces la última zona, también reduces la cobertura disponible para nuevos domicilios.
          </div>

          <div className="space-y-3">
            {[...settings.deliveryBands]
              .sort((a, b) => a.minMeters - b.minMeters)
              .map((band, index) => (
                <article
                  key={band.id}
                  className={
                    "rounded-[22px] border p-4 " +
                    (band.active
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-neutral-200 bg-[#faf9f7]")
                  }
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
                    <div className="min-w-0 flex-1">
                      <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400">
                        Nombre de zona
                      </label>
                      <input
                        value={band.name}
                        onChange={(event) =>
                          updateDeliveryBand(band.id, {
                            name: event.target.value,
                          })
                        }
                        className="alento-input w-full rounded-xl px-3 py-2.5 text-sm font-bold"
                      />
                    </div>

                    <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
                      <div>
                        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400">
                          Desde
                        </label>
                        <div className="flex items-center rounded-xl border bg-white">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={band.minMeters}
                            onChange={(event) =>
                              updateDeliveryBand(band.id, {
                                minMeters: Math.max(
                                  0,
                                  Number(event.target.value) || 0,
                                ),
                              })
                            }
                            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-black outline-none"
                          />
                          <span className="pr-3 text-[9px] font-black uppercase text-neutral-400">
                            m
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400">
                          Hasta
                        </label>
                        <div className="flex items-center rounded-xl border bg-white">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={band.maxMeters}
                            onChange={(event) =>
                              updateDeliveryBand(band.id, {
                                maxMeters: Math.max(
                                  0,
                                  Number(event.target.value) || 0,
                                ),
                              })
                            }
                            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-black outline-none"
                          />
                          <span className="pr-3 text-[9px] font-black uppercase text-neutral-400">
                            m
                          </span>
                        </div>
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400">
                          Tarifa
                        </label>
                        <div className="flex items-center rounded-xl border bg-white">
                          <span className="pl-3 text-xs font-black text-neutral-500">
                            $
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={500}
                            value={band.fee}
                            onChange={(event) =>
                              updateDeliveryBand(band.id, {
                                fee: Math.max(
                                  0,
                                  Number(event.target.value) || 0,
                                ),
                              })
                            }
                            className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm font-black outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateDeliveryBand(band.id, {
                            active: !band.active,
                          })
                        }
                        className={
                          "h-11 rounded-xl px-4 text-[10px] font-black transition " +
                          (band.active
                            ? "bg-emerald-600 text-white"
                            : "bg-neutral-200 text-neutral-500")
                        }
                        aria-pressed={band.active}
                      >
                        {band.active ? "Activa" : "Inactiva"}
                      </button>

                      <button
                        type="button"
                        onClick={() => removeDeliveryBand(band.id)}
                        disabled={settings.deliveryBands.length <= 1}
                        className="h-11 rounded-xl border border-red-200 bg-white px-3 text-[10px] font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`Eliminar ${band.name || `zona ${index + 1}`}`}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-neutral-500">
                    <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">
                      {(band.minMeters / 1000).toFixed(
                        band.minMeters % 1000 === 0 ? 0 : 1,
                      )}{" "}
                      km →{" "}
                      {(band.maxMeters / 1000).toFixed(
                        band.maxMeters % 1000 === 0 ? 0 : 1,
                      )}{" "}
                      km
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">
                      {new Intl.NumberFormat("es-CO", {
                        style: "currency",
                        currency: "COP",
                        maximumFractionDigits: 0,
                      }).format(band.fee)}
                    </span>
                    {band.active && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-black text-emerald-700">
                        Incluida en cobertura
                      </span>
                    )}
                  </div>
                </article>
              ))}
          </div>

          <div className="mt-4 rounded-2xl bg-[#111] px-4 py-4 text-white">
            <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-white/45">
              Cobertura máxima actual
            </span>
            <strong className="mt-1 block text-xl font-black">
              {(() => {
                const active = settings.deliveryBands.filter(
                  (band) => band.active,
                );
                const maxMeters = active.length
                  ? Math.max(...active.map((band) => band.maxMeters))
                  : 0;
                return maxMeters >= 1000
                  ? `${(maxMeters / 1000).toFixed(
                      maxMeters % 1000 === 0 ? 0 : 1,
                    )} km`
                  : `${maxMeters} m`;
              })()}
            </strong>
            <p className="mt-1 text-[10px] text-white/45">
              Una dirección por fuera de este límite se rechazará como fuera de cobertura.
            </p>
          </div>
        </section>

        <section className="alento-card rounded-[28px] p-5 md:p-6">
          <div className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Repartidores</p>
            <h2 className="mt-1 text-xl font-black">Capacidad simultánea</h2>
            <p className="mt-1 text-sm text-neutral-500">Define cuántos domicilios sin entregar puede tener asignados al mismo tiempo cada repartidor.</p>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border bg-[#faf9f7] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <b className="block text-sm text-neutral-900">Máximo de pedidos por repartidor</b>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">
                Al alcanzar este límite el repartidor ya no podrá autoasignarse otro domicilio y el panel administrativo también bloqueará nuevas asignaciones. Los pedidos entregados, finalizados o cancelados liberan cupo automáticamente.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setSettings({
                  ...settings,
                  driverManagement: {
                    ...settings.driverManagement,
                    maxConcurrentDeliveries: Math.max(1, settings.driverManagement.maxConcurrentDeliveries - 1),
                  },
                })}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-lg font-black text-neutral-700"
                aria-label="Reducir máximo de pedidos simultáneos"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={10}
                value={settings.driverManagement.maxConcurrentDeliveries}
                onChange={(event) => setSettings({
                  ...settings,
                  driverManagement: {
                    ...settings.driverManagement,
                    maxConcurrentDeliveries: Math.min(10, Math.max(1, Number(event.target.value) || 1)),
                  },
                })}
                className="h-10 w-16 rounded-xl border-0 bg-transparent text-center text-xl font-black tabular-nums outline-none"
                aria-label="Máximo de pedidos simultáneos por repartidor"
              />
              <button
                type="button"
                onClick={() => setSettings({
                  ...settings,
                  driverManagement: {
                    ...settings.driverManagement,
                    maxConcurrentDeliveries: Math.min(10, settings.driverManagement.maxConcurrentDeliveries + 1),
                  },
                })}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-lg font-black text-white"
                aria-label="Aumentar máximo de pedidos simultáneos"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <b className="block text-sm text-neutral-900">
                Radio para aceptar domicilios
              </b>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">
                El repartidor debe estar dentro de esta zona alrededor de Alentó para autoasignarse un pedido. Salir de la zona durante una entrega no afecta los pedidos que ya tenga asignados.
              </p>
              <p className="mt-2 text-[11px] font-black text-emerald-700">
                Radio actual: {settings.driverManagement.acceptanceRadiusMeters >= 1000
                  ? `${(settings.driverManagement.acceptanceRadiusMeters / 1000).toFixed(
                      settings.driverManagement.acceptanceRadiusMeters % 1000 === 0 ? 0 : 1,
                    )} km`
                  : `${settings.driverManagement.acceptanceRadiusMeters} m`}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-emerald-200 bg-white p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() =>
                  setSettings({
                    ...settings,
                    driverManagement: {
                      ...settings.driverManagement,
                      acceptanceRadiusMeters: Math.max(
                        100,
                        settings.driverManagement.acceptanceRadiusMeters - 100,
                      ),
                    },
                  })
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-lg font-black text-neutral-700"
                aria-label="Reducir radio de aceptación"
              >
                −
              </button>
              <input
                type="number"
                min={100}
                max={10000}
                step={100}
                value={settings.driverManagement.acceptanceRadiusMeters}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    driverManagement: {
                      ...settings.driverManagement,
                      acceptanceRadiusMeters: Math.min(
                        10000,
                        Math.max(100, Number(event.target.value) || 100),
                      ),
                    },
                  })
                }
                className="h-10 w-20 rounded-xl border-0 bg-transparent text-center text-lg font-black tabular-nums outline-none"
                aria-label="Radio en metros para aceptar domicilios"
              />
              <span className="pr-1 text-[10px] font-black uppercase text-neutral-400">
                m
              </span>
              <button
                type="button"
                onClick={() =>
                  setSettings({
                    ...settings,
                    driverManagement: {
                      ...settings.driverManagement,
                      acceptanceRadiusMeters: Math.min(
                        10000,
                        settings.driverManagement.acceptanceRadiusMeters + 100,
                      ),
                    },
                  })
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-lg font-black text-white"
                aria-label="Aumentar radio de aceptación"
              >
                +
              </button>
            </div>
          </div>
        </section>

        <section className="alento-card rounded-[28px] p-5 md:p-6">
          <div className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Clientes</p>
            <h2 className="mt-1 text-xl font-black">Gestión de clientes</h2>
            <p className="mt-1 text-sm text-neutral-500">Controla funciones sensibles del módulo de clientes.</p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border bg-[#faf9f7] p-4">
            <div className="min-w-0">
              <b className="block text-sm text-neutral-900">Permitir eliminación masiva</b>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Si está desactivado, la selección múltiple para eliminar clientes no aparecerá y el servidor rechazará cualquier intento de borrado masivo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettings({
                ...settings,
                customerManagement: {
                  ...settings.customerManagement,
                  bulkDeleteEnabled: !settings.customerManagement.bulkDeleteEnabled,
                },
              })}
              className={`relative h-8 w-14 shrink-0 rounded-full transition ${settings.customerManagement.bulkDeleteEnabled ? "bg-emerald-500" : "bg-neutral-300"}`}
              aria-pressed={settings.customerManagement.bulkDeleteEnabled}
              aria-label="Permitir eliminación masiva de clientes"
            >
              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${settings.customerManagement.bulkDeleteEnabled ? "left-7" : "left-1"}`} />
            </button>
          </div>
        </section>

        <section className="alento-card rounded-[28px] p-5 md:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Caja</p>
              <h2 className="mt-1 text-xl font-black">Medios de pago</h2>
              <p className="mt-1 text-sm text-neutral-500">Solo los medios activos aparecerán durante el cierre de un pedido.</p>
            </div>
            <button onClick={addPayment} className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-black">+ Agregar medio</button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {settings.paymentMethods.map((method) => (
              <div key={method.id} className="flex items-center gap-2 rounded-2xl border bg-[#faf9f7] p-3">
                <button onClick={() => updatePayment(method.id, { active: !method.active })} className={`shrink-0 rounded-xl px-3 py-2.5 text-xs font-black ${method.active ? "bg-black text-white" : "bg-neutral-200 text-neutral-500"}`}>{method.active ? "Activo" : "Inactivo"}</button>
                <input value={method.name} onChange={(event) => updatePayment(method.id, { name: event.target.value })} className="alento-input min-w-0 flex-1 rounded-xl px-3 py-2.5" />
                <button onClick={() => removePayment(method.id)} disabled={settings.paymentMethods.length === 1} className="rounded-xl border border-red-200 bg-white px-3 py-2.5 text-xs font-black text-red-600 disabled:border-neutral-200 disabled:text-neutral-300">Eliminar</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
