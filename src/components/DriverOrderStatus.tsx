type DriverStage = {
  label: string;
  statuses: string[];
};

const STAGES: DriverStage[] = [
  { label: "Preparando", statuses: ["DRAFT", "CONFIRMED", "PREPARING"] },
  { label: "Horneando", statuses: ["PREPARED"] },
  { label: "Listo", statuses: ["READY"] },
  { label: "En camino", statuses: ["OUT_FOR_DELIVERY"] },
  { label: "Llegó", statuses: ["ARRIVED"] },
];

const STATUS_TITLE: Record<string, string> = {
  DRAFT: "Pedido recibido",
  CONFIRMED: "Pedido confirmado",
  PREPARING: "El pedido está en preparación",
  PREPARED: "El pedido está horneándose",
  READY: "Listo para recoger",
  OUT_FOR_DELIVERY: "Entrega en curso",
  ARRIVED: "Llegaste al destino",
  DELIVERED: "Pedido entregado",
  COMPLETED: "Entrega finalizada",
  CANCELED: "Pedido cancelado",
};

const STATUS_COPY: Record<string, string> = {
  DRAFT: "Alentó recibió el pedido y pronto entrará a preparación.",
  CONFIRMED: "El pedido está confirmado y listo para entrar a cocina.",
  PREPARING: "La cocina está preparando el pedido. Puedes ir calculando cuándo acercarte a Alentó.",
  PREPARED: "El pedido está en el horno. Ya puedes calcular tu llegada para recogerlo a tiempo.",
  READY: "El pedido ya está listo. Puedes recogerlo en Alentó Pizza.",
  OUT_FOR_DELIVERY: "Ya saliste de Alentó y el domicilio está en curso.",
  ARRIVED: "Ya estás en el punto de entrega del cliente.",
  DELIVERED: "La entrega fue registrada.",
  COMPLETED: "El pedido quedó finalizado.",
  CANCELED: "Este pedido fue cancelado. No continúes con la entrega.",
};

export default function DriverOrderStatus({ status }: { status: string }) {
  if (status === "CANCELED") {
    return (
      <section className="rounded-[24px] border border-[#e21a22]/35 bg-[radial-gradient(circle_at_top_right,rgba(226,26,34,.20),transparent_38%),linear-gradient(145deg,#171717,#090909_72%)] p-5 text-white shadow-[0_20px_55px_rgba(0,0,0,.30)]">
        <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#ff454b]">
          Estado actual
        </p>
        <h2 className="mt-2 text-[24px] font-black tracking-[-0.03em]">
          Pedido cancelado
        </h2>
        <p className="mt-2 text-[12px] leading-5 text-white/58">
          {STATUS_COPY.CANCELED}
        </p>
      </section>
    );
  }

  let current = STAGES.findIndex((stage) => stage.statuses.includes(status));
  if (current < 0) current = 0;

  return (
    <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(226,26,34,.14),transparent_36%),linear-gradient(145deg,#151515,#090909_72%)] px-5 pb-5 pt-4 text-white shadow-[0_20px_55px_rgba(0,0,0,.30)]">
      <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#ff454b]">
        Estado actual
      </p>

      <h2 className="mt-2 text-[24px] font-black leading-tight tracking-[-0.035em]">
        {STATUS_TITLE[status] ?? "Pedido en proceso"}
      </h2>

      <p className="mt-1.5 max-w-[520px] text-[11px] leading-5 text-white/55">
        {STATUS_COPY[status] ?? "Estamos actualizando el estado del pedido."}
      </p>

      <div className="relative mt-5">
        <div
          className="absolute top-[11px] grid"
          style={{
            left: `${100 / (STAGES.length * 2)}%`,
            right: `${100 / (STAGES.length * 2)}%`,
            gridTemplateColumns: `repeat(${STAGES.length - 1}, minmax(0, 1fr))`,
          }}
        >
          {STAGES.slice(0, -1).map((_, index) => {
            const completed = index < current;
            const activeSegment = index === current && current < STAGES.length - 1;

            return (
              <div
                key={index}
                className="relative h-[2px] overflow-hidden bg-white/10"
              >
                {completed && <div className="absolute inset-0 bg-[#e21a22]" />}

                {activeSegment && (
                  <>
                    <div className="absolute inset-0 bg-[#e21a22]/18" />
                    <div className="alento-progress-runner absolute inset-y-0 left-0 w-full origin-left bg-[linear-gradient(90deg,rgba(226,26,34,.22),#ff3439_55%,#ff7a7e)] shadow-[0_0_10px_rgba(255,52,57,.55)]" />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="relative grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))`,
          }}
        >
          {STAGES.map((stage, index) => {
            const completed = index < current;
            const active = index === current;

            return (
              <div key={stage.label} className="min-w-0 text-center">
                <div
                  className={
                    "relative mx-auto flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-black transition " +
                    (completed
                      ? "border-[#e21a22] bg-[#e21a22] text-white"
                      : active
                        ? "border-[#ff454b] bg-[#ff454b]/20 text-[#ff454b] ring-4 ring-[#e21a22]/10"
                        : "border-white/20 bg-[#111] text-white/30")
                  }
                >
                  {active && current < STAGES.length - 1 && (
                    <span className="alento-progress-pulse absolute inset-[-5px] rounded-full border border-[#ff454b]/30" />
                  )}
                  <span className="relative z-10">
                    {completed ? "✓" : index + 1}
                  </span>
                </div>

                <span
                  className={
                    "mt-2 block px-0.5 text-[7px] font-semibold leading-3 tracking-[-0.02em] sm:px-1 sm:text-[9px] " +
                    (active
                      ? "text-white"
                      : completed
                        ? "text-white/60"
                        : "text-white/25")
                  }
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
