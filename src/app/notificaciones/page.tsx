"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TemplateConfig = {
  id: string;
  title: string;
  event: string;
  audience: "CUSTOMER" | "DRIVER";
  fulfillmentTypes: string[];
  templateName: string;
  language: string;
  category: string;
  headerImageUrl: string;
  active: boolean;
  variables: Array<{ key: string; label: string; source: string }>;
  button?: { type: "tracking" | "driver_tracking" | "static"; label: string; value?: string } | null;
  delayMinutes?: number;
};

type Filter = "ALL" | "CUSTOMER" | "DRIVER" | "ACTIVE" | "INACTIVE";

const fulfillmentLabel: Record<string, string> = {
  DELIVERY: "Domicilio",
  PICKUP: "Recoger",
  STORE: "Local",
};

const eventDescription: Record<string, string> = {
  "order.created": "Se envía inmediatamente después de crear el pedido.",
  "order.status.READY": "Se envía cuando un pedido de local o recoger queda listo.",
  "order.driver_assigned": "Se envía al repartidor cuando le asignas un domicilio.",
  "order.status.OUT_FOR_DELIVERY": "Se envía cuando el repartidor inicia la entrega.",
  "order.status.ARRIVED": "Se envía cuando el repartidor confirma que llegó.",
  "order.status.DELIVERED": "Se envía cuando el domicilio queda entregado.",
  "order.status.COMPLETED": "Se envía al finalizar un pedido de local o recoger.",
  "order.review": "Se programa después del cierre para solicitar una reseña.",
};

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
}

function UploadIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="m6 6 12 12M18 6 6 18"/></svg>;
}

function ImageIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/></svg>;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text };
  }
}

function Switch({ checked, onChange, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      aria-pressed={checked}
      aria-disabled={disabled}
      disabled={disabled}
      className={`relative h-8 w-14 shrink-0 rounded-full border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${checked
        ? "border-emerald-500 bg-emerald-500 shadow-[0_8px_18px_rgba(16,185,129,.22)]"
        : "border-neutral-300 bg-neutral-200"
      }`}
    >
      <span
        className={`absolute top-[3px] h-6 w-6 rounded-full bg-white shadow-[0_3px_10px_rgba(0,0,0,.18)] transition-all duration-200 ${checked ? "left-[25px]" : "left-[3px]"}`}
      />
    </button>
  );
}

