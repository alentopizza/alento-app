"use client";

import { useEffect, useMemo, useState } from "react";

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
type EditorTab = "CONTENT" | "VARIABLES" | "BUTTON" | "CONFIG";

const fulfillmentLabel: Record<string, string> = {
  DELIVERY: "Domicilio",
  PICKUP: "Recoger",
  STORE: "Local",
};

const eventCopy: Record<string, string> = {
  "order.created": "Se envía cuando el pedido queda registrado correctamente.",
  "order.status.READY": "Se envía cuando un pedido para recoger o consumir en el local está listo.",
  "order.driver_assigned": "Se envía al repartidor cuando se le asigna un domicilio.",
  "order.status.OUT_FOR_DELIVERY": "Se envía al cliente cuando el repartidor inicia el domicilio.",
  "order.status.ARRIVED": "Se envía al cliente cuando el repartidor confirma que llegó.",
  "order.status.DELIVERED": "Se envía al cliente cuando el domicilio queda entregado.",
  "order.status.COMPLETED": "Se envía cuando el pedido en local o para recoger queda finalizado.",
  "order.review": "Se programa después de finalizar para solicitar una reseña al cliente.",
};

const previewCopy: Record<string, string[]> = {
  order_created: ["Hola {{1}},", "Se ha recibido tu nuevo pedido {{2}}.", "Gracias por tu compra."],
  order_ready_pickup_store: ["¡Buenas noticias!", "Tu pedido {{1}} está listo.", "Ya puedes recogerlo o disfrutarlo en el local."],
  order_driver_assigned: ["Hola {{1}},", "Tienes asignada la orden {{2}}.", "Abre el pedido para iniciar la entrega."],
  order_out_for_delivery: ["Tu pedido {{1}} va en camino.", "Puedes seguir el estado desde el botón inferior."],
  order_arrived: ["Tu pedido {{1}} ha llegado.", "El repartidor ya se encuentra en el punto de entrega."],
  order_finalized_delivery: ["Pedido {{1}} entregado.", "Gracias por elegir Alentó Pizza."],
  order_finalized_pickup_store: ["Pedido {{1}} finalizado.", "Gracias por elegir Alentó Pizza."],
  google_review: ["¿Qué te pareció tu pedido?", "Tu opinión nos ayuda a seguir mejorando."],
};

function Icon({
  name,
  className = "h-4 w-4",
}: {
  name: "search" | "save" | "refresh" | "image" | "link" | "settings" | "variables" | "edit" | "eye" | "check";
  className?: string;
}) {
  if (name === "search") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
  if (name === "save") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></svg>;
  if (name === "refresh") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6.4 6.4L4 11M20 13l-2.4 4.6A7 7 0 0 1 5.5 15"/></svg>;
  if (name === "image") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/></svg>;
  if (name === "link") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>;
  if (name === "settings") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>;
  if (name === "variables") return <span className={`${className} flex items-center justify-center font-mono text-[11px] font-black`}>{"{}"}</span>;
  if (name === "edit") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>;
  if (name === "eye") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="m5 12 4 4L19 6"/></svg>;
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className="inline-flex items-center gap-2"
      aria-pressed={checked}
    >
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-[var(--brand-red)]" : "bg-neutral-300"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
      </span>
      {label && <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-500">{label}</span>}
    </button>
  );
}

