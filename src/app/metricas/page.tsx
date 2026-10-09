"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Eye,
  Link2,
  MousePointerClick,
  Settings2,
  ShoppingCart,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { TrackingSettings } from "@/lib/trackingSettings";

type TextTrackingKey = Exclude<
  keyof TrackingSettings,
  "enabled" | "requireConsent"
>;

type IntegrationId =
  | "gtm"
  | "ga4"
  | "googleAds"
  | "meta"
  | "tiktok"
  | "clarity";

type MetricsSection = "INTERNAL" | "EXTERNAL";

type VerificationResult = {
  status: "verified" | "configured" | "invalid";
  title: string;
  detail: string;
};

type IntegrationDefinition = {
  id: IntegrationId;
  name: string;
  short: string;
  description: string;
  externalUrl: string;
  externalLabel: string;
  fields: Array<{
    key: TextTrackingKey;
    label: string;
    placeholder: string;
    help: string;
    required?: boolean;
  }>;
  steps: string[];
  note: string;
};

type Dashboard = {
  period: { days: number; start: string; end: string };
  summary: {
    menuViews: number;
    uniqueVisitors: number;
    productViews: number;
    addToCartActions: number;
    cartsStarted: number;
    checkoutStarted: number;
    orders: number;
    abandonedCarts: number;
    revenue: number;
    menuToCartRate: number;
    cartToOrderRate: number;
    conversionRate: number;
  };
  hourly: Array<{
    hour: number;
    label: string;
    menuViews: number;
    productViews: number;
    adds: number;
    orders: number;
  }>;
  hourlyByDay: Array<{
    date: string;
    hours: Array<{
      hour: number;
      menuViews: number;
      productViews: number;
      adds: number;
      orders: number;
    }>;
  }>;
  trend: Array<{
    date: string;
    menuViews: number;
    visitors: number;
    orders: number;
  }>;
  topProducts: Array<{
    productId: number | null;
    name: string;
    views: number;
    adds: number;
    addRate: number;
  }>;
  sources: Array<{
    source: string;
    views: number;
    visitors: number;
  }>;
};

const EMPTY_SETTINGS: TrackingSettings = {
  enabled: true,
  requireConsent: true,
  googleTagManagerId: "",
  googleAnalyticsId: "",
  googleAdsId: "",
  googleAdsPurchaseLabel: "",
  metaPixelId: "",
  tiktokPixelId: "",
  clarityId: "",
};

