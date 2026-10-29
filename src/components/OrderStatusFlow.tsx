"use client";

import {
  statusLabel,
  workflowFor,
  type FulfillmentType,
  type OrderStatus,
} from "@/lib/orderWorkflow";

type Props = {
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  compact?: boolean;
};

export default function OrderStatusFlow({ status, fulfillmentType, compact = false }: Props) {
  const flow = workflowFor(fulfillmentType);
  const normalizedStatus = status === "CONFIRMED" ? "PREPARING" : status;
  const activeIndex = flow.indexOf(normalizedStatus);

  if (status === "CANCELED") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.08em] text-red-700">
        Pedido cancelado
      </div>
    );
  }

  return (
    <div className={`grid gap-2 ${compact ? "text-[9px]" : "text-[10px]"}`} style={{ gridTemplateColumns: `repeat(${flow.length}, minmax(0, 1fr))` }}>
      {flow.map((step, index) => {
        const current = index === activeIndex;
        const complete = activeIndex >= 0 && index < activeIndex;
        return (
          <div
            key={step}
            className={`flex min-h-10 items-center justify-center rounded-xl border px-2 text-center font-black uppercase tracking-[0.035em] transition ${
              current
                ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white shadow-sm"
                : complete
                  ? "border-neutral-800 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-neutral-100 text-neutral-500"
            }`}
          >
            {index + 1}. {statusLabel(step)}
          </div>
        );
      })}
    </div>
  );
}
