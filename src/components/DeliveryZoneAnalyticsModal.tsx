"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, MapPin, Trophy } from "lucide-react";
import { createAlentoMapPinElement } from "@/lib/alentoMapMarker";
import {
  loadGoogleMapsClient,
  type GoogleMapsImportRuntime,
} from "@/lib/googleMapsClient";

const MAP_ID = "b0bfaae2809a720a6204509b";

type Point = {
  latitude: number;
  longitude: number;
};

type ZoneStat = {
  id: string;
  name: string;
  minMeters: number | null;
  maxMeters: number | null;
  configuredFee: number | null;
  current: boolean;
  orderCount: number;
  orderValue: number;
  paidAmount: number;
  deliveryRevenue: number;
  reconstructedCount: number;
  lastOrderAt: string | null;
  averageTicket: number;
  sharePercent: number;
};

type ZonePin = {
  orderId: number;
  code: string;
  zoneId: string | null;
  zoneName: string | null;
  latitude: number;
  longitude: number;
  address: string;
  customerName: string;
  status: string;
  createdAt: string;
  total: number;
  paidAmount: number;
  deliveryFee: number;
  distanceMeters: number | null;
  reconstructed: boolean;
};

type ZoneAnalyticsPayload = {
  range: { startDate: string; endDate: string };
  store:
    | (Point & {
        name: string;
        address: string;
      })
    | null;
  zones: ZoneStat[];
  pins: ZonePin[];
  summary: {
    totalOrders: number;
    classifiedOrders: number;
    unclassifiedOrders: number;
    unclassifiedValue: number;
    unclassifiedPaid: number;
    reconstructedOrders: number;
    totalOrderValue: number;
    totalPaidAmount: number;
    totalDeliveryRevenue: number;
    averageTicket: number;
    topZone:
      | {
          id: string;
          name: string;
          orders: number;
          sharePercent: number;
        }
      | null;
  };
};

