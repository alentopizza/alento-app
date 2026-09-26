"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DriverPushControl from "@/components/DriverPushControl";
import DriverFinancePanels from "@/components/DriverFinancePanels";
import {
  createAlentoMapPinElement,
  createDeliveryClusterPinElement,
  createDeliveryMapPinElement,
  createDeliveryRouteStopPinElement,
  createDriverMapPinElement,
} from "@/lib/alentoMapMarker";
import { orderDeliveryStopsByProximity } from "@/lib/deliveryStopOrder";
import {
  groupDeliveryLocations,
  spreadDeliveryClusterPoint,
} from "@/lib/deliveryMapClusters";
import {
  isAlentoNativeDriverApp,
  startNativeDriverAvailabilityTracking,
  stopNativeDriverTracking,
} from "@/lib/nativeDriverApp";

const LOGO =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

const HOME_GPS_KEY = "alento-driver-home-gps";

type DriverState = {
  id: number;
  name: string;
  driverAvailable: boolean;
  driverLatitude: number | null;
  driverLongitude: number | null;
  driverLocationAccuracy: number | null;
  driverLocationUpdatedAt: string | null;
  driverLocationSource: string | null;
};

type DriverRequestItem = {
  id: number;
  productName: string;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  configuration: unknown;
  notes: string | null;
};

