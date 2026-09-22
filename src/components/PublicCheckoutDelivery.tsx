"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FulfillmentType = "DELIVERY" | "PICKUP";

export type PublicCheckoutSelection = {
  fulfillmentType: FulfillmentType;
  deliveryFee: number;
  distanceMeters?: number;
  durationSeconds?: number | null;
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
  return `~${minutes} min de ruta`;
}

type GoogleMapInstance = {
  setCenter: (center: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
};

type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleMapsRuntime = {
  maps: {
    importLibrary: (library: string) => Promise<unknown>;
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => GoogleMapInstance;
    Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance;
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
    __alentoGoogleMapsPromise?: Promise<GoogleMapsRuntime>;
  }
}

function requireGoogleRuntime() {
  if (!window.google) {
    throw new Error("Google Maps no quedó disponible después de cargar el script.");
  }
  return window.google;
}

function loadGoogleMaps(): Promise<GoogleMapsRuntime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps solo está disponible en el navegador."));
  }

  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google);
  }

  if (window.__alentoGoogleMapsPromise) {
    return window.__alentoGoogleMapsPromise;
  }

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no está configurada."),
    );
  }

  window.__alentoGoogleMapsPromise = new Promise<GoogleMapsRuntime>(
    (resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-alento-google-maps="true"]',
    );

    if (existing) {
      existing.addEventListener("load", () => {
        try {
          resolve(requireGoogleRuntime());
        } catch (error) {
          reject(error);
        }
      });
      existing.addEventListener("error", () =>
        reject(new Error("No fue posible cargar Google Maps.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(key) +
      "&loading=async&libraries=places&language=es&region=CO";
    script.async = true;
    script.defer = true;
    script.dataset.alentoGoogleMaps = "true";
    script.onload = () => {
      try {
        resolve(requireGoogleRuntime());
      } catch (error) {
        reject(error);
      }
    };
    script.onerror = () =>
      reject(new Error("No fue posible cargar Google Maps."));
    document.head.appendChild(script);
    },
  );

  return window.__alentoGoogleMapsPromise;
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
  const markerRef = useRef<GoogleMarkerInstance | null>(null);

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>(
    initialSelection?.fulfillmentType ?? "DELIVERY",
  );
  const [quote, setQuote] = useState<DeliveryQuote | null>(
    initialSelection?.fulfillmentType === "DELIVERY"
      ? {
          covered: true,
          distanceMeters: initialSelection.distanceMeters ?? 0,
          durationSeconds: initialSelection.durationSeconds,
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
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [locating, setLocating] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");

  const drawMap = useCallback(async (destination: {
    latitude: number;
    longitude: number;
  }) => {
    if (!mapRef.current) return;

    const google = await loadGoogleMaps();
    await google.maps.importLibrary("maps");

    const center = {
      lat: destination.latitude,
      lng: destination.longitude,
    };

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom: 17,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "cooperative",
      });
    } else {
      mapInstanceRef.current.setCenter(center);
      mapInstanceRef.current.setZoom(17);
    }

    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    markerRef.current = new google.maps.Marker({
      map: mapInstanceRef.current,
      position: center,
      title: "Punto de entrega",
    });
  }, []);

  const requestQuote = useCallback(async (input: {
    latitude: number;
    longitude: number;
    formattedAddress?: string;
    placeId?: string;
  }) {
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

      if (nextQuote.destination) {
        await drawMap(nextQuote.destination);
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
    if (fulfillmentType !== "DELIVERY") return;

    let cancelled = false;
    let autocomplete: PlaceAutocompleteElementInstance | null = null;
    let onSelect: EventListener | null = null;

    async function setupAutocomplete() {
      setLoadingMaps(true);
      setError("");

      try {
        const google = await loadGoogleMaps();
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
    if (
      fulfillmentType === "DELIVERY" &&
      quote?.destination &&
      mapRef.current
    ) {
      void drawMap(quote.destination);
    }
  }, [drawMap, fulfillmentType, quote?.destination]);

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
      <div className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-[#111] text-white shadow-[0_28px_80px_rgba(0,0,0,.55)] sm:max-w-[680px] sm:rounded-[30px]">
        <header className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#ff3439]">
                Finaliza tu pedido
              </p>
              <h2 className="mt-1 text-[22px] font-bold tracking-[-0.02em]">
                ¿Cómo quieres recibirlo?
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-xl text-white/55"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setFulfillmentType("DELIVERY");
                setError("");
              }}
              className={
                "rounded-[16px] border px-4 py-3 text-left transition " +
                (fulfillmentType === "DELIVERY"
                  ? "border-[#e21a22] bg-[#e21a22]/15"
                  : "border-white/10 bg-white/[0.035]")
              }
            >
              <b className="block text-[13px]">Domicilio</b>
              <span className="mt-1 block text-[10px] text-white/40">
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
                "rounded-[16px] border px-4 py-3 text-left transition " +
                (fulfillmentType === "PICKUP"
                  ? "border-[#e21a22] bg-[#e21a22]/15"
                  : "border-white/10 bg-white/[0.035]")
              }
            >
              <b className="block text-[13px]">Recoger</b>
              <span className="mt-1 block text-[10px] text-white/40">
                Sin costo de domicilio
              </span>
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {fulfillmentType === "DELIVERY" ? (
            <div className="space-y-4">
              <section className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
                      Dirección
                    </p>
                    <h3 className="mt-1 text-[17px] font-bold">
                      ¿Dónde entregamos?
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    disabled={locating || quoting}
                    className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[10px] font-semibold text-white/70 disabled:opacity-40"
                  >
                    {locating ? "Ubicando..." : "⌖ Usar mi ubicación"}
                  </button>
                </div>

                <div className="mt-3 min-h-[54px] rounded-[15px] border border-white/10 bg-white px-2 py-1 text-black">
                  {loadingMaps ? (
                    <div className="flex h-[46px] items-center px-3 text-[11px] text-neutral-500">
                      Cargando Google Maps...
                    </div>
                  ) : (
                    <div ref={autocompleteHostRef} />
                  )}
                </div>

                <p className="mt-2 text-[9px] leading-4 text-white/30">
                  Selecciona una sugerencia de Google para calcular correctamente el domicilio.
                </p>
              </section>

              {(quoting || quote) && (
                <section className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035]">
                  <div
                    ref={mapRef}
                    className="h-[190px] w-full bg-[#171717]"
                  />

                  <div className="p-4">
                    {quoting ? (
                      <div className="text-[12px] text-white/50">
                        Calculando ruta y cobertura...
                      </div>
                    ) : quote?.destination ? (
                      <>
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
                          Punto de entrega
                        </p>
                        <b className="mt-1 block text-[13px] leading-5">
                          {quote.destination.formattedAddress}
                        </b>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-[14px] border border-white/8 bg-black/20 p-3">
                            <span className="text-[9px] text-white/35">Ruta</span>
                            <b className="mt-1 block text-[13px]">
                              {formatDistance(quote.distanceMeters)}
                            </b>
                          </div>
                          <div className="rounded-[14px] border border-white/8 bg-black/20 p-3">
                            <span className="text-[9px] text-white/35">
                              Domicilio
                            </span>
                            <b className="mt-1 block text-[13px] text-[#ff454b]">
                              {quote.covered && quote.deliveryFee != null
                                ? money(quote.deliveryFee)
                                : "Sin cobertura"}
                            </b>
                          </div>
                        </div>

                        {formatDuration(quote.durationSeconds) && (
                          <p className="mt-2 text-[9px] text-white/30">
                            {formatDuration(quote.durationSeconds)}
                          </p>
                        )}

                        {!quote.covered && (
                          <div className="mt-3 rounded-[14px] border border-amber-400/20 bg-amber-400/10 p-3 text-[10px] leading-4 text-amber-100">
                            Esta ubicación está fuera de nuestra cobertura actual. Puedes elegir otra dirección o recoger tu pedido.
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                </section>
              )}
            </div>
          ) : (
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

        <footer className="border-t border-white/10 bg-[#0c0c0c] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] text-white/40">Total provisional</span>
            <b className="text-[22px]">{money(total)}</b>
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={
              quoting ||
              (fulfillmentType === "DELIVERY" &&
                (!quote?.covered || quote.deliveryFee == null))
            }
            className="h-12 w-full rounded-full bg-[#e21a22] text-[11px] font-bold uppercase tracking-[0.05em] text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
          >
            {fulfillmentType === "DELIVERY"
              ? quote?.covered
                ? "Confirmar domicilio"
                : "Confirma una dirección"
              : "Continuar con recogida"}
          </button>
        </footer>
      </div>
    </div>
  );
}