type GoogleMapInstance = {
  fitBounds: (
    bounds: unknown,
    padding?:
      | number
      | { top: number; right: number; bottom: number; left: number },
  ) => void;
  setCenter: (point: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
};

type GoogleAdvancedMarker = {
  map: GoogleMapInstance | null;
  addListener?: (
    eventName: string,
    handler: () => void,
  ) => { remove?: () => void };
};

type GoogleCircle = {
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleBounds = {
  extend: (point: { lat: number; lng: number }) => void;
};

type GoogleMarkerLibrary = {
  AdvancedMarkerElement: new (options: {
    map: GoogleMapInstance;
    position: { lat: number; lng: number };
    title?: string;
    content?: Node;
    zIndex?: number;
  }) => GoogleAdvancedMarker;
};

type GoogleRuntime = GoogleMapsImportRuntime & {
  maps: GoogleMapsImportRuntime["maps"] & {
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => GoogleMapInstance;
    Circle: new (options: Record<string, unknown>) => GoogleCircle;
    LatLngBounds: new () => GoogleBounds;
  };
};

const ZONE_COLORS = [
  "#16a34a",
  "#f59e0b",
  "#e21a22",
  "#7c3aed",
  "#0284c7",
  "#db2777",
];

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateLabel(value: string | null) {
  if (!value) return "Sin pedidos";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function distanceLabel(meters: number | null) {
  if (meters == null) return "Sin distancia";
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

function todayBogotaText() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${map.year}-${map.month}-${map.day}`;
}

function monthStartBogotaText() {
  const today = todayBogotaText();
  return `${today.slice(0, 7)}-01`;
}

function createOrderPinElement(
  pin: ZonePin,
  color: string,
  selected: boolean,
) {
  const root = document.createElement("div");
  root.style.width = selected ? "34px" : "26px";
  root.style.height = selected ? "34px" : "26px";
  root.style.borderRadius = "999px";
  root.style.border = selected ? "3px solid white" : "2px solid white";
  root.style.background = color;
  root.style.boxShadow = selected
    ? "0 6px 18px rgba(0,0,0,.34)"
    : "0 4px 12px rgba(0,0,0,.24)";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.color = "white";
  root.style.fontSize = selected ? "9px" : "7px";
  root.style.fontWeight = "900";
  root.style.cursor = "pointer";
  root.style.transition = "transform .15s ease";
  root.textContent = pin.code.split("-").at(-1) ?? "•";
  return root;
}

export default function DeliveryZoneAnalyticsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleAdvancedMarker[]>([]);
  const circlesRef = useRef<GoogleCircle[]>([]);
  const [data, setData] = useState<ZoneAnalyticsPayload | null>(null);
  const [startDate, setStartDate] = useState(() => monthStartBogotaText());
  const [endDate, setEndDate] = useState(() => todayBogotaText());
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (from: string, to: string) => {
    if (!from || !to || from > to) {
      setError("Selecciona un rango de fechas válido.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/analytics/delivery-zones?startDate=${encodeURIComponent(from)}&endDate=${encodeURIComponent(to)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "No fue posible cargar las zonas de entrega.",
        );
      }

      setData(payload as ZoneAnalyticsPayload);
      setSelectedOrderId(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar las zonas de entrega.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const from = monthStartBogotaText();
    const to = todayBogotaText();
    setStartDate(from);
    setEndDate(to);
    void load(from, to);
  }, [load, open]);

  const selectedPin = useMemo(
    () =>
      selectedOrderId == null
        ? null
        : data?.pins.find((pin) => pin.orderId === selectedOrderId) ?? null,
    [data?.pins, selectedOrderId],
  );

  const zoneColorById = useMemo(() => {
    const map = new Map<string, string>();
    (data?.zones ?? []).forEach((zone, index) => {
      map.set(zone.id, ZONE_COLORS[index % ZONE_COLORS.length]);
    });
    return map;
  }, [data?.zones]);

  const drawMap = useCallback(
    async (payload: ZoneAnalyticsPayload) => {
      if (!mapHostRef.current) return;

      const google = await loadGoogleMapsClient<GoogleRuntime>();
      await google.maps.importLibrary("maps");
      const { AdvancedMarkerElement } =
        (await google.maps.importLibrary("marker")) as GoogleMarkerLibrary;

      const center = payload.store
        ? {
            lat: payload.store.latitude,
            lng: payload.store.longitude,
          }
        : payload.pins[0]
          ? {
              lat: payload.pins[0].latitude,
              lng: payload.pins[0].longitude,
            }
          : { lat: 4.6097, lng: -74.0817 };

      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(mapHostRef.current, {
          center,
          zoom: 13,
          mapId: MAP_ID,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
        });
      }

      markersRef.current.forEach((marker) => {
        marker.map = null;
      });
      markersRef.current = [];

      circlesRef.current.forEach((circle) => circle.setMap(null));
      circlesRef.current = [];

      const map = mapRef.current;
      const bounds = new google.maps.LatLngBounds();
      let pointCount = 0;

      if (payload.store) {
        const storePoint = {
          lat: payload.store.latitude,
          lng: payload.store.longitude,
        };

        const storeMarker = new AdvancedMarkerElement({
          map,
          position: storePoint,
          title: "Alentó Pizza",
          content: createAlentoMapPinElement(),
          zIndex: 80,
        });

        markersRef.current.push(storeMarker);
        bounds.extend(storePoint);
        pointCount += 1;

        const currentZones = payload.zones
          .filter(
            (zone) =>
              zone.current &&
              zone.maxMeters != null &&
              zone.maxMeters > 0,
          )
          .sort(
            (a, b) =>
              Number(b.maxMeters ?? 0) - Number(a.maxMeters ?? 0),
          );

        currentZones.forEach((zone) => {
          const color =
            zoneColorById.get(zone.id) ?? ZONE_COLORS[0];

          const circle = new google.maps.Circle({
            map,
            center: storePoint,
            radius: Number(zone.maxMeters),
            strokeColor: color,
            strokeOpacity: 0.85,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.055,
            clickable: false,
          });

          circlesRef.current.push(circle);
        });
      }

      payload.pins.forEach((pin) => {
        const point = { lat: pin.latitude, lng: pin.longitude };
        const color = pin.zoneId
          ? zoneColorById.get(pin.zoneId) ?? "#525252"
          : "#737373";
        const marker = new AdvancedMarkerElement({
          map,
          position: point,
          title: `${pin.code} · ${pin.customerName} · ${pin.zoneName || "Sin clasificar"}`,
          content: createOrderPinElement(
            pin,
            color,
            selectedOrderId === pin.orderId,
          ),
          zIndex: selectedOrderId === pin.orderId ? 90 : 35,
        });

        marker.addListener?.("click", () => {
          setSelectedOrderId(pin.orderId);
          map.setCenter(point);
        });

        markersRef.current.push(marker);
        bounds.extend(point);
        pointCount += 1;
      });

      if (pointCount > 1) {
        map.fitBounds(bounds, {
          top: 70,
          right: 70,
          bottom: 70,
          left: 70,
        });
      } else {
        map.setCenter(center);
        map.setZoom(14);
      }
    },
    [selectedOrderId, zoneColorById],
  );

  useEffect(() => {
    if (!open || !data) return;
    void drawMap(data).catch((drawError) => {
      setError(
        drawError instanceof Error
          ? drawError.message
          : "No fue posible dibujar el mapa.",
      );
    });
  }, [data, drawMap, open]);

  useEffect(() => {
    if (open) return;

    markersRef.current.forEach((marker) => {
      marker.map = null;
    });
    markersRef.current = [];
    circlesRef.current.forEach((circle) => circle.setMap(null));
    circlesRef.current = [];
    mapRef.current = null;
    setData(null);
    setSelectedOrderId(null);
    setError("");
  }, [open]);

  if (!open) return null;

  const showToday = () => {
    const today = todayBogotaText();
    setStartDate(today);
    setEndDate(today);
    void load(today, today);
  };

  const showMonth = () => {
    const from = monthStartBogotaText();
    const to = todayBogotaText();
    setStartDate(from);
    setEndDate(to);
    void load(from, to);
  };

  return (
    <div
      className="fixed inset-0 z-[165] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px] sm:p-5"
      onClick={onClose}
    >
      <div
        className="flex h-[94dvh] w-full max-w-[1600px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#f5f4f1] shadow-[0_30px_100px_rgba(0,0,0,.42)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-col gap-3 border-b border-white/10 bg-[radial-gradient(circle_at_90%_10%,rgba(226,26,34,.24),transparent_28%),linear-gradient(135deg,#09090a,#201113)] px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="alento-ui-label uppercase tracking-[0.16em] text-[#ff5a60]">
              Analítica de domicilios
            </p>
            <h2 className="alento-ui-title mt-1 text-white">
              Zonas de entrega
            </h2>
            <p className="alento-ui-micro mt-1 text-white/45">
              Pedidos, recaudo y concentración por zona.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              <MetricDark
                label="Pedidos"
                value={String(data?.summary.totalOrders ?? 0)}
              />
              <MetricDark
                label="Zona líder"
                value={data?.summary.topZone?.name ?? "—"}
                compact
              />
              <MetricDark
                label="Recibido"
                value={money(data?.summary.totalPaidAmount ?? 0)}
                compact
              />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-2xl text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Cerrar zonas de entrega"
            >
              ×
            </button>
          </div>
        </header>

        <div className="border-b border-neutral-200 bg-white px-3 py-2.5 sm:px-5">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <DateControl
                label="Desde"
                value={startDate}
                max={endDate}
                onChange={setStartDate}
              />
              <DateControl
                label="Hasta"
                value={endDate}
                min={startDate}
                onChange={setEndDate}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={showToday}
                className="alento-ui-control h-10 rounded-xl border border-neutral-200 bg-white px-3 text-neutral-700"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={showMonth}
                className="alento-ui-control h-10 rounded-xl border border-neutral-200 bg-white px-3 text-neutral-700"
              >
                Este mes
              </button>
              <button
                type="button"
                onClick={() => void load(startDate, endDate)}
                disabled={loading}
                className="alento-ui-control h-10 rounded-xl bg-neutral-950 px-4 text-white disabled:opacity-50"
              >
                {loading ? "Actualizando..." : "Aplicar"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
              <p className="alento-ui-micro text-red-700">{error}</p>
            </div>
          )}

          {data &&
            (data.summary.reconstructedOrders > 0 ||
              data.summary.unclassifiedOrders > 0) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {data.summary.reconstructedOrders > 0 && (
                  <span className="alento-ui-micro rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                    {data.summary.reconstructedOrders} pedidos antiguos
                    reconstruidos por distancia
                  </span>
                )}
                {data.summary.unclassifiedOrders > 0 && (
                  <span className="alento-ui-micro rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">
                    {data.summary.unclassifiedOrders} sin clasificar
                  </span>
                )}
              </div>
            )}
        </div>

        <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="relative min-h-[420px] bg-[#ecebe7]">
            <div ref={mapHostRef} className="absolute inset-0" />

            {selectedPin && (
              <div className="absolute bottom-4 right-4 z-30 w-[min(360px,calc(100%-2rem))] rounded-[18px] border border-white/20 bg-[#111]/95 p-3.5 text-white shadow-[0_18px_50px_rgba(0,0,0,.32)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="alento-ui-label uppercase text-[#ff5a60]">
                      Pedido
                    </p>
                    <h3 className="alento-ui-status mt-1">
                      {selectedPin.code}
                    </h3>
                    <p className="alento-ui-micro mt-1 truncate text-white/50">
                      {selectedPin.customerName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderId(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-white/60"
                    aria-label="Cerrar detalle"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MiniDark
                    label="Zona"
                    value={selectedPin.zoneName || "Sin clasificar"}
                  />
                  <MiniDark
                    label="Distancia"
                    value={distanceLabel(selectedPin.distanceMeters)}
                  />
                  <MiniDark
                    label="Pedido"
                    value={money(selectedPin.total)}
                  />
                  <MiniDark
                    label="Recibido"
                    value={money(selectedPin.paidAmount)}
                  />
                </div>

                <p className="alento-ui-micro mt-3 leading-4 text-white/45">
                  {selectedPin.address}
                </p>

                {selectedPin.reconstructed && (
                  <span className="alento-ui-micro mt-2 inline-flex rounded-full bg-blue-400/10 px-2 py-1 text-blue-200">
                    Zona reconstruida por distancia
                  </span>
                )}
              </div>
            )}

            {data?.zones.some(
              (zone) => zone.current && zone.maxMeters != null,
            ) && (
              <div className="absolute left-4 top-4 z-20 max-w-[calc(100%-2rem)] rounded-[16px] border border-white/20 bg-white/92 p-2 shadow-lg backdrop-blur">
                <div className="flex flex-wrap gap-1.5">
                  {data.zones
                    .filter(
                      (zone) =>
                        zone.current && zone.maxMeters != null,
                    )
                    .map((zone, index) => (
                      <span
                        key={zone.id}
                        className="alento-ui-micro inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-neutral-600"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            background:
                              zoneColorById.get(zone.id) ??
                              ZONE_COLORS[index % ZONE_COLORS.length],
                          }}
                        />
                        {zone.name} · {zone.orderCount}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>

          <aside className="min-h-0 overflow-y-auto border-l border-neutral-200 bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              <MetricLight
                label="Ventas"
                value={money(data?.summary.totalOrderValue ?? 0)}
              />
              <MetricLight
                label="Domicilios"
                value={money(data?.summary.totalDeliveryRevenue ?? 0)}
              />
              <MetricLight
                label="Ticket promedio"
                value={money(data?.summary.averageTicket ?? 0)}
              />
              <MetricLight
                label="Clasificados"
                value={String(data?.summary.classifiedOrders ?? 0)}
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="alento-ui-label uppercase text-neutral-400">
                  Ranking
                </p>
                <h3 className="alento-ui-status mt-0.5 text-neutral-950">
                  Pedidos por zona
                </h3>
              </div>
              <Trophy className="h-4 w-4 text-[var(--brand-red)]" />
            </div>

            <div className="mt-2 space-y-2">
              {(data?.zones ?? []).map((zone, index) => (
                <article
                  key={zone.id}
                  className="rounded-[16px] border border-neutral-200 bg-[#faf9f7] p-3"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 h-9 w-2 shrink-0 rounded-full"
                      style={{
                        background:
                          zoneColorById.get(zone.id) ??
                          ZONE_COLORS[index % ZONE_COLORS.length],
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="alento-ui-control truncate font-bold text-neutral-950">
                          {zone.name}
                        </h4>
                        {index === 0 && zone.orderCount > 0 && (
                          <span className="alento-ui-micro shrink-0 rounded-full bg-red-50 px-2 py-1 font-bold text-[var(--brand-red)]">
                            Más pedidos
                          </span>
                        )}
                      </div>
                      <p className="alento-ui-micro mt-0.5 text-neutral-400">
                        {zone.current
                          ? zone.minMeters != null &&
                            zone.maxMeters != null
                            ? `${distanceLabel(zone.minMeters)} → ${distanceLabel(zone.maxMeters)}`
                            : "Zona actual"
                          : "Zona histórica"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <ZoneMini
                      label="Pedidos"
                      value={String(zone.orderCount)}
                    />
                    <ZoneMini
                      label="Participación"
                      value={`${zone.sharePercent.toLocaleString(
                        "es-CO",
                        { maximumFractionDigits: 1 },
                      )}%`}
                    />
                    <ZoneMini
                      label="Recibido"
                      value={money(zone.paidAmount)}
                    />
                  </div>

                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    <ZoneMini
                      label="Ventas"
                      value={money(zone.orderValue)}
                    />
                    <ZoneMini
                      label="Domicilios"
                      value={money(zone.deliveryRevenue)}
                    />
                    <ZoneMini
                      label="Ticket"
                      value={money(zone.averageTicket)}
                    />
                  </div>

                  <p className="alento-ui-micro mt-2 text-neutral-400">
                    Último pedido: {dateLabel(zone.lastOrderAt)}
                    {zone.reconstructedCount > 0
                      ? ` · ${zone.reconstructedCount} reconstruidos`
                      : ""}
                  </p>
                </article>
              ))}
            </div>

            {data?.summary.unclassifiedOrders ? (
              <div className="mt-2 rounded-[14px] border border-amber-200 bg-amber-50 p-3">
                <p className="alento-ui-label uppercase text-amber-700">
                  Sin clasificar
                </p>
                <p className="alento-ui-micro mt-1 text-amber-900">
                  {data.summary.unclassifiedOrders} pedidos ·{" "}
                  {money(data.summary.unclassifiedPaid)} recibido
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

function MetricDark({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        "flex h-[54px] flex-col items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.06] px-3 text-center " +
        (compact ? "min-w-[105px]" : "min-w-[74px]")
      }
    >
      <span className="alento-ui-micro uppercase text-white/35">
        {label}
      </span>
      <b className="alento-ui-control mt-0.5 max-w-[140px] truncate text-white">
        {value}
      </b>
    </div>
  );
}

function MetricLight({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[14px] border border-neutral-200 bg-[#faf9f7] px-3 py-2.5">
      <span className="alento-ui-micro uppercase text-neutral-400">
        {label}
      </span>
      <b className="alento-ui-control mt-1 block truncate text-neutral-950">
        {value}
      </b>
    </div>
  );
}

function DateControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-[170px]">
      <span className="alento-ui-label mb-1 block text-neutral-400">
        {label}
      </span>
      <div className="flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3">
        <CalendarDays className="h-4 w-4 text-neutral-400" strokeWidth={2} />
        <input
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value)}
          className="alento-ui-control min-w-0 bg-transparent outline-none"
        />
      </div>
    </label>
  );
}

function MiniDark({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] px-2.5 py-2">
      <span className="alento-ui-micro uppercase text-white/28">
        {label}
      </span>
      <b className="alento-ui-control mt-0.5 block truncate text-white">
        {value}
      </b>
    </div>
  );
}

function ZoneMini({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[10px] border border-neutral-100 bg-white px-2 py-1.5">
      <span className="alento-ui-micro block truncate uppercase text-neutral-400">
        {label}
      </span>
      <b className="alento-ui-micro mt-0.5 block truncate font-bold text-neutral-900">
        {value}
      </b>
    </div>
  );
}
