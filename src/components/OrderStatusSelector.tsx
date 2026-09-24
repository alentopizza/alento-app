"use client";

import { useMemo, useState } from "react";
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
  selectedDriverId?: number | null;
  driverBusy?: boolean;
  onDriverChange?: (driverId: number | null) => void;
  onConfirmDriver?: () => void;
  onUnassignDriver?: () => void;
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

function shortStatusLabel(status: OrderStatus) {
  const labels: Partial<Record<OrderStatus, string>> = {
    PREPARING: "Preparando",
    PREPARED: "Horneando",
    READY: "Listo",
    OUT_FOR_DELIVERY: "En camino",
    ARRIVED: "Llegó",
    DELIVERED: "Entregado",
    COMPLETED: "Finalizado",
  };
  return labels[status] ?? statusLabel(status);
}

export default function OrderStatusSelector({
  orderCode,
  currentStatus,
  fulfillmentType,
  pendingBalance,
  busy = false,
  drivers = [],
  assignedDriverId = null,
  selectedDriverId = null,
  driverBusy = false,
  onDriverChange,
  onConfirmDriver,
  onUnassignDriver,
  onClose,
  onSelect,
}: OrderStatusSelectorProps) {
  const [showMoreStatuses, setShowMoreStatuses] = useState(false);

  const statuses = useMemo(() => workflowFor(fulfillmentType), [fulfillmentType]);
  const currentIndex = statuses.indexOf(currentStatus);
  const hasPendingPayment = pendingBalance > 0;

  const nextStatus =
    currentIndex >= 0 && currentIndex < statuses.length - 1
      ? statuses[currentIndex + 1]
      : null;

  const nextBlocked =
    nextStatus === "COMPLETED" && hasPendingPayment;

  const remainingStatuses = statuses.filter((_, index) => index > currentIndex);

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-3 backdrop-blur-[3px] sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-[26px] border border-white/10 bg-white shadow-[0_28px_90px_rgba(0,0,0,.30)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 bg-[radial-gradient(circle_at_88%_20%,rgba(229,28,17,.22),transparent_30%),linear-gradient(135deg,#09090a,#191617)] px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="alento-ui-label uppercase tracking-[0.10em] text-white/55">
                Estado del pedido
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="text-[24px] font-extrabold tracking-[-0.03em]">
                  {orderCode}
                </h3>
                <span className="rounded-full border border-white/10 bg-white/[0.07] px-2.5 py-1 alento-ui-micro uppercase tracking-[0.04em] text-white/70">
                  {fulfillmentLabel(fulfillmentType)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] text-lg text-white"
              aria-label="Cerrar selector de estados"
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <section className="rounded-[20px] border border-neutral-200 bg-[#fbfaf8] px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="alento-ui-label uppercase text-neutral-500">
                  Flujo operativo
                </p>
                <p className="mt-1 alento-ui-status text-neutral-900">
                  {shortStatusLabel(currentStatus)}
                </p>
              </div>
              <span className="rounded-full bg-black px-3 py-1.5 alento-ui-micro uppercase tracking-[0.03em] text-white">
                Estado actual
              </span>
            </div>

            <div className="mt-5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div
                className="relative grid min-w-[700px] gap-0 sm:min-w-0"
                style={{
                  gridTemplateColumns: `repeat(${statuses.length}, minmax(0, 1fr))`,
                }}
              >
                <div
                  className="absolute top-[17px] h-[3px] rounded-full bg-neutral-200"
                  style={{
                    left: `${100 / (statuses.length * 2)}%`,
                    right: `${100 / (statuses.length * 2)}%`,
                  }}
                />
                <div
                  className="absolute top-[17px] h-[3px] rounded-full bg-black transition-all"
                  style={{
                    left: `${100 / (statuses.length * 2)}%`,
                    width:
                      currentIndex <= 0
                        ? "0%"
                        : `${(currentIndex / Math.max(1, statuses.length - 1)) * (100 - 100 / statuses.length)}%`,
                  }}
                />

                {statuses.map((status, index) => {
                  const current = status === currentStatus;
                  const complete = currentIndex >= 0 && index < currentIndex;

                  return (
                    <div key={status} className="relative min-w-0 px-1 text-center">
                      <div
                        className={
                          "relative z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2 text-[13px] font-bold leading-none " +
                          (current
                            ? "border-black bg-black text-white ring-[5px] ring-black/10"
                            : complete
                              ? "border-black bg-black text-white"
                              : "border-neutral-300 bg-white text-neutral-500")
                        }
                      >
                        {complete ? "✓" : index + 1}
                      </div>
                      <span
                        className={
                          "mt-3 block px-1 text-[11px] font-bold leading-[14px] tracking-[-0.01em] " +
                          (current
                            ? "text-neutral-950"
                            : complete
                              ? "text-neutral-700"
                              : "text-neutral-500")
                        }
                      >
                        {shortStatusLabel(status)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {hasPendingPayment && currentStatus !== "COMPLETED" && (
              <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="block alento-ui-label uppercase text-amber-700">
                      Pago pendiente
                    </span>
                    <b className="mt-1 block text-[18px] font-bold text-amber-900">
                      {money(pendingBalance)}
                    </b>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                    Finalizado bloqueado
                  </span>
                </div>
              </div>
            )}

            {fulfillmentType === "DELIVERY" && (
              <div
                className={
                  "rounded-[16px] border border-neutral-200 bg-[#faf9f7] px-3.5 py-3 " +
                  (!hasPendingPayment ? "sm:col-span-2" : "")
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="block alento-ui-label uppercase text-neutral-500">
                      Repartidor
                    </span>
                    <b className="mt-1 block text-[13px] font-semibold text-neutral-800">
                      {assignedDriverId ? "Asignado" : "Sin asignar"}
                    </b>
                  </div>
                  {assignedDriverId && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                      ACTIVO
                    </span>
                  )}
                </div>

                <div className="mt-2 flex gap-2">
                  <select
                    value={selectedDriverId ?? ""}
                    disabled={driverBusy || busy}
                    onChange={(event) => {
                      const value = event.target.value;
                      onDriverChange?.(value ? Number(value) : null);
                    }}
                    className="alento-input h-11 min-w-0 flex-1 rounded-xl px-3 alento-ui-control"
                  >
                    <option value="">Seleccionar repartidor...</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id} disabled={!driver.ready}>
                        {driver.name}{driver.ready ? "" : " · sin WhatsApp"}
                      </option>
                    ))}
                  </select>

                  {selectedDriverId && (
                    <button
                      type="button"
                      disabled={driverBusy || busy}
                      onClick={() => onConfirmDriver?.()}
                      className="h-11 shrink-0 rounded-xl bg-neutral-950 px-4 text-[11px] font-bold uppercase tracking-[0.03em] text-white disabled:opacity-50"
                    >
                      {driverBusy
                        ? "..."
                        : assignedDriverId === selectedDriverId
                          ? "Notificar"
                          : assignedDriverId
                            ? "Reasignar"
                            : "Asignar"}
                    </button>
                  )}
                </div>

                {assignedDriverId && (
                  <button
                    type="button"
                    disabled={driverBusy || busy}
                    onClick={() => onUnassignDriver?.()}
                    className="mt-2 flex h-10 w-full items-center justify-center rounded-xl border border-red-200 bg-white text-[10px] font-black uppercase tracking-[0.05em] text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    {driverBusy ? "Procesando..." : "Desasignar repartidor"}
                  </button>
                )}
              </div>
            )}
          </div>

          <section className="mt-4 rounded-[20px] border border-neutral-200 bg-white p-3.5 shadow-[0_8px_24px_rgba(20,18,16,.035)]">
            <p className="alento-ui-label uppercase text-neutral-500">
              Siguiente paso
            </p>

            {nextStatus ? (
              <button
                type="button"
                disabled={busy || nextBlocked}
                onClick={() => onSelect(nextStatus)}
                className={
                  "mt-2 flex w-full items-center justify-between gap-3 rounded-[16px] border px-4 py-3.5 text-left transition disabled:cursor-not-allowed " +
                  (nextBlocked
                    ? "border-neutral-200 bg-neutral-100 text-neutral-400"
                    : `${statusTone(nextStatus)} hover:-translate-y-0.5 hover:shadow-sm`)
                }
              >
                <span>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.04em] opacity-60">
                    Cambiar a
                  </span>
                  <b className="mt-1 block text-[17px] font-bold">
                    {statusLabel(nextStatus)}
                  </b>
                  {nextBlocked && (
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.04em] text-amber-700">
                      Requiere pago total
                    </span>
                  )}
                </span>
                {!nextBlocked && (
                  <span className="text-2xl opacity-40">›</span>
                )}
              </button>
            ) : (
              <div className="mt-2 rounded-[16px] bg-neutral-100 px-4 py-3 text-xs font-semibold text-neutral-500">
                Este pedido ya está en la última etapa operativa.
              </div>
            )}

            {remainingStatuses.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowMoreStatuses((value) => !value)}
                  className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[11px] font-bold uppercase tracking-[0.04em] text-neutral-500 hover:bg-neutral-50"
                >
                  {showMoreStatuses ? "Ocultar estados" : "Más estados"}
                  <span className="text-sm">{showMoreStatuses ? "⌃" : "⌄"}</span>
                </button>

                {showMoreStatuses && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {remainingStatuses.map((status, index) => {
                      const paymentBlocked =
                        status === "COMPLETED" && hasPendingPayment;
                      const isNext = index === 0;

                      return (
                        <button
                          key={status}
                          type="button"
                          disabled={busy || paymentBlocked}
                          onClick={() => onSelect(status)}
                          className={
                            "flex min-h-12 items-center justify-between rounded-xl border px-3 py-2.5 text-left text-[13px] font-bold transition disabled:cursor-not-allowed " +
                            (paymentBlocked
                              ? "border-neutral-200 bg-neutral-100 text-neutral-400"
                              : `${statusTone(status)} hover:-translate-y-0.5 disabled:opacity-50`)
                          }
                        >
                          <span>
                            <span className="block">{statusLabel(status)}</span>
                            {isNext && (
                              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.04em] opacity-55">
                                Siguiente
                              </span>
                            )}
                            {paymentBlocked && (
                              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.04em] text-amber-700">
                                Requiere pago total
                              </span>
                            )}
                          </span>
                          {!paymentBlocked && <span className="opacity-35">›</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {hasPendingPayment && currentStatus !== "COMPLETED" && (
              <p className="mt-3 text-center text-[10px] font-semibold leading-4 text-neutral-500">
                Finalizado se habilita automáticamente cuando el saldo quede en $0.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