const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: "gtm",
    name: "Google Tag Manager",
    short: "GTM",
    description:
      "Administra etiquetas de marketing y analítica desde un solo contenedor.",
    externalUrl: "https://tagmanager.google.com/",
    externalLabel: "Abrir Tag Manager",
    fields: [
      {
        key: "googleTagManagerId",
        label: "ID del contenedor",
        placeholder: "GTM-XXXXXXX",
        help: "Empieza por GTM-. Lo encuentras en la parte superior del contenedor.",
        required: true,
      },
    ],
    steps: [
      "Entra a Google Tag Manager y crea una cuenta si todavía no tienes una.",
      "Crea un contenedor para alentopizza.com y elige Web como plataforma.",
      "Copia el identificador que empieza por GTM- y pégalo aquí.",
      "Publica el contenedor en Tag Manager para que sus etiquetas queden activas.",
    ],
    note:
      "Tag Manager es una forma alternativa de instalar etiquetas. Si dentro de GTM creas una etiqueta de Analytics, Meta o TikTok, no conectes esa misma plataforma también de forma directa en Alentó. Usa un solo método por plataforma para evitar eventos duplicados.",
  },
  {
    id: "ga4",
    name: "Google Analytics 4",
    short: "GA4",
    description:
      "Mide visitas, productos, carrito, checkout y compras en Google Analytics.",
    externalUrl: "https://analytics.google.com/",
    externalLabel: "Abrir Analytics",
    fields: [
      {
        key: "googleAnalyticsId",
        label: "Measurement ID",
        placeholder: "G-XXXXXXXXXX",
        help: "Debe empezar por G-. Es el identificador del flujo de datos web.",
        required: true,
      },
    ],
    steps: [
      "Entra a Google Analytics y abre la propiedad de Alentó.",
      "Ve a Administrar > Flujos de datos > Web.",
      "Crea o abre el flujo de alentopizza.com.",
      "Copia el Measurement ID que empieza por G- y pégalo aquí.",
    ],
    note:
      "Después de guardar y probar, genera una visita al menú y confirma la recepción en Informes > Tiempo real o en DebugView.",
  },
  {
    id: "googleAds",
    name: "Google Ads",
    short: "ADS",
    description:
      "Envía compras a Google Ads para atribución y optimización de campañas.",
    externalUrl: "https://ads.google.com/",
    externalLabel: "Abrir Google Ads",
    fields: [
      {
        key: "googleAdsId",
        label: "Google tag ID",
        placeholder: "AW-123456789",
        help: "Debe empezar por AW-.",
        required: true,
      },
      {
        key: "googleAdsPurchaseLabel",
        label: "Etiqueta de conversión de compra",
        placeholder: "AbCdEFghijk",
        help: "Es la parte que aparece después de AW-XXXXXXXXX/ en el send_to del evento de compra.",
      },
    ],
    steps: [
      "En Google Ads abre Objetivos > Conversiones.",
      "Crea o abre la acción de conversión de Compra del sitio web.",
      "En la configuración de etiqueta localiza el Google tag ID AW-XXXXXXXXX.",
      "En el fragmento de evento de compra copia también la etiqueta que aparece después de la barra en send_to.",
    ],
    note:
      "El ID AW permite cargar Google Ads; la etiqueta de conversión es la que relaciona Purchase con la acción de compra elegida.",
  },
  {
    id: "meta",
    name: "Meta Pixel",
    short: "META",
    description:
      "Envía ViewContent, AddToCart, InitiateCheckout y Purchase a Meta.",
    externalUrl: "https://www.facebook.com/events_manager2/",
    externalLabel: "Abrir Events Manager",
    fields: [
      {
        key: "metaPixelId",
        label: "Pixel ID",
        placeholder: "123456789012345",
        help: "Solo números. No pegues el código completo del píxel.",
        required: true,
      },
    ],
    steps: [
      "Abre Meta Events Manager.",
      "Conecta una fuente de datos Web y crea o selecciona tu Pixel.",
      "En Configuración busca el ID del conjunto de datos / Pixel.",
      "Copia únicamente el número y pégalo aquí.",
    ],
    note:
      "Meta confirma la recepción exacta desde Events Manager > Probar eventos. Alentó enviará los eventos estándar del embudo.",
  },
  {
    id: "tiktok",
    name: "TikTok Pixel",
    short: "TT",
    description:
      "Permite medir contenido, carrito, checkout y pago para campañas de TikTok.",
    externalUrl: "https://ads.tiktok.com/i18n/events_manager/",
    externalLabel: "Abrir Events Manager",
    fields: [
      {
        key: "tiktokPixelId",
        label: "Pixel ID",
        placeholder: "CXXXXXXXXXXXXXXX",
        help: "Copia el identificador del píxel, no el script completo.",
        required: true,
      },
    ],
    steps: [
      "En TikTok Ads Manager abre Events Manager.",
      "Crea una fuente Web y elige Pixel como método de conexión.",
      "Selecciona instalación manual.",
      "Copia el Pixel ID y pégalo aquí.",
    ],
    note:
      "Después de configurarlo, TikTok puede confirmar la llegada de eventos en Events Manager > Test Events.",
  },
  {
    id: "clarity",
    name: "Microsoft Clarity",
    short: "CL",
    description:
      "Añade mapas de calor, grabaciones de sesión y señales de comportamiento.",
    externalUrl: "https://clarity.microsoft.com/",
    externalLabel: "Abrir Clarity",
    fields: [
      {
        key: "clarityId",
        label: "Project ID",
        placeholder: "abcdefghij",
        help: "Es el identificador corto del proyecto de Clarity.",
        required: true,
      },
    ],
    steps: [
      "Entra a Microsoft Clarity y crea un proyecto para alentopizza.com.",
      "Abre Configuración > Setup.",
      "En instalación manual localiza el Project ID.",
      "Copia el identificador y pégalo aquí.",
    ],
    note:
      "Las grabaciones y mapas de calor aparecerán cuando haya sesiones con consentimiento de medición.",
  },
];

function number(value: number) {
  return new Intl.NumberFormat("es-CO").format(value || 0);
}

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function trafficSourceInfo(source: string) {
  const key = source.toLowerCase();

  const known: Record<string, { label: string; detail: string }> = {
    direct: {
      label: "Acceso directo",
      detail: "Sin campaña o sitio de referencia",
    },
    seguimiento: {
      label: "Seguimiento de pedido",
      detail: "Regreso al menú desde seguimiento",
    },
    internal: {
      label: "Navegación interna",
      detail: "Desde otra página de Alentó",
    },
    facebook: {
      label: "Facebook / Meta",
      detail: "Referencia desde Facebook o Meta",
    },
    instagram: {
      label: "Instagram",
      detail: "Referencia desde Instagram",
    },
    tiktok: {
      label: "TikTok",
      detail: "Referencia desde TikTok",
    },
    google: {
      label: "Google",
      detail: "Referencia desde Google",
    },
    whatsapp: {
      label: "WhatsApp",
      detail: "Referencia desde WhatsApp",
    },
  };

  return (
    known[key] ?? {
      label: source,
      detail: "Sitio o campaña detectada",
    }
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <article className="rounded-[22px] border border-neutral-200 bg-white p-4.5 shadow-[0_12px_32px_rgba(20,15,12,.045)] transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_16px_38px_rgba(20,15,12,.07)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="alento-ui-label uppercase tracking-[0.08em] text-neutral-500">
            {label}
          </p>
          <strong className="mt-2 block text-[28px] font-black tracking-[-0.04em] text-neutral-950">
            {value}
          </strong>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-neutral-950 text-white shadow-[0_8px_18px_rgba(0,0,0,.12)]">
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="alento-ui-control mt-2 leading-5 text-neutral-600">{detail}</p>
    </article>
  );
}

