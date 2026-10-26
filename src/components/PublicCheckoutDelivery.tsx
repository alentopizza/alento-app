"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicCartItem } from "@/lib/publicCart";
import {
  createAlentoMapPinElement,
  createDeliveryMapPinElement,
} from "@/lib/alentoMapMarker";

type FulfillmentType = "DELIVERY" | "PICKUP";

type Coupon = {
  id: number;
  name: string;
  type: "FIXED" | "PERCENTAGE";
  value: number;
};

const ALENTO_DELIVERY_MAP_ID = "b0bfaae2809a720a6204509b";

export type PublicCheckoutSelection = {
  fulfillmentType: FulfillmentType;
  deliveryFee: number;
  distanceMeters?: number;
  durationSeconds?: number | null;
  encodedPolyline?: string;
  deliveryZoneId?: string | null;
  deliveryZoneName?: string | null;
  couponId?: number | null;
  couponName?: string | null;
  couponType?: "FIXED" | "PERCENTAGE" | null;
  couponValue?: number | null;
  discount?: number;
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

function getGoogleWindow() {
  return window as typeof window & { google?: GoogleMapsRuntime };
}

function requireGoogleRuntime(): GoogleMapsRuntime {
  const runtime = getGoogleWindow().google;

  if (!runtime?.maps) {
    throw new Error(
      "Google Maps no quedó disponible después de iniciar el cargador.",
    );
  }

  return runtime;
}

function installGoogleMapsBootstrap(key: string) {
  if (getGoogleWindow().google?.maps?.importLibrary) return;

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

  if (typeof getGoogleWindow().google?.maps?.importLibrary !== "function") {
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
  cart,
  subtotal,
  initialSelection,
  onClose,
  onConfirm,
  fullPage = false,
}: {
  cart: PublicCartItem[];
  subtotal: number;
  initialSelection?: PublicCheckoutSelection | null;
  onClose: () => void;
  onConfirm: (selection: PublicCheckoutSelection) => void;
  fullPage?: boolean;
}) {
  const autocompleteHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
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
    initialSelection?.fulfillmentType ?? "PICKUP",
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
  const [loadingSavedAddress, setLoadingSavedAddress] = useState(false);
  const [savedAddressChecked, setSavedAddressChecked] = useState(false);
  const [savedAddressRequiresValidation, setSavedAddressRequiresValidation] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(
    initialSelection?.couponId ?? null,
  );
  const [eligibleSubtotal, setEligibleSubtotal] = useState(0);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [eligibilityReady, setEligibilityReady] = useState(false);

  const applicableCoupons = useMemo(
    () =>
      eligibilityReady
        ? coupons.filter((coupon) => {
            const saving =
              coupon.type === "PERCENTAGE"
                ? Math.round(eligibleSubtotal * (coupon.value / 100))
                : Math.min(coupon.value, eligibleSubtotal);
            return saving > 0;
          })
        : coupons,
    [coupons, eligibleSubtotal, eligibilityReady],
  );

  const selectedCoupon = useMemo(
    () =>
      applicableCoupons.find((coupon) => coupon.id === selectedCouponId) ?? null,
    [applicableCoupons, selectedCouponId],
  );

  const discount = selectedCoupon
    ? selectedCoupon.type === "PERCENTAGE"
      ? Math.round(eligibleSubtotal * (selectedCoupon.value / 100))
      : Math.min(selectedCoupon.value, eligibleSubtotal)
    : 0;

  useEffect(() => {
    let cancelled = false;

    async function loadCoupons() {
      setLoadingCoupons(true);
      setEligibilityReady(false);

      const checkoutRequest = fetch("/api/public-checkout", {
        cache: "no-store",
      });
      const eligibilityRequest = fetch("/api/public-checkout/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            configuration: item.configuration,
          })),
        }),
      });

      try {
        const checkoutResponse = await checkoutRequest;
        const checkoutData = await checkoutResponse.json();

        if (!cancelled) {
          const nextCoupons = checkoutResponse.ok
            ? (checkoutData.coupons ?? [])
            : [];

          setCoupons(nextCoupons);
          setSelectedCouponId((current) =>
            current != null &&
            nextCoupons.some((coupon: Coupon) => coupon.id === current)
              ? current
              : null,
          );
          setLoadingCoupons(false);
        }

        const eligibilityResponse = await eligibilityRequest;
        const eligibilityData = await eligibilityResponse.json();

        if (!cancelled) {
          setEligibleSubtotal(
            eligibilityResponse.ok
              ? Number(eligibilityData.eligibleSubtotal ?? 0)
              : 0,
          );
          setEligibilityReady(true);
        }
      } catch {
        if (!cancelled) {
          setCoupons([]);
          setEligibleSubtotal(0);
          setEligibilityReady(true);
          setLoadingCoupons(false);
        }
      }
    }

    void loadCoupons();
    return () => {
      cancelled = true;
    };
  }, [cart]);

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
    const { AdvancedMarkerElement } =
      (await google.maps.importLibrary("marker")) as GoogleMarkerLibrary;

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
      const brandedMarker = new AdvancedMarkerElement({
        map: mapInstanceRef.current,
        position: { lat: origin.latitude, lng: origin.longitude },
        title: "Alentó Pizza",
        content: createAlentoMapPinElement(),
        zIndex: 20,
      });

      originMarkerRef.current = {
        setMap: (map) => {
          brandedMarker.map = map;
        },
      };
    }

    if (destination && mapInstanceRef.current) {
      const deliveryMarker = new AdvancedMarkerElement({
        map: mapInstanceRef.current,
        position: center,
        title: "Tu ubicación",
        content: createDeliveryMapPinElement(),
        zIndex: 25,
      });
      destinationMarkerRef.current = {
        setMap: (map) => {
          deliveryMarker.map = map;
        },
      };
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
      mapInstanceRef.current.fitBounds(bounds, {
        top: 78,
        right: 44,
        bottom: 64,
        left: 44,
      });
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
      setQuote({
        covered: false,
        distanceMeters: 0,
        deliveryFee: null,
        destination: {
          formattedAddress: input.formattedAddress || "Ubicación seleccionada",
          placeId: input.placeId || "",
          latitude: input.latitude,
          longitude: input.longitude,
        },
      });
      setEditingAddress(false);
      setError(
        err instanceof Error ? err.message : "No fue posible calcular el domicilio.",
      );
      await drawMap(
        {
          latitude: input.latitude,
          longitude: input.longitude,
        },
        undefined,
      ).catch(() => undefined);
    } finally {
      setQuoting(false);
    }
  }, [drawMap]);

  const saveValidatedCustomerAddress = useCallback(async (input: {
    formattedAddress: string;
    placeId: string;
    latitude: number;
    longitude: number;
  }) => {
    try {
      await fetch("/api/delivery/customer-default-address", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      // Guardar la dirección mejora compras futuras, pero no debe bloquear
      // la cotización actual si el cliente es invitado o la sesión expiró.
    }
  }, []);

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
    if (fulfillmentType !== "DELIVERY") {
      mapInstanceRef.current = null;
      destinationMarkerRef.current = null;
      originMarkerRef.current = null;
      routePolylineRef.current = null;
      return;
    }

    if (!editingAddress) return;

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

            const selectedLocation = {
              latitude: lat,
              longitude: lng,
              formattedAddress: place.formattedAddress || "",
              placeId: place.id || "",
            };
            await requestQuote(selectedLocation);
            await saveValidatedCustomerAddress(selectedLocation);
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
  }, [editingAddress, fulfillmentType, requestQuote, saveValidatedCustomerAddress]);

  useEffect(() => {
    if (
      fulfillmentType !== "DELIVERY" ||
      !quote?.destination ||
      !mapReady ||
      !mapRef.current
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      void drawMap(quote.destination, quote.encodedPolyline).catch((err) => {
        setError(
          err instanceof Error ? err.message : "No fue posible mostrar el mapa.",
        );
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    drawMap,
    fulfillmentType,
    mapReady,
    origin,
    quote?.destination,
    quote?.encodedPolyline,
  ]);

  const loadSavedCustomerAddress = useCallback(async (force = false) => {
    if ((!force && savedAddressChecked) || loadingSavedAddress) return;

    setLoadingSavedAddress(true);
    setSavedAddressChecked(true);
    setSavedAddressRequiresValidation(false);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch("/api/delivery/customer-default-address", {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await response.json();

      if (!response.ok) return;

      if (data?.requiresValidation) {
        setSavedAddressRequiresValidation(true);
        setQuote(null);
        setEditingAddress(true);
        return;
      }

      if (
        data?.address?.validated &&
        Number.isFinite(Number(data.address.latitude)) &&
        Number.isFinite(Number(data.address.longitude)) &&
        data.address.placeId
      ) {
        await requestQuote({
          latitude: Number(data.address.latitude),
          longitude: Number(data.address.longitude),
          formattedAddress:
            data.address.formattedAddress || data.address.address || "",
          placeId: data.address.placeId,
        });
      }
    } catch {
      // Sin sesión o sin dirección válida: el buscador de Google queda disponible.
    } finally {
      window.clearTimeout(timeout);
      setLoadingSavedAddress(false);
    }
  }, [loadingSavedAddress, requestQuote, savedAddressChecked]);

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
        couponId: selectedCoupon?.id ?? null,
        couponName: selectedCoupon?.name ?? null,
        couponType: selectedCoupon?.type ?? null,
        couponValue: selectedCoupon?.value ?? null,
        discount,
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
      couponId: selectedCoupon?.id ?? null,
      couponName: selectedCoupon?.name ?? null,
      couponType: selectedCoupon?.type ?? null,
      couponValue: selectedCoupon?.value ?? null,
      discount,
      destination: quote.destination,
    });
  }

  const deliveryFee =
    fulfillmentType === "DELIVERY" && quote?.covered
      ? quote.deliveryFee ?? 0
      : 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  return (
    <div
      className={
        fullPage
          ? "w-full bg-[#090909]"
          : "fixed inset-0 z-[140] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-5"
      }
      onMouseDown={(event) => {
        if (!fullPage && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={
          fullPage
            ? "mx-auto flex min-h-dvh w-full max-w-[1180px] flex-col bg-[#111] text-white"
            : "flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-[26px] border border-white/10 bg-[#111] text-white shadow-[0_28px_80px_rgba(0,0,0,.55)] sm:max-h-[92vh] sm:max-w-[680px] sm:rounded-[30px]"
        }
      >
        <header
          className={
            "border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4 " +
            (fullPage ? "sticky top-0 z-30 bg-[#111]/95 backdrop-blur-xl" : "")
          }
        >
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

                if (quote?.destination) {
                  // Cambiar a Recoger no debe destruir la última dirección
                  // válida del cliente. Al volver a Domicilio la reutilizamos.
                  setEditingAddress(false);
                  return;
                }

                setMapReady(false);
                setEditingAddress(true);
                void loadSavedCustomerAddress(true);
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
                // Conservamos quote/destination en memoria. Pickup solo cambia
                // la modalidad; no significa que el cliente haya borrado su
                // dirección de domicilio.
                setEditingAddress(false);
                setError("");
              }}
              className={
                "rounded-[15px] border px-3 py-2.5 text-left transition sm:px-4 sm:py-3 " +
                (fulfillmentType === "PICKUP"
                  ? "border-[#e21a22] bg-[#e21a22]/15"
                  : "border-white/10 bg-white/[0.035]")
              }
            >
              <b className="block text-[12px] sm:text-[13px]">Recoger en tienda</b>
              <span className="mt-0.5 block text-[9px] text-white/40 sm:mt-1 sm:text-[10px]">
                Sin costo de domicilio
              </span>
            </button>
          </div>
        </header>

        <div
          className={
            "min-h-0 flex-1 p-3 sm:p-5 " +
            (fullPage ? "mx-auto w-full max-w-[1080px] overflow-visible py-5 sm:py-7" : "overflow-y-auto")
          }
        >
          {fulfillmentType === "DELIVERY" ? (
            <div className="space-y-2.5 sm:space-y-3">
              {savedAddressRequiresValidation && editingAddress && (
                <div className="rounded-[16px] border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-[11px] leading-5 text-amber-100">
                  <b className="block text-[12px]">Actualiza tu dirección</b>
                  La dirección guardada todavía no fue validada con Google Maps. Selecciónala nuevamente para poder usar domicilio.
                </div>
              )}

              {quote?.destination && !editingAddress ? (
                <section className="rounded-[18px] border border-white/10 bg-white/[0.035] px-3 py-2.5 sm:rounded-[20px] sm:px-4 sm:py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/30">
                        Dirección de entrega
                      </p>
                      <b className="mt-0.5 block truncate text-[11px] leading-4 text-white/90 sm:text-[12px]">
                        {quote.destination.formattedAddress}
                      </b>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingAddress(true);
                        setError("");
                      }}
                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 text-[9px] font-bold text-white/65 transition hover:border-white/20 hover:bg-white/[0.10] hover:text-white sm:h-10 sm:px-3.5 sm:text-[10px]"
                      aria-label="Editar dirección de entrega"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                      </svg>
                      Editar
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
                    <div ref={autocompleteHostRef} />
                    {loadingMaps && (
                      <div className="flex h-[42px] items-center px-3 text-[10px] text-neutral-500">
                        Cargando buscador de direcciones...
                      </div>
                    )}
                  </div>

                  <div className="mt-1.5 flex min-h-[14px] items-center justify-between gap-2">
                    <p className="text-[8px] leading-3.5 text-white/28">
                      Elige una sugerencia de Google para validar cobertura y tarifa.
                    </p>
                    {loadingSavedAddress && (
                      <span className="shrink-0 text-[8px] font-semibold text-white/30">
                        Buscando dirección guardada…
                      </span>
                    )}
                  </div>
                </section>
              )}

              {quote?.destination && (
                <>
                  <section
                    className={
                      "relative mx-auto w-full overflow-hidden rounded-[22px] border border-white/10 bg-[#171717] shadow-[0_18px_50px_rgba(0,0,0,.28)] sm:rounded-[26px] " +
                      (fullPage
                        ? "aspect-square max-w-[680px]"
                        : "aspect-square max-w-[480px]")
                    }
                  >
                    <div
                      ref={(element) => {
                        mapRef.current = element;
                        setMapReady(Boolean(element));
                      }}
                      className="h-full w-full"
                    />

                    <div className="pointer-events-none absolute inset-x-2 top-2 z-10 grid grid-cols-3 overflow-hidden rounded-[14px] border border-white/10 bg-[#111]/90 shadow-[0_8px_22px_rgba(0,0,0,.24)] backdrop-blur-xl sm:inset-x-3 sm:top-3">
                      <div className="px-2 py-1.5 sm:px-2.5 sm:py-2">
                        <span className="block text-[6px] font-bold uppercase tracking-[0.11em] text-white/38 sm:text-[7px]">
                          Distancia
                        </span>
                        <b className="mt-px block truncate text-[10px] leading-4 text-white sm:text-[11px]">
                          {formatDistance(quote.distanceMeters)}
                        </b>
                      </div>
                      <div className="border-l border-white/[0.08] px-2 py-1.5 sm:px-2.5 sm:py-2">
                        <span className="block text-[6px] font-bold uppercase tracking-[0.11em] text-white/38 sm:text-[7px]">
                          Domicilio
                        </span>
                        <b className="mt-px block truncate text-[10px] leading-4 text-[#ff454b] sm:text-[11px]">
                          {quote.covered && quote.deliveryFee != null
                            ? money(quote.deliveryFee)
                            : "Sin cobertura"}
                        </b>
                      </div>
                      <div className="border-l border-white/[0.08] px-2 py-1.5 sm:px-2.5 sm:py-2">
                        <span className="block text-[6px] font-bold uppercase tracking-[0.11em] text-white/38 sm:text-[7px]">
                          Tiempo
                        </span>
                        <b className="mt-px block truncate text-[10px] leading-4 text-white sm:text-[11px]">
                          {formatDuration(quote.durationSeconds) || "—"}
                        </b>
                      </div>
                    </div>



                    {!quoting && !quote.covered && (
                      <div className="absolute inset-x-4 top-1/2 z-20 -translate-y-1/2 sm:inset-x-8">
                        <div className="mx-auto max-w-[430px] rounded-[22px] border border-[#e21a22]/35 bg-[#111]/94 p-4 text-white shadow-[0_22px_60px_rgba(0,0,0,.45)] backdrop-blur-xl sm:p-5">
                          <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ff5a60]/25 bg-[#e21a22]/15 text-[#ff5a60]">
                              <svg
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M12 9v4" />
                                <path d="M12 17h.01" />
                                <path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
                              </svg>
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-black leading-5 sm:text-[14px]">
                                Esta ubicación está fuera de nuestra cobertura
                              </p>
                              <p className="mt-1 text-[10px] leading-4 text-white/55 sm:text-[11px] sm:leading-5">
                                Elige otra dirección o cambia a Recoger en tienda.
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAddress(true);
                                setError("");
                              }}
                              className="h-10 rounded-full border border-white/12 bg-white/[0.06] px-3 text-[9px] font-black text-white/78 transition hover:bg-white/[0.10] active:scale-[0.98] sm:text-[10px]"
                            >
                              Editar dirección
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFulfillmentType("PICKUP");
                                setEditingAddress(false);
                                setError("");
                              }}
                              className="h-10 rounded-full bg-[#e21a22] px-3 text-[9px] font-black text-white shadow-[0_8px_20px_rgba(226,26,34,.28)] transition hover:bg-[#c9151c] active:scale-[0.98] sm:text-[10px]"
                            >
                              Recoger en tienda
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-2 sm:inset-x-4 sm:bottom-4">
                      <div className="rounded-full border border-black/5 bg-white/90 px-2.5 py-1.5 text-[7px] font-bold text-neutral-800 shadow-md backdrop-blur sm:text-[8px]">
                        Alentó → tu ubicación
                      </div>
                      {quoting && (
                        <div className="rounded-full bg-[#111]/92 px-3 py-2 text-[8px] font-bold text-white shadow-lg backdrop-blur sm:text-[9px]">
                          Calculando...
                        </div>
                      )}
                    </div>
                  </section>
                </>
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

        <footer
          className={
            "border-t border-white/10 bg-[#0c0c0c] p-3 sm:p-4 " +
            (fullPage ? "sticky bottom-0 z-30 mt-auto" : "")
          }
        >
          {(loadingCoupons || applicableCoupons.length > 0) && (
            <section className="mb-3 rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.13em] text-red-300">
                    Beneficios disponibles
                  </p>
                  <p className="mt-0.5 text-[9px] leading-4 text-white/48">
                    Aplica un cupón y mira tu nuevo total antes de continuar.
                  </p>
                </div>
                {selectedCoupon && (
                  <button
                    type="button"
                    onClick={() => setSelectedCouponId(null)}
                    className="shrink-0 text-[9px] font-bold text-white/55 underline underline-offset-2"
                  >
                    Quitar
                  </button>
                )}
              </div>

              {loadingCoupons ? (
                <div className="mt-2.5 rounded-[14px] border border-white/[0.07] bg-black/20 px-3 py-3 text-[9px] text-white/40">
                  Cargando cupones...
                </div>
              ) : (
                <div className="alento-scroll mt-2.5 flex gap-2 overflow-x-auto pb-1">
                  {applicableCoupons.map((coupon) => {
                    const active = selectedCouponId === coupon.id;
                    const saving =
                      coupon.type === "PERCENTAGE"
                        ? Math.round(eligibleSubtotal * (coupon.value / 100))
                        : Math.min(coupon.value, eligibleSubtotal);

                    return (
                      <button
                        key={coupon.id}
                        type="button"
                        onClick={() =>
                          setSelectedCouponId(active ? null : coupon.id)
                        }
                        className={
                          "min-w-[210px] shrink-0 rounded-[15px] border px-3 py-2.5 text-left transition " +
                          (active
                            ? "border-[#e21a22] bg-[#e21a22]/16 shadow-[0_0_0_1px_rgba(226,26,34,.14)]"
                            : "border-white/10 bg-black/20 hover:bg-white/[0.05]")
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <b className="block truncate text-[10px] text-white">
                              {coupon.name}
                            </b>
                            <span className="mt-0.5 block text-[9px] font-bold text-red-300">
                              {coupon.type === "PERCENTAGE"
                                ? `${coupon.value}% de descuento`
                                : `${money(coupon.value)} de descuento`}
                            </span>
                          </div>
                          <span
                            className={
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-black " +
                              (active
                                ? "border-[#e21a22] bg-[#e21a22] text-white"
                                : "border-white/20 text-transparent")
                            }
                          >
                            ✓
                          </span>
                        </div>
                        <span className="mt-1.5 block text-[8px] text-white/45">
                          {eligibilityReady
                            ? `Ahorras ${money(saving)}`
                            : "Calculando ahorro..."}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <div className="mb-3 rounded-[16px] border border-white/[0.07] bg-white/[0.025] px-3.5 py-3 sm:px-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[9px] font-semibold text-white/38 sm:text-[10px]">
                Subtotal
              </span>
              <span className="text-[11px] font-semibold text-white/72 sm:text-[12px]">
                {money(subtotal)}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-[9px] font-semibold text-white/38 sm:text-[10px]">
                Domicilio
              </span>
              <span
                className={
                  "text-[11px] font-semibold sm:text-[12px] " +
                  (fulfillmentType === "DELIVERY" &&
                  quote?.covered &&
                  quote.deliveryFee != null
                    ? "text-[#ff454b]"
                    : "text-white/72")
                }
              >
                {fulfillmentType === "PICKUP"
                  ? money(0)
                  : quote?.covered && quote.deliveryFee != null
                    ? money(quote.deliveryFee)
                    : "—"}
              </span>
            </div>

            {discount > 0 && (
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-[9px] font-semibold text-white/50 sm:text-[10px]">
                  Cupón · {selectedCoupon?.name}
                </span>
                <span className="text-[11px] font-bold text-emerald-300 sm:text-[12px]">
                  − {money(discount)}
                </span>
              </div>
            )}

            <div className="mt-2.5 flex items-end justify-between gap-4 border-t border-white/[0.08] pt-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/55">
                Total
              </span>
              <b className="text-[21px] tracking-[-0.03em] text-white sm:text-[23px]">
                {money(total)}
              </b>
            </div>
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={
              quoting ||
              (selectedCouponId != null && !eligibilityReady) ||
              (fulfillmentType === "DELIVERY" &&
                (editingAddress || !quote?.covered || quote.deliveryFee == null))
            }
            className="h-11 w-full rounded-full bg-[#e21a22] text-[10px] font-bold uppercase tracking-[0.05em] text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 sm:h-12 sm:text-[11px]"
          >
            {fulfillmentType === "DELIVERY"
              ? !editingAddress && quote?.covered
                ? "Confirmar domicilio"
                : "Confirma una dirección"
              : "Continuar · recoger en tienda"}
          </button>
        </footer>
      </div>
    </div>
  );
}
