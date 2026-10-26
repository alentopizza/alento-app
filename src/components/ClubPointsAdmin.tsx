"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Settings, Star, Trophy, Users, X } from "lucide-react";

type ClubSettings = {
  enabled: boolean;
  earnRatePercent: number;
  minimumRedemptionPurchase: number;
  pointValueCop: number;
};

type ClubCustomer = {
  id: number;
  rank: number;
  name: string;
  countryCode: string;
  phone: string | null;
  email: string | null;
  points: number;
  earnedPoints: number;
  redeemedPoints: number;
  movements: number;
  purchases: number;
  lastMovementAt: string | null;
};

type ClubSummary = {
  customersWithPoints: number;
  pointsInCirculation: number;
  totalEarnedPoints: number;
  totalRedeemedPoints: number;
};

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPoints(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value);
}

function shortDate(value: string | null) {
  if (!value) return "Sin movimientos";
  return new Date(value).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "C";
}

function rankLabel(rank: number) {
  if (rank === 1) return "Líder";
  if (rank === 2) return "2.º lugar";
  if (rank === 3) return "3.º lugar";
  return "#" + rank;
}

export default function ClubPointsAdmin() {
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [customers, setCustomers] = useState<ClubCustomer[]>([]);
  const [summary, setSummary] = useState<ClubSummary>({
    customersWithPoints: 0,
    pointsInCirculation: 0,
    totalEarnedPoints: 0,
    totalRedeemedPoints: 0,
  });
  const [loading, setLoading] = useState(true);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadRanking(silent = false) {
    if (!silent) setRankingLoading(true);
    try {
      const response = await fetch("/api/club-points", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar el ranking del Club.");
      setCustomers(data.customers ?? []);
      setSummary({
        customersWithPoints: Number(data.summary?.customersWithPoints ?? 0),
        pointsInCirculation: Number(data.summary?.pointsInCirculation ?? 0),
        totalEarnedPoints: Number(data.summary?.totalEarnedPoints ?? 0),
        totalRedeemedPoints: Number(data.summary?.totalRedeemedPoints ?? 0),
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el ranking del Club.");
    } finally {
      if (!silent) setRankingLoading(false);
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const responses = await Promise.all([
          fetch("/api/club-settings", { cache: "no-store" }),
          fetch("/api/club-points", { cache: "no-store" }),
        ]);
        const settingsData = await responses[0].json();
        const rankingData = await responses[1].json();

        if (!responses[0].ok) throw new Error(settingsData.error || "No fue posible cargar Club Alentó.");
        if (!responses[1].ok) throw new Error(rankingData.error || "No fue posible cargar el ranking del Club.");

        setSettings(settingsData.settings);
        setCustomers(rankingData.customers ?? []);
        setSummary({
          customersWithPoints: Number(rankingData.summary?.customersWithPoints ?? 0),
          pointsInCirculation: Number(rankingData.summary?.pointsInCirculation ?? 0),
          totalEarnedPoints: Number(rankingData.summary?.totalEarnedPoints ?? 0),
          totalRedeemedPoints: Number(rankingData.summary?.totalRedeemedPoints ?? 0),
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No fue posible cargar Club Alentó.");
      } finally {
        setLoading(false);
        setRankingLoading(false);
      }
    }

    void load();
    const timer = window.setInterval(() => void loadRanking(true), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleCustomers = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("es");

    return customers.filter((customer) => {
      if (!value) return true;
      const phone = customer.phone
        ? customer.countryCode + customer.phone
        : "";

      return (
        customer.name +
        " " +
        phone +
        " " +
        (customer.email ?? "")
      )
        .toLocaleLowerCase("es")
        .includes(value);
    });
  }, [customers, query]);

  const topCustomers = customers.slice(0, 3);

  async function save(nextSettings: ClubSettings) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/club-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: nextSettings }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible guardar Club Alentó.");
      setSettings(data.settings);
      setMessage("Configuración del Club guardada.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar Club Alentó.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="w-full p-3 md:p-5 xl:p-6">
        <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-neutral-200 bg-white text-sm font-semibold text-neutral-400 shadow-sm">
          Cargando Club Alentó...
        </div>
      </main>
    );
  }

  if (!settings) {
    return (
      <main className="w-full p-3 md:p-5 xl:p-6">
        <div className="rounded-[24px] border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">
          {error || "No fue posible cargar Club Alentó."}
        </div>
      </main>
    );
  }

  return (
    <main className="w-full p-3 md:p-5 xl:p-6">
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
                  Fidelización
                </p>
              </div>
              <h1 className="alento-ui-hero-title mt-1.5">Club Puntos</h1>
              <p className="alento-ui-hero-subtitle mt-1.5 text-white/60">
                Mira quiénes más acumulan y cómo crece la comunidad Alentó.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 self-end md:self-auto">
              <button
                type="button"
                onClick={() => { setMessage(""); setSettingsOpen(true); }}
                aria-label="Ajustes del Club"
                title="Ajustes del Club"
                className="flex h-[56px] w-[76px] items-center justify-center rounded-[16px] border border-red-400/45 bg-[linear-gradient(135deg,rgba(236,25,31,.96),rgba(119,12,16,.82))] text-white shadow-[0_10px_22px_rgba(168,11,16,.25),inset_0_1px_0_rgba(255,255,255,.13)] transition hover:-translate-y-0.5 hover:brightness-110"
              >
                <Settings className="h-[22px] w-[22px]" strokeWidth={2.15} />
              </button>

              <div className="flex h-[56px] w-[76px] flex-col items-center justify-center rounded-[16px] border border-white/14 bg-white/[0.08] px-3 backdrop-blur-sm">
                <span className="alento-ui-micro uppercase tracking-[0.14em] text-white/50">
                  Con puntos
                </span>
                <b className="alento-ui-metric mt-0.5 tabular-nums text-white">
                  {summary.customersWithPoints}
                </b>
              </div>
            </div>
          </div>
        </section>

        {error && !settingsOpen && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>
        )}

        <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Clientes con saldo" value={String(summary.customersWithPoints)} note="Clientes que hoy tienen puntos disponibles." icon={<Users className="h-5 w-5 text-neutral-300" strokeWidth={1.8} />} />
          <StatCard label="Puntos en circulación" value={formatPoints(summary.pointsInCirculation)} note="Saldo disponible entre todos los clientes." red icon={<Star className="h-5 w-5 text-[var(--brand-red)]" strokeWidth={1.8} />} />
          <StatCard label="Puntos acumulados" value={formatPoints(summary.totalEarnedPoints)} note="Total histórico generado por compras válidas." />
          <StatCard
            label="Estado del Club"
            value={settings.enabled ? "Activo" : "Inactivo"}
            note={settings.enabled ? "Visible y acumulando puntos." : "Oculto en la app y sin nuevas acreditaciones."}
            red={settings.enabled}
          />
        </section>

        <section className="rounded-[22px] border border-neutral-200 bg-white p-3.5 shadow-[0_8px_24px_rgba(28,23,20,.04)] md:p-4">
          <div className="flex flex-col gap-2 border-b border-neutral-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-[var(--brand-red)]" strokeWidth={2} />
                <p className="alento-ui-label uppercase text-[var(--brand-red)]">Top Club</p>
              </div>
              <h2 className="alento-ui-title mt-1 text-neutral-950">Clientes con más puntos</h2>
            </div>
            <p className="alento-ui-micro text-neutral-400">Ranking por saldo disponible</p>
          </div>

          {rankingLoading ? (
            <div className="py-12 text-center text-sm font-semibold text-neutral-400">Calculando ranking...</div>
          ) : topCustomers.length ? (
            <div className="mt-3 grid gap-2.5 lg:grid-cols-3">
              {topCustomers.map((customer) => (
                <TopCard key={customer.id} customer={customer} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-sm font-semibold text-neutral-400">Aún no hay clientes con puntos acumulados.</div>
          )}
        </section>

        <section className="overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-[0_8px_24px_rgba(28,23,20,.04)]">
          <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-end gap-3">
              <div>
                <p className="alento-ui-label uppercase text-neutral-400">
                  Ranking completo
                </p>
                <h2 className="alento-ui-title mt-1 text-neutral-950">
                  Clientes con puntos
                </h2>
              </div>
              <span className="alento-ui-label mb-0.5 rounded-full bg-neutral-100 px-2 py-1 text-neutral-500">
                {visibleCustomers.length}
              </span>
            </div>

            <label className="group relative w-full lg:w-[360px]">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 transition group-focus-within:text-neutral-700"
                strokeWidth={2}
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar cliente, teléfono o correo..."
                className="alento-ui-control h-10 w-full rounded-[13px] border border-neutral-200 bg-[#faf9f7] pl-10 pr-3 outline-none transition focus:border-neutral-400 focus:bg-white"
              />
            </label>
          </div>

          {rankingLoading ? (
            <div className="p-10 text-center text-sm font-semibold text-neutral-400">Cargando clientes...</div>
          ) : visibleCustomers.length ? (
            <div className="divide-y divide-neutral-100">
              {visibleCustomers.map((customer) => (
                <article key={customer.id} className="grid gap-3 px-4 py-3 transition hover:bg-[#faf9f7] md:grid-cols-[56px_minmax(0,1fr)_125px_140px] md:items-center">
                  <div>
                    <span className={"alento-ui-control inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-2 " + (customer.rank > 0 && customer.rank <= 3 ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600")}>
                      {"#" + customer.rank}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="alento-ui-label flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 shadow-sm">
                        {initials(customer.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <h3 className="alento-ui-body truncate font-bold text-neutral-950">{customer.name}</h3>
                        </div>
                        <p className="alento-ui-micro mt-0.5 truncate text-neutral-400">
                          {customer.phone ? customer.countryCode + customer.phone : customer.email || "Sin teléfono"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="block alento-ui-label uppercase text-neutral-400">Compras con puntos</span>
                    <b className="alento-ui-control mt-1 block text-neutral-700">{customer.purchases}</b>
                  </div>

                  <div className="md:text-right">
                    <b className="alento-ui-status block tabular-nums text-[var(--brand-red)]">{formatPoints(customer.points)} pts</b>
                    <span className="alento-ui-micro mt-1 block text-neutral-400">Último mov. {shortDate(customer.lastMovementAt)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center text-sm font-semibold text-neutral-400">No hay clientes que coincidan con la búsqueda.</div>
          )}
        </section>
      </div>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          saving={saving}
          message={message}
          error={error}
          onClose={() => setSettingsOpen(false)}
          onSave={(nextSettings) => void save(nextSettings)}
        />
      )}
    </main>
  );
}

function StatCard({ label, value, note, red = false, icon }: { label: string; value: string; note: string; red?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-neutral-200 bg-white p-3.5 shadow-[0_7px_20px_rgba(28,23,20,.04)]">
      <div className="flex items-center justify-between">
        <span className="alento-ui-label uppercase text-neutral-400">{label}</span>
        {icon}
      </div>
      <b className={"alento-ui-metric mt-2 block " + (red ? "text-[var(--brand-red)]" : "text-neutral-950")}>{value}</b>
      <p className="alento-ui-micro mt-1 text-neutral-400">{note}</p>
    </div>
  );
}

function TopCard({ customer }: { customer: ClubCustomer }) {
  const leader = customer.rank === 1;
  return (
    <article className={"relative overflow-hidden rounded-[18px] border p-4 transition " + (leader ? "border-red-200 bg-[linear-gradient(145deg,#171113,#080808)] text-white shadow-[0_16px_38px_rgba(110,10,14,.20)]" : "border-neutral-200 bg-[#faf9f7] text-neutral-950")}>
      {leader && <div className="absolute right-[-20px] top-[-28px] h-28 w-28 rounded-full bg-red-600/20 blur-xl" />}
      <div className="relative flex items-start justify-between gap-4">
        <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl alento-ui-control " + (leader ? "border border-white/10 bg-white/[0.08] text-white" : "border border-neutral-200 bg-white text-neutral-700")}>
          {initials(customer.name)}
        </div>
        <span className={"alento-ui-label rounded-full px-3 py-1.5 uppercase " + (leader ? "bg-[var(--brand-red)] text-white" : "border border-neutral-200 bg-white text-neutral-500")}>
          {rankLabel(customer.rank)}
        </span>
      </div>

      <div className="relative mt-3">
        <h3 className="alento-ui-status truncate">{customer.name}</h3>
        {customer.phone && <p className={"alento-ui-micro mt-1 " + (leader ? "text-white/45" : "text-neutral-400")}>{customer.countryCode}{customer.phone}</p>}
      </div>

      <div className="relative mt-3 flex items-end justify-between gap-3">
        <div>
          <span className={"alento-ui-label uppercase " + (leader ? "text-white/40" : "text-neutral-400")}>Saldo</span>
          <b className={"alento-ui-metric mt-1 block " + (leader ? "text-white" : "text-[var(--brand-red)]")}>{formatPoints(customer.points)}</b>
        </div>
        <span className={"alento-ui-micro pb-1 font-bold " + (leader ? "text-white/45" : "text-neutral-400")}>
          {customer.purchases} compra{customer.purchases === 1 ? "" : "s"}
        </span>
      </div>
    </article>
  );
}

function SettingsModal({
  settings,
  saving,
  message,
  error,
  onClose,
  onSave,
}: {
  settings: ClubSettings;
  saving: boolean;
  message: string;
  error: string;
  onClose: () => void;
  onSave: (settings: ClubSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const examples = useMemo(() => {
    return [14900, 39900, 69900].map((amount) => ({
      amount,
      points: Math.floor(amount * (draft.earnRatePercent / 100)),
    }));
  }, [draft.earnRatePercent]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-3 backdrop-blur-[3px] sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-[860px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#f7f6f3] shadow-[0_30px_100px_rgba(0,0,0,.34)]">
        <header className="relative overflow-hidden bg-[#0b0b0c] px-5 py-5 text-white sm:px-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_30%,rgba(226,26,34,.34),transparent_28%),linear-gradient(120deg,#111319,#1a0b0d)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-red-300" strokeWidth={2} />
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/45">Club Puntos</p>
              </div>
              <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em]">Ajustes de acumulación</h2>
              <p className="mt-1 text-[12px] text-white/50">Define cuánto acumulan los clientes y desde qué compra pueden redimir.</p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] text-white/70 transition hover:bg-white/[0.12]" aria-label="Cerrar ajustes">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {(message || error) && (
            <div className={"mb-4 rounded-2xl px-4 py-3 text-sm font-semibold " + (error ? "border border-red-200 bg-red-50 text-red-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700")}>
              {error || message}
            </div>
          )}

          <section className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
            <div className="bg-[linear-gradient(135deg,#09090a,#261214)] p-5 text-white sm:p-6">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/38">Regla actual</p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-[30px] font-black tracking-[-0.045em]">
                    {draft.enabled ? `${draft.earnRatePercent}% en puntos` : "Club pausado"}
                  </h3>
                  <p className="mt-1 text-[11px] text-white/48">
                    {draft.enabled
                      ? "sobre el subtotal elegible del pedido"
                      : "No aparece en la app y no acredita nuevos puntos"}
                  </p>
                </div>
                <span
                  className={
                    "rounded-full border px-3 py-1.5 text-[10px] font-black " +
                    (draft.enabled
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                      : "border-white/15 bg-white/[0.07] text-white/55")
                  }
                >
                  {draft.enabled ? "ACTIVO" : "INACTIVO"}
                </span>
              </div>
            </div>

            <div className="p-5">
              <button
                type="button"
                role="switch"
                aria-checked={draft.enabled}
                onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
                className={
                  "flex w-full items-center justify-between rounded-[18px] border px-4 py-3.5 text-left transition " +
                  (draft.enabled
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-neutral-200 bg-[#faf9f7]")
                }
              >
                <span>
                  <b className="block text-[12px] text-neutral-950">
                    Club Puntos en la app
                  </b>
                  <span className="mt-0.5 block text-[10px] leading-4 text-neutral-500">
                    {draft.enabled
                      ? "Los clientes ven Club y siguen acumulando puntos."
                      : "Club se oculta de la app y se pausan las nuevas acreditaciones."}
                  </span>
                </span>
                <span
                  className={
                    "relative h-7 w-12 shrink-0 rounded-full transition " +
                    (draft.enabled ? "bg-emerald-500" : "bg-neutral-300")
                  }
                >
                  <span
                    className={
                      "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition " +
                      (draft.enabled ? "left-6" : "left-1")
                    }
                  />
                </span>
              </button>

              <div className="mt-5 grid gap-5 md:grid-cols-[1fr_1.05fr]">
                <div>
                <label className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">Porcentaje de acumulación</label>
                <div className="relative mt-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={draft.earnRatePercent}
                    onChange={(event) => setDraft({ ...draft, earnRatePercent: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })}
                    className="alento-input w-full rounded-2xl px-4 py-4 pr-12 text-[22px] font-black"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg font-black text-neutral-400">%</span>
                </div>

                <label className="mt-5 block text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">Compra mínima para redimir</label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={draft.minimumRedemptionPurchase}
                  onChange={(event) => setDraft({ ...draft, minimumRedemptionPurchase: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
                  className="alento-input mt-2 w-full rounded-2xl px-4 py-4 text-[20px] font-black"
                />
                <p className="mt-2 text-[10px] leading-5 text-neutral-400">Los puntos se calculan al finalizar el pedido sobre productos elegibles y sin incluir domicilio.</p>
              </div>

                <div className="rounded-[20px] border border-neutral-200 bg-[#faf9f7] p-4">
                <p className="alento-ui-label uppercase text-neutral-400">Ejemplos con la regla actual</p>
                <div className="mt-3 space-y-2">
                  {examples.map((example) => (
                    <div key={example.amount} className="flex items-center justify-between rounded-xl border border-neutral-100 bg-white px-4 py-3">
                      <span className="text-sm text-neutral-600">{money(example.amount)}</span>
                      <b className="text-sm text-[var(--brand-red)]">{formatPoints(example.points)} pts</b>
                    </div>
                  ))}
                </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-[24px] border border-neutral-200 bg-white p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-400">Reglas del Club</p>
            <h3 className="mt-1 text-[19px] font-black tracking-[-0.025em]">Acumulación y redención</h3>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {[
                ["01", "Solo productos sin descuento", "Los combos y productos afectados por cupón o descuento manual no generan puntos."],
                ["02", "Sobre el subtotal elegible", "El domicilio y otros cargos externos a los productos no generan puntos."],
                ["03", "Compra mínima para redimir", "La compra debe ser de mínimo " + money(draft.minimumRedemptionPurchase) + " antes de aplicar cualquier canje."],
                ["04", "1 punto = $1 COP", "El saldo Club se usa como descuento en recompensas habilitadas; no se entrega en efectivo."],
                ["05", "Solo pedidos finalizados", "Los puntos se acreditan cuando el pedido queda pagado y finalizado."],
                ["06", "Sin puntos sobre puntos", "La parte pagada con puntos no vuelve a generar nuevos puntos cuando se habilite la redención."],
              ].map(([step, title, description]) => (
                <div key={step} className="rounded-[16px] border border-neutral-200 bg-[#faf9f7] p-3.5">
                  <span className="text-[9px] font-black text-[var(--brand-red)]">{step}</span>
                  <b className="mt-1 block text-[12px] text-neutral-900">{title}</b>
                  <p className="mt-1 text-[10px] leading-[18px] text-neutral-500">{description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex flex-col gap-2 border-t border-neutral-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[10px] font-medium text-neutral-400">Los cambios aplican a las próximas acreditaciones del Club.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="h-11 rounded-xl border border-neutral-200 bg-white px-5 text-[11px] font-black text-neutral-600">Cancelar</button>
            <button type="button" onClick={() => onSave(draft)} disabled={saving} className="h-11 rounded-xl bg-[var(--brand-red)] px-5 text-[11px] font-black text-white shadow-[0_8px_20px_rgba(226,26,34,.20)] disabled:bg-neutral-300">
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
