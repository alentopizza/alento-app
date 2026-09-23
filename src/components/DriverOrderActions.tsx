"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PresentedDetail } from "@/lib/orderPresentation";

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
  initialStatus,
  items,
}: {
  token: string;
  initialStatus: string;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const locationWatchRef = useRef<number | null>(null);
  const lastLocationSyncRef = useRef(0);

  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [locationState, setLocationState] = useState<
    "idle" | "requesting" | "active" | "error"
  >("idle");
  const [locationSnapshot, setLocationSnapshot] =
    useState<DriverLocationSnapshot | null>(null);
  const [locationError, setLocationError] = useState("");

  const locationStorageKey = `alento-driver-location-sharing:${token}`;

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (status !== "READY") {
      setCheckedIds([]);
      return;
    }

    setCheckedIds(items.filter((item) => item.verified).map((item) => item.id));
  }, [status, items]);

  useEffect(() => {
    return () => {
      if (locationWatchRef.current != null) {
        navigator.geolocation?.clearWatch(locationWatchRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (status === "ARRIVED" && locationWatchRef.current != null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
      setLocationState("idle");
      setLocationSnapshot(null);
      window.localStorage.removeItem(locationStorageKey);
    }
  }, [status, locationStorageKey]);

  useEffect(() => {
    if (status !== "READY" && status !== "OUT_FOR_DELIVERY") return;
    if (locationWatchRef.current != null) return;

    const shouldResume =
      window.localStorage.getItem(locationStorageKey) === "1";

    if (!shouldResume) return;

    if (navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((permission) => {
          if (
            permission.state === "granted" &&
            locationWatchRef.current == null
          ) {
            startLocationSharing();
          }
        })
        .catch(() => {
          startLocationSharing();
        });
      return;
    }

    startLocationSharing();
  }, [status, locationStorageKey]);

  const target =
    status === "READY"
      ? "OUT_FOR_DELIVERY"
      : status === "OUT_FOR_DELIVERY"
        ? "ARRIVED"
        : status === "ARRIVED"
          ? "DELIVERED"
          : null;

  const label =
    target === "OUT_FOR_DELIVERY"
      ? "Desliza para iniciar entrega"
      : target === "ARRIVED"
        ? "Desliza cuando hayas llegado"
        : target === "DELIVERED"
          ? "Desliza para entregar"
          : null;

  const allChecked = useMemo(
    () => items.length > 0 && items.every((item) => checkedIds.includes(item.id)),
    [items, checkedIds],
  );

  const locationActive =
    locationState === "active" &&
    locationSnapshot != null &&
    Date.now() - locationSnapshot.timestamp < 60_000;

  const canStartDelivery = allChecked && locationActive;

  const pendingItems = useMemo(
    () => items.filter((item) => !checkedIds.includes(item.id)),
    [items, checkedIds],
  );

  async function toggleItem(itemId: number) {
    if (busy || status !== "READY") return;

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

  function stopLocationSharing() {
    if (locationWatchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
    }
    locationWatchRef.current = null;
    setLocationState("idle");
    setLocationSnapshot(null);
    setLocationError("");
    window.localStorage.removeItem(locationStorageKey);
  }

  function startLocationSharing() {
    if (!navigator.geolocation) {
      setLocationState("error");
      setLocationError(
        "Este dispositivo o navegador no permite compartir ubicación.",
      );
      return;
    }

    if (locationWatchRef.current != null) return;

    setLocationState("requesting");
    setLocationError("");

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocationSnapshot({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        });
        setLocationState("active");
        setLocationError("");
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
        setLocationState("error");

        if (error.code === error.PERMISSION_DENIED) {
          setLocationError(
            "Debes permitir el acceso a la ubicación para iniciar el domicilio.",
          );
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError("No fue posible obtener tu ubicación actual.");
        } else {
          setLocationError(
            "La ubicación tardó demasiado. Intenta activarla nuevamente.",
          );
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

    if (next === "OUT_FOR_DELIVERY" && !locationActive) {
      setNotice(
        "Activa Compartir ubicación en tiempo real antes de iniciar el domicilio.",
      );
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
        window.localStorage.removeItem(locationStorageKey);
        router.replace("/repartidor");
        router.refresh();
        return;
      }

      setNotice(
        next === "OUT_FOR_DELIVERY"
          ? "Entrega iniciada. La ubicación sigue compartiéndose y el cliente fue notificado."
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

    if (target === "OUT_FOR_DELIVERY" && !canStartDelivery) {
      setProgress(0);
      setNotice(
        !allChecked
          ? "Completa la verificación del pedido antes de salir."
          : "Activa Compartir ubicación en tiempo real antes de salir.",
      );
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
    return null;
  }

  return (
    <section
      className={
        target === "OUT_FOR_DELIVERY" &&
        (pendingItems.length > 0 || !locationActive)
          ? "overflow-hidden rounded-[24px] border border-white/10 bg-[#101011] text-white shadow-[0_20px_55px_rgba(0,0,0,.32)]"
          : "contents"
      }
    >
      {target === "OUT_FOR_DELIVERY" && (
        <>
          {pendingItems.length > 0 && (
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
          )}

          {!locationActive && (
          <div className="border-b border-white/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.13em] text-[#ff454b]">
                  Ubicación
                </p>
              </div>

              <span
                className={
                  "shrink-0 rounded-full px-3 py-1.5 text-[9px] font-black uppercase " +
                  (locationActive
                    ? "bg-[#e21a22] text-white"
                    : locationState === "requesting"
                      ? "bg-white/10 text-white/65"
                      : "bg-white/[0.06] text-white/40")
                }
              >
                {locationActive
                  ? "Activa"
                  : locationState === "requesting"
                    ? "Activando"
                    : "Inactiva"}
              </span>
            </div>

            <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.045] p-3.5">
              <div className="flex items-center gap-3">
                <div
                  className={
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full " +
                    (locationActive
                      ? "bg-[#e21a22] text-white"
                      : "bg-white/10 text-white/55")
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                    <circle cx="12" cy="12" r="8" />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <b className="block text-[11px] text-white">
                    {locationActive
                      ? "Ubicación compartiéndose"
                      : "Ubicación requerida para salir"}
                  </b>
                  <p className="mt-0.5 text-[9px] leading-4 text-white/42">
                    {locationActive && locationSnapshot
                      ? `Precisión aproximada: ±${Math.round(locationSnapshot.accuracy)} m`
                      : "El navegador solicitará permiso para acceder a tu GPS."}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={busy || locationState === "requesting"}
                  onClick={
                    locationActive ? stopLocationSharing : startLocationSharing
                  }
                  className={
                    "h-10 shrink-0 rounded-xl px-3 text-[10px] font-black transition disabled:opacity-50 " +
                    (locationActive
                      ? "border border-white/10 bg-white/[0.06] text-white/65 hover:text-white"
                      : "bg-[#e21a22] text-white hover:bg-[#c9151c]")
                  }
                >
                  {locationState === "requesting"
                    ? "Activando..."
                    : locationActive
                      ? "Detener"
                      : "Activar"}
                </button>
              </div>

              {locationError && (
                <p className="mt-3 rounded-xl border border-[#e21a22]/25 bg-[#e21a22]/10 px-3 py-2.5 text-[10px] font-semibold leading-4 text-[#ff7a7e]">
                  {locationError}
                </p>
              )}
            </div>
          </div>
          )}
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/92 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-[640px]">
          <div
            ref={trackRef}
            className={
              "relative h-[62px] w-full overflow-hidden rounded-full border backdrop-blur-md " +
              (target === "OUT_FOR_DELIVERY" && !canStartDelivery
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
                (target === "OUT_FOR_DELIVERY" && !canStartDelivery
                  ? "text-black/45"
                  : "landing-menu-slider-text text-black/75")
              }
            >
              {busy
                ? "Actualizando..."
                : target === "OUT_FOR_DELIVERY" && !allChecked
                  ? "Completa productos"
                  : target === "OUT_FOR_DELIVERY" && !locationActive
                    ? "Activa ubicación"
                    : label}
            </span>
          </div>

          <button
            type="button"
            aria-label={label}
            disabled={
              busy || (target === "OUT_FOR_DELIVERY" && !canStartDelivery)
            }
            className={
              "absolute top-1 z-[4] flex h-[54px] w-[54px] touch-none select-none items-center justify-center rounded-full bg-black text-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[#e21a22] focus-visible:ring-offset-2 active:scale-[.98] disabled:cursor-not-allowed " +
              (target === "OUT_FOR_DELIVERY" && !canStartDelivery
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
                (target === "OUT_FOR_DELIVERY" && !canStartDelivery)
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
                !(target === "OUT_FOR_DELIVERY" && !canStartDelivery)
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
    </section>
  );
}
