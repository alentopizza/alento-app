"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAlentoMapPinElement,
  createDeliveryMapPinElement,
  createDriverMapPinElement,
} from "@/lib/alentoMapMarker";

const MAP_ID = "b0bfaae2809a720a6204509b";
const ROUTE_COLORS = [
  "#e21a22",
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#ea580c",
];

type Point = {
  latitude: number;
  longitude: number;
};

type MapStore = Point & {
  name: string;
  address: string;
};

type MapDriver = Point & {
  id: number;
  name: string;
  available: boolean;
  accuracy: number | null;
  updatedAt: string | null;
};

type MapRoute = {
  distanceMeters: number;
  durationSeconds: number | null;
  encodedPolyline: string;
};

type MapOrder = {
  id: number;
  code: string;
  status: string;
  createdAt: string;
  customerName: string;
  destination: (Point & { address: string }) | null;
  driver:
    | {
        id: number;
        name: string;
        available: boolean;
        latitude: number | null;
        longitude: number | null;
        accuracy: number | null;
        updatedAt: string | null;
      }
    | null;
  route: MapRoute | null;
};

type MapPayload = {
  updatedAt: string;
  store: MapStore | null;
  drivers: MapDriver[];
  orders: MapOrder[];
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

type GooglePolyline = {
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleBounds = {
  extend: (point: { lat: number; lng: number }) => void;
};

type GoogleRuntime = {
  maps: {
    importLibrary: (name: string) => Promise<unknown>;
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => GoogleMapInstance;
    Polyline: new (options: Record<string, unknown>) => GooglePolyline;
    LatLngBounds: new () => GoogleBounds;
    geometry?: {
      encoding?: {
        decodePath: (
          encoded: string,
        ) => Array<{ lat: () => number; lng: () => number }>;
      };
    };
  };
};

function getGoogle() {
  return (window as typeof window & { google?: GoogleRuntime }).google;
}

function installGoogleMaps(key: string) {
  if (getGoogle()?.maps?.importLibrary) return;

  const id = "alento-admin-delivery-map-google";
  if (document.getElementById(id)) return;

  const script = document.createElement("script");
  script.id = id;
  script.textContent = `
    (g=>{
      var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",
        q="__ib__",m=document,b=window;
      b=b[c]||(b[c]={});
      var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,
        u=()=>h||(h=new Promise(async(f,n)=>{
          await (a=m.createElement("script"));
          e.set("libraries",[...r]+"");
          for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);
          e.set("callback",c+"."+ "maps" +"."+q);
          a.src="https://maps."+c+"apis.com/maps/api/js?"+e;
          d[q]=f;
          a.onerror=()=>h=n(Error(p+" could not load."));
          a.nonce=m.querySelector("script[nonce]")?.nonce||"";
          m.head.append(a)
        }));
      d[l]
        ? console.warn(p+" only loads once. Ignoring:",g)
        : d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))
    })({
      key: "__KEY__",
      v: "weekly",
      language: "es",
      region: "CO"
    });
  `.replace('"__KEY__"', JSON.stringify(key));

  document.head.appendChild(script);
}

async function loadGoogleMaps() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new Error("Google Maps no está configurado.");

  installGoogleMaps(key);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const runtime = getGoogle();
    if (runtime?.maps?.importLibrary) return runtime;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  throw new Error("No fue posible iniciar Google Maps.");
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    CONFIRMED: "Confirmado",
    PREPARING: "Preparando",
    PREPARED: "Horneando",
    READY: "Listo",
    OUT_FOR_DELIVERY: "En camino",
    ARRIVED: "Llegó",
  };
  return labels[status] ?? status;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function formatDistance(meters: number) {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

export default function AdminDeliveryMapModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleAdvancedMarker[]>([]);
  const routesRef = useRef<GooglePolyline[]>([]);
  const initialFitRef = useRef(false);
  const colorByDriverRef = useRef<Map<number, string>>(new Map());

  const [data, setData] = useState<MapPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const colorForDriver = useCallback((driverId: number) => {
    const existing = colorByDriverRef.current.get(driverId);
    if (existing) return existing;

    const color =
      ROUTE_COLORS[colorByDriverRef.current.size % ROUTE_COLORS.length];
    colorByDriverRef.current.set(driverId, color);
    return color;
  }, []);

  const mergePayload = useCallback((next: MapPayload) => {
    setData((current) => {
      const previousRoutes = new Map(
        (current?.orders ?? []).map((order) => [order.id, order.route]),
      );

      return {
        ...next,
        orders: next.orders.map((order) => ({
          ...order,
          route:
            order.status === "OUT_FOR_DELIVERY"
              ? order.route ?? previousRoutes.get(order.id) ?? null
              : null,
        })),
      };
    });
  }, []);

  const load = useCallback(
    async (includeRoutes: boolean, silent = false) => {
      if (!silent) setLoading(true);

      try {
        const response = await fetch(
          `/api/orders/delivery-map${includeRoutes ? "?routes=1" : ""}`,
          { cache: "no-store" },
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload.error || "No fue posible cargar el mapa de entregas.",
          );
        }

        mergePayload(payload as MapPayload);
        setError("");
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar el mapa de entregas.",
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [mergePayload],
  );

  useEffect(() => {
    if (!open) return;

    initialFitRef.current = false;
    colorByDriverRef.current.clear();
    void load(true);

    const locationTimer = window.setInterval(() => {
      void load(false, true);
    }, 5000);

    const routeTimer = window.setInterval(() => {
      void load(true, true);
    }, 15000);

    return () => {
      window.clearInterval(locationTimer);
      window.clearInterval(routeTimer);
    };
  }, [load, open]);

  const drawMap = useCallback(
    async (payload: MapPayload) => {
      if (!mapHostRef.current) return;

      const google = await loadGoogleMaps();
      await google.maps.importLibrary("maps");
      await google.maps.importLibrary("geometry");
      const { AdvancedMarkerElement } =
        (await google.maps.importLibrary("marker")) as GoogleMarkerLibrary;

      if (!mapRef.current) {
        const center = payload.store
          ? {
              lat: payload.store.latitude,
              lng: payload.store.longitude,
            }
          : payload.orders.find((order) => order.destination)?.destination
            ? {
                lat: payload.orders.find((order) => order.destination)!
                  .destination!.latitude,
                lng: payload.orders.find((order) => order.destination)!
                  .destination!.longitude,
              }
            : { lat: 4.6097, lng: -74.0817 };

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

      routesRef.current.forEach((route) => route.setMap(null));
      routesRef.current = [];

      const map = mapRef.current;
      const bounds = new google.maps.LatLngBounds();
      let points = 0;

      if (payload.store) {
        const point = {
          lat: payload.store.latitude,
          lng: payload.store.longitude,
        };
        const marker = new AdvancedMarkerElement({
          map,
          position: point,
          title: "Alentó Pizza",
          content: createAlentoMapPinElement(),
          zIndex: 40,
        });
        markersRef.current.push(marker);
        bounds.extend(point);
        points += 1;
      }

      payload.orders.forEach((order) => {
        if (!order.destination) return;

        const point = {
          lat: order.destination.latitude,
          lng: order.destination.longitude,
        };

        const marker = new AdvancedMarkerElement({
          map,
          position: point,
          title: `${order.code} · ${order.customerName} · ${formatStatus(
            order.status,
          )}`,
          content: createDeliveryMapPinElement(order.code),
          zIndex: order.status === "OUT_FOR_DELIVERY" ? 35 : 25,
        });
        markersRef.current.push(marker);
        bounds.extend(point);
        points += 1;
      });

      payload.drivers.forEach((driver) => {
        const point = {
          lat: driver.latitude,
          lng: driver.longitude,
        };

        const marker = new AdvancedMarkerElement({
          map,
          position: point,
          title: driver.name,
          content: createDriverMapPinElement(),
          zIndex: 50,
        });
        markersRef.current.push(marker);
        bounds.extend(point);
        points += 1;
      });

      payload.orders.forEach((order) => {
        if (
          order.status !== "OUT_FOR_DELIVERY" ||
          !order.driver ||
          !order.route?.encodedPolyline ||
          !google.maps.geometry?.encoding?.decodePath
        ) {
          return;
        }

        const path = google.maps.geometry.encoding.decodePath(
          order.route.encodedPolyline,
        );
        const color = colorForDriver(order.driver.id);

        const polyline = new google.maps.Polyline({
          map,
          path,
          strokeColor: color,
          strokeOpacity: 0.95,
          strokeWeight: 6,
          geodesic: true,
        });
        routesRef.current.push(polyline);

        path.forEach((point) =>
          bounds.extend({ lat: point.lat(), lng: point.lng() }),
        );
      });

      if (!initialFitRef.current && points > 0) {
        initialFitRef.current = true;
        if (points > 1) {
          map.fitBounds(bounds, {
            top: 90,
            right: 70,
            bottom: 90,
            left: 70,
          });
        }
      }
    },
    [colorForDriver],
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
    routesRef.current.forEach((route) => route.setMap(null));
    routesRef.current = [];
    mapRef.current = null;
    setData(null);
    setError("");
  }, [open]);

  const inRoute = useMemo(
    () =>
      (data?.orders ?? []).filter(
        (order) =>
          order.status === "OUT_FOR_DELIVERY" &&
          order.driver &&
          order.route,
      ),
    [data],
  );

  const routeLegend = useMemo(() => {
    const unique = new Map<
      number,
      { id: number; name: string; color: string; orders: string[] }
    >();

    inRoute.forEach((order) => {
      if (!order.driver) return;
      const current = unique.get(order.driver.id);
      if (current) {
        current.orders.push(order.code);
        return;
      }

      unique.set(order.driver.id, {
        id: order.driver.id,
        name: order.driver.name,
        color: colorForDriver(order.driver.id),
        orders: [order.code],
      });
    });

    return [...unique.values()];
  }, [colorForDriver, inRoute]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[4px] sm:p-5"
      onClick={onClose}
    >
      <div
        className="flex h-[92dvh] w-full max-w-[1500px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0b0c] shadow-[0_30px_100px_rgba(0,0,0,.42)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-col gap-3 border-b border-white/10 bg-[radial-gradient(circle_at_90%_10%,rgba(226,26,34,.22),transparent_28%),linear-gradient(135deg,#09090a,#171516)] px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ff5a60]">
              Operación en vivo
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]">
              Mapa De Entregas
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-center">
                <span className="block text-[7px] font-black uppercase tracking-[.08em] text-white/35">
                  Entregas
                </span>
                <b className="mt-0.5 block text-sm">
                  {data?.orders.filter((order) => order.destination).length ?? 0}
                </b>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-center">
                <span className="block text-[7px] font-black uppercase tracking-[.08em] text-white/35">
                  Repartidores
                </span>
                <b className="mt-0.5 block text-sm">
                  {data?.drivers.length ?? 0}
                </b>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-center">
                <span className="block text-[7px] font-black uppercase tracking-[.08em] text-white/35">
                  En camino
                </span>
                <b className="mt-0.5 block text-sm">{inRoute.length}</b>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-2xl text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Cerrar mapa de entregas"
            >
              ×
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 bg-[#ecebe7]">
          <div ref={mapHostRef} className="absolute inset-0" />

          {routeLegend.length > 0 && (
            <div className="absolute bottom-4 left-4 z-20 max-w-[calc(100%-2rem)] rounded-[18px] border border-white/15 bg-[#111]/94 p-2.5 text-white shadow-xl backdrop-blur-xl">
              <p className="px-1 text-[7px] font-black uppercase tracking-[.12em] text-white/35">
                Rutas en camino
              </p>
              <div className="mt-2 flex max-w-[760px] flex-wrap gap-1.5">
                {routeLegend.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-2.5 py-1.5"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <b className="text-[9px]">{item.name}</b>
                    <span className="text-[8px] text-white/40">
                      {item.orders.join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && !data && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/25 text-sm font-bold text-white backdrop-blur-sm">
              Cargando mapa de entregas…
            </div>
          )}

          {error && (
            <div className="absolute left-4 right-4 top-4 z-30 rounded-[16px] border border-red-200 bg-white/95 px-4 py-3 text-[11px] font-semibold text-red-700 shadow-xl backdrop-blur-md">
              {error}
            </div>
          )}

          {!loading &&
            data &&
            data.orders.filter((order) => order.destination).length === 0 &&
            data.drivers.length === 0 && (
              <div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center">
                <div className="rounded-[20px] border border-black/10 bg-white/95 px-6 py-5 shadow-xl">
                  <b className="text-sm text-neutral-900">
                    No hay entregas activas en el mapa
                  </b>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Los nuevos domicilios y repartidores activos aparecerán aquí automáticamente.
                  </p>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
