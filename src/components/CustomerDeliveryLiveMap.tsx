"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAP_ID = "b0bfaae2809a720a6204509b";

type LivePayload = {
  status: string;
  driver: { name: string } | null;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    updatedAt: string | null;
    stale: boolean;
  } | null;
  destination: {
    formattedAddress: string;
    latitude: number;
    longitude: number;
  } | null;
  route: {
    distanceMeters: number;
    durationSeconds: number | null;
    encodedPolyline: string;
  } | null;
};

type GoogleMapInstance = {
  fitBounds: (
    bounds: unknown,
    padding?:
      | number
      | { top: number; right: number; bottom: number; left: number },
  ) => void;
};

type GoogleAdvancedMarkerInstance = {
  map: GoogleMapInstance | null;
  position?: { lat: number; lng: number };
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
    Marker: new (options: Record<string, unknown>) => {
      setMap: (map: GoogleMapInstance | null) => void;
    };
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

function formatDistance(meters?: number | null) {
  if (meters == null) return "—";
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return "—";
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function createDriverMarkerElement() {
  const root = document.createElement("div");
  root.style.width = "44px";
  root.style.height = "44px";
  root.style.borderRadius = "999px";
  root.style.background = "#111";
  root.style.border = "3px solid #fff";
  root.style.boxShadow = "0 8px 22px rgba(0,0,0,.30)";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.fontSize = "22px";
  root.textContent = "🛵";
  root.setAttribute("aria-label", "Tu repartidor");
  return root;
}

export default function CustomerDeliveryLiveMap({ token }: { token: string }) {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const driverMarkerRef = useRef<GoogleAdvancedMarkerInstance | null>(null);
  const destinationMarkerRef = useRef<{ setMap: (map: GoogleMapInstance | null) => void } | null>(null);
  const routeRef = useRef<GooglePolylineInstance | null>(null);
  const routeDataRef = useRef<LivePayload["route"]>(null);

  const [data, setData] = useState<LivePayload | null>(null);
  const [routeData, setRouteData] = useState<LivePayload["route"]>(null);
  const [error, setError] = useState("");

  const drawMap = useCallback(
    async (
      next: LivePayload,
      route: LivePayload["route"],
      fit = false,
    ) => {
      if (!mapHostRef.current || !next.location || !next.destination) return;

      const google = await loadGoogleMaps();
      await google.maps.importLibrary("maps");
      await google.maps.importLibrary("geometry");
      const { AdvancedMarkerElement } =
        (await google.maps.importLibrary("marker")) as GoogleMarkerLibrary;

      const driverPoint = {
        lat: next.location.latitude,
        lng: next.location.longitude,
      };
      const destinationPoint = {
        lat: next.destination.latitude,
        lng: next.destination.longitude,
      };

      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(mapHostRef.current, {
          center: driverPoint,
          zoom: 16,
          mapId: MAP_ID,
          disableDefaultUI: true,
          gestureHandling: "cooperative",
        });
        fit = true;
      }

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new AdvancedMarkerElement({
          map: mapRef.current,
          position: driverPoint,
          title: "Tu repartidor",
          content: createDriverMarkerElement(),
          zIndex: 30,
        });
      } else {
        driverMarkerRef.current.position = driverPoint;
      }

      if (!destinationMarkerRef.current) {
        destinationMarkerRef.current = new google.maps.Marker({
          map: mapRef.current,
          position: destinationPoint,
          title: "Tu ubicación",
          zIndex: 25,
        });
      }

      if (route?.encodedPolyline && google.maps.geometry?.encoding?.decodePath) {
        routeRef.current?.setMap(null);
        const path = google.maps.geometry.encoding.decodePath(
          route.encodedPolyline,
        );
        routeRef.current = new google.maps.Polyline({
          map: mapRef.current,
          path,
          strokeColor: "#e21a22",
          strokeOpacity: 0.96,
          strokeWeight: 5,
          geodesic: true,
        });

        if (fit) {
          const bounds = new google.maps.LatLngBounds();
          path.forEach((point) =>
            bounds.extend({ lat: point.lat(), lng: point.lng() }),
          );
          bounds.extend(driverPoint);
          bounds.extend(destinationPoint);
          mapRef.current.fitBounds(bounds, {
            top: 118,
            right: 52,
            bottom: 70,
            left: 52,
          });
        }
      } else if (fit) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(driverPoint);
        bounds.extend(destinationPoint);
        mapRef.current.fitBounds(bounds, {
          top: 118,
          right: 52,
          bottom: 70,
          left: 52,
        });
      }
    },
    [],
  );

  const fetchLive = useCallback(
    async (withRoute: boolean) => {
      const response = await fetch(
        `/api/seguimiento/${encodeURIComponent(token)}/delivery-live${withRoute ? "?route=1" : ""}`,
        { cache: "no-store" },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "No fue posible actualizar el domicilio.",
        );
      }

      const next = payload as LivePayload;
      setData(next);

      if (next.route) {
        routeDataRef.current = next.route;
        setRouteData(next.route);
      }

      await drawMap(
        next,
        next.route ?? routeDataRef.current,
        Boolean(next.route),
      );
    },
    [drawMap, token],
  );

  useEffect(() => {
    let disposed = false;

    async function start() {
      try {
        await fetchLive(true);
        if (!disposed) setError("");
      } catch (err) {
        if (!disposed) {
          setError(
            err instanceof Error
              ? err.message
              : "No fue posible cargar el seguimiento en vivo.",
          );
        }
      }
    }

    void start();

    const locationTimer = window.setInterval(() => {
      void fetchLive(false).catch(() => undefined);
    }, 5000);

    const routeTimer = window.setInterval(() => {
      void fetchLive(true).catch(() => undefined);
    }, 15000);

    return () => {
      disposed = true;
      window.clearInterval(locationTimer);
      window.clearInterval(routeTimer);
      driverMarkerRef.current && (driverMarkerRef.current.map = null);
      destinationMarkerRef.current?.setMap(null);
      routeRef.current?.setMap(null);
      mapRef.current = null;
    };
  }, [fetchLive]);

  const driverName = data?.driver?.name || "Tu repartidor";
  const locationReady = Boolean(data?.location && data?.destination);

  return (
    <section className="mb-4 overflow-hidden rounded-[22px] border border-white/10 bg-[#111] text-white shadow-[0_18px_46px_rgba(0,0,0,.28)]">
      <div className="relative aspect-[4/3] min-h-[250px] overflow-hidden bg-[#080808]">
        <div ref={mapHostRef} className="absolute inset-0" />

        <div className="pointer-events-none absolute left-3 right-3 top-3 z-20">
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-[#111]/94 p-2.5 shadow-xl backdrop-blur-xl sm:left-4 sm:right-4">
            <div className="min-w-0 px-1">
              <p className="text-[8px] font-black uppercase tracking-[0.11em] text-[#ff454b]">
                Tu repartidor
              </p>
              <h3 className="mt-0.5 truncate text-[14px] font-black">
                {driverName}
              </h3>
            </div>

            <div className="grid shrink-0 grid-cols-2 divide-x divide-white/10 overflow-hidden rounded-[14px] border border-white/[0.07] bg-white/[0.055]">
              <div className="min-w-[76px] px-2.5 py-2 text-center">
                <span className="block text-[7px] font-black uppercase tracking-[.08em] text-white/35">
                  Distancia
                </span>
                <b className="mt-0.5 block text-[12px]">
                  {formatDistance(routeData?.distanceMeters)}
                </b>
              </div>
              <div className="min-w-[68px] px-2.5 py-2 text-center">
                <span className="block text-[7px] font-black uppercase tracking-[.08em] text-white/35">
                  Tiempo
                </span>
                <b className="mt-0.5 block text-[12px]">
                  {formatDuration(routeData?.durationSeconds)}
                </b>
              </div>
            </div>
          </div>
        </div>

        {!locationReady && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <div>
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#e21a22]/12 text-xl">
                🛵
              </div>
              <b className="mt-3 block text-[12px]">
                Ubicando a tu repartidor
              </b>
              <p className="mt-1 text-[10px] leading-4 text-white/45">
                La ubicación aparecerá aquí apenas recibamos una señal reciente.
              </p>
            </div>
          </div>
        )}

        {data?.location?.stale && (
          <div className="absolute bottom-3 left-3 right-3 rounded-[14px] border border-white/10 bg-[#111]/92 px-3 py-2 text-center text-[9px] font-semibold text-white/55 backdrop-blur-md">
            Actualizando la ubicación del repartidor…
          </div>
        )}
      </div>

      {error && (
        <div className="border-t border-[#e21a22]/15 bg-[#e21a22]/[0.07] px-4 py-2.5 text-[9px] font-semibold text-[#ff8b8f]">
          {error}
        </div>
      )}
    </section>
  );
}
