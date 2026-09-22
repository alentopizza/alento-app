"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FulfillmentType = "DELIVERY" | "PICKUP";

const ALENTO_DELIVERY_MAP_ID = "b0bfaae2809a720a6204509b";

export type PublicCheckoutSelection = {
  fulfillmentType: FulfillmentType;
  deliveryFee: number;
  distanceMeters?: number;
  durationSeconds?: number | null;
  encodedPolyline?: string;
  deliveryZoneId?: string | null;
  deliveryZoneName?: string | null;
  destination?: {
    formattedAddress: string;
    placeId: string;
    latitude: number;
    longitude: number;
  } | null;
};

type DeliveryQuote = {
  covered: boolean;
  distanceMeters: number;
  durationSeconds?: number | null;
  encodedPolyline?: string;
  deliveryFee: number | null;
  band?: {
    id: string;
    name?: string;
    fee: number;
  } | null;
  destination?: {
    formattedAddress: string;
    placeId: string;
    latitude: number;
    longitude: number;
  };
  maxCoverageMeters?: number;
};

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds < 60) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

type GoogleMapInstance = {
  setCenter: (center: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: unknown, padding?: number) => void;
};

type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
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
        decodePath: (encoded: string) => Array<{ lat: () => number; lng: () => number }>;
      };
    };
  };
};

type PlaceLocationValue = number | (() => number);

type GooglePlace = {
  id?: string;
  formattedAddress?: string;
  location?: {
    lat?: PlaceLocationValue;
    lng?: PlaceLocationValue;
  };
  fetchFields: (options: { fields: string[] }) => Promise<void>;
};

type PlaceSelectEvent = Event & {
  placePrediction: {
    toPlace: () => GooglePlace;
  };
};

type PlaceAutocompleteElementInstance = HTMLElement & {
  placeholder: string;
};

type PlacesLibrary = {
  PlaceAutocompleteElement: new () => PlaceAutocompleteElementInstance;
};

declare global {
  interface Window {
    google?: GoogleMapsRuntime;
  }
}

function requireGoogleRuntime() {
  if (!window.google?.maps) {
    throw new Error("Google Maps no quedó disponible después de iniciar el cargador.");
  }
  return window.google;
}

function installGoogleMapsBootstrap(key: string) {
  if (window.google?.maps?.importLibrary) return;

  const bootstrapId = "alento-google-maps-bootstrap";
  if (!document.getElementById(bootstrapId)) {
    const script = document.createElement("script");
    script.id = bootstrapId;

    // Bootstrap oficial de Google Maps Dynamic Library Import.
    // Instala importLibrary de inmediato y evita la carrera que ocurría
    // con el <script src=...> directo durante la primera apertura.
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

  if (typeof window.google?.maps?.importLibrary !== "function") {
    throw new Error("No fue posible iniciar Google Maps correctamente.");
  }
}

async function loadGoogleMaps(): Promise<GoogleMapsRuntime> {
  if (typeof window === "undefined") {
    throw new Error("Google Maps solo está disponible en el navegador.");
  }

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no está configurada.");
  }

  installGoogleMapsBootstrap(key);
  return requireGoogleRuntime();
}

