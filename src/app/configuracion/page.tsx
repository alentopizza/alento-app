"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bike,
  CalendarDays,
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

type PaymentUsageStat = {
  id: string;
  name: string;
  transactionCount: number;
  amount: number;
  usagePercent: number;
  amountPercent: number;
  lastUsedAt: string | null;
};

type PaymentSummary = {
  startDate: string;
  endDate: string;
  totalTransactions: number;
  totalAmount: number;
  unclassifiedTransactions: number;
  unclassifiedAmount: number;
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

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortDate(value: string | null) {
  if (!value) return "Sin registros";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function todayBogotaText() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${map.year}-${map.month}-${map.day}`;
}

function monthStartBogotaText() {
  const today = todayBogotaText();
  return `${today.slice(0, 7)}-01`;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PosSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validatingStore, setValidatingStore] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [storePinAdjusted, setStorePinAdjusted] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>("STORE");
  const [paymentStats, setPaymentStats] = useState<PaymentUsageStat[]>([]);
  const [paymentStartDate, setPaymentStartDate] = useState(
    () => monthStartBogotaText(),
  );
  const [paymentEndDate, setPaymentEndDate] = useState(
    () => todayBogotaText(),
  );
  const [paymentStatsLoading, setPaymentStatsLoading] = useState(false);
  const [paymentStatsError, setPaymentStatsError] = useState("");
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary>({
    startDate: monthStartBogotaText(),
    endDate: todayBogotaText(),
    totalTransactions: 0,
    totalAmount: 0,
    unclassifiedTransactions: 0,
    unclassifiedAmount: 0,
  });

  useEffect(() => {
    async function load() {
      const startDate = monthStartBogotaText();
      const endDate = todayBogotaText();

      try {
        const [settingsResponse, statsResponse] = await Promise.all([
          fetch("/api/settings", { cache: "no-store" }),
          fetch(
            `/api/settings/payment-stats?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
            { cache: "no-store" },
          ),
        ]);

        const settingsData = await settingsResponse.json();
        if (!settingsResponse.ok) {
          throw new Error(
            settingsData.error || "No fue posible cargar la configuración.",
          );
        }
        setSettings(settingsData.settings);

        const statsData = await statsResponse.json();
        if (statsResponse.ok) {
          setPaymentStats(
            Array.isArray(statsData.paymentStats)
              ? statsData.paymentStats
              : [],
          );
          setPaymentSummary(
            statsData.paymentSummary ?? {
              startDate,
              endDate,
              totalTransactions: 0,
              totalAmount: 0,
              unclassifiedTransactions: 0,
              unclassifiedAmount: 0,
            },
          );
        } else {
          setPaymentStatsError(
            statsData.error ||
              "No fue posible cargar las estadísticas de pagos.",
          );
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No fue posible cargar la configuración.",
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function refreshPaymentStats(
    startDate: string,
    endDate: string,
  ) {
    if (!startDate || !endDate || startDate > endDate) {
      setPaymentStatsError(
        "Selecciona un rango válido: la fecha inicial no puede ser posterior a la final.",
      );
      return;
    }

    setPaymentStatsLoading(true);
    setPaymentStatsError("");

    try {
      const response = await fetch(
        `/api/settings/payment-stats?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible cargar las estadísticas de pagos.",
        );
      }

      setPaymentStats(
        Array.isArray(data.paymentStats) ? data.paymentStats : [],
      );
      setPaymentSummary(
        data.paymentSummary ?? {
          startDate,
          endDate,
          totalTransactions: 0,
          totalAmount: 0,
          unclassifiedTransactions: 0,
          unclassifiedAmount: 0,
        },
      );
    } catch (err) {
      setPaymentStatsError(
        err instanceof Error
          ? err.message
          : "No fue posible cargar las estadísticas de pagos.",
      );
    } finally {
      setPaymentStatsLoading(false);
    }
  }

  function showPaymentsToday() {
    const today = todayBogotaText();
    setPaymentStartDate(today);
    setPaymentEndDate(today);
    void refreshPaymentStats(today, today);
  }

  function showPaymentsThisMonth() {
    const startDate = monthStartBogotaText();
    const endDate = todayBogotaText();
    setPaymentStartDate(startDate);
    setPaymentEndDate(endDate);
    void refreshPaymentStats(startDate, endDate);
  }

  function togglePayment(id: string) {
    setSettings((current) =>
      current
        ? {
            ...current,
            paymentMethods: current.paymentMethods.map((method) =>
              method.id === id
                ? { ...method, active: !method.active }
                : method,
            ),
          }
        : current,
    );
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

  const paymentCards = settings.paymentMethods
    .map((method) => {
      const stats = paymentStats.find((item) => item.id === method.id);
      return {
        ...method,
        transactionCount: stats?.transactionCount ?? 0,
        amount: stats?.amount ?? 0,
        usagePercent: stats?.usagePercent ?? 0,
        amountPercent: stats?.amountPercent ?? 0,
        lastUsedAt: stats?.lastUsedAt ?? null,
      };
    })
    .sort((a, b) => b.usagePercent - a.usagePercent);

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
            <div className="grid gap-4 xl:grid-cols-[minmax(340px,.78fr)_minmax(0,1.22fr)] xl:items-start">
              <div className="space-y-3">
                <div>
                  <p className="alento-ui-label uppercase text-neutral-400">
                    Punto de origen
                  </p>
                  <h2 className="alento-ui-title mt-1 text-neutral-950">
                    Ubicación de Alentó Pizza
                  </h2>
                  <p className="alento-ui-body mt-1 text-neutral-500">
                    Define el punto oficial usado para rutas, cobertura y domicilios.
                  </p>
                </div>

                <div className="rounded-[18px] border border-neutral-200 bg-[#faf9f7] p-3.5">
                  <div className="space-y-3">
                    <div>
                      <label className="alento-ui-label mb-1.5 block text-neutral-500">
                        Dirección del local
                      </label>
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
                        className="alento-ui-control h-11 w-full rounded-[14px] border border-neutral-200 bg-white px-3.5 outline-none transition focus:border-neutral-400"
                      />
                    </div>

                    <div>
                      <label className="alento-ui-label mb-1.5 block text-neutral-500">
                        Enlace de Google Maps
                      </label>
                      <input
                        value={settings.store.mapsUrl}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            store: {
                              ...settings.store,
                              mapsUrl: event.target.value,
                            },
                          })
                        }
                        className="alento-ui-control h-11 w-full rounded-[14px] border border-neutral-200 bg-white px-3.5 outline-none transition focus:border-neutral-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[18px] border border-neutral-200 bg-white p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="alento-ui-label uppercase text-neutral-400">
                        Origen oficial
                      </p>
                      <h3 className="alento-ui-status mt-1 text-neutral-950">
                        Validación de ubicación
                      </h3>
                    </div>
                    <span
                      className={`alento-ui-label rounded-full px-2.5 py-1 ${settings.store.latitude != null && settings.store.longitude != null ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {settings.store.latitude != null &&
                      settings.store.longitude != null
                        ? "Validada"
                        : "Pendiente"}
                    </span>
                  </div>

                  <p className="alento-ui-micro mt-2 leading-5 text-neutral-500">
                    Google valida la dirección y guarda las coordenadas exactas
                    usadas como centro de cobertura.
                  </p>

                  {settings.store.latitude != null &&
                  settings.store.longitude != null ? (
                    <div className="mt-3 grid gap-2">
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                        <span className="alento-ui-micro uppercase text-emerald-600">
                          Dirección validada
                        </span>
                        <b className="alento-ui-control mt-1 block text-emerald-900">
                          {settings.store.formattedAddress ||
                            settings.store.address}
                        </b>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-[#faf9f7] px-3 py-2.5">
                        <span className="alento-ui-micro uppercase text-neutral-400">
                          Coordenadas
                        </span>
                        <b className="alento-ui-control mt-1 block tabular-nums text-neutral-900">
                          {settings.store.latitude.toFixed(6)},{" "}
                          {settings.store.longitude.toFixed(6)}
                        </b>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                      <p className="alento-ui-micro text-amber-800">
                        Falta validar el origen oficial de la sede.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void validateStoreLocation()}
                    disabled={validatingStore}
                    className="alento-ui-control mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-neutral-950 px-4 text-white transition hover:bg-black disabled:bg-neutral-300"
                  >
                    {validatingStore
                      ? "Validando..."
                      : "Validar con Google Maps"}
                  </button>
                </div>
              </div>

              <div className="xl:sticky xl:top-4">
                {settings.store.latitude != null &&
                settings.store.longitude != null ? (
                  <>
                    <StoreOriginMapPicker
                      latitude={settings.store.latitude}
                      longitude={settings.store.longitude}
                      onChange={handleStoreOriginChange}
                    />
                    {storePinAdjusted && (
                      <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
                        <p className="alento-ui-micro text-blue-800">
                          Pin ajustado manualmente. Guarda la configuración para
                          conservar este origen.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex min-h-[420px] items-center justify-center rounded-[20px] border border-dashed border-neutral-300 bg-[#faf9f7] p-8 text-center">
                    <div>
                      <MapPinned className="mx-auto h-7 w-7 text-neutral-300" />
                      <b className="alento-ui-status mt-3 block text-neutral-700">
                        Mapa pendiente
                      </b>
                      <p className="alento-ui-micro mt-1 text-neutral-500">
                        Valida la dirección del local para habilitar el mapa del
                        origen oficial.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === "DELIVERY" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(520px,.94fr)_minmax(0,1.06fr)] xl:items-start">
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="alento-ui-label uppercase text-neutral-400">
                      Domicilios
                    </p>
                    <h2 className="alento-ui-title mt-1 text-neutral-950">
                      Cobertura y tarifas
                    </h2>
                    <p className="alento-ui-body mt-1 max-w-2xl text-neutral-500">
                      Define los rangos de distancia y cuánto se cobra en cada
                      zona.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addDeliveryBand}
                    className="alento-ui-control flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white shadow-[0_7px_16px_rgba(17,17,19,.14)] transition hover:-translate-y-0.5"
                    aria-label="Agregar zona"
                    title="Agregar zona"
                  >
                    +
                  </button>
                </div>

                <div className="mb-3 grid grid-cols-3 gap-2">
                  <div className="rounded-[14px] border border-neutral-200 bg-[#faf9f7] px-3 py-2.5">
                    <span className="alento-ui-micro uppercase text-neutral-400">
                      Zonas activas
                    </span>
                    <b className="alento-ui-status mt-1 block text-neutral-950">
                      {activeDeliveryBands}
                    </b>
                  </div>
                  <div className="rounded-[14px] border border-neutral-200 bg-[#faf9f7] px-3 py-2.5">
                    <span className="alento-ui-micro uppercase text-neutral-400">
                      Cobertura
                    </span>
                    <b className="alento-ui-status mt-1 block text-neutral-950">
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
                    </b>
                  </div>
                  <div className="rounded-[14px] border border-neutral-200 bg-[#faf9f7] px-3 py-2.5">
                    <span className="alento-ui-micro uppercase text-neutral-400">
                      Tarifa máxima
                    </span>
                    <b className="alento-ui-status mt-1 block text-[var(--brand-red)]">
                      {formatCOP(
                        settings.deliveryBands.length
                          ? Math.max(
                              ...settings.deliveryBands
                                .filter((band) => band.active)
                                .map((band) => band.fee),
                              0,
                            )
                          : 0,
                      )}
                    </b>
                  </div>
                </div>

                <div className="mb-3 rounded-[14px] border border-blue-100 bg-blue-50 px-3 py-2.5">
                  <p className="alento-ui-micro leading-5 text-blue-800">
                    Los rangos activos deben ser continuos. La última zona
                    activa define el límite máximo de cobertura.
                  </p>
                </div>

                <div className="space-y-2">
                  {[...settings.deliveryBands]
                    .sort((a, b) => a.minMeters - b.minMeters)
                    .map((band, index) => (
                      <article
                        key={band.id}
                        className={`rounded-[17px] border p-3 ${band.active ? "border-emerald-200 bg-emerald-50/45" : "border-neutral-200 bg-[#faf9f7]"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <input
                              value={band.name}
                              onChange={(event) =>
                                updateDeliveryBand(band.id, {
                                  name: event.target.value,
                                })
                              }
                              className="alento-ui-control h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 font-bold outline-none focus:border-neutral-400"
                              aria-label={`Nombre de zona ${index + 1}`}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              updateDeliveryBand(band.id, {
                                active: !band.active,
                              })
                            }
                            className={`alento-ui-label h-9 shrink-0 rounded-xl px-3 transition ${band.active ? "bg-emerald-600 text-white" : "bg-neutral-200 text-neutral-500"}`}
                            aria-pressed={band.active}
                          >
                            {band.active ? "Activa" : "Inactiva"}
                          </button>

                          <button
                            type="button"
                            onClick={() => removeDeliveryBand(band.id)}
                            disabled={settings.deliveryBands.length <= 1}
                            className="alento-ui-label flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 disabled:opacity-30"
                            aria-label={`Eliminar ${band.name || `zona ${index + 1}`}`}
                            title="Eliminar zona"
                          >
                            ×
                          </button>
                        </div>

                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <label className="rounded-xl border border-neutral-200 bg-white px-2.5 py-2">
                            <span className="alento-ui-micro uppercase text-neutral-400">
                              Desde
                            </span>
                            <div className="mt-0.5 flex items-center gap-1">
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
                                className="alento-ui-control min-w-0 flex-1 bg-transparent outline-none"
                              />
                              <span className="alento-ui-micro text-neutral-400">
                                m
                              </span>
                            </div>
                          </label>

                          <label className="rounded-xl border border-neutral-200 bg-white px-2.5 py-2">
                            <span className="alento-ui-micro uppercase text-neutral-400">
                              Hasta
                            </span>
                            <div className="mt-0.5 flex items-center gap-1">
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
                                className="alento-ui-control min-w-0 flex-1 bg-transparent outline-none"
                              />
                              <span className="alento-ui-micro text-neutral-400">
                                m
                              </span>
                            </div>
                          </label>

                          <label className="rounded-xl border border-neutral-200 bg-white px-2.5 py-2">
                            <span className="alento-ui-micro uppercase text-neutral-400">
                              Tarifa
                            </span>
                            <div className="mt-0.5 flex items-center gap-1">
                              <span className="alento-ui-micro text-neutral-400">
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
                                className="alento-ui-control min-w-0 flex-1 bg-transparent outline-none"
                              />
                            </div>
                          </label>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="alento-ui-micro rounded-full bg-white px-2 py-1 text-neutral-500 shadow-sm">
                            {(band.minMeters / 1000).toFixed(
                              band.minMeters % 1000 === 0 ? 0 : 1,
                            )}{" "}
                            km →{" "}
                            {(band.maxMeters / 1000).toFixed(
                              band.maxMeters % 1000 === 0 ? 0 : 1,
                            )}{" "}
                            km
                          </span>
                          <span className="alento-ui-micro rounded-full bg-white px-2 py-1 text-neutral-500 shadow-sm">
                            {formatCOP(band.fee)}
                          </span>
                          {band.active && (
                            <span className="alento-ui-micro rounded-full bg-emerald-100 px-2 py-1 font-bold text-emerald-700">
                              Incluida en cobertura
                            </span>
                          )}
                        </div>
                      </article>
                    ))}
                </div>
              </div>

              <div className="xl:sticky xl:top-4">
                {settings.store.latitude != null &&
                settings.store.longitude != null ? (
                  <DeliveryCoverageMap
                    latitude={settings.store.latitude}
                    longitude={settings.store.longitude}
                    bands={settings.deliveryBands}
                  />
                ) : (
                  <div className="flex min-h-[480px] items-center justify-center rounded-[20px] border border-dashed border-neutral-300 bg-[#faf9f7] p-8 text-center">
                    <div>
                      <MapPinned className="mx-auto h-7 w-7 text-neutral-300" />
                      <b className="alento-ui-status mt-3 block text-neutral-700">
                        Cobertura pendiente
                      </b>
                      <p className="alento-ui-micro mt-1 text-neutral-500">
                        Valida primero la sede para dibujar las zonas de
                        cobertura.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === "DRIVERS" && (
            <div>
              <div className="mb-4">
                <p className="alento-ui-label uppercase text-neutral-400">
                  Repartidores
                </p>
                <h2 className="alento-ui-title mt-1 text-neutral-950">
                  Operación y compensación
                </h2>
                <p className="alento-ui-body mt-1 text-neutral-500">
                  Controla capacidad, zona de aceptación y pago por domicilio.
                </p>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <div className="rounded-[14px] border border-neutral-200 bg-[#faf9f7] px-3 py-2.5">
                  <span className="alento-ui-micro uppercase text-neutral-400">
                    Simultáneos
                  </span>
                  <b className="alento-ui-status mt-1 block text-neutral-950">
                    {settings.driverManagement.maxConcurrentDeliveries}
                  </b>
                </div>
                <div className="rounded-[14px] border border-neutral-200 bg-[#faf9f7] px-3 py-2.5">
                  <span className="alento-ui-micro uppercase text-neutral-400">
                    Radio
                  </span>
                  <b className="alento-ui-status mt-1 block text-neutral-950">
                    {settings.driverManagement.acceptanceRadiusMeters >= 1000
                      ? `${(
                          settings.driverManagement.acceptanceRadiusMeters /
                          1000
                        ).toFixed(
                          settings.driverManagement.acceptanceRadiusMeters %
                            1000 ===
                            0
                            ? 0
                            : 1,
                        )} km`
                      : `${settings.driverManagement.acceptanceRadiusMeters} m`}
                  </b>
                </div>
                <div className="rounded-[14px] border border-red-100 bg-red-50 px-3 py-2.5">
                  <span className="alento-ui-micro uppercase text-red-400">
                    Ganancia
                  </span>
                  <b className="alento-ui-status mt-1 block text-[var(--brand-red)]">
                    {settings.driverManagement.earningPercent}%
                  </b>
                </div>
                <div className="rounded-[14px] border border-amber-100 bg-amber-50 px-3 py-2.5">
                  <span className="alento-ui-micro uppercase text-amber-600">
                    Domicilio gratis
                  </span>
                  <b className="alento-ui-status mt-1 block text-amber-800">
                    {formatCOP(settings.driverManagement.freeDeliveryEarning)}
                  </b>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <section className="rounded-[18px] border border-neutral-200 bg-[#faf9f7] p-3.5">
                  <div className="mb-3">
                    <p className="alento-ui-label uppercase text-neutral-400">
                      Operación
                    </p>
                    <h3 className="alento-ui-status mt-1 text-neutral-950">
                      Capacidad y zona
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-neutral-200 bg-white p-3">
                      <div className="min-w-0">
                        <b className="alento-ui-control block text-neutral-950">
                          Máximo de pedidos
                        </b>
                        <p className="alento-ui-micro mt-1 text-neutral-500">
                          Pedidos sin entregar que puede tener asignados.
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 rounded-xl border border-neutral-200 bg-[#faf9f7] p-1">
                        <button
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              driverManagement: {
                                ...settings.driverManagement,
                                maxConcurrentDeliveries: Math.max(
                                  1,
                                  settings.driverManagement
                                    .maxConcurrentDeliveries - 1,
                                ),
                              },
                            })
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-700"
                          aria-label="Reducir máximo de pedidos simultáneos"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={
                            settings.driverManagement.maxConcurrentDeliveries
                          }
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              driverManagement: {
                                ...settings.driverManagement,
                                maxConcurrentDeliveries: Math.min(
                                  10,
                                  Math.max(
                                    1,
                                    Number(event.target.value) || 1,
                                  ),
                                ),
                              },
                            })
                          }
                          className="alento-ui-status h-8 w-12 bg-transparent text-center tabular-nums outline-none"
                          aria-label="Máximo de pedidos simultáneos por repartidor"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              driverManagement: {
                                ...settings.driverManagement,
                                maxConcurrentDeliveries: Math.min(
                                  10,
                                  settings.driverManagement
                                    .maxConcurrentDeliveries + 1,
                                ),
                              },
                            })
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-950 text-white"
                          aria-label="Aumentar máximo de pedidos simultáneos"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="rounded-[14px] border border-emerald-100 bg-emerald-50/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <b className="alento-ui-control block text-neutral-950">
                            Radio para aceptar domicilios
                          </b>
                          <p className="alento-ui-micro mt-1 text-neutral-500">
                            Debe estar dentro de esta zona para autoasignarse.
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center rounded-xl border border-emerald-200 bg-white px-2">
                          <input
                            type="number"
                            min={100}
                            max={10000}
                            step={100}
                            value={
                              settings.driverManagement.acceptanceRadiusMeters
                            }
                            onChange={(event) =>
                              setSettings({
                                ...settings,
                                driverManagement: {
                                  ...settings.driverManagement,
                                  acceptanceRadiusMeters: Math.min(
                                    10000,
                                    Math.max(
                                      100,
                                      Number(event.target.value) || 100,
                                    ),
                                  ),
                                },
                              })
                            }
                            className="alento-ui-control h-9 w-20 bg-transparent text-right tabular-nums outline-none"
                            aria-label="Radio en metros para aceptar domicilios"
                          />
                          <span className="alento-ui-micro ml-1 text-neutral-400">
                            m
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[18px] border border-neutral-200 bg-white p-3.5">
                  <div className="mb-3">
                    <p className="alento-ui-label uppercase text-neutral-400">
                      Compensación
                    </p>
                    <h3 className="alento-ui-status mt-1 text-neutral-950">
                      Ganancia del repartidor
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    <div className="rounded-[14px] border border-red-100 bg-red-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <b className="alento-ui-control block text-neutral-950">
                            Domicilio cobrado
                          </b>
                          <p className="alento-ui-micro mt-1 text-neutral-500">
                            Porcentaje que recibe sobre el domicilio.
                          </p>
                        </div>
                        <label className="flex h-10 items-center rounded-xl border border-red-100 bg-white px-3">
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
                                    Math.max(
                                      0,
                                      Number(event.target.value) || 0,
                                    ),
                                  ),
                                },
                              })
                            }
                            className="alento-ui-status w-14 bg-transparent text-right text-[var(--brand-red)] outline-none"
                            aria-label="Porcentaje de ganancia del repartidor"
                          />
                          <span className="alento-ui-control ml-1 text-neutral-400">
                            %
                          </span>
                        </label>
                      </div>
                      <p className="alento-ui-micro mt-2 text-red-700">
                        Con domicilio de $5.000:{" "}
                        <b>
                          {formatCOP(
                            Math.round(
                              (5000 *
                                settings.driverManagement.earningPercent) /
                                100,
                            ),
                          )}
                        </b>
                      </p>
                    </div>

                    <div className="rounded-[14px] border border-amber-100 bg-amber-50/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <b className="alento-ui-control block text-neutral-950">
                            Domicilio sin costo
                          </b>
                          <p className="alento-ui-micro mt-1 text-neutral-500">
                            Incentivo fijo cuando el cliente paga $0.
                          </p>
                        </div>
                        <label className="flex h-10 items-center rounded-xl border border-amber-100 bg-white px-3">
                          <span className="alento-ui-control text-neutral-400">
                            $
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100000}
                            step={500}
                            value={
                              settings.driverManagement.freeDeliveryEarning
                            }
                            onChange={(event) =>
                              setSettings({
                                ...settings,
                                driverManagement: {
                                  ...settings.driverManagement,
                                  freeDeliveryEarning: Math.min(
                                    100000,
                                    Math.max(
                                      0,
                                      Math.round(
                                        Number(event.target.value) || 0,
                                      ),
                                    ),
                                  ),
                                },
                              })
                            }
                            className="alento-ui-status ml-1 w-24 bg-transparent text-right text-amber-800 outline-none"
                            aria-label="Incentivo para domicilios gratuitos"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeSection === "CUSTOMERS" && (
            <div>
              <div className="mb-4">
                <p className="alento-ui-label uppercase text-neutral-400">
                  Clientes
                </p>
                <h2 className="alento-ui-title mt-1 text-neutral-950">
                  Gestión de clientes
                </h2>
                <p className="alento-ui-body mt-1 text-neutral-500">
                  Controla funciones sensibles sin recargar el módulo principal.
                </p>
              </div>

              <div className="max-w-3xl rounded-[18px] border border-neutral-200 bg-[#faf9f7] p-3.5">
                <div className="flex items-center justify-between gap-4 rounded-[14px] border border-neutral-200 bg-white p-3.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${settings.customerManagement.bulkDeleteEnabled ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
                    >
                      <Users className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="alento-ui-status text-neutral-950">
                          Eliminación masiva
                        </b>
                        <span
                          className={`alento-ui-label rounded-full px-2 py-1 ${settings.customerManagement.bulkDeleteEnabled ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
                        >
                          {settings.customerManagement.bulkDeleteEnabled
                            ? "Habilitada"
                            : "Protegido"}
                        </span>
                      </div>
                      <p className="alento-ui-micro mt-1 max-w-xl leading-5 text-neutral-500">
                        Cuando está desactivada, el panel oculta la selección
                        múltiple y el servidor bloquea intentos de borrado
                        masivo.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        customerManagement: {
                          ...settings.customerManagement,
                          bulkDeleteEnabled:
                            !settings.customerManagement.bulkDeleteEnabled,
                        },
                      })
                    }
                    className={`relative h-8 w-14 shrink-0 rounded-full transition ${settings.customerManagement.bulkDeleteEnabled ? "bg-amber-500" : "bg-emerald-500"}`}
                    aria-pressed={
                      settings.customerManagement.bulkDeleteEnabled
                    }
                    aria-label="Permitir eliminación masiva de clientes"
                  >
                    <span
                      className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${settings.customerManagement.bulkDeleteEnabled ? "left-7" : "left-1"}`}
                    />
                  </button>
                </div>

                <div
                  className={`mt-2 rounded-[14px] border px-3 py-2.5 ${settings.customerManagement.bulkDeleteEnabled ? "border-amber-100 bg-amber-50" : "border-emerald-100 bg-emerald-50"}`}
                >
                  <p
                    className={`alento-ui-micro ${settings.customerManagement.bulkDeleteEnabled ? "text-amber-800" : "text-emerald-800"}`}
                  >
                    {settings.customerManagement.bulkDeleteEnabled
                      ? "La eliminación masiva está disponible para usuarios autorizados."
                      : "Modo protegido: los clientes no pueden eliminarse en bloque."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "PAYMENTS" && (
            <div>
              <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="alento-ui-label uppercase text-neutral-400">
                    Caja
                  </p>
                  <h2 className="alento-ui-title mt-1 text-neutral-950">
                    Medios de pago
                  </h2>
                  <p className="alento-ui-body mt-1 text-neutral-500">
                    Consulta qué medio se usa más y cuánto dinero recibió cada
                    uno en el período seleccionado.
                  </p>
                </div>

                <div className="flex gap-2">
                  <div className="rounded-[14px] border border-neutral-200 bg-[#faf9f7] px-3 py-2 text-right">
                    <span className="alento-ui-micro uppercase text-neutral-400">
                      Pagos clasificados
                    </span>
                    <b className="alento-ui-status mt-0.5 block text-neutral-950">
                      {paymentSummary.totalTransactions}
                    </b>
                  </div>
                  <div className="rounded-[14px] border border-neutral-200 bg-[#faf9f7] px-3 py-2 text-right">
                    <span className="alento-ui-micro uppercase text-neutral-400">
                      Recaudado
                    </span>
                    <b className="alento-ui-status mt-0.5 block text-[var(--brand-red)]">
                      {formatCOP(paymentSummary.totalAmount)}
                    </b>
                  </div>
                </div>
              </div>

              <div className="mb-3 flex flex-col gap-2 rounded-[16px] border border-neutral-200 bg-[#faf9f7] p-2.5 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="min-w-[170px]">
                    <span className="alento-ui-label mb-1 block text-neutral-400">
                      Desde
                    </span>
                    <div className="flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3">
                      <CalendarDays className="h-4 w-4 text-neutral-400" strokeWidth={2} />
                      <input
                        type="date"
                        value={paymentStartDate}
                        max={paymentEndDate}
                        onChange={(event) =>
                          setPaymentStartDate(event.target.value)
                        }
                        className="alento-ui-control min-w-0 bg-transparent outline-none"
                      />
                    </div>
                  </label>

                  <label className="min-w-[170px]">
                    <span className="alento-ui-label mb-1 block text-neutral-400">
                      Hasta
                    </span>
                    <div className="flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3">
                      <CalendarDays className="h-4 w-4 text-neutral-400" strokeWidth={2} />
                      <input
                        type="date"
                        value={paymentEndDate}
                        min={paymentStartDate}
                        onChange={(event) =>
                          setPaymentEndDate(event.target.value)
                        }
                        className="alento-ui-control min-w-0 bg-transparent outline-none"
                      />
                    </div>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={showPaymentsToday}
                    className="alento-ui-control h-10 rounded-xl border border-neutral-200 bg-white px-3 text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={showPaymentsThisMonth}
                    className="alento-ui-control h-10 rounded-xl border border-neutral-200 bg-white px-3 text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Este mes
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void refreshPaymentStats(
                        paymentStartDate,
                        paymentEndDate,
                      )
                    }
                    disabled={paymentStatsLoading}
                    className="alento-ui-control h-10 rounded-xl bg-neutral-950 px-4 text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-50"
                  >
                    {paymentStatsLoading ? "Actualizando..." : "Aplicar"}
                  </button>
                </div>
              </div>

              <div className="mb-3 rounded-[14px] border border-blue-100 bg-blue-50 px-3 py-2.5">
                <p className="alento-ui-micro leading-5 text-blue-800">
                  Solo se cuentan movimientos <b>PAID</b> entre{" "}
                  <b>{paymentSummary.startDate}</b> y{" "}
                  <b>{paymentSummary.endDate}</b>. Las intenciones de pago del
                  POS no entran en esta estadística.
                </p>
              </div>

              {paymentSummary.unclassifiedTransactions > 0 && (
                <div className="mb-3 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <p className="alento-ui-micro leading-5 text-amber-900">
                    <b>Histórico sin clasificar:</b>{" "}
                    {paymentSummary.unclassifiedTransactions} pagos por{" "}
                    {formatCOP(paymentSummary.unclassifiedAmount)}. Son
                    registros antiguos/importados cuyo nombre de medio no
                    coincide con Efectivo, Nequi, DaviPlata, Tarjeta o Llave;
                    por eso se muestran aparte y no alteran los porcentajes.
                  </p>
                </div>
              )}

              {paymentStatsError && (
                <div className="mb-3 rounded-[14px] border border-red-200 bg-red-50 px-3 py-2.5">
                  <p className="alento-ui-micro text-red-700">
                    {paymentStatsError}
                  </p>
                </div>
              )}

              <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {paymentCards.map((method, index) => (
                  <article
                    key={method.id}
                    className={`overflow-hidden rounded-[18px] border p-3.5 transition ${method.active ? "border-neutral-200 bg-white" : "border-neutral-200 bg-[#faf9f7] opacity-75"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${method.active ? "bg-neutral-950 text-white" : "bg-neutral-200 text-neutral-500"}`}
                      >
                        <CreditCard className="h-4 w-4" strokeWidth={2} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <h3 className="alento-ui-status truncate text-neutral-950">
                          {method.name}
                        </h3>
                        <p className="alento-ui-micro mt-0.5 text-neutral-400">
                          Último uso: {formatShortDate(method.lastUsedAt)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => togglePayment(method.id)}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition ${method.active ? "bg-emerald-500" : "bg-neutral-300"}`}
                        aria-pressed={method.active}
                        aria-label={`${method.active ? "Desactivar" : "Activar"} ${method.name}`}
                        title={method.active ? "Desactivar" : "Activar"}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${method.active ? "left-6" : "left-1"}`}
                        />
                      </button>
                    </div>

                    <div className="mt-3 rounded-[14px] bg-[#faf9f7] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="alento-ui-micro uppercase text-neutral-400">
                              Uso por transacciones
                            </span>
                            {index === 0 &&
                              method.transactionCount > 0 && (
                                <span className="alento-ui-micro rounded-full bg-red-50 px-2 py-1 font-bold text-[var(--brand-red)]">
                                  Más usado
                                </span>
                              )}
                          </div>
                          <b className="alento-ui-metric mt-1 block text-neutral-950">
                            {method.usagePercent.toLocaleString("es-CO", {
                              maximumFractionDigits: 1,
                            })}
                            %
                          </b>
                        </div>
                        <span
                          className={`alento-ui-label rounded-full px-2 py-1 ${method.active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-200 text-neutral-500"}`}
                        >
                          {method.active ? "Activo" : "Inactivo"}
                        </span>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200">
                        <div
                          className="h-full rounded-full bg-[var(--brand-red)] transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, method.usagePercent),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-neutral-100 bg-white px-2.5 py-2">
                        <span className="alento-ui-micro uppercase text-neutral-400">
                          Pagos
                        </span>
                        <b className="alento-ui-control mt-0.5 block text-neutral-950">
                          {method.transactionCount}
                        </b>
                      </div>
                      <div className="rounded-xl border border-neutral-100 bg-white px-2.5 py-2">
                        <span className="alento-ui-micro uppercase text-neutral-400">
                          Recaudado
                        </span>
                        <b className="alento-ui-control mt-0.5 block truncate text-neutral-950">
                          {formatCOP(method.amount)}
                        </b>
                      </div>
                      <div className="rounded-xl border border-neutral-100 bg-white px-2.5 py-2">
                        <span className="alento-ui-micro uppercase text-neutral-400">
                          Del valor
                        </span>
                        <b className="alento-ui-control mt-0.5 block text-neutral-950">
                          {method.amountPercent.toLocaleString("es-CO", {
                            maximumFractionDigits: 1,
                          })}
                          %
                        </b>
                      </div>
                    </div>
                  </article>
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
