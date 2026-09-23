"use client";

import { useEffect, useRef, useState } from "react";

const MAP_ID = "b0bfaae2809a720a6204509b";

type RoutePayload = {
  driver: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    updatedAt: string;
  };
  destination: {
    formattedAddress: string;
    latitude: number;
    longitude: number;
  };
  route: {
    distanceMeters: number;
    durationSeconds: number | null;
    encodedPolyline: string;
  };
};

type GoogleMap = {
  fitBounds: (bounds: unknown, padding?: number | Record<string, number>) => void;
};

type GoogleRuntime = {
  maps: {
    importLibrary: (name: string) => Promise<unknown>;
    Map: new (el: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Marker: new (options: Record<string, unknown>) => { setPosition: (p: {lat:number;lng:number}) => void; setMap: (m: GoogleMap | null) => void };
    Polyline: new (options: Record<string, unknown>) => { setMap: (m: GoogleMap | null) => void };
    LatLngBounds: new () => { extend: (p: {lat:number;lng:number}) => void };
    geometry?: {
      encoding?: {
        decodePath: (encoded: string) => Array<{lat:()=>number;lng:()=>number}>;
      };
    };
  };
};

function getGoogle() {
  return (window as typeof window & { google?: GoogleRuntime }).google;
}

function installMaps(key: string) {
  if (getGoogle()?.maps?.importLibrary) return;

  const id = "alento-driver-google-maps-bootstrap";
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

async function loadMaps() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new Error("Google Maps no está configurado.");
  installMaps(key);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const runtime = getGoogle();
    if (runtime?.maps?.importLibrary) return runtime;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Google Maps no pudo iniciar.");
}

function distanceLabel(meters: number) {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

function durationLabel(seconds: number | null) {
  if (!seconds) return "—";
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export default function DriverNavigationModal({
  token,
  open,
  onClose,
}: {
  token: string;
  open: boolean;
  onClose: () => void;
}) {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const driverMarkerRef = useRef<{ setPosition: (p:{lat:number;lng:number})=>void; setMap:(m:GoogleMap|null)=>void } | null>(null);
  const destinationMarkerRef = useRef<{ setMap:(m:GoogleMap|null)=>void } | null>(null);
  const polylineRef = useRef<{ setMap:(m:GoogleMap|null)=>void } | null>(null);
  const lastRouteAtRef = useRef(0);
  const watchRef = useRef<number | null>(null);

  const [route, setRoute] = useState<RoutePayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function draw(data: RoutePayload) {
    if (!mapHostRef.current) return;

    const google = await loadMaps();
    await google.maps.importLibrary("maps");
    await google.maps.importLibrary("geometry");

    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(mapHostRef.current, {
        center: { lat: data.driver.latitude, lng: data.driver.longitude },
        zoom: 15,
        mapId: MAP_ID,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
      });
    }

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        map: mapRef.current,
        position: { lat: data.driver.latitude, lng: data.driver.longitude },
        title: "Repartidor",
        label: { text: "🛵", fontSize: "22px" },
      });
    } else {
      driverMarkerRef.current.setPosition({
        lat: data.driver.latitude,
        lng: data.driver.longitude,
      });
    }

    destinationMarkerRef.current?.setMap(null);
    destinationMarkerRef.current = new google.maps.Marker({
      map: mapRef.current,
      position: {
        lat: data.destination.latitude,
        lng: data.destination.longitude,
      },
      title: "Cliente",
    });

    polylineRef.current?.setMap(null);
    if (
      data.route.encodedPolyline &&
      google.maps.geometry?.encoding?.decodePath
    ) {
      const path = google.maps.geometry.encoding.decodePath(
        data.route.encodedPolyline,
      );

      polylineRef.current = new google.maps.Polyline({
        map: mapRef.current,
        path,
        strokeColor: "#e21a22",
        strokeOpacity: 0.96,
        strokeWeight: 6,
        geodesic: true,
      });

      const bounds = new google.maps.LatLngBounds();
      for (const point of path) {
        bounds.extend({ lat: point.lat(), lng: point.lng() });
      }
      bounds.extend({
        lat: data.driver.latitude,
        lng: data.driver.longitude,
      });
      bounds.extend({
        lat: data.destination.latitude,
        lng: data.destination.longitude,
      });

      mapRef.current.fitBounds(bounds, {
        top: 90,
        right: 44,
        bottom: 64,
        left: 44,
      });
    }
  }

  async function refreshNavigation(position: GeolocationPosition, forceRoute = false) {
    const location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };

    void fetch(
      `/api/repartidor/pedido/${encodeURIComponent(token)}/location`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      },
    );

    if (!forceRoute && Date.now() - lastRouteAtRef.current < 15000) {
      if (route && driverMarkerRef.current) {
        driverMarkerRef.current.setPosition({
          lat: location.latitude,
          lng: location.longitude,
        });
      }
      return;
    }

    lastRouteAtRef.current = Date.now();

    const response = await fetch(
      `/api/repartidor/pedido/${encodeURIComponent(token)}/navigation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "No fue posible calcular la navegación.");
    }

    setRoute(data);
    await draw(data);
  }

  useEffect(() => {
    if (!open) return;

    if (!navigator.geolocation) {
      setError("Este dispositivo no permite obtener ubicación.");
      return;
    }

    setLoading(true);
    setError("");

    let first = true;
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        void refreshNavigation(position, first)
          .catch((err) =>
            setError(
              err instanceof Error
                ? err.message
                : "No fue posible actualizar la navegación.",
            ),
          )
          .finally(() => setLoading(false));
        first = false;
      },
      (err) => {
        setLoading(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Permite el acceso a tu ubicación para navegar."
            : "No fue posible obtener tu ubicación actual.",
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );

    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  if (!open) return null;

  const googleMapsHref = route
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${route.destination.latitude},${route.destination.longitude}`,
      )}&travelmode=driving`
    : null;

  return (
    <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/76 backdrop-blur-[4px] sm:items-center sm:p-4">
      <div className="flex h-[92dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0d0d0d] text-white shadow-[0_30px_100px_rgba(0,0,0,.55)] sm:h-[86dvh] sm:rounded-[28px]">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ff454b]">
              Navegación
            </p>
            <h2 className="mt-1 text-[18px] font-black">
              Ir hacia el cliente
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xl text-white/70"
            aria-label="Cerrar navegación"
          >
            ×
          </button>
        </header>

        <div className="relative min-h-0 flex-1">
          <div ref={mapHostRef} className="absolute inset-0" />

          <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 grid grid-cols-2 overflow-hidden rounded-[18px] border border-white/10 bg-[#111]/94 shadow-xl backdrop-blur-md">
            <div className="px-4 py-3">
              <span className="block text-[8px] font-black uppercase tracking-[.12em] text-white/35">
                Distancia
              </span>
              <b className="mt-1 block text-[15px]">
                {route ? distanceLabel(route.route.distanceMeters) : "—"}
              </b>
            </div>
            <div className="border-l border-white/10 px-4 py-3">
              <span className="block text-[8px] font-black uppercase tracking-[.12em] text-white/35">
                Tiempo
              </span>
              <b className="mt-1 block text-[15px]">
                {route ? durationLabel(route.route.durationSeconds) : "—"}
              </b>
            </div>
          </div>

          {(loading || error) && (
            <div className="absolute inset-x-3 bottom-3 z-10 rounded-[16px] border border-white/10 bg-[#111]/94 px-3.5 py-3 text-[10px] font-semibold shadow-xl backdrop-blur-md">
              {loading ? "Calculando ruta…" : error}
            </div>
          )}
        </div>

        <footer className="border-t border-white/10 bg-[#0b0b0b] p-3 sm:p-4">
          {route && (
            <div className="mb-3 rounded-[14px] border border-white/[0.07] bg-white/[0.035] px-3.5 py-2.5">
              <span className="block text-[8px] font-black uppercase tracking-[.11em] text-white/30">
                Destino
              </span>
              <b className="mt-1 block truncate text-[11px] text-white/75">
                {route.destination.formattedAddress}
              </b>
            </div>
          )}

          <a
            href={googleMapsHref ?? "#"}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!googleMapsHref}
            className={
              "flex h-12 w-full items-center justify-center rounded-full text-[11px] font-black uppercase tracking-[.06em] " +
              (googleMapsHref
                ? "bg-[#e21a22] text-white"
                : "pointer-events-none bg-white/10 text-white/30")
            }
          >
            Abrir en Google Maps
          </a>
        </footer>
      </div>
    </div>
  );
}
