"use client";

import { useEffect, useRef, useState } from "react";

const ALENTO_DELIVERY_MAP_ID = "b0bfaae2809a720a6204509b";
const ALENTO_WEB_ICON =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

type GoogleLatLng = {
  lat: () => number;
  lng: () => number;
};

type GoogleMapMouseEvent = {
  latLng?: GoogleLatLng | null;
};

type GoogleMapsListener = {
  remove?: () => void;
};

type GoogleMapInstance = {
  setCenter: (center: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  addListener: (
    eventName: string,
    handler: (event: GoogleMapMouseEvent) => void,
  ) => GoogleMapsListener;
};

type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
  setPosition: (position: { lat: number; lng: number }) => void;
  addListener: (
    eventName: string,
    handler: (event: GoogleMapMouseEvent) => void,
  ) => GoogleMapsListener;
};

type GoogleMapsRuntime = {
  maps: {
    importLibrary: (library: string) => Promise<unknown>;
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => GoogleMapInstance;
    Marker: new (
      options: Record<string, unknown>,
    ) => GoogleMarkerInstance;
    Size: new (width: number, height: number) => unknown;
  };
};

function getGoogleWindow() {
  return window as typeof window & { google?: GoogleMapsRuntime };
}

function installGoogleMapsBootstrap(key: string) {
  if (getGoogleWindow().google?.maps?.importLibrary) return;

  const bootstrapId = "alento-google-maps-bootstrap";
  if (!document.getElementById(bootstrapId)) {
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
}

async function loadGoogleMaps(): Promise<GoogleMapsRuntime> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no está configurada.");
  }

  installGoogleMapsBootstrap(key);

  const runtime = getGoogleWindow().google;
  if (!runtime?.maps?.importLibrary) {
    throw new Error("No fue posible iniciar Google Maps.");
  }

  return runtime;
}

export type StoreOriginLocation = {
  formattedAddress: string;
  placeId: string;
  latitude: number;
  longitude: number;
};

export default function StoreOriginMapPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number;
  longitude: number;
  onChange: (location: StoreOriginLocation) => void;
}) {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRef = useRef<GoogleMarkerInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    const listeners: GoogleMapsListener[] = [];

    async function resolvePoint(nextLatitude: number, nextLongitude: number) {
      setResolving(true);
      setError("");

      try {
        const response = await fetch("/api/settings/store-reverse-geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: nextLatitude,
            longitude: nextLongitude,
          }),
        });
        const data = await response.json();

        if (!response.ok || !data?.location) {
          throw new Error(
            data.error || "No fue posible validar el punto seleccionado.",
          );
        }

        onChange(data.location as StoreOriginLocation);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No fue posible validar el punto seleccionado.",
        );
      } finally {
        setResolving(false);
      }
    }

    async function setup() {
      if (!mapHostRef.current) return;

      setLoading(true);
      setError("");

      try {
        const google = await loadGoogleMaps();
        await google.maps.importLibrary("maps");

        if (disposed || !mapHostRef.current) return;

        const center = { lat: latitude, lng: longitude };

        const map = new google.maps.Map(mapHostRef.current, {
          center,
          zoom: 18,
          mapId: ALENTO_DELIVERY_MAP_ID,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        });

        const marker = new google.maps.Marker({
          map,
          position: center,
          title: "Alentó Pizza",
          draggable: true,
          icon: {
            url: ALENTO_WEB_ICON,
            scaledSize: new google.maps.Size(48, 48),
          },
          zIndex: 30,
        });

        mapRef.current = map;
        markerRef.current = marker;

        listeners.push(
          marker.addListener("dragend", (event) => {
            const nextLat = event.latLng?.lat();
            const nextLng = event.latLng?.lng();

            if (
              typeof nextLat !== "number" ||
              typeof nextLng !== "number"
            ) {
              return;
            }

            map.setCenter({ lat: nextLat, lng: nextLng });
            void resolvePoint(nextLat, nextLng);
          }),
        );

        listeners.push(
          map.addListener("click", (event) => {
            const nextLat = event.latLng?.lat();
            const nextLng = event.latLng?.lng();

            if (
              typeof nextLat !== "number" ||
              typeof nextLng !== "number"
            ) {
              return;
            }

            marker.setPosition({ lat: nextLat, lng: nextLng });
            void resolvePoint(nextLat, nextLng);
          }),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No fue posible cargar Google Maps.",
        );
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    void setup();

    return () => {
      disposed = true;
      listeners.forEach((listener) => listener.remove?.());
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [latitude, longitude, onChange]);

  return (
    <div className="overflow-hidden rounded-[20px] border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div>
          <b className="block text-[13px] text-neutral-900">
            Ajusta el origen exacto
          </b>
          <p className="mt-1 text-[11px] leading-4 text-neutral-500">
            Arrastra el pin de Alentó o toca el mapa para moverlo hasta la entrada exacta.
          </p>
        </div>
        <span
          className={
            "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase " +
            (resolving
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-50 text-emerald-700")
          }
        >
          {resolving ? "Validando..." : "Pin editable"}
        </span>
      </div>

      <div className="relative min-h-[360px] bg-neutral-100">
        <div ref={mapHostRef} className="absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-[12px] font-semibold text-neutral-500 backdrop-blur-sm">
            Cargando mapa...
          </div>
        )}
      </div>

      {error && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
