"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createAlentoMapPinElement } from "@/lib/alentoMapMarker";

const ALENTO_DELIVERY_MAP_ID = "b0bfaae2809a720a6204509b";

const ZONE_COLORS = [
  "#16a34a",
  "#eab308",
  "#f97316",
  "#e21a22",
  "#7c3aed",
  "#0284c7",
  "#db2777",
  "#0f766e",
];

type CoverageBand = {
  id: string;
  name: string;
  minMeters: number;
  maxMeters: number;
  fee: number;
  active: boolean;
};

type GoogleMapInstance = {
  fitBounds: (
    bounds: unknown,
    padding?: number | { top: number; right: number; bottom: number; left: number },
  ) => void;
};

type GoogleCircleInstance = {
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

type GoogleBoundsInstance = {
  extend: (point: { lat: number; lng: number }) => void;
};

type GoogleMapsRuntime = {
  maps: {
    importLibrary: (library: string) => Promise<unknown>;
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => GoogleMapInstance;
    Circle: new (options: Record<string, unknown>) => GoogleCircleInstance;
    LatLngBounds: new () => GoogleBoundsInstance;
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

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function distance(value: number) {
  if (value < 1000) return `${Math.round(value)} m`;
  const kilometers = value / 1000;
  return `${kilometers.toFixed(value % 1000 === 0 ? 0 : 1)} km`;
}

function extendRadiusBounds(
  bounds: GoogleBoundsInstance,
  latitude: number,
  longitude: number,
  radiusMeters: number,
) {
  const latDelta = radiusMeters / 111_320;
  const cosine = Math.max(
    0.2,
    Math.cos((latitude * Math.PI) / 180),
  );
  const lngDelta = radiusMeters / (111_320 * cosine);

  bounds.extend({ lat: latitude + latDelta, lng: longitude });
  bounds.extend({ lat: latitude - latDelta, lng: longitude });
  bounds.extend({ lat: latitude, lng: longitude + lngDelta });
  bounds.extend({ lat: latitude, lng: longitude - lngDelta });
}

export default function DeliveryCoverageMap({
  latitude,
  longitude,
  bands,
}: {
  latitude: number;
  longitude: number;
  bands: CoverageBand[];
}) {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRef = useRef<GoogleAdvancedMarkerInstance | null>(null);
  const circleRefs = useRef<GoogleCircleInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeBands = useMemo(
    () =>
      bands
        .filter(
          (band) =>
            band.active &&
            Number.isFinite(band.minMeters) &&
            Number.isFinite(band.maxMeters) &&
            band.maxMeters >= 0,
        )
        .sort((a, b) => a.minMeters - b.minMeters),
    [bands],
  );

  const bandKey = activeBands
    .map(
      (band) =>
        `${band.id}:${band.name}:${band.minMeters}:${band.maxMeters}:${band.fee}`,
    )
    .join("|");

  useEffect(() => {
    let disposed = false;

    async function setup() {
      if (!mapHostRef.current) return;

      setLoading(true);
      setError("");

      try {
        const google = await loadGoogleMaps();
        await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } =
          (await google.maps.importLibrary("marker")) as GoogleMarkerLibrary;

        if (disposed || !mapHostRef.current) return;

        const center = { lat: latitude, lng: longitude };
        const map = new google.maps.Map(mapHostRef.current, {
          center,
          zoom: 14,
          mapId: ALENTO_DELIVERY_MAP_ID,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });

        mapRef.current = map;

        const marker = new AdvancedMarkerElement({
          map,
          position: center,
          title: "Alentó Pizza",
          content: createAlentoMapPinElement(),
          zIndex: 80,
        });
        markerRef.current = marker;

        circleRefs.current.forEach((circle) => circle.setMap(null));
        circleRefs.current = [];

        const outerToInner = [...activeBands].sort(
          (a, b) => b.maxMeters - a.maxMeters,
        );

        outerToInner.forEach((band) => {
          const originalIndex = activeBands.findIndex(
            (candidate) => candidate.id === band.id,
          );
          const color =
            ZONE_COLORS[
              Math.max(0, originalIndex) % ZONE_COLORS.length
            ];

          const circle = new google.maps.Circle({
            map,
            center,
            radius: Math.max(1, band.maxMeters),
            strokeColor: color,
            strokeOpacity: 0.92,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.08,
            clickable: false,
            zIndex: 10 + Math.max(0, originalIndex),
          });

          circleRefs.current.push(circle);
        });

        const bounds = new google.maps.LatLngBounds();
        bounds.extend(center);

        const maxRadius = activeBands.length
          ? Math.max(...activeBands.map((band) => band.maxMeters))
          : 0;

        if (maxRadius > 0) {
          extendRadiusBounds(
            bounds,
            latitude,
            longitude,
            maxRadius,
          );
          map.fitBounds(bounds, {
            top: 48,
            right: 48,
            bottom: 48,
            left: 48,
          });
        }
      } catch (err) {
        if (!disposed) {
          setError(
            err instanceof Error
              ? err.message
              : "No fue posible cargar el mapa de cobertura.",
          );
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    void setup();

    return () => {
      disposed = true;
      circleRefs.current.forEach((circle) => circle.setMap(null));
      circleRefs.current = [];
      if (markerRef.current) markerRef.current.map = null;
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [activeBands, bandKey, latitude, longitude]);

  return (
    <div className="mt-5 overflow-hidden rounded-[22px] border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <b className="block text-[14px] text-neutral-900">
              Mapa de cobertura visual
            </b>
            <p className="mt-1 text-[11px] leading-5 text-neutral-500">
              Los círculos muestran los rangos reales usados para cobrar el domicilio según la distancia directa desde Alentó.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-neutral-500">
            Cobertura real
          </span>
        </div>
      </div>

      <div className="relative min-h-[420px] bg-neutral-100">
        <div ref={mapHostRef} className="absolute inset-0" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-[12px] font-semibold text-neutral-500 backdrop-blur-sm">
            Dibujando zonas...
          </div>
        )}

        {!loading && activeBands.length === 0 && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 px-6 text-center text-[12px] font-semibold text-neutral-500 backdrop-blur-sm">
            Activa al menos una zona para visualizar su cobertura.
          </div>
        )}
      </div>

      <div className="border-t border-neutral-100 px-4 py-4 sm:px-5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {activeBands.map((band, index) => {
            const color = ZONE_COLORS[index % ZONE_COLORS.length];

            return (
              <div
                key={band.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-[#faf9f7] px-3 py-2.5"
              >
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: color }}
                />
                <div className="min-w-0">
                  <b className="block truncate text-[10px] text-neutral-900">
                    {band.name}
                  </b>
                  <span className="block text-[9px] leading-4 text-neutral-500">
                    {distance(band.minMeters)} – {distance(band.maxMeters)}
                    {" · "}
                    {money(band.fee)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[10px] font-semibold leading-4 text-amber-800">
          La tarifa se determina por estos rangos de distancia directa. Las rutas a pie y en moto se usan únicamente para la operación del domicilio y no modifican el precio.
        </div>
      </div>

      {error && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
