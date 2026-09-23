"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createAlentoMapPinElement } from "@/lib/alentoMapMarker";

const ALENTO_DELIVERY_MAP_ID = "b0bfaae2809a720a6204509b";

type Point = {
  latitude: number;
  longitude: number;
};

type NavigationData = {
  driver: Point & {
    accuracy?: number | null;
    updatedAt: string;
  };
  destination: Point & {
    formattedAddress: string;
  };
  route: {
    distanceMeters: number;
    durationSeconds: number | null;
    encodedPolyline: string;
  };
};

type StoreOrigin = Point & {
  formattedAddress?: string;
};

type GoogleMapInstance = {
  fitBounds: (
    bounds: unknown,
    padding?:
      | number
      | { top: number; right: number; bottom: number; left: number },
  ) => void;
};

type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleAdvancedMarkerInstance = {
  map: GoogleMapInstance | null;
};

type GoogleMarkerLibrary = {
  AdvancedMarkerElement: new (options: {
    map: GoogleMapInstance;
    position: { lat: number; lng: number };
    title?: string;
    content?: Node;
    zIndex?: number;
  }) => GoogleAdvancedMarkerInstance;
};

type GooglePolylineInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleLatLngBoundsInstance = {
  extend: (point: { lat: number; lng: number }) => void;
};

type GoogleMapsRuntime = {
  maps: {
    importLibrary: (library: string) => Promise<unknown>;
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => GoogleMapInstance;
    Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance;
    Polyline: new (options: Record<string, unknown>) => GooglePolylineInstance;
    LatLngBounds: new () => GoogleLatLngBoundsInstance;
    geometry?: {
      encoding?: {
        decodePath: (
          encoded: string,
        ) => Array<{ lat: () => number; lng: () => number }>;
      };
    };
  };
};

function getGoogleWindow() {
  return window as typeof window & { google?: GoogleMapsRuntime };
}

