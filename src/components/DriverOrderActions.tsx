"use client";

import { useState } from "react";

export default function DriverOrderActions({ token, initialStatus }: { token: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [value, setValue] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const target = status === "READY" ? "OUT_FOR_DELIVERY" : status === "OUT_FOR_DELIVERY" ? "ARRIVED" : null;
  const label = target === "OUT_FOR_DELIVERY" ? "DESLIZA PARA INICIAR ENTREGA" : target === "ARRIVED" ? "DESLIZA CUANDO HAYAS LLEGADO" : null;

  async function update(next: string) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/repartidor/pedido/${encodeURIComponent(token)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible actualizar el pedido.");
      setStatus(data.order.status);
      setNotice(next === "OUT_FOR_DELIVERY" ? "Entrega iniciada. El cliente fue notificado." : "Llegada registrada. El cliente fue notificado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible actualizar el pedido.");
    } finally {
      setBusy(false);
      setValue(0);
    }
  }

  if (!target || !label) {
    return (
      <section className="rounded-[24px] bg-[#101011] p-5 text-center text-white">
        <p className="text-[9px] font-bold uppercase tracking-[.13em] text-white/45">Estado operativo</p>
        <h3 className="mt-2 text-xl font-black">{status === "ARRIVED" ? "Llegada registrada" : "Sin acciones pendientes"}</h3>
        <p className="mt-2 text-xs leading-5 text-white/55">La operación continuará desde Alentó.</p>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] bg-[#101011] p-5 text-white shadow-xl">
      <p className="text-[9px] font-bold uppercase tracking-[.13em] text-white/45">Acción del repartidor</p>
      <h3 className="mt-2 text-xl font-black">{target === "OUT_FOR_DELIVERY" ? "Salir a domicilio" : "Confirmar llegada"}</h3>
      <p className="mt-1 text-xs leading-5 text-white/55">Al completar el deslizador se actualiza el pedido y se envía el WhatsApp correspondiente al cliente.</p>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          disabled={busy}
          onChange={(event) => setValue(Number(event.target.value))}
          onMouseUp={() => { if (value >= 92 && !busy) void update(target); else setValue(0); }}
          onTouchEnd={() => { if (value >= 92 && !busy) void update(target); else setValue(0); }}
          className="w-full accent-white"
        />
        <div className="mt-2 flex items-center justify-between text-[9px] font-black uppercase tracking-[.11em] text-white/45">
          <span>Desliza</span><span>{busy ? "Actualizando..." : label}</span><span>→</span>
        </div>
      </div>

      {notice && <p className="mt-3 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white/80">{notice}</p>}
    </section>
  );
}
