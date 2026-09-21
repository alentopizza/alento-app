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

const fulfillmentLabel: Record<string, string> = {
  DELIVERY: "Domicilio",
  PICKUP: "Recoger",
  STORE: "Local",
};

export default function NotificationsPage() {
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/notification-templates", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible cargar las notificaciones.");
        setTemplates(data.templates ?? []);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No fue posible cargar las notificaciones."))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = useMemo(() => templates.filter((item) => item.active).length, [templates]);

  function patch(id: string, changes: Partial<TemplateConfig>) {
    setTemplates((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
    setNotice("");
  }

  async function save() {
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
      setTemplates(data.templates ?? templates);
      setNotice("Configuración de notificaciones guardada.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen p-4 lg:p-5">
      <div className="space-y-4">
        <header className="alento-dark rounded-[28px] px-7 py-5 md:px-8 md:py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/45">Automatización</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">Notificaciones WhatsApp</h1>
              <p className="mt-2 max-w-2xl text-[13px] leading-5 text-white/60">
                Organiza las plantillas aprobadas de Meta, sus imágenes, variables, destinatarios y el momento exacto en que se envían.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2.5 text-center">
                <span className="block text-[8px] font-semibold uppercase tracking-[.12em] text-white/40">Activas</span>
                <b className="mt-0.5 block text-2xl">{activeCount}/{templates.length}</b>
              </div>
              <button onClick={() => void save()} disabled={saving || loading} className="h-[52px] rounded-2xl bg-[var(--brand-red)] px-5 text-[12px] font-semibold text-white disabled:opacity-50">
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </header>

        {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</p>}
        {notice && <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">{notice}</p>}

        {loading ? (
          <section className="alento-card rounded-[24px] p-10 text-center text-sm text-neutral-400">Cargando plantillas...</section>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {templates.map((template) => (
              <article key={template.id} className="alento-card overflow-hidden rounded-[24px]">
                <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-white">
                        {template.audience === "DRIVER" ? "Repartidor" : "Cliente"}
                      </span>
                      {template.fulfillmentTypes.map((type) => (
                        <span key={type} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[9px] font-bold text-neutral-600">
                          {fulfillmentLabel[type] ?? type}
                        </span>
                      ))}
                    </div>
                    <h2 className="mt-3 text-xl font-black tracking-[-.025em] text-neutral-950">{template.title}</h2>
                    <p className="mt-1 text-[11px] font-semibold text-neutral-400">{template.event}</p>
                  </div>
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.08em] text-neutral-500">
                    <input type="checkbox" checked={template.active} onChange={(e) => patch(template.id, { active: e.target.checked })} className="h-5 w-5" />
                    {template.active ? "Activa" : "Inactiva"}
                  </label>
                </div>

                {template.headerImageUrl && (
                  <div className="border-b border-neutral-100 bg-[#f7f5f2] p-4">
                    <img src={template.headerImageUrl} alt={template.title} className="mx-auto max-h-44 w-full rounded-2xl object-cover" />
                  </div>
                )}

                <div className="space-y-4 p-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="sm:col-span-2">
                      <span className="text-[10px] font-bold uppercase tracking-[.08em] text-neutral-400">Plantilla Meta</span>
                      <input value={template.templateName} onChange={(e) => patch(template.id, { templateName: e.target.value })} className="alento-input mt-1.5 h-11 w-full rounded-xl px-3 text-sm font-semibold" />
                    </label>
                    <label>
                      <span className="text-[10px] font-bold uppercase tracking-[.08em] text-neutral-400">Idioma</span>
                      <input value={template.language} onChange={(e) => patch(template.id, { language: e.target.value })} className="alento-input mt-1.5 h-11 w-full rounded-xl px-3 text-sm font-semibold" />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-[.08em] text-neutral-400">Imagen de encabezado</span>
                    <input value={template.headerImageUrl} onChange={(e) => patch(template.id, { headerImageUrl: e.target.value })} className="alento-input mt-1.5 h-11 w-full rounded-xl px-3 text-xs" placeholder="https://..." />
                    <p className="mt-1.5 text-[10px] leading-4 text-neutral-400">Pega la URL pública aprobada en Meta. La vista previa se actualiza con esta dirección.</p>
                  </label>

                  {template.delayMinutes !== undefined && (
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-[.08em] text-neutral-400">Retraso de envío</span>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input type="number" min={0} value={template.delayMinutes} onChange={(e) => patch(template.id, { delayMinutes: Number(e.target.value) })} className="alento-input h-11 w-28 rounded-xl px-3 text-sm font-semibold" />
                        <span className="text-xs font-semibold text-neutral-500">minutos después de finalizar</span>
                      </div>
                    </label>
                  )}

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.08em] text-neutral-400">Variables</p>
                    {template.variables.length === 0 ? (
                      <p className="mt-2 rounded-xl bg-neutral-50 px-3 py-2.5 text-xs text-neutral-500">Esta plantilla no requiere variables dinámicas.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {template.variables.map((variable) => (
                          <div key={variable.key} className="grid grid-cols-[64px_1fr] items-center gap-3 rounded-xl border border-neutral-100 bg-[#faf9f7] px-3 py-2.5">
                            <code className="rounded-lg bg-white px-2 py-1 text-center text-xs font-black text-[var(--brand-red)]">{`{{${variable.key}}}`}</code>
                            <div>
                              <b className="block text-xs text-neutral-800">{variable.label}</b>
                              <span className="text-[10px] text-neutral-400">{variable.source}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {template.button && (
                    <div className="rounded-2xl border border-neutral-100 bg-[#faf9f7] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[.08em] text-neutral-400">Botón</p>
                      <p className="mt-1 text-sm font-bold text-neutral-800">{template.button.label}</p>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        {template.button.type === "tracking" && "Usa automáticamente el enlace seguro de seguimiento del cliente."}
                        {template.button.type === "driver_tracking" && "Usa automáticamente el enlace operativo privado del repartidor."}
                        {template.button.type === "static" && "Utiliza una dirección fija configurada en la plantilla."}
                      </p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