function installGoogleMapsBootstrap(key: string) {
  if (getGoogleWindow().google?.maps?.importLibrary) return;

  const bootstrapId = "alento-google-maps-bootstrap";
  if (document.getElementById(bootstrapId)) return;

  const script = document.createElement("script");
  script.id = bootstrapId;
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
      key: "__ALENTO_MAPS_KEY__",
      v: "weekly",
      language: "es",
      region: "CO"
    });
  `;
  script.textContent = script.textContent.replace(
    '"__ALENTO_MAPS_KEY__"',
    JSON.stringify(key),
  );
  document.head.appendChild(script);
}

async function loadGoogleMaps() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new Error("Google Maps no está configurado.");

  installGoogleMapsBootstrap(key);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const runtime = getGoogleWindow().google;
    if (runtime?.maps?.importLibrary) return runtime;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  throw new Error("No fue posible iniciar Google Maps.");
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds < 60) return "—";
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function createDriverMarkerElement() {
  const root = document.createElement("div");
  root.style.width = "42px";
  root.style.height = "42px";
  root.style.borderRadius = "999px";
  root.style.background = "#111";
  root.style.border = "3px solid #fff";
  root.style.boxShadow = "0 8px 20px rgba(0,0,0,.28)";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.fontSize = "21px";
  root.textContent = "🛵";
  return root;
}

export default function DriverDestinationActions({
  token,
  phone,
  customerName,
  currentStatus,
}: {
  token: string;
  phone: string | null;
  customerName: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const arrivalTrackRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRefs = useRef<Array<GoogleMarkerInstance | GoogleAdvancedMarkerInstance>>([]);
  const routeRef = useRef<GooglePolylineInstance | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastRouteAtRef = useRef(0);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [navigation, setNavigation] = useState<NavigationData | null>(null);
  const [origin, setOrigin] = useState<StoreOrigin | null>(null);
  const [error, setError] = useState("");
  const [arrivalProgress, setArrivalProgress] = useState(0);
  const [arrivalDragging, setArrivalDragging] = useState(false);
  const [arrivalBusy, setArrivalBusy] = useState(false);

  const resetMap = useCallback(() => {
    markerRefs.current.forEach((marker) => {
      if ("setMap" in marker) marker.setMap(null);
      else marker.map = null;
    });
    markerRefs.current = [];
    routeRef.current?.setMap(null);
    routeRef.current = null;
    mapRef.current = null;
  }, []);

  const drawMap = useCallback(
    async (data: NavigationData, store: StoreOrigin | null) => {
      if (!mapHostRef.current) return;

      const google = await loadGoogleMaps();
      await google.maps.importLibrary("maps");
      await google.maps.importLibrary("geometry");
      const { AdvancedMarkerElement } =
        (await google.maps.importLibrary("marker")) as GoogleMarkerLibrary;

      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(mapHostRef.current, {
          center: {
            lat: data.driver.latitude,
            lng: data.driver.longitude,
          },
          zoom: 15,
          mapId: ALENTO_DELIVERY_MAP_ID,
          disableDefaultUI: true,
          gestureHandling: "greedy",
        });
      }

      markerRefs.current.forEach((marker) => {
        if ("setMap" in marker) marker.setMap(null);
        else marker.map = null;
      });
      markerRefs.current = [];
      routeRef.current?.setMap(null);

      const map = mapRef.current;

      if (store) {
        const storeMarker = new AdvancedMarkerElement({
          map,
          position: { lat: store.latitude, lng: store.longitude },
          title: "Alentó Pizza",
          content: createAlentoMapPinElement(),
          zIndex: 20,
        });
        markerRefs.current.push(storeMarker);
      }

      const driverMarker = new AdvancedMarkerElement({
        map,
        position: {
          lat: data.driver.latitude,
          lng: data.driver.longitude,
        },
        title: "Repartidor",
        content: createDriverMarkerElement(),
        zIndex: 30,
      });
      markerRefs.current.push(driverMarker);

      const customerMarker = new google.maps.Marker({
        map,
        position: {
          lat: data.destination.latitude,
          lng: data.destination.longitude,
        },
        title: customerName,
        zIndex: 25,
      });
      markerRefs.current.push(customerMarker);

      const bounds = new google.maps.LatLngBounds();
      if (store) {
        bounds.extend({ lat: store.latitude, lng: store.longitude });
      }
      bounds.extend({
        lat: data.driver.latitude,
        lng: data.driver.longitude,
      });
      bounds.extend({
        lat: data.destination.latitude,
        lng: data.destination.longitude,
      });

      if (
        data.route.encodedPolyline &&
        google.maps.geometry?.encoding?.decodePath
      ) {
        const path = google.maps.geometry.encoding.decodePath(
          data.route.encodedPolyline,
        );

        routeRef.current = new google.maps.Polyline({
          map,
          path,
          strokeColor: "#e21a22",
          strokeOpacity: 0.96,
          strokeWeight: 5,
          geodesic: true,
        });

        path.forEach((point) => {
          bounds.extend({ lat: point.lat(), lng: point.lng() });
        });
      }

      map.fitBounds(bounds, {
        top: 110,
        right: 42,
        bottom: 60,
        left: 42,
      });
    },
    [customerName],
  );

  const requestNavigation = useCallback(
    async (position: GeolocationPosition) => {
      const response = await fetch(
        `/api/repartidor/pedido/${encodeURIComponent(token)}/navigation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible calcular la ruta.");
      }

      const next = data as NavigationData;
      setNavigation(next);
      return next;
    },
    [token],
  );

  useEffect(() => {
    if (!open) return;

    let disposed = false;

    async function setup() {
      setLoading(true);
      setError("");

      try {
        const originResponse = await fetch("/api/delivery/origin", {
          cache: "no-store",
        });
        const originData = await originResponse.json();
        const nextOrigin =
          originResponse.ok && originData?.origin
            ? (originData.origin as StoreOrigin)
            : null;

        if (!disposed) setOrigin(nextOrigin);

        if (!navigator.geolocation) {
          throw new Error("Este dispositivo no permite obtener ubicación.");
        }

        window.localStorage.setItem(
          `alento-driver-location-sharing:${token}`,
          "1",
        );

        watchRef.current = navigator.geolocation.watchPosition(
          async (position) => {
            if (disposed) return;

            const now = Date.now();
            const shouldRoute =
              now - lastRouteAtRef.current >= 8000;

            if (!shouldRoute) return;

            lastRouteAtRef.current = now;

            try {
              const next = await requestNavigation(position);
              if (nextOrigin) await drawMap(next, nextOrigin);
              if (!disposed) setError("");
            } catch (err) {
              if (!disposed) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "No fue posible actualizar la ruta.",
                );
              }
            } finally {
              if (!disposed) setLoading(false);
            }
          },
          (geoError) => {
            if (disposed) return;

            setLoading(false);
            setError(
              geoError.code === geoError.PERMISSION_DENIED
                ? "Debes permitir la ubicación para navegar."
                : "No fue posible obtener tu ubicación actual.",
            );
          },
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 15000,
          },
        );
      } catch (err) {
        if (!disposed) {
          setLoading(false);
          setError(
            err instanceof Error
              ? err.message
              : "No fue posible iniciar la navegación.",
          );
        }
      }
    }

    void setup();

    return () => {
      disposed = true;
      if (watchRef.current != null) {
        navigator.geolocation?.clearWatch(watchRef.current);
      }
      watchRef.current = null;
      lastRouteAtRef.current = 0;
      resetMap();
    };
  }, [drawMap, open, requestNavigation, resetMap, token]);

  function updateArrivalFromPointer(clientX: number) {
    const track = arrivalTrackRef.current;
    if (!track) return 0;

    const rect = track.getBoundingClientRect();
    const knobSize = 54;
    const padding = 4;
    const usable = Math.max(1, rect.width - knobSize - padding * 2);
    const raw = (clientX - rect.left - padding - knobSize / 2) / usable;
    const next = Math.min(1, Math.max(0, raw));
    setArrivalProgress(next);
    return next;
  }

  async function confirmArrival() {
    if (arrivalBusy || currentStatus !== "OUT_FOR_DELIVERY") return;

    setArrivalBusy(true);
    setError("");

    try {
      const response = await fetch(
        `/api/repartidor/pedido/${encodeURIComponent(token)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ARRIVED" }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible registrar la llegada.");
      }

      setOpen(false);
      router.refresh();
      window.setTimeout(() => router.refresh(), 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible registrar la llegada.",
      );
      setArrivalProgress(0);
    } finally {
      setArrivalDragging(false);
      setArrivalBusy(false);
    }
  }

  function finishArrival(nextProgress = arrivalProgress) {
    setArrivalDragging(false);

    if (arrivalBusy || currentStatus !== "OUT_FOR_DELIVERY") {
      setArrivalProgress(0);
      return;
    }

    if (nextProgress >= 0.82) {
      setArrivalProgress(1);
      void confirmArrival();
      return;
    }

    setArrivalProgress(0);
  }

  const googleMapsUrl = navigation
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${navigation.destination.latitude},${navigation.destination.longitude}`,
      )}&travelmode=driving`
    : null;

  return (
    <>
      <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-5">
        {phone && (
          <a
            href={`tel:${phone}`}
            aria-label={`Llamar a ${customerName}`}
            title={`Llamar · ${phone}`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111] text-white shadow-[0_7px_16px_rgba(0,0,0,.18)] transition hover:bg-black active:scale-[.97]"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-[17px] w-[17px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 5.15 12.8 19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.07 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.7a16 16 0 0 0 6.3 6.3l1.24-1.24a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z" />
            </svg>
          </a>
        )}

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir navegación"
          title="Navegar al cliente"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e21a22] text-white shadow-[0_7px_16px_rgba(226,26,34,.22)] transition hover:bg-[#c9151c] active:scale-[.97]"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-[18px] w-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[180] bg-black/78 backdrop-blur-[5px]">
          <div className="mx-auto flex h-full w-full max-w-[760px] flex-col bg-[#080808] text-white sm:h-[calc(100%-2rem)] sm:my-4 sm:overflow-hidden sm:rounded-[28px] sm:border sm:border-white/10">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#ff454b]">
                  Navegación
                </p>
                <h2 className="mt-1 text-[18px] font-black">
                  {customerName}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={googleMapsUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Abrir ruta en Google Maps"
                  title="Abrir en Google Maps"
                  aria-disabled={!googleMapsUrl}
                  className={
                    "flex h-10 w-10 items-center justify-center rounded-full border transition " +
                    (googleMapsUrl
                      ? "border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.10]"
                      : "pointer-events-none border-white/5 bg-white/[0.03] text-white/20")
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-[18px] w-[18px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 5h5v5" />
                    <path d="M10 14 19 5" />
                    <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
                  </svg>
                </a>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xl text-white/70"
                  aria-label="Cerrar navegación"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="relative min-h-0 flex-1">
              <div ref={mapHostRef} className="absolute inset-0" />

              <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 grid grid-cols-2 gap-2 rounded-[18px] border border-white/10 bg-[#111]/94 p-2.5 shadow-xl backdrop-blur-xl sm:left-4 sm:right-4">
                <div className="border-r border-white/10 px-2">
                  <span className="block text-[8px] font-black uppercase tracking-[.1em] text-white/40">
                    Distancia
                  </span>
                  <b className="mt-1 block text-[15px]">
                    {navigation
                      ? formatDistance(navigation.route.distanceMeters)
                      : "—"}
                  </b>
                </div>
                <div className="px-2">
                  <span className="block text-[8px] font-black uppercase tracking-[.1em] text-white/40">
                    Tiempo
                  </span>
                  <b className="mt-1 block text-[15px]">
                    {navigation
                      ? formatDuration(navigation.route.durationSeconds)
                      : "—"}
                  </b>
                </div>
              </div>

              {loading && !navigation && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 text-[11px] font-bold text-white/75 backdrop-blur-sm">
                  Calculando ruta...
                </div>
              )}

              {error && (
                <div className="absolute bottom-3 left-3 right-3 z-20 rounded-[16px] border border-[#e21a22]/25 bg-[#210b0d]/95 px-3 py-3 text-[10px] font-semibold leading-4 text-[#ff8b8f] shadow-xl">
                  {error}
                </div>
              )}
            </div>

            {currentStatus === "OUT_FOR_DELIVERY" && (
              <div className="border-t border-white/10 bg-[#0d0d0d] p-3 sm:p-4">
                <div
                  ref={arrivalTrackRef}
                  className="landing-menu-slider relative h-[62px] w-full overflow-hidden rounded-full border border-white/80 bg-white/95 shadow-[0_16px_44px_rgba(0,0,0,.20)] backdrop-blur-md"
                >
                  <div
                    className="absolute inset-y-1 left-1 z-[1] rounded-full bg-[#e21a22]"
                    style={{
                      width: `calc(54px + (100% - 62px) * ${arrivalProgress})`,
                      transition: arrivalDragging
                        ? "none"
                        : "width 220ms cubic-bezier(.2,.8,.2,1)",
                    }}
                  />

                  <div
                    className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center px-[72px] text-center"
                    style={{
                      opacity: Math.max(0.18, 1 - arrivalProgress * 1.15),
                      transition: arrivalDragging ? "none" : "opacity 180ms ease",
                    }}
                  >
                    <span className="landing-menu-slider-text truncate text-[10px] font-black uppercase tracking-[0.11em] text-black/75">
                      {arrivalBusy
                        ? "Registrando llegada..."
                        : "Desliza cuando hayas llegado"}
                    </span>
                  </div>

                  <button
                    type="button"
                    aria-label="Desliza cuando hayas llegado"
                    disabled={arrivalBusy}
                    className={
                      "absolute top-1 z-[4] flex h-[54px] w-[54px] touch-none select-none items-center justify-center rounded-full bg-black text-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[#e21a22] focus-visible:ring-offset-2 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60 landing-menu-slider-knob " +
                      (!arrivalDragging && arrivalProgress === 0
                        ? "landing-menu-slider-knob-idle"
                        : "")
                    }
                    style={{
                      left: `calc(4px + (100% - 62px) * ${arrivalProgress})`,
                      transition: arrivalDragging
                        ? "none"
                        : "left 220ms cubic-bezier(.2,.8,.2,1)",
                    }}
                    onPointerDown={(event) => {
                      if (arrivalBusy) return;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setArrivalDragging(true);
                      updateArrivalFromPointer(event.clientX);
                    }}
                    onPointerMove={(event) => {
                      if (!arrivalDragging || arrivalBusy) return;
                      updateArrivalFromPointer(event.clientX);
                    }}
                    onPointerUp={(event) => {
                      if (!arrivalDragging || arrivalBusy) return;
                      const next = updateArrivalFromPointer(event.clientX);
                      finishArrival(next);
                    }}
                    onPointerCancel={() => {
                      if (!arrivalBusy) finishArrival(0);
                    }}
                    onKeyDown={(event) => {
                      if (
                        (event.key === "Enter" || event.key === " ") &&
                        !arrivalBusy
                      ) {
                        event.preventDefault();
                        setArrivalProgress(1);
                        void confirmArrival();
                      }
                    }}
                  >
                    {arrivalBusy ? (
                      <span className="text-lg">…</span>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="landing-menu-slider-arrow h-[22px] w-[22px]"
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
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
