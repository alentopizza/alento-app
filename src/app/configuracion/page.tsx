"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bike,
  CheckCircle2,
  CreditCard,
  MapPinned,
  Save,
  Store,
  Users,
} from "lucide-react";
import StoreOriginMapPicker, {
  type StoreOriginLocation,
} from "@/components/StoreOriginMapPicker";
import DeliveryCoverageMap from "@/components/DeliveryCoverageMap";

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

type SettingsSection = "STORE" | "DELIVERY" | "DRIVERS" | "CUSTOMERS" | "PAYMENTS";

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
    earningPercent: number;
    freeDeliveryEarning: number;
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
  const [activeSection, setActiveSection] = useState<SettingsSection>("STORE");

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

  const activeDeliveryBands = settings.deliveryBands.filter((band) => band.active).length;
  const activePayments = settings.paymentMethods.filter((method) => method.active).length;

  const sectionCards: Array<{
    id: SettingsSection;
    title: string;
    description: string;
    icon: typeof Store;
    status: string;
  }> = [
    {
      id: "STORE",
      title: "Sede",
      description: "Origen oficial y ubicación",
      icon: Store,
      status:
        settings.store.latitude != null && settings.store.longitude != null
          ? "Validada"
          : "Pendiente",
    },
    {
      id: "DELIVERY",
      title: "Domicilios",
      description: "Cobertura, tarifas y mapa",
      icon: MapPinned,
      status: `${activeDeliveryBands} zonas activas`,
    },
    {
      id: "DRIVERS",
      title: "Repartidores",
      description: "Capacidad, radio y ganancias",
      icon: Bike,
      status: `${settings.driverManagement.maxConcurrentDeliveries} simultáneos`,
    },
    {
      id: "CUSTOMERS",
      title: "Clientes",
      description: "Funciones sensibles",
      icon: Users,
      status: settings.customerManagement.bulkDeleteEnabled
        ? "Borrado masivo activo"
        : "Protegido",
    },
    {
      id: "PAYMENTS",
      title: "Pagos",
      description: "Medios disponibles en POS",
      icon: CreditCard,
      status: `${activePayments} activos`,
    },
  ];

  const currentSection =
    sectionCards.find((section) => section.id === activeSection) ??
    sectionCards[0];
  const CurrentSectionIcon = currentSection.icon;

  return (
    <main className="min-h-screen w-full p-3 md:p-5 xl:p-6">
      <div className="w-full space-y-4">
        <section className="relative min-h-[116px] w-full overflow-hidden rounded-[24px] border border-black/5 bg-[#0a0a0b] text-white shadow-[0_14px_36px_rgba(20,16,14,.11)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_42%,rgba(226,26,34,.55),transparent_25%),radial-gradient(circle_at_68%_100%,rgba(132,12,16,.36),transparent_34%),linear-gradient(105deg,#111319_0%,#101116_43%,#1a0b0d_67%,#5a090c_100%)]" />
          <div className="absolute inset-y-0 right-0 w-[46%] opacity-70 [background:linear-gradient(115deg,transparent_0%,rgba(255,255,255,.025)_28%,transparent_29%),repeating-linear-gradient(90deg,transparent_0_54px,rgba(255,255,255,.025)_55px_56px)]" />
          <div className="absolute right-[24%] top-[-18px] h-20 w-20 rounded-full bg-red-500/10 blur-2xl" />
          <div className="absolute right-[9%] top-[22px] h-[2px] w-[30%] bg-gradient-to-r from-transparent via-red-300/40 to-transparent" />

          <div className="relative flex min-h-[116px] flex-col justify-between gap-4 px-5 py-4 md:flex-row md:items-center md:px-6 xl:px-7">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="h-[2px] w-7 rounded-full bg-[var(--brand-red)]" />
                <p className="alento-ui-label uppercase tracking-[0.2em] text-white/55">
                  Operación
                </p>
              </div>
              <h1 className="alento-ui-hero-title mt-1.5">Configuración</h1>
              <p className="alento-ui-hero-subtitle mt-1.5 text-white/60">
                Administra sede, domicilios, repartidores, clientes y medios de pago.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 self-end md:self-auto">
              <div className="flex h-[56px] min-w-[76px] flex-col items-center justify-center rounded-[16px] border border-white/14 bg-white/[0.08] px-3 backdrop-blur-sm">
                <span className="alento-ui-micro uppercase tracking-[0.14em] text-white/50">
                  Sección
                </span>
                <b className="alento-ui-label mt-0.5 whitespace-nowrap text-white">
                  {currentSection.title}
                </b>
              </div>

              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                aria-label="Guardar configuración"
                title={saving ? "Guardando..." : "Guardar configuración"}
                className="flex h-[56px] w-[76px] items-center justify-center rounded-[16px] border border-red-400/45 bg-[linear-gradient(135deg,rgba(236,25,31,.96),rgba(119,12,16,.82))] text-white shadow-[0_10px_22px_rgba(168,11,16,.25),inset_0_1px_0_rgba(255,255,255,.13)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-wait disabled:opacity-55"
              >
                <Save className="h-[22px] w-[22px]" strokeWidth={2.15} />
              </button>
            </div>
          </div>
        </section>

        {(message || error) && (
          <div
            className={`rounded-2xl border px-4 py-3 ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
          >
            <p className="alento-ui-control">{error || message}</p>
          </div>
        )}

        <section className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {sectionCards.map((section) => {
            const Icon = section.icon;
            const selected = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setActiveSection(section.id);
                  setMessage("");
                  setError("");
                }}
                className={`group flex min-h-[104px] items-center gap-3 rounded-[20px] border p-3.5 text-left transition ${selected ? "border-red-200 bg-[linear-gradient(135deg,#171113,#100d0e)] text-white shadow-[0_12px_28px_rgba(110,10,14,.14)]" : "border-neutral-200 bg-white text-neutral-950 shadow-[0_7px_20px_rgba(28,23,20,.04)] hover:-translate-y-0.5 hover:border-neutral-300"}`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border ${selected ? "border-white/10 bg-white/[0.08] text-red-300" : "border-neutral-200 bg-[#faf9f7] text-neutral-600"}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="alento-ui-status block truncate">
                    {section.title}
                  </span>
                  <span
                    className={`alento-ui-micro mt-0.5 block truncate ${selected ? "text-white/45" : "text-neutral-500"}`}
                  >
                    {section.description}
                  </span>
                  <span
                    className={`alento-ui-label mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 ${selected ? "bg-white/[0.08] text-white/65" : "bg-neutral-100 text-neutral-500"}`}
                  >
                    {selected && (
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    )}
                    {section.status}
                  </span>
                </span>
              </button>
            );
          })}
        </section>

        <section className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_10px_30px_rgba(28,23,20,.045)]">
          <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 text-white">
                <CurrentSectionIcon className="h-4 w-4" strokeWidth={2.1} />
              </span>
              <div>
                <p className="alento-ui-label uppercase text-neutral-400">
                  Configuración
                </p>
                <h2 className="alento-ui-title mt-0.5 text-neutral-950">
                  {currentSection.title}
                </h2>
              </div>
            </div>
            <span className="alento-ui-micro hidden text-neutral-400 sm:block">
              {currentSection.description}
            </span>
          </div>

          <div className="p-4 md:p-5">

          {activeSection === "STORE" && (
            <div>
              <div className="mb-5">
                <p className="alento-ui-label uppercase text-neutral-400">Punto de origen</p>
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
                  Validamos la dirección con Google para guardar coordenadas exactas. Estas coordenadas son el centro de los rangos de domicilio y también el origen de las rutas operativas.
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
                    punto exacto desde el que se miden los rangos comerciales
                    y se calculan las rutas cuando guardes la configuración.
                  </div>
                )}
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                Pendiente validar la ubicación oficial de la sede.
              </div>
            )}
          </div>
            </div>
          )}

          {activeSection === "DELIVERY" && (
            <div>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="alento-ui-label uppercase text-neutral-400">
                Domicilios
              </p>
              <h2 className="mt-1 text-xl font-black">
                Cobertura y tarifas
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-neutral-500">
                Define cuánto se cobra según la distancia directa entre Alentó y el cliente. La ruta a pie o en moto no cambia la tarifa. La última zona activa marca el límite máximo de cobertura.
              </p>
            </div>

            <button
              type="button"
              onClick={addDeliveryBand}
              className="alento-ui-control flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white shadow-[0_7px_16px_rgba(17,17,19,.14)] transition hover:-translate-y-0.5"
             aria-label="Agregar zona" title="Agregar zona">
              +
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
                      <label className="mb-1.5 block alento-ui-label uppercase text-neutral-400">
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
                        <label className="mb-1.5 block alento-ui-label uppercase text-neutral-400">
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
                        <label className="mb-1.5 block alento-ui-label uppercase text-neutral-400">
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
                        <label className="mb-1.5 block alento-ui-label uppercase text-neutral-400">
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

          {settings.store.latitude != null &&
          settings.store.longitude != null ? (
            <DeliveryCoverageMap
              latitude={settings.store.latitude}
              longitude={settings.store.longitude}
              bands={settings.deliveryBands}
            />
          ) : (
            <div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-xs font-semibold text-amber-800">
              Valida primero la ubicación oficial de Alentó para visualizar las zonas de cobertura en el mapa.
            </div>
          )}

          <div className="mt-4 rounded-2xl bg-[#111] px-4 py-4 text-white">
            <span className="block alento-ui-label uppercase text-white/45">
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
            </div>
          )}

          {activeSection === "DRIVERS" && (
            <div>
              <div className="mb-4">
                <p className="alento-ui-label uppercase text-neutral-400">Repartidores</p>
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

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[#e21a22]/10 bg-[#fff8f8] p-4">
              <p className="alento-ui-label uppercase text-[#e21a22]">
                Ganancia por domicilio cobrado
              </p>
              <div className="mt-2 flex items-end gap-3">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.driverManagement.earningPercent}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      driverManagement: {
                        ...settings.driverManagement,
                        earningPercent: Math.min(
                          100,
                          Math.max(0, Number(event.target.value) || 0),
                        ),
                      },
                    })
                  }
                  className="h-12 w-28 rounded-2xl border border-neutral-200 bg-white px-4 text-2xl font-black tabular-nums outline-none"
                  aria-label="Porcentaje de ganancia del repartidor"
                />
                <span className="pb-3 text-xl font-black text-neutral-400">%</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                Se calcula sobre el valor de domicilio cobrado al cliente y queda congelado cuando el repartidor marca el pedido como entregado.
              </p>
              <div className="mt-3 rounded-xl border border-[#e21a22]/10 bg-white px-3 py-2.5 text-[11px] font-semibold text-neutral-600">
                Ejemplo con domicilio de $5.000:{" "}
                <b className="text-[#e21a22]">
                  {"$" + Math.round(
                    (5000 * settings.driverManagement.earningPercent) / 100,
                  ).toLocaleString("es-CO")}
                </b>{" "}
                para el repartidor.
              </div>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="alento-ui-label uppercase text-amber-700">
                Incentivo para entrega sin costo
              </p>
              <div className="mt-2 flex items-end gap-2">
                <span className="pb-3 text-xl font-black text-neutral-400">$</span>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  step={500}
                  value={settings.driverManagement.freeDeliveryEarning}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      driverManagement: {
                        ...settings.driverManagement,
                        freeDeliveryEarning: Math.min(
                          100000,
                          Math.max(0, Math.round(Number(event.target.value) || 0)),
                        ),
                      },
                    })
                  }
                  className="h-12 w-36 rounded-2xl border border-neutral-200 bg-white px-4 text-2xl font-black tabular-nums outline-none"
                  aria-label="Incentivo para domicilios gratuitos"
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                Si el cliente tiene domicilio $0 por cercanía, este valor se reconoce al repartidor como incentivo sin alterar el total cobrado al cliente.
              </p>
              <div className="mt-3 rounded-xl border border-amber-100 bg-white px-3 py-2.5 text-[11px] font-semibold text-neutral-600">
                Domicilio gratis → el repartidor gana{" "}
                <b className="text-amber-700">
                  {"$" + settings.driverManagement.freeDeliveryEarning.toLocaleString("es-CO")}
                </b>.
              </div>
            </div>
          </div>
            </div>
          )}

          {activeSection === "CUSTOMERS" && (
            <div>
              <div className="mb-4">
                <p className="alento-ui-label uppercase text-neutral-400">Clientes</p>
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
            </div>
          )}

          {activeSection === "PAYMENTS" && (
            <div>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="alento-ui-label uppercase text-neutral-400">Caja</p>
              <h2 className="mt-1 text-xl font-black">Medios de pago</h2>
              <p className="mt-1 text-sm text-neutral-500">Solo los medios activos aparecerán durante el cierre de un pedido.</p>
            </div>
            <button
              type="button"
              onClick={addPayment}
              aria-label="Agregar medio de pago"
              title="Agregar medio de pago"
              className="alento-ui-control flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white shadow-[0_7px_16px_rgba(17,17,19,.14)] transition hover:-translate-y-0.5"
            >
              +
            </button>
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
            </div>
          )}
          </div>
        </section>
      </div>
    </main>
  );
}
