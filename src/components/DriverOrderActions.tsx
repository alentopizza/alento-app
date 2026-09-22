"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function DriverOrderActions({
  token,
  initialStatus,
}: {
  token: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

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
    setBusy(true);
    setNotice("");

    try {
      const response = await fetch(
        `/api/repartidor/pedido/${encodeURIComponent(token)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No fue posible actualizar el pedido.");
      }

      setStatus(data.order.status);
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
    <section className="rounded-[24px] bg-[#101011] p-5 text-white shadow-xl">
      <p className="text-[9px] font-bold uppercase tracking-[.13em] text-white/45">
        Acción del repartidor
      </p>
      <h3 className="mt-2 text-xl font-black">
        {target === "OUT_FOR_DELIVERY" ? "Salir a domicilio" : "Confirmar llegada"}
      </h3>
      <p className="mt-1 text-xs leading-5 text-white/55">
        Desliza para confirmar. El estado se actualiza inmediatamente y Alentó envía
        la notificación correspondiente al cliente.
      </p>

      <div
        ref={trackRef}
        className="relative mt-5 h-[62px] w-full overflow-hidden rounded-full border border-white/15 bg-white/[0.08] shadow-inner backdrop-blur-sm"
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
            {busy ? "Actualizando..." : label}
          </span>
        </div>

        <button
          type="button"
          aria-label={label}
          disabled={busy}
          className="absolute top-1 z-[4] flex h-[54px] w-[54px] touch-none select-none items-center justify-center rounded-full bg-white text-black shadow-[0_8px_18px_rgba(0,0,0,.28)] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[#e51c11] focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[.98] disabled:cursor-wait disabled:opacity-70"
          style={{
            left: `calc(4px + (100% - 62px) * ${progress})`,
            transition: dragging
              ? "none"
              : "left 220ms cubic-bezier(.2,.8,.2,1)",
          }}
          onPointerDown={(event) => {
            if (busy) return;
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
            if ((event.key === "Enter" || event.key === " ") && !busy) {
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
    </section>
  );
}