export default function PublicCheckoutDelivery({
  subtotal,
  initialSelection,
  onClose,
  onConfirm,
}: {
  subtotal: number;
  initialSelection?: PublicCheckoutSelection | null;
  onClose: () => void;
  onConfirm: (selection: PublicCheckoutSelection) => void;
}) {
  const autocompleteHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<GoogleMapInstance | null>(null);
  const destinationMarkerRef = useRef<GoogleMarkerInstance | null>(null);
  const originMarkerRef = useRef<GoogleMarkerInstance | null>(null);
  const routePolylineRef = useRef<GooglePolylineInstance | null>(null);
  const [origin, setOrigin] = useState<{
    formattedAddress: string;
    placeId: string;
    latitude: number;
    longitude: number;
  } | null>(null);

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>(
    initialSelection?.fulfillmentType ?? "DELIVERY",
  );
  const [quote, setQuote] = useState<DeliveryQuote | null>(
    initialSelection?.fulfillmentType === "DELIVERY"
      ? {
          covered: true,
          distanceMeters: initialSelection.distanceMeters ?? 0,
          durationSeconds: initialSelection.durationSeconds,
          encodedPolyline: initialSelection.encodedPolyline,
          deliveryFee: initialSelection.deliveryFee,
          band: initialSelection.deliveryZoneId
            ? {
                id: initialSelection.deliveryZoneId,
                name: initialSelection.deliveryZoneName ?? undefined,
                fee: initialSelection.deliveryFee,
              }
            : null,
          destination: initialSelection.destination ?? undefined,
        }
      : null,
  );
  const [editingAddress, setEditingAddress] = useState(
    !(
      initialSelection?.fulfillmentType === "DELIVERY" &&
      initialSelection.destination
    ),
  );
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [locating, setLocating] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");

  const drawMap = useCallback(async (
    destination?: {
      latitude: number;
      longitude: number;
    },
    encodedPolyline?: string,
  ) => {
    if (!mapRef.current) return;

    const google = await loadGoogleMaps();
    if (typeof google.maps.importLibrary !== "function") {
      throw new Error("Google Maps aún no está listo. Intenta nuevamente.");
    }
    await google.maps.importLibrary("maps");
    await google.maps.importLibrary("geometry");

    const fallbackCenter = origin
      ? { lat: origin.latitude, lng: origin.longitude }
      : { lat: 4.621035, lng: -74.166095 };

    const center = destination
      ? { lat: destination.latitude, lng: destination.longitude }
      : fallbackCenter;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom: destination ? 15 : 14,
        mapId: ALENTO_DELIVERY_MAP_ID,
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: "cooperative",
      });
    }

    if (originMarkerRef.current) originMarkerRef.current.setMap(null);
    if (destinationMarkerRef.current) destinationMarkerRef.current.setMap(null);
    if (routePolylineRef.current) routePolylineRef.current.setMap(null);

    if (origin && mapInstanceRef.current) {
      originMarkerRef.current = new google.maps.Marker({
        map: mapInstanceRef.current,
        position: { lat: origin.latitude, lng: origin.longitude },
        title: "Alentó Pizza",
        label: {
          text: "A",
          color: "#ffffff",
          fontWeight: "700",
        },
      });
    }

    if (destination && mapInstanceRef.current) {
      destinationMarkerRef.current = new google.maps.Marker({
        map: mapInstanceRef.current,
        position: center,
        title: "Tu ubicación",
      });
    }

    const bounds = new google.maps.LatLngBounds();
    if (origin) {
      bounds.extend({ lat: origin.latitude, lng: origin.longitude });
    }
    if (destination) {
      bounds.extend(center);
    }

    if (
      encodedPolyline &&
      google.maps.geometry?.encoding?.decodePath &&
      mapInstanceRef.current
    ) {
      const path = google.maps.geometry.encoding.decodePath(encodedPolyline);
      routePolylineRef.current = new google.maps.Polyline({
        map: mapInstanceRef.current,
        path,
        strokeColor: "#e21a22",
        strokeOpacity: 0.95,
        strokeWeight: 5,
        geodesic: true,
      });
      for (const point of path) {
        bounds.extend({ lat: point.lat(), lng: point.lng() });
      }
    }

    if ((origin || destination) && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds, 28);
    } else {
      mapInstanceRef.current.setCenter(center);
      mapInstanceRef.current.setZoom(destination ? 15 : 14);
    }
  }, [origin]);

  const requestQuote = useCallback(async (input: {
    latitude: number;
    longitude: number;
    formattedAddress?: string;
    placeId?: string;
  }) => {
    setQuoting(true);
    setError("");

    try {
      const response = await fetch("/api/delivery/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible calcular el domicilio.");
      }

      const nextQuote = data as DeliveryQuote;
      setQuote(nextQuote);
      setEditingAddress(false);

      if (nextQuote.destination) {
        await drawMap(nextQuote.destination, nextQuote.encodedPolyline);
      }
    } catch (err) {
      setQuote(null);
      setError(
        err instanceof Error ? err.message : "No fue posible calcular el domicilio.",
      );
    } finally {
      setQuoting(false);
    }
  }, [drawMap]);

  useEffect(() => {
    let cancelled = false;

    async function loadOrigin() {
      try {
        const response = await fetch("/api/delivery/origin", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible cargar Alentó.");
        if (!cancelled) setOrigin(data.origin);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "No fue posible cargar la ubicación de Alentó.",
          );
        }
      }
    }

    void loadOrigin();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fulfillmentType !== "DELIVERY") return;

    let cancelled = false;
    let autocomplete: PlaceAutocompleteElementInstance | null = null;
    let onSelect: EventListener | null = null;

    async function setupAutocomplete() {
      setLoadingMaps(true);
      setError("");

      try {
        const google = await loadGoogleMaps();
        if (typeof google.maps.importLibrary !== "function") {
          throw new Error("Google Maps aún no está listo. Intenta nuevamente.");
        }
        const { PlaceAutocompleteElement } =
          (await google.maps.importLibrary("places")) as PlacesLibrary;

        if (cancelled || !autocompleteHostRef.current) return;

        autocompleteHostRef.current.innerHTML = "";

        autocomplete = new PlaceAutocompleteElement();
        autocomplete.placeholder = "Escribe tu dirección de entrega";
        autocomplete.style.width = "100%";

        onSelect = (event: Event) => {
          void (async () => {
            try {
              const selectEvent = event as PlaceSelectEvent;
              const place = selectEvent.placePrediction.toPlace();
            await place.fetchFields({
              fields: ["id", "formattedAddress", "location"],
            });

            const lat =
              typeof place.location?.lat === "function"
                ? place.location.lat()
                : Number(place.location?.lat);
            const lng =
              typeof place.location?.lng === "function"
                ? place.location.lng()
                : Number(place.location?.lng);

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              throw new Error("Google no devolvió coordenadas para esa dirección.");
            }

            await requestQuote({
              latitude: lat,
              longitude: lng,
              formattedAddress: place.formattedAddress || "",
              placeId: place.id || "",
            });
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "No fue posible usar esa dirección.",
              );
            }
          })();
        };

        autocomplete.addEventListener("gmp-select", onSelect);
        autocompleteHostRef.current.appendChild(autocomplete);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No fue posible cargar el buscador de direcciones.",
        );
      } finally {
        if (!cancelled) setLoadingMaps(false);
      }
    }

    void setupAutocomplete();

    return () => {
      cancelled = true;
      if (autocomplete && onSelect) {
        autocomplete.removeEventListener("gmp-select", onSelect);
      }
    };
  }, [fulfillmentType, requestQuote]);

  useEffect(() => {
    if (fulfillmentType !== "DELIVERY" || !mapRef.current) return;
    void drawMap(quote?.destination, quote?.encodedPolyline);
  }, [drawMap, fulfillmentType, origin, quote?.destination, quote?.encodedPolyline]);

  function useCurrentLocation() {
    setError("");

    if (!navigator.geolocation) {
      setError("Este dispositivo no permite obtener la ubicación actual.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void requestQuote({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }).finally(() => setLocating(false));
      },
      (geoError) => {
        setLocating(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError(
            "No autorizaste la ubicación. Puedes escribir tu dirección manualmente.",
          );
          return;
        }
        setError(
          "No pudimos obtener tu ubicación. Intenta de nuevo o escribe la dirección.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      },
    );
  }

  function confirm() {
    if (fulfillmentType === "PICKUP") {
      onConfirm({
        fulfillmentType: "PICKUP",
        deliveryFee: 0,
        destination: null,
      });
      return;
    }

    if (!quote?.covered || quote.deliveryFee == null || !quote.destination) {
      setError("Confirma una dirección dentro de nuestra cobertura.");
      return;
    }

    onConfirm({
      fulfillmentType: "DELIVERY",
      deliveryFee: quote.deliveryFee,
      distanceMeters: quote.distanceMeters,
      durationSeconds: quote.durationSeconds,
      encodedPolyline: quote.encodedPolyline,
      deliveryZoneId: quote.band?.id ?? null,
      deliveryZoneName: quote.band?.name ?? null,
      destination: quote.destination,
    });
  }

  const total =
    subtotal +
    (fulfillmentType === "DELIVERY" && quote?.covered
      ? quote.deliveryFee ?? 0
      : 0);

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-[26px] border border-white/10 bg-[#111] text-white shadow-[0_28px_80px_rgba(0,0,0,.55)] sm:max-h-[92vh] sm:max-w-[680px] sm:rounded-[30px]">
        <header className="border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#ff3439]">
                Finaliza tu pedido
              </p>
              <h2 className="mt-0.5 text-[20px] font-bold tracking-[-0.02em] sm:mt-1 sm:text-[22px]">
                ¿Cómo quieres recibirlo?
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-lg text-white/55 sm:h-9 sm:w-9 sm:text-xl"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4">
            <button
              type="button"
              onClick={() => {
                setFulfillmentType("DELIVERY");
                setError("");
              }}
              className={
                "rounded-[15px] border px-3 py-2.5 text-left transition sm:px-4 sm:py-3 " +
                (fulfillmentType === "DELIVERY"
                  ? "border-[#e21a22] bg-[#e21a22]/15"
                  : "border-white/10 bg-white/[0.035]")
              }
            >
              <b className="block text-[12px] sm:text-[13px]">Domicilio</b>
              <span className="mt-0.5 block text-[9px] text-white/40 sm:mt-1 sm:text-[10px]">
                Calculamos tu cobertura
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFulfillmentType("PICKUP");
                setError("");
              }}
              className={
                "rounded-[15px] border px-3 py-2.5 text-left transition sm:px-4 sm:py-3 " +
                (fulfillmentType === "PICKUP"
                  ? "border-[#e21a22] bg-[#e21a22]/15"
                  : "border-white/10 bg-white/[0.035]")
              }
            >
              <b className="block text-[12px] sm:text-[13px]">Recoger</b>
              <span className="mt-0.5 block text-[9px] text-white/40 sm:mt-1 sm:text-[10px]">
                Sin costo de domicilio
              </span>
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {fulfillmentType === "DELIVERY" ? (
            <div className="space-y-2.5 sm:space-y-3">
              {quote?.destination && !editingAddress ? (
                <section className="rounded-[18px] border border-white/10 bg-white/[0.035] px-3 py-2.5 sm:rounded-[20px] sm:px-4 sm:py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/30">
                        Punto de entrega
                      </p>
                      <b className="mt-0.5 block truncate text-[11px] leading-4 text-white/90 sm:text-[12px]">
                        {quote.destination.formattedAddress}
                      </b>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuote(null);
                        setEditingAddress(true);
                        setError("");
                      }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/65 transition hover:bg-white/[0.09] hover:text-white"
                      aria-label="Editar dirección"
                      title="Editar dirección"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                      </svg>
                    </button>
                  </div>
                </section>
              ) : (
                <section className="rounded-[18px] border border-white/10 bg-white/[0.035] p-3 sm:rounded-[20px]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/30">
                        Dirección
                      </p>
                      <h3 className="mt-0.5 text-[14px] font-bold sm:text-[15px]">
                        ¿Dónde entregamos?
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={useCurrentLocation}
                      disabled={locating || quoting}
                      className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 text-[9px] font-semibold text-white/65 disabled:opacity-40"
                    >
                      <span aria-hidden="true" className="text-[12px]">⌖</span>
                      {locating ? "Ubicando..." : "Mi ubicación"}
                    </button>
                  </div>

                  <div className="mt-2 min-h-[46px] rounded-[13px] border border-white/10 bg-white px-2 py-0.5 text-black">
                    {loadingMaps ? (
                      <div className="flex h-[42px] items-center px-3 text-[10px] text-neutral-500">
                        Cargando Google Maps...
                      </div>
                    ) : (
                      <div ref={autocompleteHostRef} />
                    )}
                  </div>

                  {!quoting && (
                    <p className="mt-1.5 text-[8px] leading-3.5 text-white/28">
                      Elige una sugerencia de Google para validar cobertura y tarifa.
                    </p>
                  )}
                </section>
              )}

              <section className="relative mx-auto aspect-[4/3] w-full overflow-hidden rounded-[20px] border border-white/10 bg-[#171717] sm:max-h-[430px] sm:rounded-[22px]">
                <div ref={mapRef} className="h-full w-full" />
                <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
                  <div className="rounded-full border border-black/5 bg-white/92 px-3 py-2 text-[8px] font-bold text-neutral-800 shadow-lg backdrop-blur sm:text-[9px]">
                    {quote?.destination ? "Alentó → tu ubicación" : "Zona de entrega Alentó"}
                  </div>
                  {quoting && (
                    <div className="rounded-full bg-[#111]/92 px-3 py-2 text-[8px] font-bold text-white shadow-lg backdrop-blur sm:text-[9px]">
                      Calculando...
                    </div>
                  )}
                </div>
              </section>

              {quote?.destination && !quoting && (
                <section className="rounded-[18px] border border-white/10 bg-white/[0.035] p-2.5 sm:rounded-[20px] sm:p-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-[13px] border border-white/[0.07] bg-black/20 p-2.5">
                      <span className="text-[8px] text-white/35">Ruta</span>
                      <b className="mt-0.5 block text-[12px] sm:text-[13px]">
                        {formatDistance(quote.distanceMeters)}
                      </b>
                    </div>
                    <div className="rounded-[13px] border border-white/[0.07] bg-black/20 p-2.5">
                      <span className="text-[8px] text-white/35">Domicilio</span>
                      <b className="mt-0.5 block text-[12px] text-[#ff454b] sm:text-[13px]">
                        {quote.covered && quote.deliveryFee != null
                          ? money(quote.deliveryFee)
                          : "Sin cobertura"}
                      </b>
                    </div>
                    <div className="rounded-[13px] border border-white/[0.07] bg-black/20 p-2.5">
                      <span className="text-[8px] text-white/35">Tiempo</span>
                      <b className="mt-0.5 block text-[12px] sm:text-[13px]">
                        {formatDuration(quote.durationSeconds) || "—"}
                      </b>
                    </div>
                  </div>

                  {!quote.covered && (
                    <div className="mt-2 rounded-[13px] border border-amber-400/20 bg-amber-400/10 p-2.5 text-[9px] leading-4 text-amber-100">
                      Esta ubicación está fuera de nuestra cobertura. Elige otra dirección o selecciona Recoger.
                    </div>
                  )}
                </section>
              )}
            </div>          ) : (
            <section className="rounded-[22px] border border-emerald-400/20 bg-emerald-400/10 p-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-emerald-300">
                Recoger en Alentó
              </p>
              <h3 className="mt-2 text-[18px] font-bold">
                Tu pedido no tendrá costo de domicilio
              </h3>
              <p className="mt-2 text-[11px] leading-5 text-white/55">
                En el siguiente paso confirmaremos tus datos y la forma de pago.
              </p>
            </section>
          )}

          {error && (
            <div className="mt-4 rounded-[15px] border border-red-500/25 bg-red-500/10 p-3 text-[10px] font-semibold leading-5 text-red-100">
              {error}
            </div>
          )}
        </div>

        <footer className="border-t border-white/10 bg-[#0c0c0c] p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between sm:mb-3">
            <span className="text-[10px] text-white/40">Total provisional</span>
            <b className="text-[20px] sm:text-[22px]">{money(total)}</b>
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={
              quoting ||
              (fulfillmentType === "DELIVERY" &&
                (editingAddress || !quote?.covered || quote.deliveryFee == null))
            }
            className="h-11 w-full rounded-full bg-[#e21a22] text-[10px] font-bold uppercase tracking-[0.05em] text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 sm:h-12 sm:text-[11px]"
          >
            {fulfillmentType === "DELIVERY"
              ? !editingAddress && quote?.covered
                ? "Confirmar domicilio"
                : "Confirma una dirección"
              : "Continuar con recogida"}
          </button>
        </footer>
      </div>
    </div>
  );
}
