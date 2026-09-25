"use client";

import { useEffect, useRef, useState } from "react";
import {
  createAlentoMapPinElement,
  createDeliveryMapPinElement,
} from "@/lib/alentoMapMarker";

const MAP_ID = "b0bfaae2809a720a6204509b";
const WALK_COLOR = "#2563eb";
const MOTORCYCLE_COLOR = "#e21a22";

type RouteSummary = {
  distanceMeters: number;
  durationSeconds: number | null;
  encodedPolyline: string;
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

export default function ChatwootCustomerRouteMap({
  origin,
  destination,
  walkingRoute,
  motorcycleRoute,
}: {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  walkingRoute: RouteSummary | null;
  motorcycleRoute: RouteSummary | null;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const storeMarkerRef = useRef<GoogleAdvancedMarkerInstance | null>(null);
  const destinationMarkerRef = useRef<GoogleAdvancedMarkerInstance | null>(null);
  const walkingPolylineRef = useRef<GooglePolylineInstance | null>(null);
  const motorcyclePolylineRef = useRef<GooglePolylineInstance | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;

    async function setup() {
      if (!hostRef.current) return;

      try {
        const google = await loadGoogleMaps();
        await google.maps.importLibrary("maps");
        await google.maps.importLibrary("geometry");
        const { AdvancedMarkerElement } =
          (await google.maps.importLibrary("marker")) as GoogleMarkerLibrary;

        if (disposed || !hostRef.current) return;

        const originPoint = {
          lat: origin.latitude,
          lng: origin.longitude,
        };
        const destinationPoint = {
          lat: destination.latitude,
          lng: destination.longitude,
        };

        const map =
          mapRef.current ??
          new google.maps.Map(hostRef.current, {
            center: originPoint,
            zoom: 15,
            mapId: MAP_ID,
            disableDefaultUI: true,
            zoomControl: true,
            clickableIcons: false,
            gestureHandling: "cooperative",
          });

        mapRef.current = map;

        if (!storeMarkerRef.current) {
          storeMarkerRef.current = new AdvancedMarkerElement({
            map,
            position: originPoint,
            title: "Alentó Pizza",
            content: createAlentoMapPinElement(),
            zIndex: 40,
          });
        }

        if (!destinationMarkerRef.current) {
          destinationMarkerRef.current = new AdvancedMarkerElement({
            map,
            position: destinationPoint,
            title: "Cliente",
            content: createDeliveryMapPinElement(),
            zIndex: 45,
          });
        }

        walkingPolylineRef.current?.setMap(null);
        motorcyclePolylineRef.current?.setMap(null);
        walkingPolylineRef.current = null;
        motorcyclePolylineRef.current = null;

        const bounds = new google.maps.LatLngBounds();
        bounds.extend(originPoint);
        bounds.extend(destinationPoint);

        if (
          walkingRoute?.encodedPolyline &&
          google.maps.geometry?.encoding?.decodePath
        ) {
          const walkingPath = google.maps.geometry.encoding.decodePath(
            walkingRoute.encodedPolyline,
          );

          walkingPolylineRef.current = new google.maps.Polyline({
            map,
            path: walkingPath,
            strokeColor: WALK_COLOR,
            strokeOpacity: 0.96,
            strokeWeight: 7,
            geodesic: true,
            zIndex: 20,
          });

          walkingPath.forEach((point) =>
            bounds.extend({ lat: point.lat(), lng: point.lng() }),
          );
        }

        if (
          motorcycleRoute?.encodedPolyline &&
          google.maps.geometry?.encoding?.decodePath
        ) {
          const motorcyclePath = google.maps.geometry.encoding.decodePath(
            motorcycleRoute.encodedPolyline,
          );

          motorcyclePolylineRef.current = new google.maps.Polyline({
            map,
            path: motorcyclePath,
            strokeColor: MOTORCYCLE_COLOR,
            strokeOpacity: 0.9,
            strokeWeight: 5,
            geodesic: true,
            zIndex: 30,
          });

          motorcyclePath.forEach((point) =>
            bounds.extend({ lat: point.lat(), lng: point.lng() }),
          );
        }

        map.fitBounds(bounds, {
          top: 42,
          right: 42,
          bottom: 42,
          left: 42,
        });

        setError("");
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

    void setup();

    return () => {
      disposed = true;
      walkingPolylineRef.current?.setMap(null);
      motorcyclePolylineRef.current?.setMap(null);
      walkingPolylineRef.current = null;
      motorcyclePolylineRef.current = null;
      if (storeMarkerRef.current) storeMarkerRef.current.map = null;
      if (destinationMarkerRef.current) destinationMarkerRef.current.map = null;
      storeMarkerRef.current = null;
      destinationMarkerRef.current = null;
      mapRef.current = null;
    };
  }, [
    destination.latitude,
    destination.longitude,
    motorcycleRoute?.encodedPolyline,
    origin.latitude,
    origin.longitude,
    walkingRoute?.encodedPolyline,
  ]);

  return (
    <div className="relative h-full min-h-[245px] overflow-hidden rounded-[18px] bg-[#0d0e10]">
      <div ref={hostRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/95 px-3 py-1.5 text-[10px] font-black text-neutral-900 shadow-lg">
          <i
            className="h-2.5 w-6 rounded-full"
            style={{ backgroundColor: WALK_COLOR }}
          />
          A pie
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/95 px-3 py-1.5 text-[10px] font-black text-neutral-900 shadow-lg">
          <i
            className="h-2.5 w-6 rounded-full"
            style={{ backgroundColor: MOTORCYCLE_COLOR }}
          />
          Moto
        </span>
      </div>

      {error ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#111]/90 px-6 text-center text-[12px] font-semibold text-white">
          {error}
        </div>
      ) : null}
    </div>
  );
}