function TemplateThumb({ template, compact = false }: { template: TemplateConfig; compact?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-neutral-950 ${compact ? "h-14 w-[78px]" : "h-[88px] w-[128px]"}`}>
      {template.headerImageUrl ? (
        <img src={template.headerImageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-end bg-[radial-gradient(circle_at_top_right,rgba(229,28,17,.55),transparent_38%),linear-gradient(145deg,#09090a,#262021)] p-2 text-white">
          <span className="text-[9px] font-black uppercase leading-3 tracking-[0.07em]">{template.title}</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" />
    </div>
  );
}

function WhatsAppPreview({ template }: { template: TemplateConfig }) {
  const lines = previewCopy[template.id] ?? [template.title, "Mensaje automático de Alentó Pizza."];
  const buttonLabel = template.button?.label || null;

  return (
    <div className="rounded-[22px] border border-emerald-100 bg-[linear-gradient(180deg,#f4fff8,#f8fbf9)] p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#21c063] text-sm font-black text-white">W</span>
        <div>
          <p className="text-[11px] font-black text-neutral-900">Vista previa de WhatsApp</p>
          <p className="text-[9px] text-neutral-400">Ejemplo con variables visibles</p>
        </div>
      </div>

      <div className="mx-auto max-w-[330px] overflow-hidden rounded-[28px] border-[7px] border-neutral-950 bg-[#efeae2] shadow-[0_20px_45px_rgba(0,0,0,.15)]">
        <div className="flex items-center gap-2 bg-white px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-xs font-black text-white">A</div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black">Alentó Pizza</p>
            <p className="text-[8px] text-emerald-600">en línea</p>
          </div>
        </div>

        <div
          className="min-h-[390px] p-3"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,.5) 0 1px, transparent 1px), radial-gradient(circle at 80% 60%, rgba(255,255,255,.45) 0 1px, transparent 1px)",
            backgroundSize: "22px 22px, 28px 28px",
          }}
        >
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            {template.headerImageUrl && (
              <img src={template.headerImageUrl} alt="" className="h-28 w-full object-cover" />
            )}
            <div className="space-y-1.5 px-3 py-3">
              {lines.map((line, index) => (
                <p key={index} className={`text-[11px] leading-4 ${index === 0 ? "font-bold text-neutral-950" : "text-neutral-800"}`}>
                  {line}
                </p>
              ))}
              <p className="pt-1 text-right text-[8px] text-neutral-400">ahora</p>
            </div>
            {buttonLabel && (
              <div className="border-t border-neutral-100 px-3 py-2.5 text-center text-[11px] font-bold text-[#1687d9]">
                ↗ {buttonLabel}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
        <p className="text-[10px] font-bold text-blue-800">Vista orientativa</p>
        <p className="mt-0.5 text-[9px] leading-4 text-blue-600">El contenido final lo define la plantilla aprobada en Meta. Aquí validas imagen, variables y botón.</p>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [baseline, setBaseline] = useState<TemplateConfig[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<EditorTab>("CONTENT");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/notification-templates", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible cargar las notificaciones.");
        const loaded = (data.templates ?? []) as TemplateConfig[];
        setTemplates(loaded);
        setBaseline(JSON.parse(JSON.stringify(loaded)) as TemplateConfig[]);
        setSelectedId((current) => current || loaded[0]?.id || "");
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No fue posible cargar las notificaciones."))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = useMemo(() => templates.filter((item) => item.active).length, [templates]);
  const customerCount = useMemo(() => templates.filter((item) => item.audience === "CUSTOMER").length, [templates]);
  const driverCount = useMemo(() => templates.filter((item) => item.audience === "DRIVER").length, [templates]);
  const inactiveCount = templates.length - activeCount;
  const dirty = useMemo(() => JSON.stringify(templates) !== JSON.stringify(baseline), [templates, baseline]);

  const selected = useMemo(
    () => templates.find((item) => item.id === selectedId) ?? templates[0] ?? null,
    [templates, selectedId],
  );

  const originalSelected = useMemo(
    () => baseline.find((item) => item.id === selected?.id) ?? null,
    [baseline, selected?.id],
  );

  const selectedDirty = useMemo(
    () => Boolean(selected && originalSelected && JSON.stringify(selected) !== JSON.stringify(originalSelected)),
    [selected, originalSelected],
  );

  const visibleTemplates = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    return templates.filter((item) => {
      const filterMatch =
        filter === "ALL" ||
        (filter === "CUSTOMER" && item.audience === "CUSTOMER") ||
        (filter === "DRIVER" && item.audience === "DRIVER") ||
        (filter === "ACTIVE" && item.active) ||
        (filter === "INACTIVE" && !item.active);

      const queryMatch =
        !needle ||
        item.title.toLocaleLowerCase("es").includes(needle) ||
        item.templateName.toLocaleLowerCase("es").includes(needle) ||
        item.event.toLocaleLowerCase("es").includes(needle);

      return filterMatch && queryMatch;
    });
  }, [templates, filter, query]);

  function patch(id: string, changes: Partial<TemplateConfig>) {
    setTemplates((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
    setNotice("");
  }

  function resetSelected() {
    if (!selected || !originalSelected) return;
    setTemplates((current) => current.map((item) => item.id === selected.id ? JSON.parse(JSON.stringify(originalSelected)) as TemplateConfig : item));
    setNotice("Se restauraron los cambios locales de esta plantilla.");
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
      if (!response.ok) throw new Error(data.error || "No fue posible guardar.");
      const saved = (data.templates ?? templates) as TemplateConfig[];
      setTemplates(saved);
      setBaseline(JSON.parse(JSON.stringify(saved)) as TemplateConfig[]);
      setNotice("Configuración de notificaciones guardada.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar.");
    } finally {
      setSaving(false);
    }
  }

  function patchSelected(changes: Partial<TemplateConfig>) {
    if (!selected) return;
    patch(selected.id, changes);
  }

  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: "ALL", label: "Todas", count: templates.length },
    { id: "CUSTOMER", label: "Cliente", count: customerCount },
    { id: "DRIVER", label: "Repartidor", count: driverCount },
    { id: "ACTIVE", label: "Activas", count: activeCount },
    { id: "INACTIVE", label: "Inactivas", count: inactiveCount },
  ];

  if (loading) {
    return (
      <main className="min-h-screen p-4 lg:p-5">
        <div className="alento-card rounded-[24px] p-12 text-center text-sm font-semibold text-neutral-400">Cargando módulo de notificaciones...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-3 lg:p-4">
      <div className="space-y-3">
        <div>
          <header className="rounded-[24px] bg-[radial-gradient(circle_at_86%_12%,rgba(229,28,17,.30),transparent_24%),linear-gradient(135deg,#09090a,#171719)] px-5 py-4 text-white shadow-[0_18px_50px_rgba(0,0,0,.18)] md:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Automatización</p>
                <h1 className="mt-1 text-[26px] font-black tracking-[-0.035em]">Notificaciones WhatsApp</h1>
                <p className="mt-1 text-[11px] leading-4 text-white/55">Gestiona las plantillas que reciben tus clientes y repartidores sin recorrer formularios interminables.</p>
              </div>

              <div className="flex items-center gap-2">
                {dirty && (
                  <span className="hidden rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[10px] font-bold text-amber-100 sm:inline-flex">
                    Cambios sin guardar
                  </span>
                )}
                <div className="min-w-[72px] rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-center">
                  <span className="block text-[8px] font-bold uppercase tracking-[.12em] text-white/40">Activas</span>
                  <b className="mt-0.5 block text-xl leading-none">{activeCount}/{templates.length}</b>
                </div>
                <button
                  onClick={() => void save()}
                  disabled={saving || !dirty}
                  className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[var(--brand-red)] px-4 text-[11px] font-black text-white shadow-[0_10px_24px_rgba(229,28,17,.24)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Icon name="save" />
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </header>
        </div>

        {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</p>}
        {notice && <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">{notice}</p>}

        <section className="grid min-h-[calc(100dvh-150px)] gap-3 xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="alento-card flex min-h-[620px] flex-col overflow-hidden rounded-[24px]">
            <div className="border-b border-neutral-100 p-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-neutral-400">Plantillas</p>
                <h2 className="mt-1 text-lg font-black tracking-[-0.025em] text-neutral-950">Plantillas de notificaciones</h2>
                <p className="mt-1 text-[10px] leading-4 text-neutral-500">Selecciona una plantilla para editarla de forma individual.</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {filters.map((item) => {
                  const active = filter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilter(item.id)}
                      className={`rounded-full border px-2.5 py-1.5 text-[9px] font-bold transition ${active ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300"}`}
                    >
                      {item.label} <span className={`ml-1 rounded-full px-1.5 py-0.5 ${active ? "bg-white/15 text-white/75" : "bg-neutral-100 text-neutral-400"}`}>{item.count}</span>
                    </button>
                  );
                })}
              </div>

              <label className="relative mt-3 block">
                <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nombre, evento o plantilla..."
                  className="alento-input h-10 w-full rounded-xl pl-9 pr-3 text-[11px]"
                />
              </label>
            </div>

            <div className="alento-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {visibleTemplates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-200 p-7 text-center text-xs text-neutral-400">No hay plantillas con estos filtros.</div>
              ) : visibleTemplates.map((template) => {
                const current = selected?.id === template.id;
                return (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => {
                      setSelectedId(template.id);
                      setTab("CONTENT");
                    }}
                    className={`group flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition ${current ? "border-red-300 bg-red-50/70 shadow-[0_8px_24px_rgba(229,28,17,.08)]" : "border-neutral-150 bg-white hover:border-neutral-300 hover:bg-neutral-50"}`}
                  >
                    <TemplateThumb template={template} compact />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-black text-neutral-950">{template.title}</span>
                      <span className="mt-0.5 block truncate text-[9px] font-semibold text-neutral-400">{template.event}</span>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[8px] font-bold text-white">{template.audience === "DRIVER" ? "Repartidor" : "Cliente"}</span>
                        {template.fulfillmentTypes.map((type) => (
                          <span key={type} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[8px] font-bold text-neutral-500">{fulfillmentLabel[type] ?? type}</span>
                        ))}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-2">
                      <Switch checked={template.active} onChange={(active) => patch(template.id, { active })} />
                      <span className={`text-lg leading-none ${current ? "text-[var(--brand-red)]" : "text-neutral-300 group-hover:text-neutral-500"}`}>›</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {selected ? (
            <section className="alento-card min-w-0 overflow-hidden rounded-[24px]">
              <div className="border-b border-neutral-100 p-4 lg:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <TemplateThumb template={selected} />
                    <div className="min-w-0 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black tracking-[-0.03em] text-neutral-950">{selected.title}</h2>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold ${selected.active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                          {selected.active && <Icon name="check" className="h-3 w-3" />}
                          {selected.active ? "Activa" : "Inactiva"}
                        </span>
                        {selectedDirty && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700">Editada</span>}
                      </div>
                      <p className="mt-1 text-[10px] font-bold text-neutral-400">Evento: {selected.event}</p>
                      <p className="mt-1 max-w-[620px] text-[11px] leading-5 text-neutral-500">{eventCopy[selected.event] ?? "Plantilla automática conectada al flujo operativo de Alentó."}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[8px] font-bold text-white">{selected.audience === "DRIVER" ? "Repartidor" : "Cliente"}</span>
                        {selected.fulfillmentTypes.map((type) => <span key={type} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[8px] font-bold text-neutral-500">{fulfillmentLabel[type] ?? type}</span>)}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={resetSelected}
                      disabled={!selectedDirty}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-[10px] font-bold text-neutral-600 disabled:opacity-40"
                    >
                      <Icon name="refresh" />
                      Restablecer
                    </button>
                    <button
                      type="button"
                      onClick={() => patchSelected({ active: !selected.active })}
                      className={`h-10 rounded-xl border px-3 text-[10px] font-bold ${selected.active ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                    >
                      {selected.active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 rounded-xl bg-neutral-100 p-1">
                  {([
                    ["CONTENT", "edit", "Contenido"],
                    ["VARIABLES", "variables", "Variables"],
                    ["BUTTON", "link", "Botón"],
                    ["CONFIG", "settings", "Configuración"],
                  ] as Array<[EditorTab, "edit" | "variables" | "link" | "settings", string]>).map(([id, icon, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={`flex h-9 items-center justify-center gap-2 rounded-lg text-[9px] font-bold transition sm:text-[10px] ${tab === id ? "bg-neutral-950 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
                    >
                      <Icon name={icon} />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid min-h-[560px] gap-0 2xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 p-4 lg:p-5">
                  {tab === "CONTENT" && (
                    <div className="space-y-5">
                      <section>
                        <div className="mb-2">
                          <p className="text-[10px] font-black text-neutral-900">Imagen de encabezado</p>
                          <p className="mt-0.5 text-[9px] leading-4 text-neutral-400">Debe coincidir con la imagen aprobada para esta plantilla en Meta.</p>
                        </div>
                        <div className="overflow-hidden rounded-[20px] border border-neutral-200 bg-neutral-950">
                          {selected.headerImageUrl ? (
                            <img src={selected.headerImageUrl} alt={selected.title} className="h-48 w-full object-cover sm:h-56" />
                          ) : (
                            <div className="flex h-48 items-center justify-center text-neutral-500 sm:h-56"><Icon name="image" className="h-8 w-8" /></div>
                          )}
                        </div>
                        <label className="mt-2 block">
                          <span className="sr-only">URL de imagen</span>
                          <div className="relative">
                            <Icon name="image" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                            <input
                              value={selected.headerImageUrl}
                              onChange={(event) => patchSelected({ headerImageUrl: event.target.value })}
                              className="alento-input h-11 w-full rounded-xl pl-9 pr-3 text-[10px]"
                              placeholder="https://..."
                            />
                          </div>
                        </label>
                      </section>

                      <section className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                        <label>
                          <span className="text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Plantilla de WhatsApp · Meta</span>
                          <input
                            value={selected.templateName}
                            onChange={(event) => patchSelected({ templateName: event.target.value })}
                            className="alento-input mt-1.5 h-11 w-full rounded-xl px-3 text-sm font-semibold"
                          />
                          <span className="mt-1 block text-[9px] leading-4 text-neutral-400">Nombre técnico exacto de la plantilla aprobada.</span>
                        </label>

                        <label>
                          <span className="text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Idioma</span>
                          <input
                            value={selected.language}
                            onChange={(event) => patchSelected({ language: event.target.value })}
                            className="alento-input mt-1.5 h-11 w-full rounded-xl px-3 text-sm font-semibold"
                          />
                          <span className="mt-1 block text-[9px] leading-4 text-neutral-400">Ejemplo: es</span>
                        </label>
                      </section>
                    </div>
                  )}

                  {tab === "VARIABLES" && (
                    <div>
                      <p className="text-sm font-black text-neutral-950">Variables del mensaje</p>
                      <p className="mt-1 text-[10px] leading-5 text-neutral-500">Alentó reemplaza automáticamente cada variable con los datos reales del pedido o repartidor.</p>

                      {selected.variables.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
                          <Icon name="variables" className="mx-auto h-8 w-8 text-neutral-300" />
                          <p className="mt-2 text-xs font-bold text-neutral-600">Esta plantilla no requiere variables dinámicas.</p>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-2">
                          {selected.variables.map((variable) => (
                            <div key={variable.key} className="grid grid-cols-[70px_minmax(0,1fr)_minmax(120px,.8fr)] items-center gap-3 rounded-2xl border border-neutral-100 bg-[#faf9f7] p-3">
                              <code className="rounded-xl bg-white px-2 py-2 text-center text-[12px] font-black text-[var(--brand-red)] shadow-sm">{`{{${variable.key}}}`}</code>
                              <div>
                                <b className="block text-[11px] text-neutral-900">{variable.label}</b>
                                <span className="mt-0.5 block text-[9px] text-neutral-400">Dato visible para el usuario</span>
                              </div>
                              <code className="truncate rounded-lg bg-neutral-100 px-2 py-1.5 text-[9px] font-bold text-neutral-500">{variable.source}</code>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {tab === "BUTTON" && (
                    <div>
                      <p className="text-sm font-black text-neutral-950">Botón de acción</p>
                      <p className="mt-1 text-[10px] leading-5 text-neutral-500">Configura el texto visible. El destino se genera automáticamente cuando corresponde.</p>

                      {selected.button ? (
                        <div className="mt-4 space-y-4 rounded-[20px] border border-neutral-200 bg-[#faf9f7] p-4">
                          <label className="block">
                            <span className="text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Texto del botón</span>
                            <input
                              value={selected.button.label}
                              maxLength={25}
                              onChange={(event) => patchSelected({ button: { ...selected.button!, label: event.target.value } })}
                              className="alento-input mt-1.5 h-11 w-full rounded-xl px-3 text-sm font-semibold"
                            />
                            <span className="mt-1 block text-right text-[9px] text-neutral-400">{selected.button.label.length}/25</span>
                          </label>

                          <div className="rounded-xl border border-neutral-100 bg-white p-3">
                            <p className="text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Destino</p>
                            <p className="mt-1 text-[11px] font-bold text-neutral-800">
                              {selected.button.type === "tracking" && "Seguimiento seguro del pedido del cliente"}
                              {selected.button.type === "driver_tracking" && "Página operativa privada del repartidor"}
                              {selected.button.type === "static" && "Enlace fijo"}
                            </p>
                            <p className="mt-1 text-[9px] leading-4 text-neutral-400">
                              {selected.button.type === "tracking" && "Se genera automáticamente como /seguimiento/<token>."}
                              {selected.button.type === "driver_tracking" && "Se genera automáticamente con un token firmado para el repartidor asignado."}
                              {selected.button.type === "static" && "El valor configurado se envía como URL del botón."}
                            </p>
                          </div>

                          {selected.button.type === "static" && (
                            <label className="block">
                              <span className="text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">URL / parámetro</span>
                              <input
                                value={selected.button.value ?? ""}
                                onChange={(event) => patchSelected({ button: { ...selected.button!, value: event.target.value } })}
                                className="alento-input mt-1.5 h-11 w-full rounded-xl px-3 text-xs"
                                placeholder="https://..."
                              />
                            </label>
                          )}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
                          <Icon name="link" className="mx-auto h-7 w-7 text-neutral-300" />
                          <p className="mt-2 text-xs font-bold text-neutral-600">Esta plantilla no usa un botón dinámico.</p>
                          <p className="mt-1 text-[9px] leading-4 text-neutral-400">Si Meta aprobó un botón para esta plantilla, primero debemos registrarlo en la configuración base.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {tab === "CONFIG" && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-black text-neutral-950">Configuración operativa</p>
                        <p className="mt-1 text-[10px] leading-5 text-neutral-500">Datos técnicos que determinan cómo Alentó entrega esta plantilla al notifier.</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-neutral-100 bg-[#faf9f7] p-4">
                          <p className="text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Evento</p>
                          <code className="mt-2 block break-all text-[11px] font-bold text-neutral-800">{selected.event}</code>
                        </div>
                        <div className="rounded-2xl border border-neutral-100 bg-[#faf9f7] p-4">
                          <p className="text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Categoría Meta</p>
                          <input
                            value={selected.category}
                            onChange={(event) => patchSelected({ category: event.target.value })}
                            className="alento-input mt-2 h-10 w-full rounded-xl px-3 text-xs font-semibold"
                          />
                        </div>
                        <div className="rounded-2xl border border-neutral-100 bg-[#faf9f7] p-4">
                          <p className="text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Destinatario</p>
                          <p className="mt-2 text-[11px] font-bold text-neutral-800">{selected.audience === "DRIVER" ? "Repartidor asignado" : "Cliente del pedido"}</p>
                        </div>
                        <div className="rounded-2xl border border-neutral-100 bg-[#faf9f7] p-4">
                          <p className="text-[9px] font-black uppercase tracking-[.08em] text-neutral-400">Modalidades</p>
                          <p className="mt-2 text-[11px] font-bold text-neutral-800">{selected.fulfillmentTypes.map((type) => fulfillmentLabel[type] ?? type).join(" · ")}</p>
                        </div>
                      </div>

                      {selected.delayMinutes !== undefined && (
                        <label className="block rounded-2xl border border-amber-100 bg-amber-50 p-4">
                          <span className="text-[9px] font-black uppercase tracking-[.08em] text-amber-700">Retraso programado</span>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={selected.delayMinutes}
                              onChange={(event) => patchSelected({ delayMinutes: Math.max(0, Number(event.target.value)) })}
                              className="alento-input h-10 w-28 rounded-xl px-3 text-sm font-black"
                            />
                            <span className="text-[11px] font-semibold text-amber-900">minutos después de finalizar</span>
                          </div>
                          <span className="mt-2 block text-[9px] leading-4 text-amber-700">El trabajo queda guardado de forma persistente y puede reintentarse si el envío falla.</span>
                        </label>
                      )}
                    </div>
                  )}
                </div>

                <aside className="border-t border-neutral-100 p-4 2xl:border-l 2xl:border-t-0">
                  <div className="2xl:sticky 2xl:top-4">
                    <WhatsAppPreview template={selected} />
                  </div>
                </aside>
              </div>
            </section>
          ) : (
            <section className="alento-card flex min-h-[620px] items-center justify-center rounded-[24px] p-8 text-center text-sm text-neutral-400">
              Selecciona una plantilla para comenzar.
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