function TemplateImage({ template }: { template: TemplateConfig }) {
  return (
    <div className="aspect-video overflow-hidden rounded-[18px] border border-neutral-200 bg-[#f5f4f1]">
      {template.headerImageUrl ? (
        <img src={template.headerImageUrl} alt={template.title} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-neutral-300">
          <ImageIcon />
          <span className="text-[10px] font-bold uppercase tracking-[.08em]">Sin imagen</span>
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/notification-templates", { cache: "no-store" })
      .then(async (response) => {
        const data = await readJsonResponse(response);
        if (!response.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "No fue posible cargar las notificaciones.",
          );
        }
        const loaded = (data.templates ?? []) as TemplateConfig[];
        setTemplates(loaded);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No fue posible cargar las notificaciones."))
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(
    () => templates.find((item) => item.id === selectedId) ?? null,
    [templates, selectedId],
  );
  const activeCount = useMemo(() => templates.filter((item) => item.active).length, [templates]);
  const customerCount = useMemo(() => templates.filter((item) => item.audience === "CUSTOMER").length, [templates]);
  const driverCount = useMemo(() => templates.filter((item) => item.audience === "DRIVER").length, [templates]);

  const visibleTemplates = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    return templates.filter((template) => {
      const matchesFilter =
        filter === "ALL" ||
        (filter === "CUSTOMER" && template.audience === "CUSTOMER") ||
        (filter === "DRIVER" && template.audience === "DRIVER") ||
        (filter === "ACTIVE" && template.active) ||
        (filter === "INACTIVE" && !template.active);
      const matchesQuery =
        !needle ||
        template.title.toLocaleLowerCase("es").includes(needle) ||
        template.event.toLocaleLowerCase("es").includes(needle) ||
        template.templateName.toLocaleLowerCase("es").includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [templates, filter, query]);

  async function setTemplateActive(templateId: string, active: boolean) {
    if (togglingId) return;
    const target = templates.find((item) => item.id === templateId);
    if (active && !target?.headerImageUrl) {
      setError("Primero carga una imagen para poder activar esta notificación.");
      setNotice("");
      return;
    }
    setTogglingId(templateId);
    setError("");
    setNotice("");

    const nextTemplates = templates.map((item) =>
      item.id === templateId ? { ...item, active } : item,
    );
    setTemplates(nextTemplates);

    try {
      const response = await fetch("/api/notification-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates: nextTemplates }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "No fue posible actualizar la notificación.",
        );
      }

      setTemplates((data.templates ?? nextTemplates) as TemplateConfig[]);
      setNotice(active ? "Notificación activada." : "Notificación desactivada.");
    } catch (toggleError) {
      setTemplates((current) => current.map((item) =>
        item.id === templateId ? { ...item, active: !active } : item,
      ));
      setError(toggleError instanceof Error ? toggleError.message : "No fue posible actualizar la notificación.");
    } finally {
      setTogglingId(null);
    }
  }

  async function uploadImage(file: File) {
    if (!selected) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("templateId", selected.id);
      const response = await fetch("/api/notification-images", { method: "POST", body: form });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `No fue posible cargar la imagen (HTTP ${response.status}).`);
      }

      const uploadedUrl = String(data.url || "");
      setTemplates((current) => current.map((item) =>
        item.id === selected.id ? { ...item, headerImageUrl: uploadedUrl, active: false } : item,
      ));
      setNotice("Imagen cargada correctamente. La notificación quedó inactiva; actívala cuando estés listo.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No fue posible cargar la imagen.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: "ALL", label: "Todas", count: templates.length },
    { id: "CUSTOMER", label: "Clientes", count: customerCount },
    { id: "DRIVER", label: "Repartidores", count: driverCount },
    { id: "ACTIVE", label: "Activas", count: activeCount },
    { id: "INACTIVE", label: "Inactivas", count: templates.length - activeCount },
  ];

  return (
    <main className="min-h-screen p-4 lg:p-5">
      <div className="space-y-4">
        <header className="rounded-[26px] bg-[radial-gradient(circle_at_88%_14%,rgba(229,28,17,.30),transparent_24%),linear-gradient(135deg,#09090a,#171719)] px-6 py-5 text-white shadow-[0_18px_50px_rgba(0,0,0,.18)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[.2em] text-white/40">Automatización</p>
              <h1 className="mt-1 text-[28px] font-black tracking-[-.04em]">Notificaciones WhatsApp</h1>
              <p className="mt-1.5 text-[12px] text-white/55">Consulta la configuración aprobada en Meta, activa cada flujo y administra su imagen desde Alentó.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/[.055] px-4 py-2 text-center">
                <span className="block text-[8px] font-bold uppercase tracking-[.12em] text-white/40">Activas</span>
                <b className="mt-0.5 block text-xl leading-none">{activeCount}/{templates.length}</b>
              </div>
            </div>
          </div>
        </header>

        {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</p>}
        {notice && <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">{notice}</p>}

        <section className="alento-card rounded-[26px] p-4 lg:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.13em] text-neutral-400">Galería</p>
              <h2 className="mt-1 text-xl font-black tracking-[-.03em] text-neutral-950">Plantillas configuradas</h2>
              <p className="mt-1 text-[11px] text-neutral-500">Cada tarjeta representa una automatización. Haz clic para editarla.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-wrap gap-1.5">
                {filters.map((item) => (
                  <button key={item.id} type="button" onClick={() => setFilter(item.id)}
                    className={`rounded-full border px-3 py-2 text-[9px] font-bold ${filter === item.id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-500"}`}>
                    {item.label} <span className="ml-1 opacity-60">{item.count}</span>
                  </button>
                ))}
              </div>
              <label className="relative block min-w-[260px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"><SearchIcon /></span>
                <input value={query} onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar plantilla..."
                  className="alento-input h-10 w-full rounded-xl pl-9 pr-3 text-[11px]" />
              </label>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm font-semibold text-neutral-400">Cargando plantillas...</div>
          ) : visibleTemplates.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-neutral-200 py-16 text-center text-sm text-neutral-400">No hay plantillas con estos filtros.</div>
          ) : (
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleTemplates.map((template) => (
                <article key={template.id}
                  onClick={() => setSelectedId(template.id)}
                  className={`group cursor-pointer overflow-hidden rounded-[26px] border bg-white p-3.5 transition hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(20,18,16,.10)] ${template.active ? "border-emerald-200 shadow-[0_10px_28px_rgba(16,185,129,.07)]" : "border-neutral-200 shadow-[0_10px_28px_rgba(20,18,16,.045)]"}`}>
                  <TemplateImage template={template} />

                  <div className="px-1 pb-1 pt-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-black tracking-[-.02em] text-neutral-950">{template.title}</h3>
                        <p className="mt-1 truncate text-[9px] font-semibold text-neutral-400">{template.event}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`hidden rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[.07em] sm:inline-flex ${template.active ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-neutral-100 text-neutral-500"}`}>
                          {template.active ? "Activa" : template.headerImageUrl ? "Inactiva" : "Sin imagen"}
                        </span>
                        <Switch
                          checked={template.active}
                          disabled={!template.headerImageUrl}
                          onChange={(active) => void setTemplateActive(template.id, active)}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex min-h-[26px] flex-wrap gap-1.5">
                      <span className="rounded-full bg-neutral-950 px-2 py-1 text-[8px] font-bold text-white">{template.audience === "DRIVER" ? "Repartidor" : "Cliente"}</span>
                      {template.fulfillmentTypes.map((type) => (
                        <span key={type} className="rounded-full bg-neutral-100 px-2 py-1 text-[8px] font-bold text-neutral-500">{fulfillmentLabel[type] ?? type}</span>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3.5">
                      <span className="truncate text-[9px] font-semibold text-neutral-500">{template.templateName}</span>
                      <span className="text-[10px] font-black text-[var(--brand-red)]">EDITAR →</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[3px]" onClick={() => !uploading && setSelectedId(null)}>
          <div className="flex max-h-[94dvh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_100px_rgba(0,0,0,.35)]" onClick={(event) => event.stopPropagation()}>
            <header className="flex shrink-0 items-start justify-between gap-4 border-b-[3px] border-[var(--brand-red)] bg-[linear-gradient(135deg,#09090a,#241719)] px-5 py-4 text-white sm:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[9px] font-bold uppercase tracking-[.16em] text-white/40">Detalle notificación</p>
                  <span className={`rounded-full px-2 py-1 text-[8px] font-bold ${selected.active ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/50"}`}>{selected.active ? "ACTIVA" : "INACTIVA"}</span>
                </div>
                <h2 className="mt-1 text-[24px] font-black tracking-[-.035em]">{selected.title}</h2>
                <p className="mt-1 text-[10px] text-white/45">{selected.event}</p>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white" aria-label="Cerrar">
                <CloseIcon />
              </button>
            </header>

            {(error || notice) && (
              <div className={`mx-4 mt-4 rounded-xl border px-4 py-3 text-[10px] font-semibold sm:mx-5 lg:mx-6 ${error ? "border-red-100 bg-red-50 text-red-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>
                {error || notice}
              </div>
            )}

            <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
                <div className="space-y-5">
                  <section>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black text-neutral-950">Imagen de la plantilla</p>
                        <p className="mt-1 text-[10px] leading-4 text-neutral-500">El contenedor mantiene proporción 16:9 y muestra la imagen completa sin recortarla.</p>
                      </div>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-black text-neutral-500">16:9</span>
                    </div>

                    <div className="mt-3 aspect-video overflow-hidden rounded-[22px] border border-neutral-200 bg-[#f4f3ef]">
                      {selected.headerImageUrl ? (
                        <img src={selected.headerImageUrl} alt={selected.title} className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-neutral-300"><ImageIcon /><span className="text-[10px] font-bold">Sin imagen cargada</span></div>
                      )}
                    </div>

                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadImage(file);
                      }} />

                    <div className="mt-3 rounded-[18px] border border-dashed border-neutral-300 bg-[#faf9f7] p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-neutral-900">
                            {selected.headerImageUrl ? "Imagen cargada en Alentó" : "Aún no hay una imagen cargada"}
                          </p>
                          <p className="mt-1 text-[9px] leading-4 text-neutral-500">
                            {selected.headerImageUrl
                              ? "Esta es la imagen que se enviará con la plantilla."
                              : "Carga la imagen aprobada para que Alentó la use en el envío."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-[11px] font-black text-white shadow-[0_8px_18px_rgba(0,0,0,.12)] disabled:opacity-50"
                        >
                          <UploadIcon />
                          {uploading ? "Cargando..." : selected.headerImageUrl ? "Reemplazar imagen" : "Cargar imagen"}
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-[9px] leading-4 text-neutral-400">JPG, PNG o WebP · máximo 8 MB. No se muestran ni gestionan URLs manuales.</p>
                  </section>

                  <section className="border-t border-neutral-100 pt-5">
                    <div className="mb-3">
                      <p className="text-[11px] font-black text-neutral-950">Datos de Meta</p>
                      <p className="mt-1 text-[9px] leading-4 text-neutral-400">Estos datos son informativos y corresponden a la plantilla aprobada en Meta.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-neutral-200 bg-[linear-gradient(145deg,#fff,#faf9f7)] p-4 shadow-[0_6px_16px_rgba(20,18,16,.03)]">
                        <span className="text-[8px] font-black uppercase tracking-[.09em] text-neutral-400">Plantilla</span>
                        <p className="mt-2 break-words text-[13px] font-black text-neutral-900">{selected.templateName}</p>
                      </div>
                      <div className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-4">
                        <span className="text-[8px] font-black uppercase tracking-[.09em] text-neutral-400">Idioma</span>
                        <p className="mt-2 text-[13px] font-black uppercase text-neutral-900">{selected.language}</p>
                      </div>
                      <div className="rounded-2xl border border-neutral-200 bg-[#faf9f7] p-4">
                        <span className="text-[8px] font-black uppercase tracking-[.09em] text-neutral-400">Categoría</span>
                        <p className="mt-2 text-[13px] font-black text-neutral-900">{selected.category}</p>
                      </div>
                    </div>
                  </section>

                  {selected.button && (
                    <section className="border-t border-neutral-100 pt-5">
                      <div className="mb-3">
                        <p className="text-[11px] font-black text-neutral-950">Botón aprobado</p>
                        <p className="mt-1 text-[9px] leading-4 text-neutral-400">El texto y el tipo de enlace vienen definidos por la plantilla de Meta.</p>
                      </div>
                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-[#faf9f7] p-4">
                        <div>
                          <span className="text-[8px] font-black uppercase tracking-[.09em] text-neutral-400">Texto</span>
                          <p className="mt-1 text-[12px] font-black text-neutral-900">{selected.button.label}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] font-black uppercase tracking-[.09em] text-neutral-400">Destino</span>
                          <p className="mt-1 text-[10px] font-bold text-neutral-600">
                            {selected.button.type === "tracking" && "Seguimiento del cliente"}
                            {selected.button.type === "driver_tracking" && "Orden del repartidor"}
                            {selected.button.type === "static" && "Enlace fijo"}
                          </p>
                        </div>
                      </div>
                    </section>
                  )}
                </div>

                <aside className="space-y-4">
                  <section className={`rounded-[24px] border p-4 transition-all ${selected.active
                    ? "border-emerald-200 bg-[linear-gradient(145deg,#f8fffb,#ecfdf5)] shadow-[0_12px_32px_rgba(16,185,129,.08)]"
                    : "border-neutral-200 bg-[linear-gradient(145deg,#fff,#f7f7f7)]"
                  }`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black ${selected.active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                          {selected.active ? "•" : "○"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[.11em] text-neutral-400">Notificación</p>
                          <h3 className="mt-1 text-[16px] font-black tracking-[-.02em] text-neutral-950">
                            {selected.active ? "Activa" : selected.headerImageUrl ? "Inactiva" : "Pendiente de imagen"}
                          </h3>
                          <p className="mt-1.5 text-[10px] leading-5 text-neutral-500">
                            {selected.active
                            ? "Disponible para operar automáticamente."
                            : selected.headerImageUrl
                              ? "No se enviará hasta volver a activarla."
                              : "Carga primero la imagen aprobada. Después podrás activar esta notificación."}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={selected.active}
                        disabled={!selected.headerImageUrl}
                        onChange={(active) => void setTemplateActive(selected.id, active)}
                      />
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3">
                      <span className={`rounded-full px-2.5 py-1 text-[8px] font-black ${selected.active ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100" : "bg-neutral-100 text-neutral-500"}`}>
                        {togglingId === selected.id
                          ? "Guardando..."
                          : selected.active
                            ? "Activado"
                            : selected.headerImageUrl
                              ? "Desactivado"
                              : "Falta imagen"}
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-[.08em] text-neutral-400">Auto guardado</span>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-neutral-200 bg-white p-4 shadow-[0_8px_24px_rgba(20,18,16,.035)]">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-[var(--brand-red)]">→</span>
                      <p className="text-[10px] font-black text-neutral-950">Automatización</p>
                    </div>
                    <p className="mt-1 text-[9px] leading-4 text-neutral-500">{eventDescription[selected.event] ?? "Conectada al flujo operativo de Alentó."}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[8px] font-bold text-white">{selected.audience === "DRIVER" ? "Repartidor" : "Cliente"}</span>
                      {selected.fulfillmentTypes.map((type) => (
                        <span key={type} className="rounded-full bg-neutral-50 px-2.5 py-1 text-[8px] font-bold text-neutral-500 ring-1 ring-neutral-200">{fulfillmentLabel[type] ?? type}</span>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-neutral-200 bg-white p-4 shadow-[0_8px_24px_rgba(20,18,16,.035)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black text-neutral-950">Variables de Meta</p>
                        <p className="mt-1 text-[9px] leading-4 text-neutral-400">Solo informativas. Alentó las reemplaza al enviar.</p>
                      </div>
                      <span className="rounded-full bg-neutral-100 px-2 py-1 text-[9px] font-black text-neutral-500">{selected.variables.length}</span>
                    </div>
                    {selected.variables.length === 0 ? (
                      <p className="mt-3 rounded-xl bg-neutral-50 px-3 py-3 text-[10px] font-semibold text-neutral-500">Esta plantilla no usa variables.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {selected.variables.map((variable) => (
                          <div key={variable.key} className="grid grid-cols-[58px_1fr] items-center gap-3 rounded-xl border border-neutral-100 bg-[#fafafa] px-3 py-3">
                            <code className="rounded-lg bg-white px-2 py-1.5 text-center text-[11px] font-black text-[var(--brand-red)] shadow-sm">{`{{${variable.key}}}`}</code>
                            <div className="min-w-0">
                              <b className="block truncate text-[10px] text-neutral-800">{variable.label}</b>
                              <code className="mt-0.5 block truncate text-[8px] text-neutral-400">{variable.source}</code>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {selected.delayMinutes !== undefined && (
                    <section className="rounded-[24px] border border-amber-100 bg-amber-50 p-4">
                      <p className="text-[9px] font-black uppercase tracking-[.09em] text-amber-700">Programación</p>
                      <p className="mt-1 text-[14px] font-black text-amber-950">{selected.delayMinutes} minutos después de finalizar</p>
                      <p className="mt-1 text-[9px] leading-4 text-amber-700">Este tiempo pertenece al flujo definido para esta notificación.</p>
                    </section>
                  )}
                </aside>
              </div>
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-100 bg-[#faf9f7] px-5 py-4 sm:px-6">
              <p className="hidden text-[9px] text-neutral-400 sm:block">Solo puedes activar la notificación o reemplazar su imagen. Los datos de Meta son informativos.</p>
              <button type="button" onClick={() => setSelectedId(null)} disabled={uploading}
                className="ml-auto h-11 rounded-xl bg-neutral-950 px-5 text-[11px] font-black text-white">
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}
