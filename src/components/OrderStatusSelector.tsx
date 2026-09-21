"use client";

import { useMemo } from "react";
import {
  fulfillmentLabel,
  statusLabel,
  workflowFor,
  type FulfillmentType,
  type OrderStatus,
} from "@/lib/orderWorkflow";

type OrderStatusSelectorProps = {
  orderCode: string;
  currentStatus: OrderStatus;
  fulfillmentType: FulfillmentType;
  pendingBalance: number;
  busy?: boolean;
  drivers?: Array<{ id: number; name: string; ready: boolean }>;
  assignedDriverId?: number | null;
  driverBusy?: boolean;
  onAssignDriver?: (driverId: number) => void;
  onClose: () => void;
  onSelect: (status: OrderStatus) => void;
};

const money = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

function statusTone(status: OrderStatus) {
  if (status === "PREPARING") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "PREPARED") return "border-violet-200 bg-violet-50 text-violet-800";
  if (status === "READY") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "OUT_FOR_DELIVERY") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "ARRIVED") return "border-cyan-200 bg-cyan-50 text-cyan-800";
  if (status === "DELIVERED") return "border-teal-200 bg-teal-50 text-teal-800";
  if (status === "COMPLETED") return "border-neutral-300 bg-neutral-100 text-neutral-900";
  return "border-neutral-200 bg-white text-neutral-800";
}

export default function OrderStatusSelector({
  orderCode,
  currentStatus,
  fulfillmentType,
  pendingBalance,
  busy = false,
  drivers = [],
  assignedDriverId = null,
  driverBusy = false,
  onAssignDriver,
  onClose,
  onSelect,
}: OrderStatusSelectorProps) {
  const statuses = useMemo(() => workflowFor(fulfillmentType), [fulfillmentType]);
  const currentIndex = statuses.indexOf(currentStatus);
  const hasPendingPayment = pendingBalance > 0;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[26px] border border-white/10 bg-white shadow-[0_28px_90px_rgba(0,0,0,.30)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bg-[radial-gradient(circle_at_88%_20%,rgba(229,28,17,.22),transparent_30%),linear-gradient(135deg,#09090a,#191617)] px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">Estado del pedido</p>
              <h3 className="mt-1 text-2xl font-black tracking-[-0.035em]">{orderCode}</h3>
              <p className="mt-1 text-xs text-white/60">{fulfillmentLabel(fulfillmentType)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] text-xl text-white"
              aria-label="Cerrar selector de estados"
            >
              ×
            </button>
          </div>
        </header>

        <div className="p-5">
          <p className="text-sm font-semibold text-neutral-700">Selecciona el siguiente estado operativo</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Los estados ya superados quedan bloqueados para evitar retrocesos. Puedes saltar a cualquier etapa posterior, pero Finalizado solo se habilita cuando el pedido está pagado en su totalidad.
          </p>

          {hasPendingPayment && currentStatus !== "COMPLETED" && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700">Pago pendiente</span>
              <b className="mt-1 block text-lg font-bold text-amber-900">{money(pendingBalance)}</b>
              <p className="mt-1 text-[11px] leading-4 text-amber-700">Registra el saldo completo para habilitar Finalizado.</p>
            </div>
          )}

          {fulfillmentType === "DELIVERY" && (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-[#faf9f7] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-400">Repartidor</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">Al asignarlo recibirá por WhatsApp el enlace operativo del domicilio.</p>
                </div>
                {assignedDriverId && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700">ASIGNADO</span>}
              </div>
              <select
                value={assignedDriverId ?? ""}
                disabled={driverBusy || busy}
                onChange={(event) => {
                  const driverId = Number(event.target.value);
                  if (driverId && onAssignDriver) onAssignDriver(driverId);
                }}
                className="alento-input mt-3 h-11 w-full rounded-xl px-3 text-sm font-semibold"
              >
                <option value="">Seleccionar repartidor...</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id} disabled={!driver.ready}>
                    {driver.name}{driver.ready ? "" : " · sin WhatsApp"}
                  </option>
                ))}
              </select>
              {driverBusy && <p className="mt-2 text-[10px] font-semibold text-neutral-400">Asignando y enviando notificación...</p>}
            </div>
          )}

          <div className="mt-4 space-y-2">
            {statuses.map((status, index) => {
              const current = status === currentStatus;
              const previous = currentIndex >= 0 && index < currentIndex;
              const paymentBlocked = status === "COMPLETED" && hasPendingPayment;
              const disabled = busy || current || previous || paymentBlocked;

              return (
                <button
                  key={status}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(status)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    current
                      ? "border-black bg-black text-white shadow-[0_8px_20px_rgba(0,0,0,.12)]"
                      : previous || paymentBlocked
                        ? "border-neutral-200 bg-neutral-100 text-neutral-400 opacity-65"
                        : `${statusTone(status)} hover:-translate-y-0.5 hover:shadow-sm`
                  } disabled:cursor-not-allowed`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    current
                      ? "bg-white/15 text-white"
                      : previous || paymentBlocked
                        ? "bg-neutral-200 text-neutral-400"
                        : "bg-white/80 text-neutral-500"
                  }`}>
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-sm font-bold">{statusLabel(status)}</b>
                    {current && (
                      <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-white/55">
                        Estado actual
                      </span>
                    )}
                    {previous && (
                      <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                        Etapa superada
                      </span>
                    )}
                    {paymentBlocked && !current && (
                      <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-600">
                        Requiere pago total
                      </span>
                    )}
                  </span>
                  {!current && !previous && !paymentBlocked && <span className="text-lg opacity-45">›</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
