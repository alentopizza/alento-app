"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createAlentoMapPinElement,
  createDeliveryMapPinElement,
} from "@/lib/alentoMapMarker";

const ALENTO_DELIVERY_MAP_ID = "b0bfaae2809a720a6204509b";

export type GoogleCustomerAddressSelection = {
  formattedAddress: string;
  placeId: string;
  latitude: number;
  longitude: number;
  neighborhood: string;
  city: string;
  covered: boolean;
  deliveryFee: number | null;
  distanceMeters: number | null;
};

type GoogleMapInstance = {
  fitBounds: (bounds: unknown, padding?: number) => void;
  setCenter: (center: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
};

type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleAdvancedMarkerInstance = {
  map: GoogleMapInstance | null;
  addListener?: (
    eventName: string,
    handler: (event: {
      latLng?: {
        lat: () => number;
        lng: () => number;
      } | null;
    }) => void,
  ) => { remove?: () => void };
};

type GoogleMarkerLibrary = {
  AdvancedMarkerElement: new (options: {
    map: GoogleMapInstance;
    position: { lat: number; lng: number };
    title?: string;
    content?: Node;
    zIndex?: number;
    gmpDraggable?: boolean;
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

type PlaceLocationValue = number | (() => number);

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlace = {
  id?: string;
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
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

type DeliveryQuote = {
  covered: boolean;
  distanceMeters?: number;
  deliveryFee?: number | null;
  encodedPolyline?: string;
  origin?: {
    latitude: number;
    longitude: number;
  };
  destination?: {
    formattedAddress: string;
    placeId: string;
    latitude: number;
    longitude: number;
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
    throw new Error("Google Maps no está configurado para el POS.");
  }

  installGoogleMapsBootstrap(key);

  const runtime = getGoogleWindow().google;
  if (!runtime?.maps?.importLibrary) {
    throw new Error("No fue posible iniciar Google Maps.");
  }

  return runtime;
}

function componentValue(
  components: AddressComponent[] | undefined,
  types: string[],
) {
  return (
    components?.find((component) =>
      component.types?.some((type) => types.includes(type)),
    )?.longText?.trim() ?? ""
  );
}

function money(value: number | null | undefined) {
  if (value == null) return "Sin cobertura";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function distance(value: number | null) {
  if (value == null) return "—";
  return value < 1000
    ? `${Math.round(value)} m`
    : `${(value / 1000).toFixed(1)} km`;
}

export default function GoogleCustomerAddressPicker({
  currentAddress,
  initialSelection,
  onSelect,
}: {
  currentAddress?: string;
  initialSelection?: {
    formattedAddress?: string;
    placeId?: string;
    latitude?: number | null;
    longitude?: number | null;
    neighborhood?: string;
    city?: string;
    covered?: boolean;
    deliveryFee?: number | null;
    distanceMeters?: number | null;
  };
  onSelect: (selection: GoogleCustomerAddressSelection) => void;
}) {
  const autocompleteHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<GoogleMapInstance | null>(null);
  const originMarkerRef = useRef<GoogleMarkerInstance | null>(null);
  const destinationMarkerRef = useRef<GoogleMarkerInstance | null>(null);
  const routePolylineRef = useRef<GooglePolylineInstance | null>(null);

  const onSelectRef = useRef(onSelect);
  const [editing, setEditing] = useState(!currentAddress);
  const [loading, setLoading] = useState(false);
  const [adjustingPin, setAdjustingPin] = useState(false);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const drawMapRef = useRef<
    ((nextQuote: DeliveryQuote) => Promise<void>) | null
  >(null);

  const quoteCoordinates = useCallback(
    async (input: {
      latitude: number;
      longitude: number;
      formattedAddress: string;
      placeId: string;
      neighborhood?: string;
      city?: string;
    }) => {
      const response = await fetch("/api/delivery/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: input.latitude,
          longitude: input.longitude,
          formattedAddress: input.formattedAddress,
          placeId: input.placeId,
        }),
      });
      const data = (await response.json()) as DeliveryQuote & {
        error?: string;
      };

      if (!response.ok || !data.destination) {
        throw new Error(data.error || "No fue posible validar la dirección.");
      }

      setQuote(data);
      setEditing(false);

      onSelectRef.current({
        formattedAddress: data.destination.formattedAddress,
        placeId: data.destination.placeId,
        latitude: data.destination.latitude,
        longitude: data.destination.longitude,
        neighborhood: input.neighborhood?.trim() ?? "",
        city: input.city?.trim() || "Bogotá",
        covered: data.covered,
        deliveryFee: data.deliveryFee ?? null,
        distanceMeters: Number.isFinite(Number(data.distanceMeters))
          ? Number(data.distanceMeters)
          : null,
      });

      return data;
    },
    [],
  );

  const refineDraggedPoint = useCallback(
    async (latitude: number, longitude: number) => {
      setAdjustingPin(true);
      setError("");

      try {
        const response = await fetch("/api/customers/address-reverse-geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude, longitude }),
        });
        const data = (await response.json()) as {
          error?: string;
          location?: {
            formattedAddress: string;
            placeId: string;
            latitude: number;
            longitude: number;
          };
        };

        if (!response.ok || !data.location) {
          throw new Error(
            data.error || "No fue posible identificar ese punto del mapa.",
          );
        }

        const nextQuote = await quoteCoordinates({
          ...data.location,
          neighborhood: initialSelection?.neighborhood,
          city: initialSelection?.city,
        });

        window.requestAnimationFrame(() => {
          void drawMapRef.current?.(nextQuote);
        });
      } catch (dragError) {
        setError(
          dragError instanceof Error
            ? dragError.message
            : "No fue posible ajustar la ubicación.",
        );
      } finally {
        setAdjustingPin(false);
      }
    },
    [
      initialSelection?.city,
      initialSelection?.neighborhood,
      quoteCoordinates,
    ],
  );

  const drawMap = useCallback(async (nextQuote: DeliveryQuote) => {
    if (!mapRef.current || !nextQuote.destination) return;

    const google = await loadGoogleMaps();
    await google.maps.importLibrary("maps");
    await google.maps.importLibrary("geometry");
    const { AdvancedMarkerElement } =
      (await google.maps.importLibrary("marker")) as GoogleMarkerLibrary;

    const destination = {
      lat: nextQuote.destination.latitude,
      lng: nextQuote.destination.longitude,
    };

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: destination,
        zoom: 15,
        mapId: ALENTO_DELIVERY_MAP_ID,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
      });
    }

    originMarkerRef.current?.setMap(null);
    destinationMarkerRef.current?.setMap(null);
    routePolylineRef.current?.setMap(null);

    const bounds = new google.maps.LatLngBounds();

    if (nextQuote.origin) {
      const origin = {
        lat: nextQuote.origin.latitude,
        lng: nextQuote.origin.longitude,
      };
      const originMarker = new AdvancedMarkerElement({
        map: mapInstanceRef.current,
        position: origin,
        title: "Alentó Pizza",
        content: createAlentoMapPinElement(),
        zIndex: 20,
      });
      originMarkerRef.current = {
        setMap: (map) => {
          originMarker.map = map;
        },
      };
      bounds.extend(origin);
    }

    const destinationMarker = new AdvancedMarkerElement({
      map: mapInstanceRef.current,
      position: destination,
      title: "Arrastra para ajustar la ubicación exacta",
      content: createDeliveryMapPinElement(),
      zIndex: 25,
      gmpDraggable: true,
    });

    destinationMarker.addListener?.("dragend", (event) => {
      const latitude = event.latLng?.lat();
      const longitude = event.latLng?.lng();

      if (
        typeof latitude === "number" &&
        typeof longitude === "number" &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
      ) {
        void refineDraggedPoint(latitude, longitude);
      }
    });

    destinationMarkerRef.current = {
      setMap: (map) => {
        destinationMarker.map = map;
      },
    };
    bounds.extend(destination);

    if (
      nextQuote.encodedPolyline &&
      google.maps.geometry?.encoding?.decodePath
    ) {
      const path = google.maps.geometry.encoding.decodePath(
        nextQuote.encodedPolyline,
      );
      routePolylineRef.current = new google.maps.Polyline({
        map: mapInstanceRef.current,
        path,
        strokeColor: "#e21a22",
        strokeOpacity: 0.95,
        strokeWeight: 4,
      });
      path.forEach((point) =>
        bounds.extend({ lat: point.lat(), lng: point.lng() }),
      );
    }

    mapInstanceRef.current.fitBounds(bounds, 42);
  }, [refineDraggedPoint]);

  useEffect(() => {
    drawMapRef.current = drawMap;
  }, [drawMap]);

  const quotePlace = useCallback(
    async (place: GooglePlace) => {
      await place.fetchFields({
        fields: [
          "id",
          "formattedAddress",
          "location",
          "addressComponents",
        ],
      });

      const latitude =
        typeof place.location?.lat === "function"
          ? place.location.lat()
          : Number(place.location?.lat);
      const longitude =
        typeof place.location?.lng === "function"
          ? place.location.lng()
          : Number(place.location?.lng);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Google no devolvió una ubicación válida.");
      }

      const neighborhood = componentValue(place.addressComponents, [
        "neighborhood",
        "sublocality_level_1",
        "sublocality",
      ]);
      const city = componentValue(place.addressComponents, [
        "locality",
        "administrative_area_level_2",
      ]);

      const data = await quoteCoordinates({
        latitude,
        longitude,
        formattedAddress: place.formattedAddress ?? "",
        placeId: place.id ?? "",
        neighborhood,
        city: city || "Bogotá",
      });

      window.requestAnimationFrame(() => {
        void drawMap(data);
      });
    },
    [drawMap, quoteCoordinates],
  );

  useEffect(() => {
    if (
      editing ||
      !currentAddress ||
      quote ||
      !initialSelection?.placeId ||
      initialSelection.latitude == null ||
      initialSelection.longitude == null ||
      !Number.isFinite(Number(initialSelection.latitude)) ||
      !Number.isFinite(Number(initialSelection.longitude))
    ) {
      return;
    }

    let cancelled = false;

    void quoteCoordinates({
      formattedAddress:
        initialSelection.formattedAddress?.trim() || currentAddress,
      placeId: initialSelection.placeId,
      latitude: Number(initialSelection.latitude),
      longitude: Number(initialSelection.longitude),
      neighborhood: initialSelection.neighborhood,
      city: initialSelection.city,
    })
      .then((data) => {
        if (cancelled) return;
        window.requestAnimationFrame(() => {
          void drawMap(data);
        });
      })
      .catch((initialError) => {
        if (!cancelled) {
          setError(
            initialError instanceof Error
              ? initialError.message
              : "No fue posible cargar la ubicación guardada.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentAddress,
    drawMap,
    editing,
    initialSelection?.city,
    initialSelection?.formattedAddress,
    initialSelection?.latitude,
    initialSelection?.longitude,
    initialSelection?.neighborhood,
    initialSelection?.placeId,
    quote,
    quoteCoordinates,
  ]);

  useEffect(() => {
    if (!editing) return;

    let cancelled = false;
    let autocomplete: PlaceAutocompleteElementInstance | null = null;
    let listener: EventListener | null = null;

    async function setup() {
      setLoading(true);
      setError("");

      try {
        const google = await loadGoogleMaps();
        const { PlaceAutocompleteElement } =
          (await google.maps.importLibrary("places")) as PlacesLibrary;

        if (cancelled || !autocompleteHostRef.current) return;

        autocompleteHostRef.current.innerHTML = "";
        autocomplete = new PlaceAutocompleteElement();
        autocomplete.placeholder = "Busca la dirección en Google";
        autocomplete.style.width = "100%";

        listener = (event: Event) => {
          const selected = event as PlaceSelectEvent;
          void quotePlace(selected.placePrediction.toPlace()).catch((err) => {
            setError(
              err instanceof Error
                ? err.message
                : "No fue posible usar esa dirección.",
            );
          });
        };

        autocomplete.addEventListener("gmp-select", listener);
        autocompleteHostRef.current.appendChild(autocomplete);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No fue posible cargar Google Maps.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void setup();

    return () => {
      cancelled = true;
      if (autocomplete && listener) {
        autocomplete.removeEventListener("gmp-select", listener);
      }
    };
  }, [editing, quotePlace]);

  useEffect(() => {
    if (!quote?.destination || editing) return;
    const frame = window.requestAnimationFrame(() => {
      void drawMap(quote);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [drawMap, editing, quote]);

  if (!editing && !quote && currentAddress) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-3">
        <span className="alento-ui-label uppercase text-neutral-400">
          Dirección actual
        </span>
        <div className="mt-2 flex items-start justify-between gap-3">
          <b className="text-[13px] leading-5 text-neutral-800">
            {currentAddress}
          </b>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-xl border border-neutral-200 px-3 py-2 text-[11px] font-bold text-neutral-700"
          >
            Cambiar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {editing ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-3">
          <div>
            <span className="alento-ui-label uppercase text-neutral-400">
              Google Maps
            </span>
            <b className="mt-1 block text-[14px] text-neutral-900">
              Busca una referencia cercana
            </b>
            <p className="mt-1 text-[10px] leading-4 text-neutral-400">
              Si Google no encuentra el número exacto, selecciona la opción más cercana y luego ajusta el pin en el mapa.
            </p>
          </div>

          <div className="mt-2 min-h-[48px] rounded-xl border border-neutral-200 bg-white px-2 py-0.5">
            <div ref={autocompleteHostRef} />
            {loading && (
              <div className="flex h-11 items-center px-2 text-[11px] text-neutral-400">
                Cargando Google Maps...
              </div>
            )}
          </div>

          <p className="mt-2 text-[10px] leading-4 text-neutral-400">
            Primero elegimos una referencia de Google; la ubicación final la puedes precisar manualmente.
          </p>
        </div>
      ) : null}

      {quote?.destination && !editing && (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <span className="alento-ui-label uppercase text-neutral-400">
                Ubicación confirmada
              </span>
              <b className="mt-1 block text-[13px] leading-5 text-neutral-900">
                {quote.destination.formattedAddress}
              </b>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setQuote(null);
                mapInstanceRef.current = null;
              }}
              className="shrink-0 rounded-xl border border-neutral-200 px-3 py-2 text-[11px] font-bold text-neutral-600"
            >
              Cambiar
            </button>
          </div>

          <div className="relative aspect-[16/8] min-h-[230px] bg-neutral-100">
            <div ref={mapRef} className="absolute inset-0" />
            <div className="pointer-events-none absolute inset-x-3 top-3 grid grid-cols-2 overflow-hidden rounded-xl border border-white/70 bg-white/92 shadow-lg backdrop-blur">
              <div className="px-3 py-2">
                <span className="block text-[10px] font-bold uppercase text-neutral-400">
                  Ruta
                </span>
                <b className="mt-0.5 block text-[12px] text-neutral-900">
                  {distance(
                    Number.isFinite(Number(quote.distanceMeters))
                      ? Number(quote.distanceMeters)
                      : null,
                  )}
                </b>
              </div>
              <div className="border-l border-neutral-200 px-3 py-2">
                <span className="block text-[10px] font-bold uppercase text-neutral-400">
                  Cobertura
                </span>
                <b
                  className={
                    "mt-0.5 block text-[12px] " +
                    (quote.covered ? "text-emerald-700" : "text-red-600")
                  }
                >
                  {quote.covered
                    ? money(quote.deliveryFee)
                    : "Fuera de cobertura"}
                </b>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
              <div className="rounded-full border border-white/80 bg-[#111]/92 px-3 py-2 text-[9px] font-black text-white shadow-lg backdrop-blur">
                {adjustingPin
                  ? "Actualizando ubicación y cobertura…"
                  : "↔ Arrastra el pin rojo hasta la entrada exacta"}
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-100 bg-[#faf9f7] px-3 py-2.5">
            <p className="text-[10px] leading-4 text-neutral-500">
              El punto del pin será la ubicación usada para calcular ruta y domicilio. La dirección escrita se actualiza al soltarlo.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
