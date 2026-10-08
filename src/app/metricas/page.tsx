"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Eye,
  MousePointerClick,
  Settings2,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import type { TrackingSettings } from "@/lib/trackingSettings";

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

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
}) {
  return (
    <article className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-[0_10px_30px_rgba(20,15,12,.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-neutral-400">
            {label}
          </p>
          <strong className="mt-2 block text-[28px] font-black tracking-[-0.04em] text-neutral-950">
            {value}
          </strong>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-neutral-950 text-white">
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-neutral-400">{detail}</p>
    </article>
  );
}

export default function MetricsPage() {
  const [days, setDays] = useState(7);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [settings, setSettings] =
    useState<TrackingSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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

  const maxHourly = useMemo(
    () =>
      Math.max(
        1,
        ...(dashboard?.hourly ?? []).map((item) => item.menuViews),
      ),
    [dashboard],
  );

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
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible guardar las integraciones.",
      );
    } finally {
      setSaving(false);
    }
  }

  const summary = dashboard?.summary;

  return (
    <main className="min-h-screen bg-[#f4f3f1] p-4 text-neutral-950 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1280px]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#e21a22]">
              <BarChart3 className="h-4 w-4" />
              Catálogo y conversión
            </div>
            <h1 className="mt-2 text-[30px] font-black tracking-[-0.04em] sm:text-[36px]">
              Métricas
            </h1>
            <p className="mt-1 max-w-[650px] text-[12px] leading-5 text-neutral-500">
              Visitas al menú, productos vistos, carritos, abandono, pedidos y origen del tráfico. La medición propia de Alentó no depende de Google ni de Meta.
            </p>
          </div>

          <div className="flex rounded-[14px] border border-neutral-200 bg-white p-1">
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
                  "rounded-[10px] px-3 py-2 text-[10px] font-bold transition " +
                  (days === option.value
                    ? "bg-neutral-950 text-white"
                    : "text-neutral-500 hover:bg-neutral-100")
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        {message && (
          <div className="mt-5 rounded-[14px] border border-neutral-200 bg-white px-4 py-3 text-[11px] font-semibold text-neutral-600">
            {message}
          </div>
        )}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <article className="rounded-[22px] border border-neutral-200 bg-white p-5">
            <div>
              <h2 className="text-[16px] font-black">Carga del menú por hora</h2>
              <p className="mt-1 text-[10px] text-neutral-400">
                Horario Colombia. Permite ver a qué hora comienza y alcanza su pico la intención de compra.
              </p>
            </div>

            <div className="mt-6 flex h-[220px] items-end gap-1.5 border-b border-neutral-200 pb-1">
              {(dashboard?.hourly ?? []).map((item) => (
                <div
                  key={item.hour}
                  className="group flex min-w-0 flex-1 flex-col items-center justify-end"
                  title={`${item.label}: ${item.menuViews} visitas · ${item.orders} pedidos`}
                >
                  <div
                    className="w-full rounded-t-[5px] bg-[#e21a22] transition group-hover:bg-[#bf1118]"
                    style={{
                      height: `${Math.max(
                        item.menuViews ? 4 : 0,
                        (item.menuViews / maxHourly) * 188,
                      )}px`,
                    }}
                  />
                  <span className="mt-2 text-[8px] text-neutral-350">
                    {item.hour % 3 === 0
                      ? String(item.hour).padStart(2, "0")
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[22px] border border-neutral-200 bg-white p-5">
            <h2 className="text-[16px] font-black">Embudo del catálogo</h2>
            <p className="mt-1 text-[10px] text-neutral-400">
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
                  <div className="flex items-center justify-between text-[10px]">
                    <b>{label}</b>
                    <span className="text-neutral-400">
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
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <article className="overflow-hidden rounded-[22px] border border-neutral-200 bg-white">
            <div className="border-b border-neutral-100 px-5 py-4">
              <h2 className="text-[16px] font-black">Productos con más interés</h2>
              <p className="mt-1 text-[10px] text-neutral-400">
                Qué productos abren y cuáles convierten mejor en agregar al carrito.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead className="bg-neutral-50 text-[9px] uppercase tracking-[0.1em] text-neutral-400">
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
                      <td className="px-5 py-3 text-[11px] font-bold">{product.name}</td>
                      <td className="px-4 py-3 text-right text-[11px]">{number(product.views)}</td>
                      <td className="px-4 py-3 text-right text-[11px]">{number(product.adds)}</td>
                      <td className="px-5 py-3 text-right text-[11px] font-bold">{product.addRate}%</td>
                    </tr>
                  ))}
                  {!dashboard?.topProducts?.length && (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-[11px] text-neutral-400">
                        Todavía no hay suficientes eventos de producto.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-[22px] border border-neutral-200 bg-white p-5">
            <h2 className="text-[16px] font-black">Origen del tráfico</h2>
            <p className="mt-1 text-[10px] text-neutral-400">
              UTM, referidos y tráfico directo detectado al entrar al menú.
            </p>
            <div className="mt-4 space-y-2">
              {(dashboard?.sources ?? []).map((source) => (
                <div
                  key={source.source}
                  className="flex items-center justify-between rounded-[13px] border border-neutral-100 bg-neutral-50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <b className="block truncate text-[10px]">{source.source}</b>
                    <span className="mt-0.5 block text-[9px] text-neutral-400">
                      {number(source.visitors)} visitantes
                    </span>
                  </div>
                  <strong className="text-[12px]">{number(source.views)}</strong>
                </div>
              ))}
              {!dashboard?.sources?.length && (
                <p className="py-8 text-center text-[10px] text-neutral-400">
                  El origen aparecerá cuando empiecen a llegar visitas.
                </p>
              )}
            </div>
          </article>
        </section>

        <section className="mt-6 rounded-[24px] border border-neutral-200 bg-white">
          <div className="flex items-start gap-3 border-b border-neutral-100 px-5 py-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-neutral-950 text-white">
              <Settings2 className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h2 className="text-[17px] font-black">Integraciones de medición y publicidad</h2>
              <p className="mt-1 max-w-[760px] text-[10px] leading-4 text-neutral-400">
                Conecta los identificadores públicos de tus plataformas. Los eventos de producto, carrito, checkout y compra se enviarán también a las redes activadas para ayudar a medir y optimizar campañas.
              </p>
            </div>
          </div>

          <div className="grid gap-5 p-5 xl:grid-cols-2">
            <div className="space-y-4">
              <label className="flex items-center justify-between rounded-[15px] border border-neutral-200 p-3">
                <span>
                  <b className="block text-[11px]">Rastreadores externos</b>
                  <span className="mt-0.5 block text-[9px] text-neutral-400">
                    La medición propia de Alentó funciona aunque esto esté apagado.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      enabled: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 accent-[#e21a22]"
                />
              </label>

              <label className="flex items-center justify-between rounded-[15px] border border-neutral-200 p-3">
                <span>
                  <b className="block text-[11px]">Solicitar consentimiento</b>
                  <span className="mt-0.5 block text-[9px] text-neutral-400">
                    Recomendado para analítica publicitaria y protección de privacidad.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.requireConsent}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      requireConsent: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 accent-[#e21a22]"
                />
              </label>

              {[
                ["Google Tag Manager", "googleTagManagerId", "GTM-XXXXXXX"],
                ["Google Analytics 4", "googleAnalyticsId", "G-XXXXXXXXXX"],
                ["Google Ads", "googleAdsId", "AW-123456789"],
                ["Google Ads · etiqueta compra", "googleAdsPurchaseLabel", "AbCdEFghijk"],
              ].map(([label, key, placeholder]) => (
                <label key={key} className="block">
                  <span className="mb-1.5 block text-[10px] font-bold">{label}</span>
                  <input
                    value={String(settings[key as keyof TrackingSettings])}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    placeholder={placeholder}
                    className="h-11 w-full rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 text-[11px] outline-none transition focus:border-neutral-400 focus:bg-white"
                  />
                </label>
              ))}
            </div>

            <div className="space-y-4">
              {[
                ["Meta Pixel", "metaPixelId", "123456789012345"],
                ["TikTok Pixel", "tiktokPixelId", "CXXXXXXXXXXXXXXX"],
                ["Microsoft Clarity", "clarityId", "abcdefghij"],
              ].map(([label, key, placeholder]) => (
                <label key={key} className="block">
                  <span className="mb-1.5 block text-[10px] font-bold">{label}</span>
                  <input
                    value={String(settings[key as keyof TrackingSettings])}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    placeholder={placeholder}
                    className="h-11 w-full rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 text-[11px] outline-none transition focus:border-neutral-400 focus:bg-white"
                  />
                </label>
              ))}

              <div className="rounded-[15px] border border-amber-200 bg-amber-50 p-3 text-[9.5px] leading-4 text-amber-900/75">
                Si utilizas Google Tag Manager para instalar Analytics, Meta, TikTok u otras etiquetas, evita configurar la misma herramienta también de forma directa para no duplicar eventos. GTM queda disponible precisamente para integrar plataformas adicionales sin cambiar el código de Alentó.
              </div>

              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={saving}
                className="h-11 w-full rounded-full bg-[#e21a22] text-[11px] font-bold text-white transition hover:bg-[#c9151c] disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar integraciones"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