export default function MetricsPage() {
  const [days, setDays] = useState(7);
  const [activeMetricsSection, setActiveMetricsSection] =
    useState<MetricsSection>("INTERNAL");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [settings, setSettings] =
    useState<TrackingSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [activeIntegrationId, setActiveIntegrationId] =
    useState<IntegrationId | null>(null);
  const [verifying, setVerifying] = useState<IntegrationId | null>(null);
  const [verification, setVerification] = useState<
    Partial<Record<IntegrationId, VerificationResult>>
  >({});

  async function loadDashboard(selectedDays = days) {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/metrics/dashboard?days=${selectedDays}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible cargar las métricas.");
      }
      setDashboard(data as Dashboard);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible cargar las métricas.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard(days);
  }, [days]);

  useEffect(() => {
    fetch("/api/metrics/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.settings) {
          setSettings(data.settings as TrackingSettings);
        }
      })
      .catch(() => {});
  }, []);

  const maxHourlyByDay = useMemo(
    () =>
      Math.max(
        1,
        ...(dashboard?.hourlyByDay ?? []).flatMap((day) =>
          day.hours.map((item) => item.menuViews),
        ),
      ),
    [dashboard],
  );

  const totalSourceViews = useMemo(
    () =>
      (dashboard?.sources ?? []).reduce(
        (total, source) => total + source.views,
        0,
      ),
    [dashboard],
  );

  function heatCellStyle(value: number) {
    if (value <= 0) {
      return {
        backgroundColor: "#f3f2ef",
        color: "#8a857f",
      };
    }

    const strength = Math.max(0.18, Math.min(1, value / maxHourlyByDay));
    const alpha = 0.16 + strength * 0.84;

    return {
      backgroundColor: `rgba(226, 26, 34, ${alpha})`,
      color: strength > 0.5 ? "#ffffff" : "#7f1014",
    };
  }

  function heatDayLabel(date: string) {
    const value = new Date(`${date}T12:00:00-05:00`);
    const weekday = new Intl.DateTimeFormat("es-CO", {
      weekday: "short",
      timeZone: "America/Bogota",
    })
      .format(value)
      .replace(".", "");
    const day = new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "short",
      timeZone: "America/Bogota",
    })
      .format(value)
      .replace(".", "");

    return {
      weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
      day,
    };
  }

  function updateTextSetting(
    key: TextTrackingKey,
    value: string,
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/metrics/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible guardar.");
      }
      setSettings(data.settings as TrackingSettings);
      setMessage("Integraciones guardadas.");
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible guardar las integraciones.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function verifyIntegration(id: IntegrationId) {
    setVerifying(id);
    setMessage("");

    try {
      const response = await fetch("/api/metrics/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: id }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible comprobar la integración.",
        );
      }

      setVerification((current) => ({
        ...current,
        [id]: data as VerificationResult,
      }));
    } catch (error) {
      setVerification((current) => ({
        ...current,
        [id]: {
          status: "invalid",
          title: "No pudimos completar la prueba",
          detail:
            error instanceof Error
              ? error.message
              : "Revisa los datos e intenta nuevamente.",
        },
      }));
    } finally {
      setVerifying(null);
    }
  }

  async function saveAndVerify(id: IntegrationId) {
    const saved = await saveSettings();
    if (saved) {
      await verifyIntegration(id);
    }
  }

  function integrationConfigured(integration: IntegrationDefinition) {
    const requiredFields = integration.fields.filter(
      (field) => field.required !== false,
    );

    return requiredFields.every((field) =>
      String(settings[field.key] || "").trim(),
    );
  }

  const activeIntegration =
    INTEGRATIONS.find(
      (integration) => integration.id === activeIntegrationId,
    ) ?? null;

  const configuredCount = INTEGRATIONS.filter((integration) =>
    integrationConfigured(integration),
  ).length;

  const summary = dashboard?.summary;

  return (
    <main className="min-h-screen w-full p-3 text-neutral-950 md:p-5 xl:p-6">
      <div className="w-full">
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
                  Catálogo y conversión
                </p>
              </div>
              <h1 className="alento-ui-hero-title mt-1.5">Métricas</h1>
              <p className="alento-ui-hero-subtitle mt-1.5 text-white/60">
                Visitas, productos, carrito, abandono, pedidos y origen del tráfico del menú público.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 self-end md:self-auto">
              {activeMetricsSection === "INTERNAL" ? (
                <div className="flex items-center gap-2">
                  <div className="flex h-[56px] min-w-[82px] flex-col items-center justify-center rounded-[16px] border border-white/14 bg-white/[0.08] px-3 backdrop-blur-sm">
                    <span className="alento-ui-micro uppercase tracking-[0.14em] text-white/50">
                      Periodo
                    </span>
                    <b className="alento-ui-label mt-0.5 whitespace-nowrap text-white">
                      {days === 1 ? "Hoy" : `${days} días`}
                    </b>
                  </div>
                  <div className="flex rounded-[14px] border border-white/14 bg-white/[0.08] p-1 backdrop-blur-sm">
                    {[
                      { value: 1, label: "Hoy" },
                      { value: 7, label: "7 días" },
                      { value: 30, label: "30 días" },
                      { value: 90, label: "90 días" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDays(option.value)}
                        className={
                          "alento-ui-control rounded-[10px] px-3 py-2 transition " +
                          (days === option.value
                            ? "bg-white text-neutral-950 shadow-sm"
                            : "text-white/55 hover:bg-white/[0.08] hover:text-white")
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[56px] min-w-[118px] flex-col items-center justify-center rounded-[16px] border border-white/14 bg-white/[0.08] px-4 backdrop-blur-sm">
                  <span className="alento-ui-micro uppercase tracking-[0.14em] text-white/50">
                    Integraciones
                  </span>
                  <b className="alento-ui-metric mt-0.5 tabular-nums text-white">
                    {configuredCount}/{INTEGRATIONS.length}
                  </b>
                </div>
              )}
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-[14px] border border-neutral-200 bg-white px-4 py-3">
            <p className="alento-ui-control font-semibold text-neutral-700">
              {message}
            </p>
          </div>
        )}

        <section className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {[
            {
              id: "INTERNAL" as const,
              title: "Métricas internas",
              description: "Catálogo, embudo, productos y ventas",
              status: days === 1 ? "Hoy" : `${days} días analizados`,
              icon: BarChart3,
            },
            {
              id: "EXTERNAL" as const,
              title: "Integraciones externas",
              description: "Meta, Google, TikTok y Clarity",
              status: `${configuredCount} de ${INTEGRATIONS.length} configuradas`,
              icon: Link2,
            },
          ].map((section) => {
            const Icon = section.icon;
            const selected = activeMetricsSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveMetricsSection(section.id)}
                className={
                  "group flex min-h-[104px] items-center gap-3 rounded-[20px] border p-3.5 text-left transition " +
                  (selected
                    ? "border-red-200 bg-[linear-gradient(135deg,#171113,#100d0e)] text-white shadow-[0_12px_28px_rgba(110,10,14,.14)]"
                    : "border-neutral-200 bg-white text-neutral-950 shadow-[0_7px_20px_rgba(28,23,20,.04)] hover:-translate-y-0.5 hover:border-neutral-300")
                }
              >
                <span
                  className={
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border " +
                    (selected
                      ? "border-white/10 bg-white/[0.08] text-red-300"
                      : "border-neutral-200 bg-[#faf9f7] text-neutral-600")
                  }
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="alento-ui-status block truncate">
                    {section.title}
                  </span>
                  <span
                    className={
                      "alento-ui-micro mt-0.5 block truncate " +
                      (selected ? "text-white/45" : "text-neutral-500")
                    }
                  >
                    {section.description}
                  </span>
                  <span
                    className={
                      "alento-ui-label mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 " +
                      (selected
                        ? "bg-white/[0.08] text-white/65"
                        : "bg-neutral-100 text-neutral-500")
                    }
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

        {activeMetricsSection === "INTERNAL" && (
          <>
        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Visitas al menú"
            value={loading ? "…" : number(summary?.menuViews ?? 0)}
            detail="Cada carga registrada de /menu."
            icon={Eye}
          />
          <MetricCard
            label="Personas únicas"
            value={loading ? "…" : number(summary?.uniqueVisitors ?? 0)}
            detail="Visitantes anónimos distintos en el periodo."
            icon={Users}
          />
          <MetricCard
            label="Carritos iniciados"
            value={loading ? "…" : number(summary?.cartsStarted ?? 0)}
            detail={`${summary?.menuToCartRate ?? 0}% de visitantes iniciaron carrito.`}
            icon={ShoppingCart}
          />
          <MetricCard
            label="Pedidos"
            value={loading ? "…" : number(summary?.orders ?? 0)}
            detail={`${summary?.conversionRate ?? 0}% de conversión desde visitantes.`}
            icon={CheckCircle2}
          />
          <MetricCard
            label="Productos vistos"
            value={loading ? "…" : number(summary?.productViews ?? 0)}
            detail="Aperturas de la ficha o configurador del producto."
            icon={MousePointerClick}
          />
          <MetricCard
            label="Agregar al carrito"
            value={loading ? "…" : number(summary?.addToCartActions ?? 0)}
            detail="Acciones de agregar registradas en el catálogo y carrito."
            icon={TrendingUp}
          />
          <MetricCard
            label="Carritos abandonados"
            value={loading ? "…" : number(summary?.abandonedCarts ?? 0)}
            detail="Carritos sin compra después de 30 minutos de inactividad."
            icon={ShoppingCart}
          />
          <MetricCard
            label="Venta atribuida"
            value={loading ? "…" : money(summary?.revenue ?? 0)}
            detail={`${summary?.cartToOrderRate ?? 0}% de carritos terminaron en pedido.`}
            icon={BarChart3}
          />
        </section>

        <section className="mt-5">
          <article className="overflow-hidden rounded-[22px] border border-neutral-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="alento-ui-status text-neutral-950">
                  Actividad del menú por día y hora
                </h2>
                <p className="alento-ui-control mt-1 max-w-[760px] leading-5 text-neutral-600">
                  Cada celda muestra cuántas veces cargaron el menú en esa hora. Más rojo significa mayor actividad.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto">
                <span className="alento-ui-micro text-neutral-500">Menor</span>
                {[0.14, 0.32, 0.52, 0.74, 1].map((opacity) => (
                  <span
                    key={opacity}
                    className="h-3.5 w-5 rounded-[4px]"
                    style={{ backgroundColor: `rgba(226, 26, 34, ${opacity})` }}
                  />
                ))}
                <span className="alento-ui-micro text-neutral-500">Mayor</span>
              </div>
            </div>

            <div className="alento-scroll max-h-[460px] overflow-auto px-4 pb-4 pt-3">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-[86px_repeat(24,minmax(28px,1fr))] gap-1">
                  <div className="sticky left-0 z-20 bg-white" />
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div
                      key={hour}
                      className="alento-ui-micro flex h-7 items-center justify-center tabular-nums text-neutral-500"
                    >
                      {String(hour).padStart(2, "0")}
                    </div>
                  ))}

                  {(dashboard?.hourlyByDay ?? []).map((day) => {
                    const label = heatDayLabel(day.date);

                    return (
                      <div key={day.date} className="contents">
                        <div className="sticky left-0 z-10 flex min-h-8 items-center gap-1.5 bg-white pr-2">
                          <b className="alento-ui-micro w-7 text-neutral-900">
                            {label.weekday}
                          </b>
                          <span className="alento-ui-micro whitespace-nowrap text-neutral-500">
                            {label.day}
                          </span>
                        </div>

                        {day.hours.map((item) => (
                          <div
                            key={`${day.date}-${item.hour}`}
                            className="group relative flex h-8 items-center justify-center rounded-[5px] border border-black/[0.035] text-[10px] font-bold tabular-nums transition hover:z-20 hover:scale-110 hover:shadow-[0_6px_18px_rgba(20,15,12,.16)]"
                            style={heatCellStyle(item.menuViews)}
                            title={`${label.weekday} ${label.day} · ${String(item.hour).padStart(2, "0")}:00 · ${item.menuViews} visitas · ${item.productViews} productos vistos · ${item.adds} agregados · ${item.orders} pedidos`}
                          >
                            {item.menuViews > 0 ? item.menuViews : ""}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50 px-5 py-3">
              <p className="alento-ui-micro text-neutral-500">
                Hora local de Colombia · 00 a 23
              </p>
              <p className="alento-ui-micro text-neutral-500">
                Pasa el cursor sobre una celda para ver visitas, productos, carrito y pedidos.
              </p>
            </div>
          </article>

        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <article className="rounded-[22px] border border-neutral-200 bg-white p-5">
            <h2 className="alento-ui-status text-neutral-950">Embudo del catálogo</h2>
            <p className="alento-ui-control mt-1 leading-5 text-neutral-600">
              De descubrir el menú a terminar el pedido.
            </p>

            <div className="mt-5 space-y-3">
              {[
                ["Visitantes", summary?.uniqueVisitors ?? 0, 100],
                [
                  "Carrito",
                  summary?.cartsStarted ?? 0,
                  summary?.menuToCartRate ?? 0,
                ],
                [
                  "Checkout",
                  summary?.checkoutStarted ?? 0,
                  summary?.uniqueVisitors
                    ? Math.round(
                        ((summary?.checkoutStarted ?? 0) /
                          summary.uniqueVisitors) *
                          1000,
                      ) / 10
                    : 0,
                ],
                [
                  "Pedido",
                  summary?.orders ?? 0,
                  summary?.conversionRate ?? 0,
                ],
              ].map(([label, value, rate]) => (
                <div key={String(label)}>
                  <div className="alento-ui-control flex items-center justify-between gap-3">
                    <b className="text-neutral-900">{label}</b>
                    <span className="tabular-nums text-neutral-600">
                      {number(Number(value))} · {Number(rate)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-neutral-950"
                      style={{
                        width: `${Math.min(100, Math.max(1, Number(rate)))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-[22px] border border-neutral-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="alento-ui-status text-neutral-950">Origen del tráfico</h2>
                <p className="alento-ui-control mt-1 leading-5 text-neutral-600">
                  De dónde llegaron las entradas al menú durante el período.
                </p>
              </div>
              <span className="alento-ui-label shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-600">
                {number(totalSourceViews)} entradas
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {(dashboard?.sources ?? []).map((source) => {
                const info = trafficSourceInfo(source.source);
                const percentage = totalSourceViews
                  ? Math.round((source.views / totalSourceViews) * 1000) / 10
                  : 0;

                return (
                  <div
                    key={source.source}
                    className="rounded-[14px] border border-neutral-100 bg-neutral-50 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <b className="alento-ui-control block truncate text-neutral-950">
                          {info.label}
                        </b>
                        <span className="alento-ui-micro mt-0.5 block truncate text-neutral-500">
                          {info.detail}
                        </span>
                      </div>

                      <div className="shrink-0 text-right">
                        <strong className="alento-ui-status block tabular-nums text-neutral-950">
                          {number(source.views)}
                        </strong>
                        <span className="alento-ui-micro tabular-nums text-neutral-500">
                          {percentage}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
                        <div
                          className="h-full rounded-full bg-neutral-950"
                          style={{ width: `${Math.max(2, percentage)}%` }}
                        />
                      </div>
                      <span className="alento-ui-micro w-[84px] shrink-0 text-right text-neutral-500">
                        {number(source.visitors)} personas
                      </span>
                    </div>
                  </div>
                );
              })}

              {!dashboard?.sources?.length && (
                <p className="alento-ui-control py-8 text-center text-neutral-500">
                  El origen aparecerá cuando empiecen a llegar visitas.
                </p>
              )}
            </div>

            <p className="alento-ui-micro mt-3 leading-4 text-neutral-500">
              “Acceso directo” significa que no llegó una campaña o sitio de referencia detectable; puede ser una URL escrita, un favorito o una app que no comparte el origen.
            </p>
          </article>
        </section>

        <section className="mt-5">
          <article className="overflow-hidden rounded-[22px] border border-neutral-200 bg-white">
            <div className="border-b border-neutral-100 px-5 py-4">
              <h2 className="alento-ui-status text-neutral-950">Productos con más interés</h2>
              <p className="alento-ui-control mt-1 leading-5 text-neutral-600">
                Qué productos abren y cuáles convierten mejor en agregar al carrito.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead className="alento-ui-label bg-neutral-50 uppercase tracking-[0.08em] text-neutral-600">
                  <tr>
                    <th className="px-5 py-3">Producto</th>
                    <th className="px-4 py-3 text-right">Vistas</th>
                    <th className="px-4 py-3 text-right">Agregados</th>
                    <th className="px-5 py-3 text-right">Tasa</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.topProducts ?? []).map((product) => (
                    <tr key={product.productId ?? product.name} className="border-t border-neutral-100">
                      <td className="alento-ui-control px-5 py-3 font-bold text-neutral-900">{product.name}</td>
                      <td className="alento-ui-control px-4 py-3 text-right tabular-nums text-neutral-700">{number(product.views)}</td>
                      <td className="alento-ui-control px-4 py-3 text-right tabular-nums text-neutral-700">{number(product.adds)}</td>
                      <td className="alento-ui-control px-5 py-3 text-right font-bold tabular-nums text-neutral-900">{product.addRate}%</td>
                    </tr>
                  ))}
                  {!dashboard?.topProducts?.length && (
                    <tr>
                      <td colSpan={4} className="alento-ui-control px-5 py-10 text-center text-neutral-500">
                        Todavía no hay suficientes eventos de producto.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

        </section>

          </>
        )}

        {activeMetricsSection === "EXTERNAL" && (
        <section className="mt-5 overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_8px_24px_rgba(28,23,20,.05)]">
          <div className="flex flex-col gap-4 border-b border-neutral-100 px-5 py-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-neutral-950 text-white">
                <Settings2 className="h-[18px] w-[18px]" />
              </span>
              <div>
                <h2 className="alento-ui-title">
                  Integraciones externas
                </h2>
                <p className="alento-ui-control mt-1 max-w-[820px] leading-5 text-neutral-600">
                  Conecta las plataformas que quieras usar. Alentó valida los identificadores y envía los eventos del embudo sin obligarte a pegar scripts manualmente.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="alento-ui-control rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-2 font-bold text-neutral-700">
                {configuredCount} de {INTEGRATIONS.length} configuradas
              </span>
            </div>
          </div>

          <div className="p-5">
            <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
              <article className="overflow-hidden rounded-[20px] border border-neutral-200 bg-[#faf9f7]">
                <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-neutral-950 text-white">
                      <Settings2 className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="alento-ui-status text-neutral-950">Ajustes de métricas</h3>
                      <p className="alento-ui-micro mt-0.5 text-neutral-500">
                        Controla cuándo se cargan las plataformas externas.
                      </p>
                    </div>
                  </div>
                  <span className={
                    "alento-ui-micro rounded-full px-2.5 py-1 font-bold " +
                    (settings.enabled
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-neutral-100 text-neutral-600")
                  }>
                    {settings.enabled ? "Medición activa" : "Solo Alentó"}
                  </span>
                </div>

                <div className="divide-y divide-neutral-200">
                  <label className="flex cursor-pointer items-center justify-between gap-5 px-4 py-4 transition hover:bg-white/70">
                    <span className="min-w-0">
                      <b className="alento-ui-control block text-neutral-950">
                        Rastreadores externos
                      </b>
                      <span className="alento-ui-micro mt-1 block max-w-[520px] leading-4 text-neutral-600">
                        Activa Meta, Google Analytics, TikTok y Clarity. La analítica propia de Alentó continúa funcionando si los apagas.
                      </span>
                    </span>
                    <span className="relative inline-flex shrink-0 items-center">
                      <input
                        type="checkbox"
                        checked={settings.enabled}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            enabled: event.target.checked,
                          }))
                        }
                        className="peer sr-only"
                      />
                      <span className="h-7 w-12 rounded-full bg-neutral-300 transition peer-checked:bg-[#e21a22]" />
                      <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-5 px-4 py-4 transition hover:bg-white/70">
                    <span className="min-w-0">
                      <b className="alento-ui-control block text-neutral-950">
                        Solicitar consentimiento
                      </b>
                      <span className="alento-ui-micro mt-1 block max-w-[520px] leading-4 text-neutral-600">
                        Antes de cargar herramientas externas, permite que el cliente acepte o continúe sin medición publicitaria.
                      </span>
                    </span>
                    <span className="relative inline-flex shrink-0 items-center">
                      <input
                        type="checkbox"
                        checked={settings.requireConsent}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            requireConsent: event.target.checked,
                          }))
                        }
                        className="peer sr-only"
                      />
                      <span className="h-7 w-12 rounded-full bg-neutral-300 transition peer-checked:bg-[#e21a22]" />
                      <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-end border-t border-neutral-200 bg-white px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void saveSettings()}
                    disabled={saving}
                    className="alento-ui-control h-10 rounded-full bg-neutral-950 px-5 text-white transition hover:bg-black disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar ajustes"}
                  </button>
                </div>
              </article>

              <article className="rounded-[20px] border border-amber-200 bg-[linear-gradient(145deg,#fffaf0,#fff7df)] p-4.5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-amber-950 text-amber-50">
                    <CircleAlert className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="alento-ui-status text-amber-950">
                      Evita eventos duplicados
                    </h3>
                    <p className="alento-ui-control mt-1.5 leading-5 text-amber-950/75">
                      Usa una sola conexión por plataforma. Si instalas Analytics, Meta o TikTok dentro de Google Tag Manager, no conectes esa misma herramienta también de forma directa en Alentó.
                    </p>
                    <p className="alento-ui-micro mt-3 rounded-[11px] border border-amber-200/80 bg-white/65 px-3 py-2 leading-4 text-amber-900">
                      Recomendación actual: mantén las conexiones directas que ya configuraste y deja GTM sin configurar mientras no lo necesites.
                    </p>
                  </div>
                </div>
              </article>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {INTEGRATIONS.map((integration) => {
                const configured = integrationConfigured(integration);
                const result = verification[integration.id];

                return (
                  <button
                    key={integration.id}
                    type="button"
                    onClick={() => setActiveIntegrationId(integration.id)}
                    className="group flex min-h-[154px] flex-col rounded-[20px] border border-neutral-200 bg-white p-4.5 text-left shadow-[0_9px_24px_rgba(28,23,20,.04)] transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_16px_34px_rgba(28,23,20,.08)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-10 min-w-10 items-center justify-center rounded-[12px] bg-neutral-950 px-2 text-[11px] font-black tracking-[0.04em] text-white">
                        {integration.short}
                      </span>

                      <span
                        className={
                          "alento-ui-micro inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold " +
                          (result?.status === "verified"
                            ? "bg-emerald-50 text-emerald-700"
                            : result?.status === "invalid"
                              ? "bg-red-50 text-red-700"
                              : configured
                                ? "bg-blue-50 text-blue-700"
                                : "bg-neutral-100 text-neutral-500")
                        }
                      >
                        {result?.status === "verified" ? (
                          <BadgeCheck className="h-3 w-3" />
                        ) : result?.status === "invalid" ? (
                          <CircleAlert className="h-3 w-3" />
                        ) : configured ? (
                          <Link2 className="h-3 w-3" />
                        ) : null}
                        {result?.status === "verified"
                          ? "Verificada"
                          : result?.status === "invalid"
                            ? "Revisar"
                            : configured
                              ? "Configurada"
                              : "Sin configurar"}
                      </span>
                    </div>

                    <h3 className="alento-ui-status mt-3 text-neutral-950">
                      {integration.name}
                    </h3>
                    <p className="alento-ui-control mt-1 line-clamp-2 leading-5 text-neutral-600">
                      {integration.description}
                    </p>

                    <span className="alento-ui-control mt-auto flex items-center justify-between pt-3 font-bold text-[#e21a22]">
                      {configured ? "Revisar configuración" : "Configurar"}
                      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
        )}

        {activeIntegration && (
          <div
            className="fixed inset-0 z-[260] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-label={`Configurar ${activeIntegration.name}`}
          >
            <div className="flex max-h-[92vh] w-full max-w-[940px] flex-col overflow-hidden rounded-[26px] border border-white/10 bg-white shadow-[0_30px_100px_rgba(0,0,0,.38)]">
              <div className="flex items-start justify-between gap-4 border-b border-neutral-200 bg-[#0d0d0e] px-5 py-4 text-white sm:px-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="alento-ui-label flex h-11 min-w-11 items-center justify-center rounded-[13px] border border-white/10 bg-white/[0.07] px-2 tracking-[0.04em]">
                    {activeIntegration.short}
                  </span>
                  <div className="min-w-0">
                    <p className="alento-ui-label uppercase tracking-[0.16em] text-[#ff454b]">
                      Integración
                    </p>
                    <h2 className="alento-ui-title mt-0.5 tracking-[-0.025em]">
                      {activeIntegration.name}
                    </h2>
                    <p className="alento-ui-body mt-1 max-w-[600px] leading-5 text-white/60">
                      {activeIntegration.description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveIntegrationId(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/60 transition hover:bg-white/[0.1] hover:text-white"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[.9fr_1.1fr] lg:overflow-hidden">
                <aside className="border-b border-neutral-200 bg-[#f7f6f4] p-5 sm:p-6 lg:overflow-y-auto lg:border-b-0 lg:border-r">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="alento-ui-label uppercase tracking-[0.13em] text-neutral-500">
                        Cómo obtenerlo
                      </p>
                      <h3 className="alento-ui-status mt-1">
                        Configuración paso a paso
                      </h3>
                    </div>
                    <a
                      href={activeIntegration.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="alento-ui-control inline-flex h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 text-neutral-700 transition hover:border-neutral-300"
                    >
                      {activeIntegration.externalLabel}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <div className="mt-5 space-y-3">
                    {activeIntegration.steps.map((step, index) => (
                      <div key={step} className="flex gap-3">
                        <span className="alento-ui-label flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white">
                          {index + 1}
                        </span>
                        <p className="alento-ui-body pt-0.5 leading-5 text-neutral-650">
                          {step}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[15px] border border-neutral-200 bg-white p-3">
                    <p className="alento-ui-label uppercase tracking-[0.1em] text-neutral-500">
                      Importante
                    </p>
                    <p className="alento-ui-body mt-1.5 leading-5 text-neutral-650">
                      {activeIntegration.note}
                    </p>
                  </div>
                </aside>

                <section className="p-5 sm:p-6 lg:overflow-y-auto">
                  <div>
                    <p className="alento-ui-label uppercase tracking-[0.13em] text-[#e21a22]">
                      Vincular con Alentó
                    </p>
                    <h3 className="alento-ui-title mt-1">
                      Identificadores de la integración
                    </h3>
                    <p className="alento-ui-body mt-1 leading-5 text-neutral-500">
                      No pegues scripts completos. Solo necesitamos los identificadores públicos que indica cada campo.
                    </p>
                  </div>

                  <div className="mt-5 space-y-4">
                    {activeIntegration.fields.map((field) => (
                      <label key={field.key} className="block">
                        <span className="alento-ui-label mb-1.5 flex items-center gap-1 text-neutral-800">
                          {field.label}
                          {field.required && (
                            <span className="text-[#e21a22]">*</span>
                          )}
                        </span>
                        <input
                          value={settings[field.key]}
                          onChange={(event) => {
                            updateTextSetting(field.key, event.target.value);
                            setVerification((current) => {
                              const next = { ...current };
                              delete next[activeIntegration.id];
                              return next;
                            });
                          }}
                          placeholder={field.placeholder}
                          autoComplete="off"
                          className="alento-ui-control h-12 w-full rounded-[13px] border border-neutral-200 bg-neutral-50 px-3.5 outline-none transition placeholder:font-normal placeholder:text-neutral-300 focus:border-neutral-400 focus:bg-white"
                        />
                        <span className="alento-ui-micro mt-1.5 block leading-4 text-neutral-500">
                          {field.help}
                        </span>
                      </label>
                    ))}
                  </div>

                  {verification[activeIntegration.id] && (
                    <div
                      className={
                        "mt-5 rounded-[15px] border p-3.5 " +
                        (verification[activeIntegration.id]?.status === "verified"
                          ? "border-emerald-200 bg-emerald-50"
                          : verification[activeIntegration.id]?.status === "invalid"
                            ? "border-red-200 bg-red-50"
                            : "border-blue-200 bg-blue-50")
                      }
                    >
                      <div className="flex items-start gap-2.5">
                        {verification[activeIntegration.id]?.status === "verified" ? (
                          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        ) : verification[activeIntegration.id]?.status === "invalid" ? (
                          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                        ) : (
                          <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                        )}
                        <div>
                          <b className="alento-ui-label block">
                            {verification[activeIntegration.id]?.title}
                          </b>
                          <p className="alento-ui-body mt-1 leading-5 text-neutral-650">
                            {verification[activeIntegration.id]?.detail}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 rounded-[15px] border border-neutral-200 bg-[#faf9f7] p-3">
                    <div className="flex items-start gap-2">
                      <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                      <p className="alento-ui-body leading-5 text-neutral-600">
                        <b className="text-neutral-700">Qué verifica Alentó:</b>{" "}
                        guardamos el ID, comprobamos su formato, confirmamos que nuestra integración quedó preparada y, cuando la plataforma permite una comprobación pública, probamos también su script. La recepción definitiva de eventos se confirma dentro del panel de cada plataforma después de generar tráfico.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveIntegrationId(null)}
                      className="alento-ui-control h-11 rounded-full border border-neutral-200 px-5 text-neutral-600 transition hover:bg-neutral-50"
                    >
                      Cerrar
                    </button>
                    {integrationConfigured(activeIntegration) && (
                      <button
                        type="button"
                        onClick={() => void verifyIntegration(activeIntegration.id)}
                        disabled={verifying === activeIntegration.id || saving}
                        className="alento-ui-control h-11 rounded-full border border-neutral-950 px-5 text-neutral-950 transition hover:bg-neutral-50 disabled:opacity-50"
                      >
                        {verifying === activeIntegration.id
                          ? "Comprobando..."
                          : "Probar conexión"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void saveAndVerify(activeIntegration.id)}
                      disabled={saving || verifying === activeIntegration.id}
                      className="alento-ui-control h-11 rounded-full bg-[#e21a22] px-6 text-white transition hover:bg-[#c9151c] disabled:opacity-50"
                    >
                      {saving
                        ? "Guardando..."
                        : verifying === activeIntegration.id
                          ? "Comprobando..."
                          : "Guardar y probar"}
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
