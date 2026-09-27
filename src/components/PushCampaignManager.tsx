"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  Eye,
  RefreshCcw,
  Send,
  Smartphone,
  UploadCloud,
  X,
  type LucideIcon,
} from "lucide-react";

type Campaign = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string;
  imageUrl: string | null;
  audience: string;
  channels: string[];
  actionType: string;
  actionValue: string | null;
  status: string;
  createdByName: string;
  webTargetCount: number;
  nativeTargetCount: number;
  webDeliveredCount: number;
  nativeDeliveredCount: number;
  failedCount: number;
  openedCount: number;
  sentAt: string | null;
  createdAt: string;
};

type DeliveryState = {
  webConfigured: boolean;
  androidConfigured: boolean;
  webDevices: number;
  androidDevices: number;
};

const audienceOptions = [
  { id: "DRIVERS", label: "Repartidores" },
  { id: "KITCHEN", label: "Cocina" },
  { id: "POS", label: "POS / Caja" },
  { id: "ADMIN", label: "Administración" },
  { id: "ALL_STAFF", label: "Todo el equipo" },
];

const sectionOptions = [
  { value: "/repartidor", label: "Repartidor" },
  { value: "/cocina", label: "Cocina" },
  { value: "/pedidos", label: "Pedidos" },
  { value: "/interno", label: "Punto de venta" },
  { value: "/caja", label: "Caja" },
];

function moneylessDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function audienceLabel(value: string) {
  return audienceOptions.find((item) => item.id === value)?.label ?? value;
}

function actionLabel(campaign: Campaign) {
  if (campaign.actionType === "NONE") return "Sin acción";
  if (campaign.actionType === "WEB") return "Web";
  if (campaign.actionType === "SECTION") return "Sección";
  return "Aplicación";
}

function CampaignMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl bg-[#faf9f7] px-2 py-2 text-center">
      <Icon className="mx-auto h-3.5 w-3.5 text-neutral-400" />
      <b className="mt-1 block text-[11px] text-neutral-900">
        {String(value)}
      </b>
      <span className="text-[7px] font-black uppercase tracking-[.08em] text-neutral-400">
        {label}
      </span>
    </div>
  );
}

