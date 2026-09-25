"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAlentoMapPinElement,
  createDeliveryClusterPinElement,
  createDeliveryMapPinElement,
  createDeliveryRouteStopPinElement,
  createDriverMapPinElement,
} from "@/lib/alentoMapMarker";
import {
  groupDeliveryLocations,
  spreadDeliveryClusterPoint,
} from "@/lib/deliveryMapClusters";
import {
  deliveryTravelModeColor,
  deliveryTravelModeLabel,
  type DeliveryTravelMode,
} from "@/lib/deliveryTravelMode";

const MAP_ID = "b0bfaae2809a720a6204509b";

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
  distanceFromStoreMeters: number | null;
  durationFromStoreSeconds: number | null;
};

type MapTripStop = {
  orderId: number;
  code: string;
  customerName: string;
  stopNumber: number;
  travelMode: DeliveryTravelMode;
  destination: Point & { address: string };
};

type MapTripLeg = {
  stopNumber: number;
  orderId: number;
  code: string;
  distanceMeters: number;
  durationSeconds: number | null;
  encodedPolyline: string;
  travelMode: DeliveryTravelMode;
  routeTravelMode: DeliveryTravelMode;
  fallbackToVehicle: boolean;
};

type MapTrip = {
  driverId: number;
  driverName: string;
  origin: Point;
  stops: MapTripStop[];
  legs: MapTripLeg[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
};

type MapOrder = {
  id: number;
  code: string;
  status: string;
  createdAt: string;
  customerName: string;
  total: number;
  deliveryFee: number;
  deliveryTravelMode: DeliveryTravelMode | null;
  paidAmount: number;
  balance: number;
  itemCount: number;
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
};

type AssignableDriver = {
  id: number;
  name: string;
  available: boolean;
  ready: boolean;
  assignedDeliveries: number;
  maxConcurrentDeliveries: number;
  capacityReached: boolean;
};

type MapPayload = {
  updatedAt: string;
  store: MapStore | null;
  drivers: MapDriver[];
  assignableDrivers: AssignableDriver[];
  orders: MapOrder[];
  trips: MapTrip[];
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

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
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
  const [data, setData] = useState<MapPayload | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [expandedLocationCluster, setExpandedLocationCluster] =
    useState<string | null>(null);
  const [selectedAssignDriverId, setSelectedAssignDriverId] =
    useState<number | null>(null);
  const [assigningOrderId, setAssigningOrderId] = useState<number | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mergePayload = useCallback((next: MapPayload) => {
    setData((current) => {
      if (!current) return next;

      const previousTrips = new Map(
        current.trips.map((trip) => [trip.driverId, trip]),
      );

      const previousDrivers = new Map(
        current.drivers.map((driver) => [driver.id, driver]),
      );

      return {
        ...next,
        drivers: next.drivers.map((driver) => {
          if (
            driver.distanceFromStoreMeters != null ||
            driver.durationFromStoreSeconds != null
          ) {
            return driver;
          }

          const previous = previousDrivers.get(driver.id);
          return previous
            ? {
                ...driver,
                distanceFromStoreMeters: previous.distanceFromStoreMeters,
                durationFromStoreSeconds: previous.durationFromStoreSeconds,
              }
            : driver;
        }),
        trips: next.trips.map((trip) => {
          if (trip.legs.length > 0) return trip;

          const previous = previousTrips.get(trip.driverId);
          if (!previous) return trip;

          const sameStops =
            previous.stops.map((stop) => stop.orderId).join(",") ===
            trip.stops.map((stop) => stop.orderId).join(",");

          return sameStops
            ? {
                ...trip,
                legs: previous.legs,
                totalDistanceMeters: previous.totalDistanceMeters,
                totalDurationSeconds: previous.totalDurationSeconds,
              }
            : trip;
        }),
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

      const routeStopByOrder = new Map<
        number,
        { stopNumber: number; color: string; driverName: string }
      >();

      payload.trips.forEach((trip) => {
        trip.stops.forEach((stop) => {
          routeStopByOrder.set(stop.orderId, {
            stopNumber: stop.stopNumber,
            color: deliveryTravelModeColor(stop.travelMode),
            driverName: trip.driverName,
          });
        });
      });

      const ordersWithDestination = payload.orders.filter(
        (
          order,
        ): order is MapOrder & {
          destination: Point & { address: string };
        } => order.destination != null,
      );
      const locationClusters = groupDeliveryLocations(
        ordersWithDestination,
        (order) => ({
          latitude: order.destination.latitude,
          longitude: order.destination.longitude,
        }),
        (order) => order.id,
      );

      const drawOrderMarker = (
        order: MapOrder & {
          destination: Point & { address: string };
        },
        point: { lat: number; lng: number },
        expanded = false,
      ) => {
        const routeStop = routeStopByOrder.get(order.id);
        const assigned = order.driver != null;
        const marker = new AdvancedMarkerElement({
          map,
          position: point,
          title: routeStop
            ? `Parada ${routeStop.stopNumber} · ${order.code} · ${order.customerName} · ${routeStop.driverName}`
            : assigned
              ? `${order.code} · ${order.customerName} · Asignado a ${order.driver!.name} · ${formatStatus(
                  order.status,
                )}`
              : `${order.code} · ${order.customerName} · Disponible · ${formatStatus(
                  order.status,
                )}`,
          content: routeStop
            ? createDeliveryRouteStopPinElement(
                order.code,
                routeStop.stopNumber,
                routeStop.color,
                { tone: "assigned" },
              )
            : createDeliveryMapPinElement(
                order.code,
                assigned ? { tone: "assigned" } : undefined,
              ),
          zIndex:
            selectedOrderId === order.id
              ? 72
              : expanded
                ? 64
                : routeStop
                  ? 38
                  : assigned
                    ? 32
                    : 25,
        });

        marker.addListener?.("click", () => {
          setSelectedOrderId(order.id);
          setSelectedDriverId(null);
          setSelectedAssignDriverId(order.driver?.id ?? null);
          setActionNotice(null);
        });

        markersRef.current.push(marker);
      };

      locationClusters.forEach((cluster) => {
        const centerPoint = {
          lat: cluster.center.latitude,
          lng: cluster.center.longitude,
        };

        bounds.extend(centerPoint);
        points += 1;

        if (cluster.items.length === 1) {
          drawOrderMarker(cluster.items[0], centerPoint);
          return;
        }

        const assignedCount = cluster.items.filter(
          (order) => order.driver != null,
        ).length;
        const tone =
          assignedCount === cluster.items.length
            ? "assigned"
            : assignedCount > 0
              ? "mixed"
              : "default";
        const clusterMarker = new AdvancedMarkerElement({
          map,
          position: centerPoint,
          title: `${cluster.items.length} pedidos en esta ubicación · ${cluster.items
            .map((order) => order.code)
            .join(" · ")}`,
          content: createDeliveryClusterPinElement(cluster.items.length, {
            tone,
          }),
          zIndex: 58,
        });

        clusterMarker.addListener?.("click", () => {
          setExpandedLocationCluster((current) =>
            current === cluster.key ? null : cluster.key,
          );
          setSelectedOrderId(null);
          setSelectedDriverId(null);
          setSelectedAssignDriverId(null);
          setActionNotice(null);
          map.setCenter(centerPoint);
          map.setZoom(18);
        });

        markersRef.current.push(clusterMarker);

        if (expandedLocationCluster !== cluster.key) return;

        cluster.items.forEach((order, index) => {
          const spreadPoint = spreadDeliveryClusterPoint(
            cluster.center,
            index,
            cluster.items.length,
          );
          drawOrderMarker(
            order,
            {
              lat: spreadPoint.latitude,
              lng: spreadPoint.longitude,
            },
            true,
          );
        });
      });

      payload.drivers.forEach((driver) => {
        const point = {
          lat: driver.latitude,
          lng: driver.longitude,
        };

        const marker = new AdvancedMarkerElement({
          map,
          position: point,
          title: `${driver.name} · Ver información`,
          content: createDriverMapPinElement({ label: driver.name }),
          zIndex: selectedDriverId === driver.id ? 65 : 50,
        });

        marker.addListener?.("click", () => {
          setSelectedDriverId(driver.id);
          setSelectedOrderId(null);
          setSelectedAssignDriverId(null);
          setActionNotice(null);
        });

        markersRef.current.push(marker);
        bounds.extend(point);
        points += 1;
      });

      payload.trips.forEach((trip) => {
        if (!google.maps.geometry?.encoding?.decodePath) return;

        trip.legs.forEach((leg) => {
          if (!leg.encodedPolyline) return;

          const path = google.maps.geometry!.encoding!.decodePath(
            leg.encodedPolyline,
          );
          const color = deliveryTravelModeColor(leg.travelMode);

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
    [
      expandedLocationCluster,
      selectedDriverId,
      selectedOrderId,
    ],
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
    setSelectedDriverId(null);
    setSelectedOrderId(null);
    setExpandedLocationCluster(null);
    setSelectedAssignDriverId(null);
    setAssigningOrderId(null);
    setActionNotice(null);
    setError("");
  }, [open]);

  const inRoute = useMemo(
    () =>
      (data?.orders ?? []).filter(
        (order) => order.status === "OUT_FOR_DELIVERY",
      ),
    [data],
  );

  const routeLegend = useMemo(
    () =>
      (data?.trips ?? []).map((trip) => ({
        id: trip.driverId,
        name: trip.driverName,
        stops: trip.stops.map((stop) => ({
          ...stop,
          color: deliveryTravelModeColor(stop.travelMode),
        })),
        distanceMeters: trip.totalDistanceMeters,
        durationSeconds: trip.totalDurationSeconds,
      })),
    [data],
  );

  const selectedDriver = useMemo(
    () =>
      selectedDriverId == null
        ? null
        : data?.drivers.find((driver) => driver.id === selectedDriverId) ?? null,
    [data?.drivers, selectedDriverId],
  );

  const selectedDriverTrip = useMemo(
    () =>
      selectedDriverId == null
        ? null
        : data?.trips.find((trip) => trip.driverId === selectedDriverId) ?? null,
    [data?.trips, selectedDriverId],
  );

  const selectedDriverOrders = useMemo(
    () =>
      selectedDriverId == null
        ? []
        : (data?.orders ?? []).filter(
            (order) => order.driver?.id === selectedDriverId,
          ),
    [data?.orders, selectedDriverId],
  );

  const selectedOrder = useMemo(
    () =>
      selectedOrderId == null
        ? null
        : data?.orders.find((order) => order.id === selectedOrderId) ?? null,
    [data?.orders, selectedOrderId],
  );

  async function assignSelectedOrder() {
    if (
      !selectedOrder ||
      !selectedAssignDriverId ||
      assigningOrderId === selectedOrder.id
    ) {
      return;
    }

    setAssigningOrderId(selectedOrder.id);
    setActionNotice(null);

    try {
      const response = await fetch(
        `/api/orders/${selectedOrder.id}/driver`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driverId: selectedAssignDriverId }),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "No fue posible asignar el repartidor.",
        );
      }

      const driverName =
        data?.assignableDrivers.find(
          (driver) => driver.id === selectedAssignDriverId,
        )?.name ?? "El repartidor";

      setActionNotice({
        tone: payload.notification?.ok === false ? "error" : "success",
        message:
          payload.notification?.ok === false
            ? `${driverName} quedó asignado, pero la notificación no pudo enviarse.`
            : `${driverName} quedó asignado a ${selectedOrder.code}.`,
      });

      await load(true, true);
    } catch (assignmentError) {
      setActionNotice({
        tone: "error",
        message:
          assignmentError instanceof Error
            ? assignmentError.message
            : "No fue posible asignar el repartidor.",
      });
    } finally {
      setAssigningOrderId(null);
    }
  }

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

          <div className="pointer-events-none absolute left-4 top-4 z-20 space-y-1.5">
            <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-[#111]/92 px-2.5 py-2 text-white shadow-lg backdrop-blur-xl">
              <span className="inline-flex items-center gap-1.5 rounded-full px-1.5 text-[8px] font-black uppercase tracking-[0.05em] text-white/70">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,.45)]" />
                Asignado
              </span>
              <span className="h-4 w-px bg-white/10" />
              <span className="inline-flex items-center gap-1.5 rounded-full px-1.5 text-[8px] font-black uppercase tracking-[0.05em] text-white/70">
                <span className="h-2.5 w-2.5 rounded-full bg-[#e21a22] shadow-[0_0_8px_rgba(226,26,34,.40)]" />
                Disponible
              </span>
            </div>

            {routeLegend.length > 0 && (
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-[#111]/92 px-3 py-2 text-[8px] font-black text-white/62 shadow-lg backdrop-blur-xl">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-4 rounded-full bg-[#2563eb]" />
                  Pie
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-4 rounded-full bg-[#e21a22]" />
                  Moto
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-4 rounded-full bg-[#f59e0b]" />
                  Vehículo
                </span>
              </div>
            )}
          </div>

          {selectedDriver && (
            <div className="absolute right-4 top-4 z-30 max-h-[calc(100%-2rem)] w-[min(380px,calc(100%-2rem))] overflow-y-auto rounded-[22px] border border-white/15 bg-[#111]/95 text-white shadow-[0_20px_55px_rgba(0,0,0,.34)] backdrop-blur-xl">
              <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white text-[22px] shadow-lg">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111]">
                    🛵
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[7px] font-black uppercase tracking-[.13em] text-[#ff5a60]">
                    Repartidor en vivo
                  </p>
                  <h3 className="mt-1 truncate text-[17px] font-black leading-5">
                    {selectedDriver.name}
                  </h3>
                  <p className="mt-1 text-[9px] font-semibold text-emerald-300">
                    {selectedDriverTrip?.stops.length
                      ? "En ruta"
                      : selectedDriverOrders.length > 0
                        ? "Activo · pedido asignado"
                        : "Activo · sin pedidos"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDriverId(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-base text-white/55 transition hover:bg-white/10 hover:text-white"
                  aria-label="Cerrar información del repartidor"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-2 divide-x divide-white/10 border-b border-white/10">
                <div className="px-4 py-3">
                  <span className="block text-[7px] font-black uppercase tracking-[.08em] text-white/32">
                    Distancia a Alentó
                  </span>
                  <b className="mt-1 block text-[17px] tabular-nums">
                    {selectedDriver.distanceFromStoreMeters != null
                      ? formatDistance(selectedDriver.distanceFromStoreMeters)
                      : "Calculando…"}
                  </b>
                </div>
                <div className="px-4 py-3">
                  <span className="block text-[7px] font-black uppercase tracking-[.08em] text-white/32">
                    Tiempo a Alentó
                  </span>
                  <b className="mt-1 block text-[17px] tabular-nums">
                    {selectedDriver.durationFromStoreSeconds != null
                      ? formatDuration(selectedDriver.durationFromStoreSeconds)
                      : "Calculando…"}
                  </b>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5">
                  <span className="block text-[7px] font-black uppercase tracking-[.08em] text-white/28">
                    Pedidos asignados
                  </span>
                  <b className="mt-1 block text-sm">
                    {selectedDriverOrders.length}
                  </b>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5">
                  <span className="block text-[7px] font-black uppercase tracking-[.08em] text-white/28">
                    GPS
                  </span>
                  <b className="mt-1 block text-sm">
                    {selectedDriver.accuracy != null
                      ? `±${Math.round(selectedDriver.accuracy)} m`
                      : "Activo"}
                  </b>
                </div>
              </div>

              {selectedDriverTrip && selectedDriverTrip.stops.length > 0 && (
                <div className="border-t border-white/10 px-4 py-3">
                  <span className="block text-[7px] font-black uppercase tracking-[.08em] text-white/30">
                    Ruta actual
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedDriverTrip.stops.map((stop) => (
                      <span
                        key={stop.orderId}
                        className="rounded-full border border-white/10 bg-white/[0.055] px-2.5 py-1 text-[8px] font-bold text-white/65"
                      >
                        {stop.stopNumber}. {stop.code} · {deliveryTravelModeLabel(stop.travelMode)}
                      </span>
                    ))}
                  </div>
                  {selectedDriverTrip.totalDistanceMeters > 0 && (
                    <p className="mt-2 text-[8px] text-white/36">
                      Ruta restante · {formatDistance(selectedDriverTrip.totalDistanceMeters)}
                      {" · "}
                      {formatDuration(selectedDriverTrip.totalDurationSeconds)}
                    </p>
                  )}
                </div>
              )}

              {selectedDriverOrders.length > 0 && (
                <div className="border-t border-white/10 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="block text-[7px] font-black uppercase tracking-[.08em] text-white/30">
                      Órdenes asignadas
                    </span>
                    <span className="text-[8px] font-bold text-white/32">
                      {selectedDriverOrders.length}
                    </span>
                  </div>

                  <div className="mt-2 space-y-2">
                    {selectedDriverOrders.map((order) => {
                      const leg = selectedDriverTrip?.legs.find(
                        (item) => item.orderId === order.id,
                      );

                      return (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            setSelectedDriverId(null);
                            setSelectedAssignDriverId(
                              order.driver?.id ?? null,
                            );
                            setActionNotice(null);
                          }}
                          className="w-full rounded-[14px] border border-white/10 bg-white/[0.045] p-3 text-left transition hover:bg-white/[0.075]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <b className="text-[12px] font-black">
                                  {order.code}
                                </b>
                                <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[7px] font-black uppercase text-white/50">
                                  {formatStatus(order.status)}
                                </span>
                                {order.deliveryTravelMode && (
                                  <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-0.5 text-[7px] font-black text-white/45">
                                    {deliveryTravelModeLabel(order.deliveryTravelMode)}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 truncate text-[10px] font-semibold text-white/72">
                                {order.customerName}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[8px] leading-4 text-white/36">
                                {order.destination?.address || "Sin dirección"}
                              </p>
                            </div>
                            <span className="shrink-0 text-[11px] font-black text-white">
                              {money(order.total)}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1.5 text-[7px] font-bold">
                            <span className="rounded-full bg-white/[0.06] px-2 py-1 text-white/45">
                              Domicilio {money(order.deliveryFee)}
                            </span>
                            <span
                              className={
                                "rounded-full px-2 py-1 " +
                                (order.balance <= 0
                                  ? "bg-emerald-400/12 text-emerald-300"
                                  : "bg-red-400/12 text-red-300")
                              }
                            >
                              {order.balance <= 0
                                ? "Pagado"
                                : `Cobrar ${money(order.balance)}`}
                            </span>
                            {leg && (
                              <span className="rounded-full bg-white/[0.06] px-2 py-1 text-white/45">
                                {formatDistance(leg.distanceMeters)} ·{" "}
                                {formatDuration(leg.durationSeconds)}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedOrder && (
            <div className="absolute right-4 top-4 z-30 max-h-[calc(100%-2rem)] w-[min(390px,calc(100%-2rem))] overflow-y-auto rounded-[22px] border border-white/15 bg-[#111]/95 text-white shadow-[0_20px_55px_rgba(0,0,0,.34)] backdrop-blur-xl">
              <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3.5">
                <div
                  className={
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white text-[12px] font-black text-white shadow-lg " +
                    (selectedOrder.driver
                      ? "bg-emerald-600"
                      : "bg-[#e21a22]")
                  }
                >
                  {selectedOrder.code.split("-").at(-1)}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[7px] font-black uppercase tracking-[.13em] text-[#ff5a60]">
                    Pedido en mapa
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-[17px] font-black leading-5">
                      {selectedOrder.code}
                    </h3>
                    <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[7px] font-black uppercase text-white/52">
                      {formatStatus(selectedOrder.status)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrderId(null);
                    setSelectedAssignDriverId(null);
                    setActionNotice(null);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-base text-white/55 transition hover:bg-white/10 hover:text-white"
                  aria-label="Cerrar información del pedido"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3 px-4 py-3.5">
                <div>
                  <span className="block text-[7px] font-black uppercase tracking-[.08em] text-white/30">
                    Cliente
                  </span>
                  <b className="mt-1 block text-[13px]">
                    {selectedOrder.customerName}
                  </b>
                  <p className="mt-1 text-[9px] leading-4 text-white/42">
                    {selectedOrder.destination?.address || "Sin dirección"}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5">
                    <span className="block text-[6px] font-black uppercase tracking-[.08em] text-white/28">
                      Total
                    </span>
                    <b className="mt-1 block text-[11px]">
                      {money(selectedOrder.total)}
                    </b>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5">
                    <span className="block text-[6px] font-black uppercase tracking-[.08em] text-white/28">
                      Domicilio
                    </span>
                    <b className="mt-1 block text-[11px]">
                      {money(selectedOrder.deliveryFee)}
                    </b>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5">
                    <span className="block text-[6px] font-black uppercase tracking-[.08em] text-white/28">
                      Productos
                    </span>
                    <b className="mt-1 block text-[11px]">
                      {selectedOrder.itemCount}
                    </b>
                  </div>
                </div>

                <div
                  className={
                    "rounded-xl border px-3 py-2.5 " +
                    (selectedOrder.balance <= 0
                      ? "border-emerald-400/15 bg-emerald-400/10"
                      : "border-red-400/15 bg-red-400/10")
                  }
                >
                  <span className="block text-[7px] font-black uppercase tracking-[.08em] text-white/34">
                    Estado de pago
                  </span>
                  <b
                    className={
                      "mt-1 block text-[11px] " +
                      (selectedOrder.balance <= 0
                        ? "text-emerald-300"
                        : "text-red-300")
                    }
                  >
                    {selectedOrder.balance <= 0
                      ? "Pagado"
                      : `Pendiente por cobrar · ${money(selectedOrder.balance)}`}
                  </b>
                </div>

                {selectedOrder.driver && (
                  <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/10 px-3 py-2.5">
                    <span className="block text-[7px] font-black uppercase tracking-[.08em] text-emerald-300/70">
                      Repartidor actual
                    </span>
                    <b className="mt-1 block text-[11px] text-emerald-200">
                      {selectedOrder.driver.name}
                    </b>
                  </div>
                )}

                {!["OUT_FOR_DELIVERY", "ARRIVED"].includes(
                  selectedOrder.status,
                ) ? (
                  <div className="border-t border-white/10 pt-3">
                    <span className="block text-[7px] font-black uppercase tracking-[.08em] text-white/30">
                      {selectedOrder.driver
                        ? "Cambiar repartidor"
                        : "Asignar repartidor"}
                    </span>

                    <select
                      value={selectedAssignDriverId ?? ""}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setSelectedAssignDriverId(
                          Number.isInteger(next) && next > 0 ? next : null,
                        );
                        setActionNotice(null);
                      }}
                      className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#1b1b1c] px-3 text-[10px] font-bold text-white outline-none"
                    >
                      <option value="">Selecciona un repartidor</option>
                      {(data?.assignableDrivers ?? []).map((driver) => {
                        const isCurrent =
                          selectedOrder.driver?.id === driver.id;
                        const disabled =
                          !driver.ready ||
                          !driver.available ||
                          (driver.capacityReached && !isCurrent);

                        return (
                          <option
                            key={driver.id}
                            value={driver.id}
                            disabled={disabled}
                          >
                            {driver.name} · {driver.assignedDeliveries}/
                            {driver.maxConcurrentDeliveries}
                            {!driver.available
                              ? " · Inactivo"
                              : !driver.ready
                                ? " · Sin WhatsApp"
                                : driver.capacityReached && !isCurrent
                                  ? " · Sin cupo"
                                  : ""}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      type="button"
                      onClick={() => void assignSelectedOrder()}
                      disabled={
                        !selectedAssignDriverId ||
                        assigningOrderId === selectedOrder.id ||
                        selectedAssignDriverId === selectedOrder.driver?.id
                      }
                      className="mt-2 h-11 w-full rounded-xl bg-[#e21a22] px-3 text-[9px] font-black uppercase tracking-[.04em] text-white shadow-[0_8px_20px_rgba(226,26,34,.22)] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
                    >
                      {assigningOrderId === selectedOrder.id
                        ? "Asignando..."
                        : selectedOrder.driver
                          ? "Cambiar repartidor"
                          : "Asignar repartidor"}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-300/15 bg-amber-300/10 px-3 py-2.5 text-[9px] leading-4 text-amber-100">
                    Este pedido ya está en reparto. Para cambiar el repartidor debe gestionarse desde Estados para conservar el flujo operativo.
                  </div>
                )}

                {actionNotice && (
                  <div
                    className={
                      "rounded-xl border px-3 py-2.5 text-[9px] font-semibold leading-4 " +
                      (actionNotice.tone === "success"
                        ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-200"
                        : "border-red-400/15 bg-red-400/10 text-red-200")
                    }
                  >
                    {actionNotice.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {routeLegend.length > 0 && (
            <div className="absolute bottom-4 left-4 z-20 max-w-[calc(100%-2rem)] rounded-[18px] border border-white/15 bg-[#111]/94 p-2.5 text-white shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3 px-1">
                <p className="text-[7px] font-black uppercase tracking-[.12em] text-white/35">
                  Rutas en camino
                </p>
                <span className="text-[7px] font-semibold text-white/28">
                  A pie y moto: rutas orientativas
                </span>
              </div>
              <div className="mt-2 flex max-w-[760px] flex-wrap gap-1.5">
                {routeLegend.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-2.5 py-1.5"
                  >
                    <b className="text-[9px]">{item.name}</b>
                    <div className="flex items-center gap-1.5">
                      {item.stops.map((stop, index) => (
                        <span
                          key={stop.orderId}
                          className="inline-flex items-center gap-1 text-[8px] text-white/52"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: stop.color }}
                          />
                          {stop.stopNumber}. {stop.code} · {deliveryTravelModeLabel(stop.travelMode)}
                          {index < item.stops.length - 1 && (
                            <span className="ml-0.5 text-white/22">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                    {item.distanceMeters > 0 && (
                      <span className="text-[8px] text-white/28">
                        {formatDistance(item.distanceMeters)}
                        {" · "}
                        {formatDuration(item.durationSeconds)}
                      </span>
                    )}
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
            <div className="absolute left-4 right-4 top-16 z-30 rounded-[16px] border border-red-200 bg-white/95 px-4 py-3 text-[11px] font-semibold text-red-700 shadow-xl backdrop-blur-md">
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
