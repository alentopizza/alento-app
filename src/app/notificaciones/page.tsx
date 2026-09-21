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

function SaveIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="m6 6 12 12M18 6 6 18"/></svg>;
}

function ImageIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/></svg>;
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={(event) => { event.stopPropagation(); onChange(!checked); }} aria-pressed={checked}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-[var(--brand-red)]" : "bg-neutral-300"}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

function TemplateImage({ template }: { template: TemplateConfig }) {
  return (
    <div className="aspect-[4/3] overflow-hidden rounded-[18px] border border-neutral-200 bg-[#f5f4f1]">
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
  const [baseline, setBaseline] = useState<TemplateConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/notification-templates", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible cargar las notificaciones.");
        const loaded = (data.templates ?? []) as TemplateConfig[];
        setTemplates(loaded);
        setBaseline(JSON.parse(JSON.stringify(loaded)) as TemplateConfig[]);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No fue posible cargar las notificaciones."))
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(
    () => templates.find((item) => item.id === selectedId) ?? null,
    [templates, selectedId],
  );
  const dirty = useMemo(() => JSON.stringify(templates) !== JSON.stringify(baseline), [templates, baseline]);
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

  function patch(id: string, changes: Partial<TemplateConfig>) {
    setTemplates((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
    setNotice("");
  }

  function patchSelected(changes: Partial<TemplateConfig>) {
    if (!selected) return;
    patch(selected.id, changes);
  }

  async function save() {
    if (!dirty) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/notification-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible guardar los cambios.");
      const saved = (data.templates ?? templates) as TemplateConfig[];
      setTemplates(saved);
      setBaseline(JSON.parse(JSON.stringify(saved)) as TemplateConfig[]);
      setNotice("Cambios guardados correctamente.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar los cambios.");
    } finally {
      setSaving(false);
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
      const response = await fetch("/api/notification-images", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar la imagen.");
      patchSelected({ headerImageUrl: data.url });
      setNotice("Imagen cargada. Guarda los cambios para asignarla a la plantilla.");
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
              <p className="mt-1.5 text-[12px] text-white/55">Administra tus plantillas desde una galería simple. Abre solo la que quieras modificar.</p>
            </div>
            <div className="flex items-center gap-2">
              {dirty && <span className="hidden rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[10px] font-bold text-amber-100 sm:inline-flex">Cambios sin guardar</span>}
              <div className="rounded-2xl border border-white/10 bg-white/[.055] px-4 py-2 text-center">
                <span className="block text-[8px] font-bold uppercase tracking-[.12em] text-white/40">Activas</span>
                <b className="mt-0.5 block text-xl leading-none">{activeCount}/{templates.length}</b>
              </div>
              <button onClick={() => void save()} disabled={!dirty || saving}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[var(--brand-red)] px-4 text-[11px] font-black text-white shadow-[0_10px_24px_rgba(229,28,17,.24)] disabled:opacity-40">
                <SaveIcon /> {saving ? "Guardando..." : "Guardar cambios"}
              </button>
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
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleTemplates.map((template) => (
                <article key={template.id}
                  onClick={() => setSelectedId(template.id)}
                  className="group cursor-pointer overflow-hidden rounded-[22px] border border-neutral-200 bg-white p-3 shadow-[0_10px_28px_rgba(20,18,16,.045)] transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_16px_38px_rgba(20,18,16,.08)]">
                  <TemplateImage template={template} />

                  <div className="px-1 pb-1 pt-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-[14px] font-black text-neutral-950">{template.title}</h3>
                        <p className="mt-0.5 truncate text-[9px] font-semibold text-neutral-400">{template.event}</p>
                      </div>
                      <Switch checked={template.active} onChange={(active) => patch(template.id, { active })} />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      <span className="rounded-full bg-neutral-950 px-2 py-1 text-[8px] font-bold text-white">{template.audience === "DRIVER" ? "Repartidor" : "Cliente"}</span>
                      {template.fulfillmentTypes.map((type) => (
                        <span key={type} className="rounded-full bg-neutral-100 px-2 py-1 text-[8px] font-bold text-neutral-500">{fulfillmentLabel[type] ?? type}</span>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
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
          <div className="flex max-h-[94dvh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_100px_rgba(0,0,0,.35)]" onClick={(event) => event.stopPropagation()}>
            <header className="flex shrink-0 items-start justify-between gap-4 border-b-[3px] border-[var(--brand-red)] bg-[linear-gradient(135deg,#09090a,#241719)] px-5 py-4 text-white sm:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[9px] font-bold uppercase tracking-[.16em] text-white/40">Editar notificación</p>
                  <span className={`rounded-full px-2 py-1 text-[8px] font-bold ${selected.active ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/50"}`}>{selected.active ? "ACTIVA" : "INACTIVA"}</span>
                </div>
                <h2 className="mt-1 text-[24px] font-black tracking-[-.035em]">{selected.title}</h2>
                <p className="mt-1 text-[10px] text-white/45">{selected.event}</p>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white" aria-label="Cerrar">
                <CloseIcon />
              </button>
            </header>

            <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
                <div className="space-y-5">
                  <section>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black text-neutral-950">Imagen de la plantilla</p>
                        <p className="mt-1 text-[10px] leading-4 text-neutral-500">El contenedor mantiene proporción 4:3 y nunca recorta la imagen cargada.</p>
                      </div>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-black text-neutral-500">4:3</span>
                    </div>

                    <div className="mt-3 aspect-[4/3] overflow-hidden rounded-[22px] border border-neutral-200 bg-[#f4f3ef]">
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

                    <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr]">
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-[11px] font-black text-white disabled:opacity-50">
                        <UploadIcon /> {uploading ? "Cargando..." : selected.headerImageUrl ? "Cambiar imagen" : "Cargar imagen"}
                      </button>
                      <div className="min-w-0 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                        <span className="block text-[8px] font-black uppercase tracking-[.08em] text-neutral-400">Enlace generado</span>
                        <span className="mt-1 block truncate text-[10px] font-semibold text-neutral-600">{selected.headerImageUrl || "Se generará automáticamente al cargar el archivo."}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-[9px] leading-4 text-neutral-400">JPG, PNG o WebP · máximo 8 MB. La imagen queda almacenada en Alentó y el sistema genera su URL pública.</p>
                  </section>

                  <section className="grid gap-4 border-t border-neutral-100 pt-5 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <label>
                      <span className="text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Plantilla Meta</span>
                      <input value={selected.templateName} onChange={(event) => patchSelected({ templateName: event.target.value })}
                        className="alento-input mt-1.5 h-11 w-full rounded-xl px-3 text-sm font-semibold" />
                      <span className="mt-1 block text-[9px] leading-4 text-neutral-400">Debe coincidir exactamente con el nombre aprobado en Meta.</span>
                    </label>
                    <label>
                      <span className="text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Idioma</span>
                      <input value={selected.language} onChange={(event) => patchSelected({ language: event.target.value })}
                        className="alento-input mt-1.5 h-11 w-full rounded-xl px-3 text-sm font-semibold" />
                    </label>
                  </section>

                  {selected.button && (
                    <section className="border-t border-neutral-100 pt-5">
                      <p className="text-[11px] font-black text-neutral-950">Botón de acción</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <label>
                          <span className="text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Texto visible</span>
                          <input value={selected.button.label} maxLength={25}
                            onChange={(event) => patchSelected({ button: { ...selected.button!, label: event.target.value } })}
                            className="alento-input mt-1.5 h-11 w-full rounded-xl px-3 text-sm font-semibold" />
                        </label>
                        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                          <span className="text-[8px] font-black uppercase tracking-[.08em] text-neutral-400">Destino</span>
                          <p className="mt-1 text-[10px] font-bold text-neutral-700">
                            {selected.button.type === "tracking" && "Seguimiento del cliente"}
                            {selected.button.type === "driver_tracking" && "Página privada del repartidor"}
                            {selected.button.type === "static" && "Enlace fijo"}
                          </p>
                        </div>
                      </div>
                    </section>
                  )}
                </div>

                <aside className="space-y-5">
                  <section className="rounded-[22px] border border-neutral-200 bg-[#faf9f7] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black text-neutral-950">Automatización</p>
                        <p className="mt-1 text-[9px] leading-4 text-neutral-500">{eventDescription[selected.event] ?? "Conectada al flujo operativo de Alentó."}</p>
                      </div>
                      <Switch checked={selected.active} onChange={(active) => patchSelected({ active })} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[8px] font-bold text-white">{selected.audience === "DRIVER" ? "Repartidor" : "Cliente"}</span>
                      {selected.fulfillmentTypes.map((type) => <span key={type} className="rounded-full bg-white px-2.5 py-1 text-[8px] font-bold text-neutral-500 ring-1 ring-neutral-200">{fulfillmentLabel[type] ?? type}</span>)}
                    </div>
                  </section>

                  <section className="rounded-[22px] border border-neutral-200 bg-white p-4">
                    <p className="text-[10px] font-black text-neutral-950">Variables</p>
                    <p className="mt-1 text-[9px] leading-4 text-neutral-400">Datos que el sistema reemplaza al momento del envío.</p>
                    {selected.variables.length === 0 ? (
                      <p className="mt-3 rounded-xl bg-neutral-50 px-3 py-3 text-[10px] font-semibold text-neutral-500">Esta plantilla no usa variables.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {selected.variables.map((variable) => (
                          <div key={variable.key} className="grid grid-cols-[58px_1fr] items-center gap-3 rounded-xl bg-neutral-50 px-3 py-2.5">
                            <code className="rounded-lg bg-white px-2 py-1.5 text-center text-[11px] font-black text-[var(--brand-red)]">{`{{${variable.key}}}`}</code>
                            <div className="min-w-0">
                              <b className="block truncate text-[10px] text-neutral-800">{variable.label}</b>
                              <code className="mt-0.5 block truncate text-[8px] text-neutral-400">{variable.source}</code>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-[22px] border border-neutral-200 bg-white p-4">
                    <p className="text-[10px] font-black text-neutral-950">Configuración</p>
                    <div className="mt-3 space-y-3">
                      <label>
                        <span className="text-[8px] font-black uppercase tracking-[.08em] text-neutral-400">Categoría Meta</span>
                        <input value={selected.category} onChange={(event) => patchSelected({ category: event.target.value })}
                          className="alento-input mt-1.5 h-10 w-full rounded-xl px-3 text-xs font-semibold" />
                      </label>
                      {selected.delayMinutes !== undefined && (
                        <label>
                          <span className="text-[8px] font-black uppercase tracking-[.08em] text-neutral-400">Enviar después de finalizar</span>
                          <div className="mt-1.5 flex items-center gap-2">
                            <input type="number" min={0} value={selected.delayMinutes}
                              onChange={(event) => patchSelected({ delayMinutes: Math.max(0, Number(event.target.value)) })}
                              className="alento-input h-10 w-24 rounded-xl px-3 text-sm font-black" />
                            <span className="text-[10px] font-semibold text-neutral-500">minutos</span>
                          </div>
                        </label>
                      )}
                    </div>
                  </section>
                </aside>
              </div>
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-100 bg-[#faf9f7] px-5 py-4 sm:px-6">
              <p className="hidden text-[9px] text-neutral-400 sm:block">Los cambios se aplican al notifier después de guardar.</p>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={() => setSelectedId(null)} disabled={uploading}
                  className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-[11px] font-bold text-neutral-600">Cerrar</button>
                <button type="button" onClick={() => void save()} disabled={!dirty || saving || uploading}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand-red)] px-5 text-[11px] font-black text-white disabled:opacity-40">
                  <SaveIcon /> {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}