type DriverStore = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type DriverRequest = {
  id: number;
  code: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  driverEarningPreview: number;
  discount: number;
  total: number;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  payment: {
    method: string;
    paidAmount: number;
    balance: number;
    paid: boolean;
    partial: boolean;
  } | null;
  address: {
    address: string;
    placeId: string | null;
    neighborhood: string | null;
    notes: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  items: DriverRequestItem[];
  assignment: {
    driverId: number;
    driverName: string;
    own: boolean;
  } | null;
  claimable: boolean;
  href: string | null;
};

type DriverRouteSummary = {
  distanceMeters: number;
  durationSeconds: number | null;
};

type DriverAcceptanceZone = {
  radiusMeters: number;
  distanceMeters: number | null;
  inside: boolean;
  hasLocation: boolean;
  locationFresh: boolean;
  storeConfigured: boolean;
  reason:
    | "INSIDE"
    | "OUTSIDE"
    | "NO_LOCATION"
    | "STALE_LOCATION"
    | "STORE_UNCONFIGURED";
};

type DriverTab = "requests" | "performance" | "wallet";

type GoogleAdvancedMarker = {
  map: GoogleMap | null;
  position: { lat: number; lng: number };
  content?: Node | null;
  addListener: (event: string, listener: () => void) => unknown;
};

type GoogleMarkerLibrary = {
  AdvancedMarkerElement: new (options: {
    map: GoogleMap;
    position: { lat: number; lng: number };
    title?: string;
    content?: Node;
    zIndex?: number;
  }) => GoogleAdvancedMarker;
};

type GoogleCircle = {
  setMap: (map: GoogleMap | null) => void;
  setCenter: (point: { lat: number; lng: number }) => void;
  setRadius: (radius: number) => void;
};

type GoogleMap = {
  fitBounds: (
    bounds: unknown,
    padding?: number | { top: number; right: number; bottom: number; left: number },
  ) => void;
  panTo: (point: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number | undefined;
};

type GoogleBounds = {
  extend: (point: { lat: number; lng: number }) => void;
};

type GoogleRuntime = {
  maps: {
    importLibrary: (name: string) => Promise<unknown>;
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Circle: new (options: Record<string, unknown>) => GoogleCircle;
    LatLngBounds: new () => GoogleBounds;
  };
};

function getGoogle() {
  return (window as typeof window & { google?: GoogleRuntime }).google;
}

function installGoogleMaps(key: string) {
  if (getGoogle()?.maps?.importLibrary) return;

  const id = "alento-driver-home-google-maps";
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
          e.set("callback",c+".maps."+q);
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

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function gpsFreshness(updatedAt: string | null, nowMs: number) {
  if (nowMs <= 0) {
    return {
      ageSeconds: null,
      label: "Actualizando",
      tone: "neutral" as const,
    };
  }

  if (!updatedAt) {
    return {
      ageSeconds: null,
      label: "Esperando señal",
      tone: "neutral" as const,
    };
  }

  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return {
      ageSeconds: null,
      label: "Sin lectura",
      tone: "neutral" as const,
    };
  }

  const ageSeconds = Math.max(
    0,
    Math.round((nowMs - timestamp) / 1000),
  );

  if (ageSeconds <= 15) {
    return {
      ageSeconds,
      label: "En vivo",
      tone: "live" as const,
    };
  }

  if (ageSeconds <= 45) {
    return {
      ageSeconds,
      label: "Reciente",
      tone: "recent" as const,
    };
  }

  return {
    ageSeconds,
    label: "Desactualizado",
    tone: "stale" as const,
  };
}

function gpsAgeLabel(ageSeconds: number | null) {
  if (ageSeconds == null) return "sin actualización";
  if (ageSeconds < 60) return `hace ${ageSeconds} s`;
  const minutes = Math.floor(ageSeconds / 60);
  return `hace ${minutes} min`;
}

function routeDistance(value: number) {
  if (value < 1000) return `${Math.round(value)} m`;
  const kilometers = value / 1000;
  return `${kilometers < 10 ? kilometers.toFixed(1) : Math.round(kilometers)} km`;
}

function routeDuration(value: number | null) {
  if (value == null) return "—";
  const minutes = Math.max(1, Math.round(value / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function acceptanceZoneLabel(zone: DriverAcceptanceZone | null) {
  if (!zone) return "Actualizando zona…";
  if (!zone.storeConfigured) return "Zona sin configurar";
  if (!zone.hasLocation || !zone.locationFresh) return "Actualizando tu ubicación…";
  if (zone.inside) return "Dentro de zona · Puedes aceptar pedidos";
  return `Fuera de zona · ${routeDistance(zone.distanceMeters ?? 0)} de Alentó`;
}

function extendCircleBounds(
  bounds: GoogleBounds,
  store: DriverStore,
  radiusMeters: number,
) {
  const latDelta = radiusMeters / 111_320;
  const cosine = Math.max(
    0.2,
    Math.cos((store.latitude * Math.PI) / 180),
  );
  const lngDelta = radiusMeters / (111_320 * cosine);

  bounds.extend({
    lat: store.latitude + latDelta,
    lng: store.longitude,
  });
  bounds.extend({
    lat: store.latitude - latDelta,
    lng: store.longitude,
  });
  bounds.extend({
    lat: store.latitude,
    lng: store.longitude + lngDelta,
  });
  bounds.extend({
    lat: store.latitude,
    lng: store.longitude - lngDelta,
  });
}

function statusLabel(status: string) {
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

function requestStatusBadgeClass(status: string) {
  if (status === "PREPARING") {
    return "border border-[#ff454b]/30 bg-[#e21a22]/18 text-[#ff6267]";
  }

  if (status === "PREPARED") {
    return "border border-amber-300/30 bg-amber-400/15 text-amber-300";
  }

  if (status === "READY") {
    return "border border-emerald-400/30 bg-emerald-400/15 text-emerald-300";
  }

  return "bg-white/[0.07] text-white/55";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function orderItemDetails(configuration: unknown) {
  if (!isRecord(configuration)) return [];

  const kind = textValue(configuration.kind)?.toUpperCase();
  const details: string[] = [];

  if (kind === "PIZZA") {
    const size = isRecord(configuration.size) ? configuration.size : null;
    const sizeName = textValue(size?.name);
    const diameter = Number(size?.diameterCm);

    if (sizeName) {
      details.push(
        Number.isFinite(diameter) && diameter > 0
          ? `${sizeName} · ${diameter} cm`
          : sizeName,
      );
    }

    const flavors = Array.isArray(configuration.flavors)
      ? configuration.flavors
          .map((item) => (isRecord(item) ? textValue(item.name) : null))
          .filter((value): value is string => Boolean(value))
      : [];

    if (flavors.length) {
      details.push(
        `${flavors.length > 1 ? "Sabores" : "Sabor"}: ${flavors.join(" + ")}`,
      );
    }

    const crust = isRecord(configuration.crust) ? configuration.crust : null;
    const crustName = textValue(crust?.name);
    if (crustName) details.push(`Borde: ${crustName}`);

    const modifiers = Array.isArray(configuration.modifiers)
      ? configuration.modifiers
          .map((item) => {
            if (!isRecord(item)) return null;
            const name = textValue(item.name);
            if (!name) return null;
            const quantity = Number(item.quantity);
            return Number.isFinite(quantity) && quantity > 1
              ? `${quantity}× ${name}`
              : name;
          })
          .filter((value): value is string => Boolean(value))
      : [];

    if (modifiers.length) details.push(`Extras: ${modifiers.join(", ")}`);
  }

  if (kind === "COMBO") {
    const pizzas = Array.isArray(configuration.pizzas)
      ? configuration.pizzas
      : [];

    pizzas.forEach((item, index) => {
      if (!isRecord(item)) return;
      const size = isRecord(item.size) ? item.size : null;
      const flavors = Array.isArray(item.flavors)
        ? item.flavors
            .map((flavor) => (isRecord(flavor) ? textValue(flavor.name) : null))
            .filter((value): value is string => Boolean(value))
        : [];
      const legacyFlavor = isRecord(item.flavor) ? textValue(item.flavor.name) : null;
      const flavorText =
        flavors.length > 1
          ? flavors.map((flavor) => `½ ${flavor}`).join(" + ")
          : flavors[0] ?? legacyFlavor;
      const parts = [textValue(size?.name), flavorText].filter(Boolean);
      if (parts.length) details.push(`Pizza ${index + 1}: ${parts.join(" · ")}`);
    });

    const groups = Array.isArray(configuration.groups)
      ? configuration.groups
      : [];

    groups.forEach((group) => {
      if (!isRecord(group)) return;
      const groupName = textValue(group.name) || "Incluye";
      const selections = Array.isArray(group.selections)
        ? group.selections
            .map((item) => {
              if (!isRecord(item)) return null;
              const name = textValue(item.name);
              if (!name) return null;
              const quantity = Number(item.quantity);
              return Number.isFinite(quantity) && quantity > 1
                ? `${quantity}× ${name}`
                : name;
            })
            .filter((value): value is string => Boolean(value))
        : [];

      if (selections.length) {
        details.push(`${groupName}: ${selections.join(", ")}`);
      }
    });
  }

  return details;
}

export default function DriverHome({
  initialDriver,
}: {
  initialDriver: DriverState;
}) {
  const router = useRouter();
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const driverMarkerRef = useRef<GoogleAdvancedMarker | null>(null);
  const storeMarkerRef = useRef<GoogleAdvancedMarker | null>(null);
  const acceptanceZoneCircleRef = useRef<GoogleCircle | null>(null);
  const requestMarkerRefs = useRef<Map<string, GoogleAdvancedMarker>>(new Map());
  const knownRequestIdsRef = useRef<Set<number> | null>(null);
  const routeSummaryCacheRef = useRef<Map<string, DriverRouteSummary>>(new Map());
  const pendingRouteSummaryRef = useRef<Set<string>>(new Set());
  const fitForNewRequestRef = useRef(false);
  const initialMapFitDoneRef = useRef(false);
  const lastFocusedRequestRef = useRef<number | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastGpsSyncRef = useRef(0);

  const [driver, setDriver] = useState(initialDriver);
  const [store, setStore] = useState<DriverStore | null>(null);
  const [acceptanceZone, setAcceptanceZone] =
    useState<DriverAcceptanceZone | null>(null);
  const [orders, setOrders] = useState<DriverRequest[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [routeSummaries, setRouteSummaries] = useState<Record<number, DriverRouteSummary>>({});
  const [tab, setTab] = useState<DriverTab>("requests");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedLocationCluster, setExpandedLocationCluster] =
    useState<string | null>(null);
  const [busyAvailability, setBusyAvailability] = useState(false);
  const [busyLogout, setBusyLogout] = useState(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [gpsNow, setGpsNow] = useState(0);
  const [nativeGps, setNativeGps] = useState(false);

  const gpsState = gpsFreshness(
    driver.driverLocationUpdatedAt,
    gpsNow,
  );

  useEffect(() => {
    setNativeGps(isAlentoNativeDriverApp());

    const tick = () => setGpsNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? null,
    [orders, selectedId],
  );

  const availableCount = useMemo(
    () => orders.filter((order) => order.claimable).length,
    [orders],
  );

  const assignedPendingCount = useMemo(
    () => orders.filter((order) => order.assignment?.own).length,
    [orders],
  );

  const assignedStopNumbers = useMemo(() => {
    const assigned = orders.filter(
      (order) =>
        order.assignment?.own &&
        order.address?.latitude != null &&
        order.address?.longitude != null,
    );

    if (assigned.length < 2) return new Map<number, number>();

    const origin =
      driver.driverLatitude != null && driver.driverLongitude != null
        ? {
            latitude: driver.driverLatitude,
            longitude: driver.driverLongitude,
          }
        : store
          ? {
              latitude: store.latitude,
              longitude: store.longitude,
            }
          : null;

    const ordered = origin
      ? orderDeliveryStopsByProximity(
          origin,
          assigned,
          (order) => ({
            latitude: order.address!.latitude!,
            longitude: order.address!.longitude!,
          }),
        )
      : [...assigned].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

    return new Map(ordered.map((order, index) => [order.id, index + 1]));
  }, [driver.driverLatitude, driver.driverLongitude, orders, store]);

  const stopGps = useCallback((clearIntent = false) => {
    if (watchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    watchRef.current = null;
    lastGpsSyncRef.current = 0;

    if (clearIntent) {
      window.localStorage.removeItem(HOME_GPS_KEY);
    }
  }, []);

  const startGps = useCallback(() => {
    if (watchRef.current != null) return;

    if (!navigator.geolocation) {
      setError("Este dispositivo no permite compartir ubicación.");
      return;
    }

    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        setDriver((current) => ({
          ...current,
          driverLatitude: latitude,
          driverLongitude: longitude,
          driverLocationAccuracy: accuracy,
          driverLocationUpdatedAt: new Date().toISOString(),
          driverLocationSource: "WEB",
        }));

        const now = Date.now();
        if (now - lastGpsSyncRef.current < 5000) return;
        lastGpsSyncRef.current = now;

        void fetch("/api/repartidor/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude, longitude, accuracy }),
        }).then(async (response) => {
          if (response.status === 409) {
            stopGps(true);
            setDriver((current) => ({
              ...current,
              driverAvailable: false,
              driverLatitude: null,
              driverLongitude: null,
              driverLocationAccuracy: null,
              driverLocationUpdatedAt: null,
              driverLocationSource: null,
            }));
          }
        }).catch(() => undefined);
      },
      (geoError) => {
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Debes permitir el acceso a la ubicación para ponerte Activo."
            : "No fue posible obtener tu ubicación.",
        );
        stopGps(true);

        void fetch("/api/repartidor/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: false }),
        }).catch(() => undefined);

        setDriver((current) => ({
          ...current,
          driverAvailable: false,
          driverLatitude: null,
          driverLongitude: null,
          driverLocationAccuracy: null,
          driverLocationUpdatedAt: null,
          driverLocationSource: null,
        }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );
  }, [stopGps]);

  const refreshState = useCallback(async () => {
    const response = await fetch("/api/repartidor/state", {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) return;

    const next = data.driver as DriverState;
    setDriver(next);

    if (!next.driverAvailable && watchRef.current != null) {
      stopGps(true);
    }
  }, [stopGps]);

  const refreshOrders = useCallback(async () => {
    const response = await fetch("/api/repartidor/requests", {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) return;

    const next = (data.orders ?? []) as DriverRequest[];
    const nextIds = new Set(next.map((order) => order.id));
    const known = knownRequestIdsRef.current;

    if (
      known &&
      next.some((order) => !known.has(order.id))
    ) {
      fitForNewRequestRef.current = true;
    }

    knownRequestIdsRef.current = nextIds;
    setStore((data.store ?? null) as DriverStore | null);
    setAcceptanceZone(
      (data.acceptanceZone ?? null) as DriverAcceptanceZone | null,
    );
    setOrders(next);
    setOrdersLoaded(true);
    setSelectedId((current) =>
      current && !next.some((order) => order.id === current)
        ? null
        : current,
    );
  }, []);

  useEffect(() => {
    void refreshOrders();

    const stateTimer = window.setInterval(() => {
      void refreshState();
    }, 5000);

    const ordersTimer = window.setInterval(() => {
      void refreshOrders();
    }, 2500);

    if (initialDriver.driverAvailable) {
      if (isAlentoNativeDriverApp()) {
        window.localStorage.removeItem(HOME_GPS_KEY);
        stopGps(false);
        void startNativeDriverAvailabilityTracking();
      } else if (window.localStorage.getItem(HOME_GPS_KEY) === "1") {
        startGps();
      }
    }

    return () => {
      window.clearInterval(stateTimer);
      window.clearInterval(ordersTimer);
      stopGps(false);
    };
  }, [initialDriver.driverAvailable, refreshOrders, refreshState, startGps, stopGps]);

  useEffect(() => {
    if (tab !== "requests" || !store) return;

    orders.forEach((order) => {
      const latitude = order.address?.latitude;
      const longitude = order.address?.longitude;
      if (latitude == null || longitude == null) return;

      const key = [
        order.id,
        store.latitude,
        store.longitude,
        latitude,
        longitude,
      ].join(":");

      const cached = routeSummaryCacheRef.current.get(key);
      if (cached) {
        setRouteSummaries((current) =>
          current[order.id] === cached
            ? current
            : { ...current, [order.id]: cached },
        );
        return;
      }

      if (pendingRouteSummaryRef.current.has(key)) return;
      pendingRouteSummaryRef.current.add(key);

      void fetch("/api/delivery/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude,
          longitude,
          formattedAddress: order.address?.address || "",
          placeId: order.address?.placeId || "",
        }),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) return null;

          const distanceMeters = Number(data.distanceMeters);
          const durationValue =
            data.durationSeconds == null ? null : Number(data.durationSeconds);
          const durationSeconds =
            durationValue != null && Number.isFinite(durationValue)
              ? durationValue
              : null;

          if (!Number.isFinite(distanceMeters)) return null;

          return {
            distanceMeters,
            durationSeconds,
          } satisfies DriverRouteSummary;
        })
        .then((summary) => {
          if (!summary) return;
          routeSummaryCacheRef.current.set(key, summary);
          setRouteSummaries((current) => ({
            ...current,
            [order.id]: summary,
          }));
        })
        .catch(() => undefined)
        .finally(() => {
          pendingRouteSummaryRef.current.delete(key);
        });
    });
  }, [orders, store, tab]);

  async function changeAvailability(active: boolean) {
    if (busyAvailability || active === driver.driverAvailable) return;

    setBusyAvailability(true);
    setError("");

    try {
      const response = await fetch("/api/repartidor/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible cambiar tu estado.");
      }

      setDriver(data.driver);

      if (active) {
        if (isAlentoNativeDriverApp()) {
          window.localStorage.removeItem(HOME_GPS_KEY);
          stopGps(false);
          void startNativeDriverAvailabilityTracking();
        } else {
          window.localStorage.setItem(HOME_GPS_KEY, "1");
          startGps();
        }
      } else {
        stopNativeDriverTracking();
        stopGps(true);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible cambiar tu estado.",
      );
    } finally {
      setBusyAvailability(false);
    }
  }

  async function logout() {
    if (busyLogout) return;

    setBusyLogout(true);
    setError("");

    try {
      const stateResponse = await fetch("/api/repartidor/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      const stateData = await stateResponse.json().catch(() => ({}));

      if (!stateResponse.ok) {
        throw new Error(
          stateData.error ||
            "Finaliza tus domicilios asignados antes de cerrar sesión.",
        );
      }

      stopNativeDriverTracking();
      stopGps(true);

      const response = await fetch("/api/auth/staff/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("No fue posible cerrar la sesión.");
      }

      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No fue posible cerrar la sesión.",
      );
      setBusyLogout(false);
    }
  }

  async function claim(order: DriverRequest) {
    if (claimingId != null) return;

    setClaimingId(order.id);
    setError("");

    try {
      const response = await fetch(
        `/api/repartidor/requests/${order.id}/claim`,
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible tomar la solicitud.");
      }

      if (data.href) {
        router.push(data.href);
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible tomar la solicitud.",
      );
      void refreshOrders();
    } finally {
      setClaimingId(null);
    }
  }

  const recenterMap = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;

    const bounds = new google.maps.LatLngBounds();
    let points = 0;

    if (
      driver.driverLatitude != null &&
      driver.driverLongitude != null
    ) {
      bounds.extend({
        lat: driver.driverLatitude,
        lng: driver.driverLongitude,
      });
      points += 1;
    }

    if (store) {
      bounds.extend({
        lat: store.latitude,
        lng: store.longitude,
      });
      points += 1;

      if (acceptanceZone?.radiusMeters) {
        extendCircleBounds(
          bounds,
          store,
          acceptanceZone.radiusMeters,
        );
        points += 4;
      }
    }

    orders.forEach((order) => {
      if (
        order.address?.latitude == null ||
        order.address?.longitude == null
      ) {
        return;
      }

      bounds.extend({
        lat: order.address.latitude,
        lng: order.address.longitude,
      });
      points += 1;
    });

    if (points > 1) {
      map.fitBounds(bounds, {
        top: 120,
        right: 74,
        bottom: 190,
        left: 74,
      });
      return;
    }

    if (
      driver.driverLatitude != null &&
      driver.driverLongitude != null
    ) {
      map.panTo({
        lat: driver.driverLatitude,
        lng: driver.driverLongitude,
      });
      map.setZoom(15);
      return;
    }

    const first = orders.find(
      (order) =>
        order.address?.latitude != null &&
        order.address?.longitude != null,
    );

    if (first?.address?.latitude != null && first.address.longitude != null) {
      map.panTo({
        lat: first.address.latitude,
        lng: first.address.longitude,
      });
      map.setZoom(14);
    }
  }, [
    driver.driverLatitude,
    acceptanceZone?.radiusMeters,
    driver.driverLongitude,
    orders,
    store,
  ]);

  const zoomMap = useCallback((delta: number) => {
    const map = mapRef.current;
    if (!map) return;

    const current = map.getZoom() ?? 14;
    map.setZoom(Math.max(3, Math.min(20, current + delta)));
  }, []);

  useEffect(() => {
    if (tab !== "requests" || !mapHostRef.current) return;

    let disposed = false;

    async function renderMap() {
      try {
        const google = await loadGoogleMaps();
        await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } =
          (await google.maps.importLibrary("marker")) as GoogleMarkerLibrary;

        if (disposed || !mapHostRef.current) return;

        const requestWithLocation = orders.filter(
          (order) =>
            order.address?.latitude != null &&
            order.address?.longitude != null,
        );

        const center =
          driver.driverLatitude != null && driver.driverLongitude != null
            ? {
                lat: driver.driverLatitude,
                lng: driver.driverLongitude,
              }
            : store
              ? {
                  lat: store.latitude,
                  lng: store.longitude,
                }
              : requestWithLocation[0]?.address?.latitude != null &&
                  requestWithLocation[0]?.address?.longitude != null
                ? {
                    lat: requestWithLocation[0].address.latitude,
                    lng: requestWithLocation[0].address.longitude,
                  }
                : { lat: 4.6097, lng: -74.0817 };

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapHostRef.current, {
            center,
            zoom: 13,
            mapId: "b0bfaae2809a720a6204509b",
            disableDefaultUI: true,
            zoomControl: false,
            gestureHandling: "greedy",
          });
        }

        const bounds = new google.maps.LatLngBounds();
        let points = 0;

        if (
          driver.driverLatitude != null &&
          driver.driverLongitude != null
        ) {
          const point = {
            lat: driver.driverLatitude,
            lng: driver.driverLongitude,
          };

          if (!driverMarkerRef.current) {
            driverMarkerRef.current = new AdvancedMarkerElement({
              map: mapRef.current,
              position: point,
              title: driver.name,
              content: createDriverMapPinElement(),
              zIndex: 50,
            });
          } else {
            driverMarkerRef.current.position = point;
          }

          bounds.extend(point);
          points += 1;
        } else if (driverMarkerRef.current) {
          driverMarkerRef.current.map = null;
          driverMarkerRef.current = null;
        }

        if (store) {
          const storePoint = {
            lat: store.latitude,
            lng: store.longitude,
          };

          if (!storeMarkerRef.current) {
            storeMarkerRef.current = new AdvancedMarkerElement({
              map: mapRef.current,
              position: storePoint,
              title: "Alentó Pizza",
              content: createAlentoMapPinElement(),
              zIndex: 45,
            });
          } else {
            storeMarkerRef.current.position = storePoint;
          }

          bounds.extend(storePoint);
          points += 1;

          if (acceptanceZone?.radiusMeters) {
            if (!acceptanceZoneCircleRef.current) {
              acceptanceZoneCircleRef.current = new google.maps.Circle({
                map: mapRef.current,
                center: storePoint,
                radius: acceptanceZone.radiusMeters,
                strokeColor: "#059669",
                strokeOpacity: 0.82,
                strokeWeight: 2,
                fillColor: "#10b981",
                fillOpacity: 0.11,
                clickable: false,
                zIndex: 5,
              });
            } else {
              acceptanceZoneCircleRef.current.setMap(mapRef.current);
              acceptanceZoneCircleRef.current.setCenter(storePoint);
              acceptanceZoneCircleRef.current.setRadius(
                acceptanceZone.radiusMeters,
              );
            }

            extendCircleBounds(
              bounds,
              store,
              acceptanceZone.radiusMeters,
            );
            points += 4;
          }
        } else {
          if (storeMarkerRef.current) {
            storeMarkerRef.current.map = null;
            storeMarkerRef.current = null;
          }
          acceptanceZoneCircleRef.current?.setMap(null);
          acceptanceZoneCircleRef.current = null;
        }

        const visibleRequestMarkerKeys = new Set<string>();
        const locationClusters = groupDeliveryLocations(
          requestWithLocation,
          (order) => ({
            latitude: order.address!.latitude!,
            longitude: order.address!.longitude!,
          }),
          (order) => order.id,
        );

        const upsertOrderMarker = (
          markerKey: string,
          order: DriverRequest,
          point: { lat: number; lng: number },
          expanded = false,
        ) => {
          visibleRequestMarkerKeys.add(markerKey);
          const existing = requestMarkerRefs.current.get(markerKey);
          const stopNumber = assignedStopNumbers.get(order.id);
          const ownAssignment = order.assignment?.own === true;
          const markerContent = stopNumber
            ? createDeliveryRouteStopPinElement(
                order.code,
                stopNumber,
                "#065f46",
                { tone: "assigned" },
              )
            : createDeliveryMapPinElement(
                order.code,
                ownAssignment ? { tone: "assigned" } : undefined,
              );

          if (existing) {
            existing.position = point;
            existing.content = markerContent;
            return;
          }

          const marker = new AdvancedMarkerElement({
            map: mapRef.current!,
            position: point,
            title: stopNumber
              ? `Parada ${stopNumber} · ${order.code} · ${order.customerName}`
              : `${order.code} · ${order.customerName}`,
            content: markerContent,
            zIndex: expanded
              ? 58
              : order.claimable
                ? 30
                : ownAssignment
                  ? 40
                  : 20,
          });

          marker.addListener("click", () => {
            if (order.href) {
              router.push(order.href);
              return;
            }

            mapRef.current?.panTo(point);
            mapRef.current?.setZoom(15);
          });

          requestMarkerRefs.current.set(markerKey, marker);
        };

        locationClusters.forEach((cluster) => {
          const centerPoint = {
            lat: cluster.center.latitude,
            lng: cluster.center.longitude,
          };

          bounds.extend(centerPoint);
          points += 1;

          if (cluster.items.length === 1) {
            upsertOrderMarker(
              `order:${cluster.items[0].id}`,
              cluster.items[0],
              centerPoint,
            );
            return;
          }

          const clusterMarkerKey = `cluster:${cluster.key}`;
          visibleRequestMarkerKeys.add(clusterMarkerKey);
          const allAssigned = cluster.items.every(
            (order) => order.assignment?.own === true,
          );
          const someAssigned = cluster.items.some(
            (order) => order.assignment?.own === true,
          );
          const tone = allAssigned
            ? "assigned"
            : someAssigned
              ? "mixed"
              : "default";
          const clusterContent = createDeliveryClusterPinElement(
            cluster.items.length,
            { tone },
          );
          const existingCluster =
            requestMarkerRefs.current.get(clusterMarkerKey);

          if (existingCluster) {
            existingCluster.position = centerPoint;
            existingCluster.content = clusterContent;
          } else {
            const clusterMarker = new AdvancedMarkerElement({
              map: mapRef.current!,
              position: centerPoint,
              title: `${cluster.items.length} pedidos en esta ubicación · ${cluster.items
                .map((order) => order.code)
                .join(" · ")}`,
              content: clusterContent,
              zIndex: 52,
            });

            clusterMarker.addListener("click", () => {
              setExpandedLocationCluster((current) =>
                current === cluster.key ? null : cluster.key,
              );
              mapRef.current?.panTo(centerPoint);
              if ((mapRef.current?.getZoom() ?? 0) < 18) {
                mapRef.current?.setZoom(18);
              }
            });

            requestMarkerRefs.current.set(
              clusterMarkerKey,
              clusterMarker,
            );
          }

          if (expandedLocationCluster !== cluster.key) return;

          cluster.items.forEach((order, index) => {
            const spreadPoint = spreadDeliveryClusterPoint(
              cluster.center,
              index,
              cluster.items.length,
            );
            upsertOrderMarker(
              `cluster-order:${cluster.key}:${order.id}`,
              order,
              {
                lat: spreadPoint.latitude,
                lng: spreadPoint.longitude,
              },
              true,
            );
          });
        });

        requestMarkerRefs.current.forEach((marker, markerKey) => {
          if (!visibleRequestMarkerKeys.has(markerKey)) {
            marker.map = null;
            requestMarkerRefs.current.delete(markerKey);
          }
        });

        const shouldFit =
          ordersLoaded &&
          (!initialMapFitDoneRef.current || fitForNewRequestRef.current);

        if (shouldFit && points > 0) {
          if (points > 1) {
            mapRef.current.fitBounds(bounds, {
              top: 120,
              right: 74,
              bottom: 190,
              left: 74,
            });
          } else {
            mapRef.current.panTo(center);
            mapRef.current.setZoom(14);
          }

          initialMapFitDoneRef.current = true;
          fitForNewRequestRef.current = false;
        }
      } catch (err) {
        if (!disposed) {
          setError(
            err instanceof Error
              ? err.message
              : "No fue posible cargar el mapa.",
          );
        }
      }
    }

    void renderMap();

    return () => {
      disposed = true;
    };
  }, [
    acceptanceZone?.radiusMeters,
    assignedStopNumbers,
    driver.driverLatitude,
    driver.driverLongitude,
    driver.name,
    expandedLocationCluster,
    orders,
    ordersLoaded,
    router,
    store,
    tab,
  ]);

  useEffect(() => {
    if (!selectedOrder?.address || !mapRef.current) return;
    if (lastFocusedRequestRef.current === selectedOrder.id) return;

    const { latitude, longitude } = selectedOrder.address;
    if (latitude == null || longitude == null) return;

    lastFocusedRequestRef.current = selectedOrder.id;
    mapRef.current.panTo({ lat: latitude, lng: longitude });
    mapRef.current.setZoom(15);
  }, [selectedOrder]);

  useEffect(() => {
    if (selectedId == null) {
      lastFocusedRequestRef.current = null;
    }
  }, [selectedId]);

  useEffect(() => {
    if (tab === "requests") return;

    if (driverMarkerRef.current) driverMarkerRef.current.map = null;
    driverMarkerRef.current = null;

    if (storeMarkerRef.current) storeMarkerRef.current.map = null;
    storeMarkerRef.current = null;

    acceptanceZoneCircleRef.current?.setMap(null);
    acceptanceZoneCircleRef.current = null;

    requestMarkerRefs.current.forEach((marker) => {
      marker.map = null;
    });
    requestMarkerRefs.current.clear();

    mapRef.current = null;
    initialMapFitDoneRef.current = false;
    lastFocusedRequestRef.current = null;
    setExpandedLocationCluster(null);
  }, [tab]);

  const navItems: Array<{
    id: DriverTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "requests",
      label: "Solicitudes",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 21s7-5.1 7-12A7 7 0 1 0 5 9c0 6.9 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.2" />
        </svg>
      ),
    },
    {
      id: "performance",
      label: "Desempeño",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        </svg>
      ),
    },
    {
      id: "wallet",
      label: "Cartera",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H19a2 2 0 0 1 2 2v12H5.5A2.5 2.5 0 0 1 3 15.5v-9Z" />
          <path d="M16 10h5v4h-5a2 2 0 0 1 0-4Z" />
        </svg>
      ),
    },
  ];

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#080808] text-white">
      {tab === "requests" ? (
        <div className="absolute inset-0">
          <div ref={mapHostRef} className="absolute inset-0 bg-[#efefeb]" />
        </div>
      ) : (
        <div className="absolute inset-0 overflow-y-auto bg-[#080808] px-3 pb-8 pt-[86px] sm:px-5">
          <DriverFinancePanels tab={tab} />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-[max(12px,env(safe-area-inset-top))] sm:px-5">
        <div className="pointer-events-auto mx-auto flex max-w-[760px] items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú del repartidor"
            title="Abrir menú"
            className="group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-white shadow-[0_8px_24px_rgba(0,0,0,.16)] transition active:scale-95"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-[3px] rounded-[19px] border border-[#e21a22]/55 animate-pulse"
            />
            <img
              src={LOGO}
              alt="Alentó Pizza"
              className="h-10 w-10 rounded-xl object-cover"
            />
            <span
              aria-hidden="true"
              className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] flex-col items-center justify-center gap-[2px] rounded-full border-2 border-white bg-[#e21a22] shadow-[0_4px_12px_rgba(226,26,34,.35)]"
            >
              <span className="h-[1.5px] w-2 rounded-full bg-white" />
              <span className="h-[1.5px] w-2 rounded-full bg-white" />
              <span className="h-[1.5px] w-2 rounded-full bg-white" />
            </span>
          </button>

          <div className="flex min-w-0 flex-1 items-center rounded-full border border-black/10 bg-white/96 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,.15)] backdrop-blur-xl">
            <button
              type="button"
              disabled={
                busyAvailability ||
                (driver.driverAvailable && assignedPendingCount > 0)
              }
              onClick={() => void changeAvailability(false)}
              aria-label={
                assignedPendingCount > 0
                  ? "No puedes ponerte Inactivo mientras tengas domicilios asignados"
                  : "Ponerte Inactivo"
              }
              title={
                assignedPendingCount > 0
                  ? "Finaliza tus domicilios asignados antes de ponerte Inactivo"
                  : "Ponerte Inactivo"
              }
              className={
                "h-10 flex-1 rounded-full text-[11px] font-black transition disabled:cursor-not-allowed " +
                (!driver.driverAvailable
                  ? "bg-[#e21a22] text-white shadow-[0_6px_18px_rgba(226,26,34,.24)]"
                  : assignedPendingCount > 0
                    ? "bg-neutral-100 text-neutral-300"
                    : "text-neutral-400")
              }
            >
              Inactivo
            </button>
            <button
              type="button"
              disabled={busyAvailability}
              onClick={() => void changeAvailability(true)}
              className={
                "h-10 flex-1 rounded-full text-[11px] font-black transition " +
                (driver.driverAvailable
                  ? "bg-emerald-500 text-white shadow-[0_6px_18px_rgba(16,185,129,.26)]"
                  : "text-neutral-400")
              }
            >
              Activo
            </button>
          </div>

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-white shadow-[0_8px_24px_rgba(0,0,0,.16)]">
            <span
              className={
                "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black text-white transition " +
                (driver.driverAvailable
                  ? "bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,.55)]"
                  : "bg-[#e21a22] shadow-[0_0_14px_rgba(226,26,34,.45)]")
              }
              aria-label={`${availableCount} pedidos disponibles`}
              title={`${availableCount} pedidos disponibles`}
            >
              {availableCount}
            </span>
          </div>
        </div>
      </div>

      {tab === "requests" && driver.driverAvailable && (
        <div className="pointer-events-none absolute inset-x-0 top-[76px] z-30 px-3 sm:px-5">
          <div className="mx-auto flex max-w-[760px] flex-wrap justify-center gap-2">
            <div
              className={
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[9px] font-black shadow-[0_8px_24px_rgba(0,0,0,.14)] backdrop-blur-xl " +
                (acceptanceZone?.inside
                  ? "border-emerald-200 bg-emerald-50/95 text-emerald-700"
                  : "border-amber-200 bg-amber-50/95 text-amber-800")
              }
            >
              <span
                className={
                  "h-2.5 w-2.5 rounded-full " +
                  (acceptanceZone?.inside
                    ? "bg-emerald-500"
                    : "bg-amber-500")
                }
              />
              {acceptanceZoneLabel(acceptanceZone)}
              {acceptanceZone?.radiusMeters ? (
                <span className="font-semibold opacity-60">
                  · radio {routeDistance(acceptanceZone.radiusMeters)}
                </span>
              ) : null}
            </div>

            <div
              className={
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[9px] font-black shadow-[0_8px_24px_rgba(0,0,0,.14)] backdrop-blur-xl " +
                (gpsState.tone === "live"
                  ? "border-emerald-200 bg-[#07150f]/94 text-emerald-300"
                  : gpsState.tone === "recent"
                    ? "border-amber-200 bg-[#1b1404]/94 text-amber-200"
                    : gpsState.tone === "stale"
                      ? "border-red-300 bg-[#210b0d]/94 text-[#ff777c]"
                      : "border-white/15 bg-[#111]/92 text-white/50")
              }
            >
              <span
                className={
                  "h-2.5 w-2.5 rounded-full " +
                  (gpsState.tone === "live"
                    ? "bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,.7)]"
                    : gpsState.tone === "recent"
                      ? "bg-amber-300"
                      : gpsState.tone === "stale"
                        ? "bg-[#ff6267]"
                        : "bg-white/25")
                }
              />
              {driver.driverLocationSource === "ANDROID_NATIVE"
                      ? "Android nativo"
                      : driver.driverLocationSource === "WEB"
                        ? "Web"
                        : nativeGps
                          ? "Android · esperando"
                          : "GPS"} · {gpsState.label}
              <span className="font-semibold opacity-65">
                ·{" "}
                {driver.driverLocationAccuracy != null
                  ? `±${Math.round(driver.driverLocationAccuracy)} m`
                  : "sin precisión"}{" "}
                · {gpsAgeLabel(gpsState.ageSeconds)}
              </span>
            </div>
          </div>
        </div>
      )}

      {tab === "requests" && (
        <div className="pointer-events-none absolute right-3 top-[46%] z-30 -translate-y-1/2 sm:right-5">
          <div className="pointer-events-auto flex flex-col overflow-hidden rounded-[18px] border border-black/10 bg-white shadow-[0_10px_28px_rgba(0,0,0,.18)]">
            <button
              type="button"
              onClick={() => zoomMap(1)}
              aria-label="Acercar mapa"
              title="Acercar"
              className="flex h-12 w-12 items-center justify-center text-[26px] font-light text-neutral-800 transition active:bg-neutral-100"
            >
              +
            </button>

            <button
              type="button"
              onClick={recenterMap}
              aria-label="Centrar mapa"
              title="Centrar vista"
              className="flex h-12 w-12 items-center justify-center border-y border-neutral-200 text-neutral-800 transition active:bg-neutral-100"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-[20px] w-[20px]"
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
            </button>

            <button
              type="button"
              onClick={() => zoomMap(-1)}
              aria-label="Alejar mapa"
              title="Alejar"
              className="flex h-12 w-12 items-center justify-center text-[28px] font-light text-neutral-800 transition active:bg-neutral-100"
            >
              −
            </button>
          </div>
        </div>
      )}

      {tab === "requests" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(14px,env(safe-area-inset-bottom))] z-30 px-3 sm:px-5">
          <div className="pointer-events-auto mx-auto max-w-[760px]">
            <div className="flex snap-x gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {orders.length ? (
                orders.map((order) => (
                  <article
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (order.href) router.push(order.href);
                    }}
                    onKeyDown={(event) => {
                      if (
                        order.href &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        router.push(order.href);
                      }
                    }}
                    className={
                      "min-w-[286px] cursor-pointer snap-start overflow-hidden rounded-[20px] border text-white backdrop-blur-xl transition active:scale-[.99] sm:min-w-[310px] " +
                      (order.assignment?.own
                        ? "border-emerald-400/35 bg-[#071a13]/96 shadow-[0_16px_42px_rgba(5,150,105,.16)] "
                        : "bg-[#111]/96 shadow-[0_16px_42px_rgba(0,0,0,.28)] ") +
                      (selectedId === order.id
                        ? order.assignment?.own
                          ? "border-emerald-300/70"
                          : "border-[#e21a22]/60"
                        : order.assignment?.own
                          ? "border-emerald-400/35"
                          : "border-white/10")
                    }
                  >
                    <div className="p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <b className="text-[12px] font-black">{order.code}</b>
                            <span
                              className={
                                "rounded-full px-2 py-0.5 text-[8px] font-black uppercase " +
                                requestStatusBadgeClass(order.status)
                              }
                            >
                              {statusLabel(order.status)}
                            </span>
                            {order.assignment?.own && (
                              <span className="rounded-full border border-emerald-300/20 bg-emerald-400/12 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.06em] text-emerald-300">
                                Mi pedido
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-[10px] font-semibold text-white/70">
                            {order.customerName}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="block text-[7px] font-black uppercase tracking-[0.09em] text-white/32">
                            Domicilio
                          </span>
                          <b
                            className={
                              "mt-0.5 block text-[13px] " +
                              (order.assignment?.own
                                ? "text-emerald-300"
                                : "text-[#ff454b]")
                            }
                          >
                            {money(order.deliveryFee)}
                          </b>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex h-6 items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-400/[0.09] px-2 text-[8px] font-black text-emerald-300">
                          Ganas {money(order.driverEarningPreview)}
                        </span>
                        {routeSummaries[order.id] ? (
                          <>
                            <span className={
                                "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[8px] font-bold " +
                                (order.assignment?.own
                                  ? "border-emerald-300/15 bg-emerald-400/[0.08] text-emerald-100/70"
                                  : "border-white/[0.07] bg-white/[0.055] text-white/62")
                              }>
                              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <path d="M5 19 19 5M10 5h9v9" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              {routeDistance(routeSummaries[order.id].distanceMeters)}
                            </span>
                            <span className={
                                "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[8px] font-bold " +
                                (order.assignment?.own
                                  ? "border-emerald-300/15 bg-emerald-400/[0.08] text-emerald-100/70"
                                  : "border-white/[0.07] bg-white/[0.055] text-white/62")
                              }>
                              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <circle cx="12" cy="12" r="8" />
                                <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              {routeDuration(routeSummaries[order.id].durationSeconds)}
                            </span>
                          </>
                        ) : order.address?.latitude != null && order.address?.longitude != null ? (
                          <span className="h-6 rounded-full bg-white/[0.04] px-2 text-[8px] font-semibold leading-6 text-white/28">
                            Calculando ruta…
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2 flex items-end justify-between gap-3">
                        <p
                          className={
                            "line-clamp-2 min-w-0 text-[9px] leading-4 " +
                            (order.assignment?.own
                              ? "text-emerald-50/55"
                              : "text-white/42")
                          }
                        >
                          {order.address?.address || "Dirección pendiente"}
                        </p>
                        <span
                          className={
                            "shrink-0 text-lg leading-none " +
                            (order.assignment?.own
                              ? "text-emerald-300/45"
                              : "text-white/28")
                          }
                        >
                          ›
                        </span>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="w-full rounded-[20px] border border-white/10 bg-[#111]/94 px-4 py-5 text-center text-[10px] font-semibold text-white/45 backdrop-blur-xl">
                  No hay domicilios en proceso.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/72 backdrop-blur-[4px] sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedId(null);
          }}
        >
          <section className="flex max-h-[92dvh] w-full max-w-[620px] flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0e0e0e] text-white shadow-[0_30px_100px_rgba(0,0,0,.55)] sm:rounded-[28px]">
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#ff454b]">
                  Solicitud de domicilio
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 className="text-[20px] font-black tracking-[-0.03em]">
                    {selectedOrder.code}
                  </h2>
                  <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[8px] font-black uppercase text-white/55">
                    {statusLabel(selectedOrder.status)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Cerrar solicitud"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xl text-white/65"
              >
                ×
              </button>
            </header>

            <div className="alento-scroll min-h-0 flex-1 overflow-y-auto">
              <div className="border-b border-white/10 p-4 sm:p-5">
                <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#ff454b]">
                  Entrega
                </p>

                <div className="mt-3 grid gap-2">
                  <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.04] px-3.5 py-3">
                    <span className="block text-[8px] font-black uppercase tracking-[0.08em] text-white/32">
                      Cliente
                    </span>
                    <b className="mt-1 block text-[13px]">
                      {selectedOrder.customerName}
                    </b>
                    {selectedOrder.customerPhone && (
                      <span className="mt-0.5 block text-[10px] text-white/45">
                        {selectedOrder.customerPhone}
                      </span>
                    )}
                  </div>

                  <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.04] px-3.5 py-3">
                    <span className="block text-[8px] font-black uppercase tracking-[0.08em] text-white/32">
                      Dirección
                    </span>
                    <b className="mt-1 block text-[11px] leading-5 text-white/82">
                      {selectedOrder.address?.address || "Dirección pendiente"}
                    </b>
                    {selectedOrder.address?.neighborhood && (
                      <span className="mt-0.5 block text-[9px] text-white/38">
                        {selectedOrder.address.neighborhood}
                      </span>
                    )}
                    {selectedOrder.address?.notes && (
                      <p className="mt-2 rounded-xl border border-[#e21a22]/15 bg-[#e21a22]/[0.07] px-3 py-2 text-[9px] leading-4 text-white/65">
                        {selectedOrder.address.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-b border-white/10 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#ff454b]">
                    Productos
                  </p>
                  <span className="text-[9px] font-semibold text-white/35">
                    {selectedOrder.items.reduce(
                      (total, item) => total + item.quantity,
                      0,
                    )}{" "}
                    unidad(es)
                  </span>
                </div>

                <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.035]">
                  {selectedOrder.items.map((item) => {
                    const details = orderItemDetails(item.configuration);

                    return (
                      <article key={item.id} className="p-3.5">
                        <div className="flex items-start gap-3">
                          <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-xl bg-[#e21a22] px-2 text-[10px] font-black text-white">
                            {item.quantity}×
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <b className="block text-[12px] leading-5">
                                  {item.productName}
                                </b>
                                {item.variantName && (
                                  <span className="block text-[9px] text-white/38">
                                    {item.variantName}
                                  </span>
                                )}
                              </div>
                              <b className="shrink-0 text-[11px]">
                                {money(item.lineTotal)}
                              </b>
                            </div>

                            {details.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                {details.map((detail) => (
                                  <p
                                    key={detail}
                                    className="text-[9px] leading-4 text-white/42"
                                  >
                                    {detail}
                                  </p>
                                ))}
                              </div>
                            )}

                            {item.notes && (
                              <p className="mt-2 text-[9px] leading-4 text-[#ff8b8f]">
                                Nota: {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#ff454b]">
                  Cobro
                </p>

                <div className="mt-3 space-y-2 text-[10px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/42">Subtotal</span>
                    <b>{money(selectedOrder.subtotal)}</b>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/42">Domicilio</span>
                    <b className="text-[#ff454b]">
                      {money(selectedOrder.deliveryFee)}
                    </b>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300/10 bg-emerald-400/[0.07] px-3 py-2">
                    <span className="text-emerald-100/55">Tu ganancia</span>
                    <b className="text-emerald-300">
                      {money(selectedOrder.driverEarningPreview)}
                    </b>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/42">Descuento</span>
                      <b className="text-[#ff8b8f]">
                        − {money(selectedOrder.discount)}
                      </b>
                    </div>
                  )}
                  <div className="border-t border-white/10 pt-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/42">Medio de pago</span>
                      <b>
                        {selectedOrder.payment?.method || "Sin información"}
                      </b>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-white/42">Estado de pago</span>
                      <span
                        className={
                          "rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[.05em] " +
                          (selectedOrder.payment?.paid
                            ? "border-emerald-300/20 bg-emerald-400/12 text-emerald-300"
                            : "border-[#ff6267]/20 bg-[#e21a22]/12 text-[#ff7a7e]")
                        }
                      >
                        {selectedOrder.payment?.paid
                          ? "Pagado"
                          : selectedOrder.payment?.partial
                            ? `Pago parcial · falta ${money(
                                selectedOrder.payment.balance,
                              )}`
                            : "Pendiente por cobrar"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-3 border-t border-white/10 pt-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-white/45">
                      Total
                    </span>
                    <b className="text-[22px] font-black tracking-[-0.03em]">
                      {money(selectedOrder.total)}
                    </b>
                  </div>
                </div>
              </div>
            </div>

            <footer className="border-t border-white/10 bg-[#0b0b0b] p-3 sm:p-4">
              {selectedOrder.assignment?.own && selectedOrder.href ? (
                <button
                  type="button"
                  onClick={() => router.push(selectedOrder.href!)}
                  className="h-12 w-full rounded-full bg-white text-[11px] font-black text-black"
                >
                  Abrir mi pedido
                </button>
              ) : selectedOrder.claimable ? (
                <button
                  type="button"
                  disabled={!driver.driverAvailable || claimingId != null}
                  onClick={() => void claim(selectedOrder)}
                  className="h-12 w-full rounded-full bg-[#e21a22] text-[11px] font-black text-white shadow-[0_10px_28px_rgba(226,26,34,.20)] disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none"
                >
                  {claimingId === selectedOrder.id
                    ? "Autoasignando..."
                    : driver.driverAvailable
                      ? "Autoasignarme este domicilio"
                      : "Ponte Activo para autoasignarte"}
                </button>
              ) : selectedOrder.assignment ? (
                <div className="flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-center text-[10px] font-semibold text-white/42">
                  Asignado a {selectedOrder.assignment.driverName}
                </div>
              ) : null}
            </footer>
          </section>
        </div>
      )}

      {error && (
        <div className="absolute left-3 right-3 top-[122px] z-40 mx-auto max-w-[520px] rounded-[16px] border border-[#e21a22]/25 bg-[#210b0d]/95 px-3.5 py-3 text-[10px] font-semibold leading-4 text-[#ff8b8f] shadow-xl backdrop-blur-xl">
          {error}
        </div>
      )}

      {menuOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-[70] bg-black/48 backdrop-blur-[2px]"
        />
      )}

      <aside
        aria-hidden={!menuOpen}
        className={
          "fixed inset-y-0 left-0 z-[80] flex w-[min(82vw,320px)] flex-col border-r border-white/10 bg-[#0b0b0b]/98 shadow-[28px_0_70px_rgba(0,0,0,.42)] backdrop-blur-2xl transition-transform duration-300 ease-out " +
          (menuOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="border-b border-white/10 px-4 pb-4 pt-[max(18px,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white">
                <img
                  src={LOGO}
                  alt="Alentó Pizza"
                  className="h-10 w-10 rounded-xl object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#ff454b]">
                  Repartidor
                </p>
                <b className="mt-0.5 block truncate text-[15px] font-black">
                  {driver.name}
                </b>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Cerrar menú"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xl text-white/55 transition active:bg-white/10"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 text-[8px] font-black uppercase tracking-[0.14em] text-white/28">
            Navegación
          </p>

          <div className="mt-2 space-y-1.5">
            {navItems.map((item) => {
              const active = item.id === tab;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setMenuOpen(false);
                  }}
                  className={
                    "flex h-14 w-full items-center gap-3 rounded-[18px] px-3.5 text-left transition active:scale-[.99] " +
                    (active
                      ? "bg-[#e21a22] text-white shadow-[0_10px_24px_rgba(226,26,34,.18)]"
                      : "text-white/58 hover:bg-white/[0.05]")
                  }
                >
                  <span
                    className={
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
                      (active ? "bg-white/12" : "bg-white/[0.055]")
                    }
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 text-[12px] font-black">
                    {item.label}
                  </span>
                  <span className={active ? "text-white/70" : "text-white/20"}>
                    ›
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/10 px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-4">
          <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.035] px-3.5 py-3">
            <p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/28">
              Estado
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={
                  "h-2 w-2 rounded-full " +
                  (driver.driverAvailable
                    ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,.62)]"
                    : "bg-[#e21a22] shadow-[0_0_10px_rgba(226,26,34,.55)]")
                }
              />
              <b
                className={
                  "text-[10px] " +
                  (driver.driverAvailable ? "text-emerald-300" : "text-[#ff6267]")
                }
              >
                {driver.driverAvailable ? "Activo" : "Inactivo"}
              </b>
            </div>
            {driver.driverAvailable && (
              <div className="mt-2.5 rounded-[13px] border border-white/[0.07] bg-black/20 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.08em] text-white/42">
                    <span
                      className={
                        "h-2 w-2 rounded-full " +
                        (gpsState.tone === "live"
                          ? "bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,.7)]"
                          : gpsState.tone === "recent"
                            ? "bg-amber-300 shadow-[0_0_9px_rgba(252,211,77,.6)]"
                            : gpsState.tone === "stale"
                              ? "bg-[#ff6267] shadow-[0_0_9px_rgba(255,98,103,.6)]"
                              : "bg-white/25")
                      }
                    />
                    {driver.driverLocationSource === "ANDROID_NATIVE"
                      ? "Android nativo"
                      : driver.driverLocationSource === "WEB"
                        ? "Web"
                        : nativeGps
                          ? "Android · esperando"
                          : "GPS"}
                  </span>
                  <b
                    className={
                      "text-[8px] " +
                      (gpsState.tone === "live"
                        ? "text-emerald-300"
                        : gpsState.tone === "recent"
                          ? "text-amber-200"
                          : gpsState.tone === "stale"
                            ? "text-[#ff777c]"
                            : "text-white/45")
                    }
                  >
                    {gpsState.label}
                  </b>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[8px] font-semibold text-white/36">
                  <span>
                    {driver.driverLocationAccuracy != null
                      ? `Precisión ±${Math.round(driver.driverLocationAccuracy)} m`
                      : "Precisión pendiente"}
                  </span>
                  <span className="text-white/15">·</span>
                  <span>{gpsAgeLabel(gpsState.ageSeconds)}</span>
                </div>
              </div>
            )}

            {assignedPendingCount > 0 && (
              <p className="mt-2 text-[9px] leading-4 text-white/38">
                {assignedPendingCount === 1
                  ? "1 domicilio asignado pendiente de entrega."
                  : `${assignedPendingCount} domicilios asignados pendientes de entrega.`}
              </p>
            )}
          </div>

          <DriverPushControl />

          <button
            type="button"
            disabled={busyLogout}
            onClick={() => void logout()}
            className="mt-2.5 flex h-12 w-full items-center justify-between rounded-[16px] border border-[#e21a22]/20 bg-[#e21a22]/[0.07] px-3.5 text-left text-[#ff6b70] transition active:scale-[.99] disabled:opacity-50"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e21a22]/12">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10 17l5-5-5-5" />
                  <path d="M15 12H3" />
                  <path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />
                </svg>
              </span>
              <b className="text-[10px]">
                {busyLogout ? "Cerrando sesión..." : "Cerrar sesión"}
              </b>
            </span>
            <span className="text-white/20">›</span>
          </button>
        </div>
      </aside>
    </main>
  );
}