export default function PushCampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [delivery, setDelivery] = useState<DeliveryState>({
    webConfigured: false,
    androidConfigured: false,
    webDevices: 0,
    androidDevices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [audience, setAudience] = useState("DRIVERS");
  const [channels, setChannels] = useState<string[]>(["WEB", "ANDROID"]);
  const [actionType, setActionType] = useState("APP");
  const [actionValue, setActionValue] = useState("/repartidor");

  const fileRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/push-campaigns", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible cargar las campañas Push.",
        );
      }

      setCampaigns(data.campaigns ?? []);
      setDelivery(
        data.delivery ?? {
          webConfigured: false,
          androidConfigured: false,
          webDevices: 0,
          androidDevices: 0,
        },
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar las campañas.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!androidAudienceAvailable) {
      setChannels((current) =>
        current.filter((channel) => channel !== "ANDROID"),
      );
    }
  }, [androidAudienceAvailable]);

  useEffect(() => {
    if (actionType !== "SECTION") return;
    if (audience === "DRIVERS") setActionValue("/repartidor");
    else if (audience === "KITCHEN") setActionValue("/cocina");
    else if (audience === "POS") setActionValue("/interno");
    else if (audience === "ADMIN") setActionValue("/interno");
  }, [actionType, audience]);

  const androidAudienceAvailable =
    audience === "DRIVERS" || audience === "ALL_STAFF";

  const totalDelivered = useMemo(
    () =>
      campaigns.reduce(
        (sum, campaign) =>
          sum +
          campaign.webDeliveredCount +
          campaign.nativeDeliveredCount,
        0,
      ),
    [campaigns],
  );

  const totalOpened = useMemo(
    () =>
      campaigns.reduce(
        (sum, campaign) => sum + campaign.openedCount,
        0,
      ),
    [campaigns],
  );

  function toggleChannel(channel: string) {
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setError("");
    setNotice("");

    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/push-campaigns/image", {
        method: "POST",
        body: form,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible cargar la imagen.");
      }

      setImageUrl(String(data.url || ""));
      setNotice("Imagen lista para esta notificación.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "No fue posible cargar la imagen.",
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function sendCampaign() {
    if (sending) return;

    setSending(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/push-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle,
          body,
          imageUrl: imageUrl || null,
          audience,
          channels,
          actionType,
          actionValue,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible enviar la notificación.",
        );
      }

      const delivered = Number(data.delivery?.delivered ?? 0);
      setNotice(
        delivered > 0
          ? `Notificación enviada a ${delivered} dispositivo(s).`
          : "La campaña se guardó, pero no había dispositivos disponibles.",
      );

      setTitle("");
      setSubtitle("");
      setBody("");
      setImageUrl("");
      setActionType("APP");
      setActionValue(
        audience === "DRIVERS"
          ? "/repartidor"
          : audience === "KITCHEN"
            ? "/cocina"
            : "/interno",
      );

      await load();
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "No fue posible enviar la notificación.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="rounded-[26px] bg-[radial-gradient(circle_at_88%_14%,rgba(229,28,17,.34),transparent_25%),linear-gradient(135deg,#09090a,#171719)] px-6 py-5 text-white shadow-[0_18px_50px_rgba(0,0,0,.18)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-red-300/70">
              Centro Push
            </p>
            <h1 className="mt-1 text-[28px] font-black tracking-[-.04em]">
              Notificaciones APK + PWA
            </h1>
            <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-white/55">
              Envía mensajes manuales al equipo y conserva métricas de
              entrega y apertura.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[.055] px-4 py-2.5 text-center">
              <span className="text-[8px] font-black uppercase tracking-[.12em] text-white/35">
                Campañas
              </span>
              <b className="mt-1 block text-xl">{campaigns.length}</b>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.055] px-4 py-2.5 text-center">
              <span className="text-[8px] font-black uppercase tracking-[.12em] text-white/35">
                Entregas
              </span>
              <b className="mt-1 block text-xl">{totalDelivered}</b>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.055] px-4 py-2.5 text-center">
              <span className="text-[8px] font-black uppercase tracking-[.12em] text-white/35">
                Vistas
              </span>
              <b className="mt-1 block text-xl">{totalOpened}</b>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
          {notice}
        </p>
      )}

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <section className="alento-card rounded-[26px] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.14em] text-neutral-400">
                Nuevo mensaje
              </p>
              <h2 className="mt-1 text-xl font-black tracking-[-.03em]">
                Crear notificación
              </h2>
            </div>
            <Send className="h-5 w-5 text-[var(--brand-red)]" />
          </div>

          <div className="mt-4 grid gap-4">
            <label>
              <span className="flex items-center justify-between text-[11px] font-bold text-neutral-700">
                Título
                <em className="not-italic text-neutral-400">
                  {title.length}/20
                </em>
              </span>
              <input
                value={title}
                maxLength={20}
                onChange={(event) => setTitle(event.target.value)}
                className="alento-input mt-1.5 h-11 w-full rounded-xl px-3.5"
                placeholder="Ej. Reunión a las 4"
              />
            </label>

            <label>
              <span className="flex items-center justify-between text-[11px] font-bold text-neutral-700">
                Subtítulo
                <em className="not-italic text-neutral-400">
                  {subtitle.length}/30
                </em>
              </span>
              <input
                value={subtitle}
                maxLength={30}
                onChange={(event) => setSubtitle(event.target.value)}
                className="alento-input mt-1.5 h-11 w-full rounded-xl px-3.5"
                placeholder="Opcional"
              />
            </label>

            <label>
              <span className="flex items-center justify-between text-[11px] font-bold text-neutral-700">
                Mensaje
                <em className="not-italic text-neutral-400">
                  {body.length}/240
                </em>
              </span>
              <textarea
                value={body}
                maxLength={240}
                onChange={(event) => setBody(event.target.value)}
                className="alento-input mt-1.5 min-h-[105px] w-full resize-none rounded-xl px-3.5 py-3"
                placeholder="Escribe el mensaje que recibirá el equipo..."
              />
            </label>

            <div>
              <span className="text-[11px] font-bold text-neutral-700">
                Imagen opcional
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(file);
                }}
              />

              {imageUrl ? (
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-[#faf9f7] p-2.5">
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-16 w-24 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <b className="text-[11px]">Imagen cargada</b>
                    <p className="mt-1 text-[9px] text-neutral-400">
                      Se mostrará expandida cuando el dispositivo lo soporte.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white"
                    aria-label="Quitar imagen"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-[#faf9f7] text-[11px] font-bold text-neutral-600 disabled:opacity-50"
                >
                  {uploading ? (
                    <RefreshCcw className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                  {uploading ? "Cargando..." : "Seleccionar imagen"}
                </button>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="text-[11px] font-bold text-neutral-700">
                  Audiencia
                </span>
                <select
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  className="alento-input mt-1.5 h-11 w-full rounded-xl px-3"
                >
                  {audienceOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="text-[11px] font-bold text-neutral-700">
                  Canales
                </span>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleChannel("WEB")}
                    className={
                      "h-11 rounded-xl border text-[10px] font-black " +
                      (channels.includes("WEB")
                        ? "border-neutral-950 bg-neutral-950 text-white"
                        : "border-neutral-200 bg-white text-neutral-500")
                    }
                  >
                    PWA · {delivery.webDevices}
                  </button>
                  <button
                    type="button"
                    disabled={!androidAudienceAvailable}
                    onClick={() => toggleChannel("ANDROID")}
                    title={
                      androidAudienceAvailable
                        ? "Enviar a la APK oficial de Repartidor"
                        : "La APK 004 pertenece únicamente a Repartidores"
                    }
                    className={
                      "h-11 rounded-xl border text-[10px] font-black disabled:cursor-not-allowed disabled:opacity-35 " +
                      (channels.includes("ANDROID")
                        ? "border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]"
                        : "border-neutral-200 bg-white text-neutral-500")
                    }
                  >
                    APK · {delivery.androidDevices}
                  </button>
                </div>
              </div>
            </div>

            <fieldset className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3.5">
              <legend className="px-1 text-[11px] font-bold text-neutral-700">
                Al tocar, abrir
              </legend>
              <div className="grid gap-2 sm:grid-cols-4">
                {[
                  ["APP", "Aplicación"],
                  ["SECTION", "Sección"],
                  ["WEB", "Web"],
                  ["NONE", "Nada"],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className={
                      "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-bold " +
                      (actionType === value
                        ? "border-neutral-950 bg-white text-neutral-950"
                        : "border-transparent text-neutral-500")
                    }
                  >
                    <input
                      type="radio"
                      name="push-action"
                      value={value}
                      checked={actionType === value}
                      onChange={() => setActionType(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              {actionType === "SECTION" && (
                <select
                  value={actionValue}
                  onChange={(event) => setActionValue(event.target.value)}
                  className="alento-input mt-3 h-11 w-full rounded-xl px-3"
                >
                  {sectionOptions.map((section) => (
                    <option key={section.value} value={section.value}>
                      {section.label}
                    </option>
                  ))}
                </select>
              )}

              {actionType === "WEB" && (
                <input
                  value={actionValue}
                  onChange={(event) => setActionValue(event.target.value)}
                  className="alento-input mt-3 h-11 w-full rounded-xl px-3.5"
                  placeholder="https://..."
                />
              )}
            </fieldset>

            <button
              type="button"
              onClick={() => void sendCampaign()}
              disabled={sending || !title.trim() || !body.trim() || !channels.length}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-red)] px-5 text-[12px] font-black text-white shadow-[0_10px_24px_rgba(226,26,34,.22)] disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {sending ? "Enviando..." : "Enviar notificación"}
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[26px] border border-neutral-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-neutral-400">
              Vista previa
            </p>
            <div className="mt-3 rounded-[24px] bg-[#111] p-3 text-white shadow-[0_18px_45px_rgba(0,0,0,.18)]">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt=""
                  className="mb-3 aspect-[2/1] w-full rounded-2xl object-cover"
                />
              )}
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white">
                  <BellRing className="h-5 w-5 text-[var(--brand-red)]" />
                </span>
                <div className="min-w-0">
                  <b className="block truncate text-[13px]">
                    {title || "Título de la notificación"}
                  </b>
                  {subtitle && (
                    <span className="mt-0.5 block truncate text-[10px] font-semibold text-white/60">
                      {subtitle}
                    </span>
                  )}
                  <p className="mt-1 text-[11px] leading-4 text-white/65">
                    {body || "Aquí aparecerá el mensaje que recibirá el equipo."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[26px] border border-neutral-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-neutral-400">
              Estado de canales
            </p>
            <div className="mt-3 grid gap-2">
              <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3">
                <span className="flex items-center gap-2 text-[11px] font-bold">
                  <BellRing className="h-4 w-4" />
                  PWA Web Push
                </span>
                <span
                  className={
                    "rounded-full px-2 py-1 text-[9px] font-black " +
                    (delivery.webConfigured
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700")
                  }
                >
                  {delivery.webConfigured
                    ? `${delivery.webDevices} dispositivos`
                    : "Sin configurar"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3">
                <span className="flex items-center gap-2 text-[11px] font-bold">
                  <Smartphone className="h-4 w-4" />
                  APK Repartidor 004
                </span>
                <span
                  className={
                    "rounded-full px-2 py-1 text-[9px] font-black " +
                    (delivery.androidConfigured
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700")
                  }
                >
                  {delivery.androidConfigured
                    ? `${delivery.androidDevices} dispositivos`
                    : "Firebase pendiente"}
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section className="alento-card rounded-[26px] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-neutral-400">
              Historial
            </p>
            <h2 className="mt-1 text-xl font-black tracking-[-.03em]">
              Notificaciones enviadas
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-[10px] font-bold text-neutral-600"
          >
            <RefreshCcw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} />
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm font-semibold text-neutral-400">
            Cargando historial...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-neutral-200 py-12 text-center text-sm text-neutral-400">
            Aún no hay campañas Push manuales.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {campaigns.map((campaign) => {
              const target =
                campaign.webTargetCount + campaign.nativeTargetCount;
              const delivered =
                campaign.webDeliveredCount +
                campaign.nativeDeliveredCount;
              const openRate =
                delivered > 0
                  ? Math.round((campaign.openedCount / delivered) * 100)
                  : 0;

              return (
                <article
                  key={campaign.id}
                  className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5 lg:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="truncate text-[13px] text-neutral-950">
                        {campaign.title}
                      </b>
                      <span
                        className={
                          "rounded-full px-2 py-1 text-[8px] font-black uppercase " +
                          (campaign.status === "SENT"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700")
                        }
                      >
                        {campaign.status === "SENT" ? "Enviada" : "Fallida"}
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2 py-1 text-[8px] font-bold text-neutral-500">
                        {audienceLabel(campaign.audience)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-neutral-500">
                      {campaign.body}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[8px] font-bold text-neutral-400">
                      <span>{moneylessDate(campaign.sentAt || campaign.createdAt)}</span>
                      <span>·</span>
                      <span>{campaign.createdByName}</span>
                      <span>·</span>
                      <span>{campaign.channels.join(" + ")}</span>
                      <span>·</span>
                      <span>{actionLabel(campaign)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 lg:min-w-[360px]">
                    <CampaignMetric
                      label="Objetivo"
                      value={target}
                      icon={Smartphone}
                    />
                    <CampaignMetric
                      label="Entregas"
                      value={delivered}
                      icon={CheckCircle2}
                    />
                    <CampaignMetric
                      label="Fallos"
                      value={campaign.failedCount}
                      icon={X}
                    />
                    <CampaignMetric
                      label="Vistas"
                      value={`${campaign.openedCount} · ${openRate}%`}
                      icon={Eye}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-[9px] leading-4 text-neutral-400">
          “Entregas” significa que el servicio Push aceptó el mensaje. “Vistas”
          cuenta aperturas únicas al tocar la notificación.
        </p>
      </section>
    </div>
  );
}
