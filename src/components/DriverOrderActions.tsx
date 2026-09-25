"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PresentedDetail } from "@/lib/orderPresentation";
import {
  DELIVERY_TRAVEL_MODE_OPTIONS,
  normalizeDeliveryTravelMode,
  type DeliveryTravelMode,
} from "@/lib/deliveryTravelMode";

type ChecklistItem = {
  id: number;
  productName: string;
  variantName: string | null;
  quantity: number;
  lineTotal: number;
  details: PresentedDetail[];
  notes: string | null;
  verified: boolean;
};

type DriverLocationSnapshot = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DriverOrderActions({
  token,
  claimOrderId,
  initiallyAssigned,
  initialStatus,
  initialTravelMode,
  items,
}: {
  token: string;
  claimOrderId: number;
  initiallyAssigned: boolean;
  initialStatus: string;
  initialTravelMode: string | null;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const locationWatchRef = useRef<number | null>(null);
  const lastLocationSyncRef = useRef(0);

  const [status, setStatus] = useState(initialStatus);
  const [travelMode, setTravelMode] = useState<DeliveryTravelMode | null>(
    normalizeDeliveryTravelMode(initialTravelMode),
  );
  const [isAssigned, setIsAssigned] = useState(initiallyAssigned);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [locationSnapshot, setLocationSnapshot] =
    useState<DriverLocationSnapshot | null>(null);

  const locationStorageKey = `alento-driver-location-sharing:${token}`;

  useEffect(() => {
    setStatus(initialStatus);
    setTravelMode(normalizeDeliveryTravelMode(initialTravelMode));
    setIsAssigned(initiallyAssigned);
  }, [initialStatus, initialTravelMode, initiallyAssigned]);

  useEffect(() => {
    if (!isAssigned || status !== "READY") {
      setCheckedIds([]);
      return;
    }

    setCheckedIds(items.filter((item) => item.verified).map((item) => item.id));
  }, [isAssigned, status, items]);

  useEffect(() => {
    return () => {
      if (locationWatchRef.current != null) {
        navigator.geolocation?.clearWatch(locationWatchRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      !["DELIVERED", "COMPLETED", "CANCELED"].includes(status) ||
      locationWatchRef.current == null
    ) {
      return;
    }

    navigator.geolocation.clearWatch(locationWatchRef.current);
    locationWatchRef.current = null;
    setLocationSnapshot(null);
    window.localStorage.removeItem(locationStorageKey);
  }, [status, locationStorageKey]);

  useEffect(() => {
    if (!isAssigned) return;
    if (!["READY", "OUT_FOR_DELIVERY", "ARRIVED"].includes(status)) return;
    if (locationWatchRef.current != null) return;

    startLocationSharing();
  }, [isAssigned, status]);

  const target =
    !isAssigned
      ? "CLAIM"
      : status === "READY"
        ? "OUT_FOR_DELIVERY"
        : status === "OUT_FOR_DELIVERY"
          ? "ARRIVED"
          : status === "ARRIVED"
            ? "DELIVERED"
            : null;

  const label =
    target === "CLAIM"
      ? "ASIGNARME DOMICILIO"
      : target === "OUT_FOR_DELIVERY"
        ? "Desliza para iniciar entrega"
        : target === "ARRIVED"
          ? "Desliza cuando hayas llegado"
          : target === "DELIVERED"
            ? "Desliza para entregar"
            : null;

  const canVerifyProducts = isAssigned && status === "READY";

  const allChecked = useMemo(
    () => items.length > 0 && items.every((item) => checkedIds.includes(item.id)),
    [items, checkedIds],
  );

  const canStartDelivery = allChecked;

  const pendingItems = useMemo(
    () => items.filter((item) => !checkedIds.includes(item.id)),
    [items, checkedIds],
  );

  async function toggleItem(itemId: number) {
    if (busy || !canVerifyProducts) return;

    const checked = checkedIds.includes(itemId);
    const optimistic = checked
      ? checkedIds.filter((id) => id !== itemId)
      : [...checkedIds, itemId];

    setCheckedIds(optimistic);
    setNotice("");

    try {
      const response = await fetch(
        `/api/repartidor/pedido/${encodeURIComponent(token)}/checklist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId,
            checked: !checked,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible actualizar la verificación.",
        );
      }

      router.refresh();
    } catch (error) {
      setCheckedIds(checkedIds);
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible actualizar la verificación.",
      );
    }
  }

  function startLocationSharing() {
    if (!navigator.geolocation) {
      setNotice("No fue posible iniciar el GPS automático en este dispositivo.");
      return;
    }

    if (locationWatchRef.current != null) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocationSnapshot({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        });
        window.localStorage.setItem(locationStorageKey, "1");

        const now = Date.now();
        if (now - lastLocationSyncRef.current >= 5000) {
          lastLocationSyncRef.current = now;
          void fetch(
            `/api/repartidor/pedido/${encodeURIComponent(token)}/location`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
              }),
            },
          ).catch(() => {
            // El watchPosition sigue activo aunque falle una sincronización puntual.
          });
        }
      },
      (error) => {
        locationWatchRef.current = null;

        if (error.code === error.PERMISSION_DENIED) {
          setNotice("El GPS automático no tiene permiso de ubicación.");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setNotice("No fue posible actualizar tu ubicación automáticamente.");
        } else {
          setNotice("La lectura del GPS tardó demasiado. Se intentará nuevamente.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 15_000,
      },
    );

    locationWatchRef.current = watchId;
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

    if (next === "OUT_FOR_DELIVERY" && !travelMode) {
      setNotice("Elige si vas a entregar a pie, en moto o en vehículo.");
      setProgress(0);
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      if (next === "CLAIM") {
        const response = await fetch(
          `/api/repartidor/requests/${claimOrderId}/claim`,
          { method: "POST" },
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "No fue posible asignarte el domicilio.");
        }

        setIsAssigned(true);
        setNotice("Domicilio asignado. Ya puedes continuar desde esta pantalla.");

        if (data.href) {
          router.replace(data.href);
        }
        router.refresh();
        return;
      }

      const response = await fetch(
        `/api/repartidor/pedido/${encodeURIComponent(token)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: next,
            deliveryTravelMode:
              next === "OUT_FOR_DELIVERY" ? travelMode : undefined,
            location:
              next === "OUT_FOR_DELIVERY" ? locationSnapshot : undefined,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible actualizar el pedido.");
      }

      setStatus(data.order.status);

      if (next === "OUT_FOR_DELIVERY") {
        setCheckedIds([]);
      }

      if (next === "DELIVERED") {
        if (locationWatchRef.current != null) {
          navigator.geolocation.clearWatch(locationWatchRef.current);
          locationWatchRef.current = null;
        }
        window.localStorage.removeItem(locationStorageKey);
        router.replace("/repartidor");
        router.refresh();
        return;
      }

      setNotice(
        next === "OUT_FOR_DELIVERY"
          ? "Entrega iniciada. La ubicación sigue compartiéndose y el cliente fue notificado."
          : "Llegada registrada. El cliente seguirá viendo tu ubicación hasta que marques Entregado.",
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

    if (target === "OUT_FOR_DELIVERY" && !canStartDelivery) {
      setProgress(0);
      setNotice("Completa la verificación del pedido antes de salir.");
      return;
    }

    if (target === "OUT_FOR_DELIVERY" && !travelMode) {
      setProgress(0);
      setNotice("Elige cómo vas a realizar la entrega.");
      return;
    }

    if (nextProgress >= 0.82) {
      setProgress(1);
      void update(target);
      return;
    }

    setProgress(0);
  }

  if ((!target || !label) && !canVerifyProducts) {
    return null;
  }

  return (
    <section
      className={
        canVerifyProducts
          ? "overflow-hidden rounded-[24px] border border-white/10 bg-[#101011] text-white shadow-[0_20px_55px_rgba(0,0,0,.32)]"
          : "contents"
      }
    >
      {canVerifyProducts && (
        <>
          {pendingItems.length > 0 ? (
          <div className="border-b border-white/10 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[9px] font-black uppercase tracking-[.13em] text-[#ff454b]">
                Productos
              </p>

              <span
                className={
                  "rounded-full px-3 py-1.5 text-[10px] font-black " +
                  (allChecked
                    ? "bg-[#e21a22] text-white"
                    : "bg-white/10 text-white/60")
                }
              >
                {checkedIds.length}/{items.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {pendingItems.map((item) => {
                const checked = checkedIds.includes(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    disabled={busy}
                    className={
                      "w-full overflow-hidden rounded-[18px] border text-left transition " +
                      (checked
                        ? "border-[#e21a22]/45 bg-[#e21a22]/10"
                        : "border-white/10 bg-white/[0.045] hover:bg-white/[0.07]")
                    }
                  >
                    <div className="flex items-start gap-3 p-3.5">
                      <span
                        className={
                          "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-xl px-2 text-[10px] font-black " +
                          (checked
                            ? "bg-[#e21a22] text-white"
                            : "bg-white/10 text-white")
                        }
                      >
                        {item.quantity}×
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <b className="block text-[12px] font-black leading-5 text-white">
                              {item.productName}
                            </b>
                            {item.variantName && (
                              <span className="mt-0.5 block text-[9px] font-semibold text-white/45">
                                {item.variantName}
                              </span>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <b className="text-[11px] text-white/72">
                              {money(item.lineTotal)}
                            </b>
                            <span
                              className={
                                "flex h-7 w-7 items-center justify-center rounded-lg border text-[12px] font-black " +
                                (checked
                                  ? "border-[#e21a22] bg-[#e21a22] text-white"
                                  : "border-white/20 bg-black/20 text-transparent")
                              }
                            >
                              ✓
                            </span>
                          </div>
                        </div>

                        {item.details.length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            {item.details.map((detail, index) => (
                              <p
                                key={`${detail.label}-${detail.value}-${index}`}
                                className="text-[9px] leading-4 text-white/48"
                              >
                                <span className="font-bold text-white/65">
                                  {detail.label}:
                                </span>{" "}
                                {detail.value}
                              </p>
                            ))}
                          </div>
                        )}

                        {item.notes && (
                          <p className="mt-2 rounded-lg border border-[#e21a22]/20 bg-[#e21a22]/10 px-2.5 py-1.5 text-[9px] leading-4 text-white/70">
                            Nota: {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          ) : (
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-3 rounded-[18px] border border-emerald-400/15 bg-emerald-400/[0.07] px-3.5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-black text-white">
                  ✓
                </span>
                <div className="min-w-0">
                  <b className="block text-[11px] text-white">
                    Productos verificados
                  </b>
                  <p className="mt-0.5 text-[9px] leading-4 text-white/42">
                    {status === "READY"
                      ? "El pedido está listo para iniciar el domicilio."
                      : "Esperando que Cocina marque el pedido como Listo."}
                  </p>
                </div>
              </div>
            </div>
          )}

        </>
      )}

      {target && label && (
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/92 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-[640px]">
          {target === "OUT_FOR_DELIVERY" && canStartDelivery && (
            <div className="mb-2.5">
              <div className="grid grid-cols-3 gap-2">
                {DELIVERY_TRAVEL_MODE_OPTIONS.map((option) => {
                  const selected = travelMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setTravelMode(option.value);
                        setNotice("");
                      }}
                      className={
                        "rounded-[12px] border px-2 py-2 text-center transition " +
                        (selected
                          ? "border-[#e21a22] bg-[#e21a22]/15 text-white"
                          : "border-white/10 bg-white/[0.055] text-white/55")
                      }
                    >
                      <span className="mr-1 text-sm">{option.emoji}</span>
                      <b className="text-[9px]">{option.shortLabel}</b>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            ref={trackRef}
            className={
              "relative h-[62px] w-full overflow-hidden rounded-full border backdrop-blur-md " +
              (target === "OUT_FOR_DELIVERY" && (!canStartDelivery || !travelMode)
                ? "border-white/20 bg-white/70 shadow-[0_12px_30px_rgba(0,0,0,.22)]"
                : "landing-menu-slider border-white/80 bg-white/95 shadow-[0_16px_44px_rgba(0,0,0,.20)]")
            }
          >
          <div
            className="absolute inset-y-1 left-1 z-[1] rounded-full bg-[#e21a22]"
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
            <span
              className={
                "truncate text-[10px] font-black uppercase tracking-[0.11em] " +
                (target === "OUT_FOR_DELIVERY" && (!canStartDelivery || !travelMode)
                  ? "text-black/45"
                  : "landing-menu-slider-text text-black/75")
              }
            >
              {busy
                ? target === "CLAIM"
                  ? "Asignando..."
                  : "Actualizando..."
                : target === "OUT_FOR_DELIVERY" && !allChecked
                  ? "Completa productos"
                  : target === "OUT_FOR_DELIVERY" && !travelMode
                    ? "Elige cómo vas a entregar"
                    : label}
            </span>
          </div>

          <button
            type="button"
            aria-label={label}
            disabled={
              busy ||
              (target === "OUT_FOR_DELIVERY" &&
                (!canStartDelivery || !travelMode))
            }
            className={
              "absolute top-1 z-[4] flex h-[54px] w-[54px] touch-none select-none items-center justify-center rounded-full bg-black text-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[#e21a22] focus-visible:ring-offset-2 active:scale-[.98] disabled:cursor-not-allowed " +
              (target === "OUT_FOR_DELIVERY" && (!canStartDelivery || !travelMode)
                ? "opacity-55 shadow-[0_8px_18px_rgba(0,0,0,.24)]"
                : "landing-menu-slider-knob " +
                  (!dragging && progress === 0
                    ? "landing-menu-slider-knob-idle"
                    : ""))
            }
            style={{
              left: `calc(4px + (100% - 62px) * ${progress})`,
              transition: dragging
                ? "none"
                : "left 220ms cubic-bezier(.2,.8,.2,1)",
            }}
            onPointerDown={(event) => {
              if (
                busy ||
                (target === "OUT_FOR_DELIVERY" &&
                  (!canStartDelivery || !travelMode))
              ) {
                return;
              }
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
                !(
                  target === "OUT_FOR_DELIVERY" &&
                  (!canStartDelivery || !travelMode)
                )
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
                className={
                  "h-[22px] w-[22px] " +
                  (target === "OUT_FOR_DELIVERY" && !canStartDelivery
                    ? ""
                    : "landing-menu-slider-arrow")
                }
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
            <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-xs font-semibold text-white/80">
              {notice}
            </p>
          )}
        </div>
      </div>
      )}
    </section>
  );
}
