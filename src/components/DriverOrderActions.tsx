"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ChecklistItem = {
  id: number;
  productName: string;
  quantity: number;
};

export default function DriverOrderActions({
  token,
  initialStatus,
  items,
}: {
  token: string;
  initialStatus: string;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const storageKey = `alento-driver-checklist:${token}`;

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (status !== "READY") {
      setCheckedIds([]);
      window.localStorage.removeItem(storageKey);
      return;
    }

    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(saved)) {
        const validIds = items.map((item) => item.id);
        setCheckedIds(
          saved
            .map(Number)
            .filter((id) => Number.isInteger(id) && validIds.includes(id)),
        );
      }
    } catch {
      setCheckedIds([]);
    }
  }, [status, storageKey, items]);

  const target =
    status === "READY"
      ? "OUT_FOR_DELIVERY"
      : status === "OUT_FOR_DELIVERY"
        ? "ARRIVED"
        : null;

  const label =
    target === "OUT_FOR_DELIVERY"
      ? "Desliza para iniciar entrega"
      : target === "ARRIVED"
        ? "Desliza cuando hayas llegado"
        : null;

  const allChecked = useMemo(
    () => items.length > 0 && items.every((item) => checkedIds.includes(item.id)),
    [items, checkedIds],
  );

  function toggleItem(itemId: number) {
    if (busy || status !== "READY") return;

    setCheckedIds((current) => {
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];

      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  function updateFromPointer(clientX: number) {
    const track = trackRef.current;
    if (!track) return 0;

    const rect = track.getBoundingClientRect();
    const knobSize = 54;
    const padding = 4;
    const usable = Math.max(1, rect.width - knobSize - padding * 2);
    const raw = (clientX - rect.left - padding - knobSize / 2) / usable;
    const next = Math.min(1, Math.max(0, raw));
    setProgress(next);
    return next;
  }

  async function update(next: string) {
    if (next === "OUT_FOR_DELIVERY" && !allChecked) {
      setNotice("Verifica todos los productos antes de iniciar la entrega.");
      setProgress(0);
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      const response = await fetch(
        `/api/repartidor/pedido/${encodeURIComponent(token)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: next,
            checklistItemIds: next === "OUT_FOR_DELIVERY" ? checkedIds : undefined,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible actualizar el pedido.");
      }

      setStatus(data.order.status);

      if (next === "OUT_FOR_DELIVERY") {
        window.localStorage.removeItem(storageKey);
        setCheckedIds([]);
      }

      setNotice(
        next === "OUT_FOR_DELIVERY"
          ? "Entrega iniciada. El cliente fue notificado."
          : "Llegada registrada. El cliente fue notificado.",
      );

      router.refresh();
      window.setTimeout(() => router.refresh(), 900);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible actualizar el pedido.",
      );
    } finally {
      setBusy(false);
      setDragging(false);
      setProgress(0);
    }
  }

  function finish(nextProgress = progress) {
    setDragging(false);

    if (busy || !target) {
      setProgress(0);
      return;
    }

    if (target === "OUT_FOR_DELIVERY" && !allChecked) {
      setProgress(0);
      setNotice("Completa la verificación del pedido antes de salir.");
      return;
    }

    if (nextProgress >= 0.82) {
      setProgress(1);
      void update(target);
      return;
    }

    setProgress(0);
  }

  if (!target || !label) {
    return (
      <section className="rounded-[24px] bg-[#101011] p-5 text-center text-white">
        <p className="text-[9px] font-bold uppercase tracking-[.13em] text-white/45">
          Estado operativo
        </p>
        <h3 className="mt-2 text-xl font-black">
          {status === "ARRIVED" ? "Llegada registrada" : "Sin acciones pendientes"}
        </h3>
        <p className="mt-2 text-xs leading-5 text-white/55">
          La operación continuará desde Alentó.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[24px] bg-[#101011] text-white shadow-xl">
      {target === "OUT_FOR_DELIVERY" && (
        <div className="border-b border-white/10 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[.13em] text-white/45">
                Verificación obligatoria
              </p>
              <h3 className="mt-2 text-xl font-black">Revisa el pedido antes de salir</h3>
              <p className="mt-1 text-xs leading-5 text-white/55">
                Marca cada producto que llevas. El botón para iniciar el domicilio se habilita únicamente cuando el pedido esté completo.
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black ${allChecked ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/60"}`}>
              {checkedIds.length}/{items.length}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {items.map((item) => {
              const checked = checkedIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  disabled={busy}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${checked
                    ? "border-emerald-400/30 bg-emerald-400/10"
                    : "border-white/10 bg-white/[0.055] hover:bg-white/[0.08]"
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-sm font-black ${checked
                    ? "border-emerald-400 bg-emerald-400 text-black"
                    : "border-white/20 bg-black/20 text-transparent"
                  }`}>
                    ✓
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-sm font-bold text-white">{item.productName}</b>
                    <span className="mt-0.5 block text-[10px] text-white/45">
                      Confirmar {item.quantity === 1 ? "1 unidad" : `${item.quantity} unidades`}
                    </span>
                  </span>
                  <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-black text-white">
                    ×{item.quantity}
                  </span>
                </button>
              );
            })}
          </div>

          {allChecked && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-[11px] font-bold text-emerald-200">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[10px] text-black">✓</span>
              Pedido verificado. Ya puedes iniciar la entrega.
            </div>
          )}
        </div>
      )}

      <div className="p-5">
        <p className="text-[9px] font-bold uppercase tracking-[.13em] text-white/45">
          Acción del repartidor
        </p>
        <h3 className="mt-2 text-xl font-black">
          {target === "OUT_FOR_DELIVERY" ? "Salir a domicilio" : "Confirmar llegada"}
        </h3>
        <p className="mt-1 text-xs leading-5 text-white/55">
          {target === "OUT_FOR_DELIVERY" && !allChecked
            ? "Primero completa la verificación de todos los productos."
            : "Desliza para confirmar. El estado se actualiza inmediatamente y Alentó envía la notificación correspondiente al cliente."}
        </p>

        <div
          ref={trackRef}
          className={`relative mt-5 h-[62px] w-full overflow-hidden rounded-full border shadow-inner backdrop-blur-sm ${target === "OUT_FOR_DELIVERY" && !allChecked
            ? "border-white/10 bg-white/[0.035] opacity-45"
            : "border-white/15 bg-white/[0.08]"
          }`}
        >
          <div
            className="absolute inset-y-1 left-1 z-[1] rounded-full bg-[#df1f26]"
            style={{
              width: `calc(54px + (100% - 62px) * ${progress})`,
              transition: dragging
                ? "none"
                : "width 220ms cubic-bezier(.2,.8,.2,1)",
            }}
          />

          <div
            className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center px-[72px] text-center"
            style={{
              opacity: Math.max(0.18, 1 - progress * 1.15),
              transition: dragging ? "none" : "opacity 180ms ease",
            }}
          >
            <span className="truncate text-[10px] font-black uppercase tracking-[0.11em] text-white/72">
              {busy
                ? "Actualizando..."
                : target === "OUT_FOR_DELIVERY" && !allChecked
                  ? "Verifica el pedido"
                  : label}
            </span>
          </div>

          <button
            type="button"
            aria-label={label}
            disabled={busy || (target === "OUT_FOR_DELIVERY" && !allChecked)}
            className="absolute top-1 z-[4] flex h-[54px] w-[54px] touch-none select-none items-center justify-center rounded-full bg-white text-black shadow-[0_8px_18px_rgba(0,0,0,.28)] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[#e51c11] focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              left: `calc(4px + (100% - 62px) * ${progress})`,
              transition: dragging
                ? "none"
                : "left 220ms cubic-bezier(.2,.8,.2,1)",
            }}
            onPointerDown={(event) => {
              if (busy || (target === "OUT_FOR_DELIVERY" && !allChecked)) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(true);
              updateFromPointer(event.clientX);
            }}
            onPointerMove={(event) => {
              if (!dragging || busy) return;
              updateFromPointer(event.clientX);
            }}
            onPointerUp={(event) => {
              if (!dragging || busy) return;
              const next = updateFromPointer(event.clientX);
              finish(next);
            }}
            onPointerCancel={() => {
              if (!busy) finish(0);
            }}
            onKeyDown={(event) => {
              if (
                (event.key === "Enter" || event.key === " ") &&
                !busy &&
                !(target === "OUT_FOR_DELIVERY" && !allChecked)
              ) {
                event.preventDefault();
                setProgress(1);
                void update(target);
              }
            }}
          >
            {busy ? (
              <span className="text-lg">…</span>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-[22px] w-[22px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h13" />
                <path d="m14 7 5 5-5 5" />
              </svg>
            )}
          </button>
        </div>

        {notice && (
          <p className="mt-3 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white/80">
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}
