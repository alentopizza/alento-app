"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DELIVERY_TRAVEL_MODE_OPTIONS,
  deliveryTravelModeColor,
  deliveryTravelModeLabel,
  googleMapsUrlTravelMode,
  normalizeDeliveryTravelMode,
  type DeliveryTravelMode,
} from "@/lib/deliveryTravelMode";
import {
  createDeliveryMapPinElement,
  createDriverMapPinElement,
} from "@/lib/alentoMapMarker";

const ALENTO_DELIVERY_MAP_ID = "b0bfaae2809a720a6204509b";

type Point = {
  latitude: number;
  longitude: number;
};

type NavigationData = {
  travelMode: DeliveryTravelMode;
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
    requestedTravelMode?: DeliveryTravelMode;
    routeTravelMode?: DeliveryTravelMode;
    fallbackToVehicle?: boolean;
  };
};

type GoogleMapInstance = {
  fitBounds: (
    bounds: unknown,
    padding?:
      | number
      | { top: number; right: number; bottom: number; left: number },
  ) => void;
  panTo?: (point: { lat: number; lng: number }) => void;
  setCenter?: (point: { lat: number; lng: number }) => void;
  setZoom?: (zoom: number) => void;
  setHeading?: (heading: number) => void;
  getHeading?: () => number | undefined;
  setTilt?: (tilt: number) => void;
  addListener?: (
    eventName: string,
    handler: () => void,
  ) => { remove?: () => void };
};

type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
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
    RenderingType?: {
      VECTOR: string;
    };
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

type NavigationPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function movementDistanceMeters(
  from: NavigationPosition,
  to: NavigationPosition,
) {
  const earthRadius = 6371000;
  const lat1 = degreesToRadians(from.latitude);
  const lat2 = degreesToRadians(to.latitude);
  const deltaLat = degreesToRadians(to.latitude - from.latitude);
  const deltaLng = degreesToRadians(to.longitude - from.longitude);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const a =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return (
    earthRadius *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
  );
}

function movementHeadingDegrees(
  from: NavigationPosition,
  to: NavigationPosition,
) {
  const lat1 = degreesToRadians(from.latitude);
  const lat2 = degreesToRadians(to.latitude);
  const deltaLng = degreesToRadians(to.longitude - from.longitude);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return (radiansToDegrees(Math.atan2(y, x)) + 360) % 360;
}

function normalizeHeading(value: number) {
  return ((value % 360) + 360) % 360;
}

function shortestHeadingDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function pointAheadOfPosition(
  position: NavigationPosition,
  heading: number,
  distanceMeters: number,
) {
  const earthRadius = 6371000;
  const angularDistance = distanceMeters / earthRadius;
  const bearing = degreesToRadians(heading);
  const latitude = degreesToRadians(position.latitude);
  const longitude = degreesToRadians(position.longitude);

  const targetLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) *
        Math.sin(angularDistance) *
        Math.cos(bearing),
  );

  const targetLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) *
        Math.sin(angularDistance) *
        Math.cos(latitude),
      Math.cos(angularDistance) -
        Math.sin(latitude) * Math.sin(targetLatitude),
    );

  return {
    lat: radiansToDegrees(targetLatitude),
    lng: radiansToDegrees(targetLongitude),
  };
}

function cameraLookAheadMeters(
  travelMode: DeliveryTravelMode | null,
  speedMetersPerSecond: number | null,
) {
  const speed =
    speedMetersPerSecond != null &&
    Number.isFinite(speedMetersPerSecond) &&
    speedMetersPerSecond > 0
      ? speedMetersPerSecond
      : 0;

  if (travelMode === "WALK") {
    return Math.min(28, Math.max(16, 14 + speed * 4));
  }

  if (travelMode === "MOTORCYCLE") {
    return Math.min(85, Math.max(42, 38 + speed * 3.5));
  }

  return Math.min(95, Math.max(48, 42 + speed * 4));
}

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


export default function DriverDestinationActions({
  token,
  phone,
  customerName,
  currentStatus,
  canStartDelivery,
  orderCode,
  initialTravelMode,
}: {
  token: string;
  phone: string | null;
  customerName: string;
  currentStatus: string;
  canStartDelivery: boolean;
  orderCode: string;
  initialTravelMode: string | null;
}) {
  const router = useRouter();
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const departureTrackRef = useRef<HTMLDivElement | null>(null);
  const arrivalTrackRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRefs = useRef<Array<GoogleMarkerInstance | GoogleAdvancedMarkerInstance>>([]);
  const driverMarkerRef = useRef<GoogleAdvancedMarkerInstance | null>(null);
  const routeRef = useRef<GooglePolylineInstance | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastRouteAtRef = useRef(0);
  const lastPositionRef = useRef<NavigationPosition | null>(null);
  const lastHeadingRef = useRef<number | null>(null);
  const routeHeadingRef = useRef<number | null>(null);
  const lastSpeedRef = useRef<number | null>(null);
  const headingAnimationRef = useRef<number | null>(null);
  const mapDragListenerRef = useRef<{ remove?: () => void } | null>(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [navigation, setNavigation] = useState<NavigationData | null>(null);
  const [error, setError] = useState("");
  const [navigationStatus, setNavigationStatus] = useState(currentStatus);
  const [travelMode, setTravelMode] = useState<DeliveryTravelMode | null>(
    normalizeDeliveryTravelMode(initialTravelMode),
  );
  const [departureProgress, setDepartureProgress] = useState(0);
  const [departureDragging, setDepartureDragging] = useState(false);
  const [departureBusy, setDepartureBusy] = useState(false);
  const [arrivalProgress, setArrivalProgress] = useState(0);
  const [arrivalDragging, setArrivalDragging] = useState(false);
  const [arrivalBusy, setArrivalBusy] = useState(false);
  const [cameraFollowing, setCameraFollowingState] = useState(true);
  const cameraFollowingRef = useRef(true);

  const setCameraFollowing = useCallback((value: boolean) => {
    cameraFollowingRef.current = value;
    setCameraFollowingState(value);
  }, []);

  useEffect(() => {
    setNavigationStatus(currentStatus);
    setTravelMode(
      normalizeDeliveryTravelMode(initialTravelMode),
    );

    if (["OUT_FOR_DELIVERY", "ARRIVED"].includes(currentStatus)) {
      setCameraFollowing(true);
      setOpen(true);
    }
  }, [currentStatus, initialTravelMode, setCameraFollowing]);

  const navigationDisabled = [
    "DELIVERED",
    "COMPLETED",
    "CANCELED",
  ].includes(navigationStatus);
  const preDelivery = [
    "CONFIRMED",
    "PREPARING",
    "PREPARED",
    "READY",
  ].includes(navigationStatus);
  const deliveryActive = [
    "OUT_FOR_DELIVERY",
    "ARRIVED",
  ].includes(navigationStatus);

  const resetMap = useCallback(() => {
    markerRefs.current.forEach((marker) => {
      if ("setMap" in marker) marker.setMap(null);
      else marker.map = null;
    });
    markerRefs.current = [];
    driverMarkerRef.current = null;
    routeRef.current?.setMap(null);
    routeRef.current = null;
    mapDragListenerRef.current?.remove?.();
    mapDragListenerRef.current = null;
    if (headingAnimationRef.current != null) {
      window.cancelAnimationFrame(headingAnimationRef.current);
      headingAnimationRef.current = null;
    }
    lastPositionRef.current = null;
    lastHeadingRef.current = null;
    routeHeadingRef.current = null;
    lastSpeedRef.current = null;
    mapRef.current = null;
  }, []);

  const animateHeading = useCallback(
    (map: GoogleMapInstance, targetHeading: number) => {
      if (!map.setHeading) return;

      const normalizedTarget = normalizeHeading(targetHeading);
      const currentHeading = normalizeHeading(
        map.getHeading?.() ?? lastHeadingRef.current ?? normalizedTarget,
      );
      const delta = shortestHeadingDelta(
        currentHeading,
        normalizedTarget,
      );

      if (Math.abs(delta) < 1) {
        map.setHeading(normalizedTarget);
        lastHeadingRef.current = normalizedTarget;
        return;
      }

      if (headingAnimationRef.current != null) {
        window.cancelAnimationFrame(headingAnimationRef.current);
      }

      const duration = 320;
      const startedAt = performance.now();

      const frame = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const heading = normalizeHeading(
          currentHeading + delta * eased,
        );
        map.setHeading?.(heading);

        if (progress < 1) {
          headingAnimationRef.current =
            window.requestAnimationFrame(frame);
        } else {
          headingAnimationRef.current = null;
          lastHeadingRef.current = normalizedTarget;
        }
      };

      headingAnimationRef.current =
        window.requestAnimationFrame(frame);
    },
    [],
  );

  const resolveMovementHeading = useCallback(
    (position: GeolocationPosition) => {
      const current: NavigationPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      const previous = lastPositionRef.current;

      const rawHeading = position.coords.heading;
      const rawSpeed = position.coords.speed;
      const gpsHeading =
        typeof rawHeading === "number" &&
        Number.isFinite(rawHeading)
          ? rawHeading
          : null;
      const speed =
        typeof rawSpeed === "number" && Number.isFinite(rawSpeed)
          ? Math.max(0, rawSpeed)
          : null;

      lastSpeedRef.current = speed;

      const gpsHeadingReliable =
        gpsHeading != null &&
        gpsHeading >= 0 &&
        (speed == null || speed >= 0.8);

      if (gpsHeadingReliable) {
        const heading = normalizeHeading(gpsHeading);
        lastPositionRef.current = current;
        lastHeadingRef.current = heading;
        return heading;
      }

      if (!previous) {
        lastPositionRef.current = current;
        return lastHeadingRef.current ?? routeHeadingRef.current;
      }

      const movement = movementDistanceMeters(previous, current);
      const minimumMovement = Math.max(
        4,
        Math.min(
          10,
          Math.max(previous.accuracy, current.accuracy) * 0.4,
        ),
      );

      // No movemos el punto de referencia hasta recorrer una distancia útil.
      // Así varios avances pequeños se acumulan y no se pierden por ruido GPS.
      if (movement < minimumMovement) {
        return lastHeadingRef.current ?? routeHeadingRef.current;
      }

      const movementHeading = movementHeadingDegrees(previous, current);
      lastPositionRef.current = current;

      const previousHeading =
        lastHeadingRef.current ?? routeHeadingRef.current;
      if (previousHeading == null) {
        lastHeadingRef.current = movementHeading;
        return movementHeading;
      }

      const delta = shortestHeadingDelta(
        previousHeading,
        movementHeading,
      );
      const blend =
        Math.abs(delta) >= 80
          ? 0.7
          : Math.abs(delta) >= 40
            ? 0.52
            : 0.34;
      const filteredHeading = normalizeHeading(
        previousHeading + delta * blend,
      );

      lastHeadingRef.current = filteredHeading;
      return filteredHeading;
    },
    [],
  );

  const updateNavigationCamera = useCallback(
    (position: GeolocationPosition) => {
      const map = mapRef.current;
      if (!map) return;

      const heading = resolveMovementHeading(position);

      // Antes de iniciar el domicilio mostramos la ruta completa para que el
      // repartidor pueda preparar el trayecto desde que recibe la asignación.
      // El modo "rumbo arriba" solo se activa durante la entrega real.
      if (
        preDelivery ||
        !cameraFollowingRef.current
      ) {
        return;
      }

      const currentPosition: NavigationPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      if (driverMarkerRef.current) {
        driverMarkerRef.current.position = {
          lat: currentPosition.latitude,
          lng: currentPosition.longitude,
        };
      }
      const cameraTarget =
        heading != null && Number.isFinite(heading)
          ? pointAheadOfPosition(
              currentPosition,
              heading,
              cameraLookAheadMeters(
                travelMode,
                lastSpeedRef.current,
              ),
            )
          : {
              lat: currentPosition.latitude,
              lng: currentPosition.longitude,
            };

      if (map.panTo) map.panTo(cameraTarget);
      else map.setCenter?.(cameraTarget);

      map.setZoom?.(17);
      map.setTilt?.(45);

      if (heading != null && Number.isFinite(heading)) {
        animateHeading(map, heading);
      }
    },
    [
      animateHeading,
      preDelivery,
      resolveMovementHeading,
      travelMode,
    ],
  );

  const drawMap = useCallback(
    async (data: NavigationData) => {
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
          ...(google.maps.RenderingType?.VECTOR
            ? { renderingType: google.maps.RenderingType.VECTOR }
            : {}),
          disableDefaultUI: true,
          gestureHandling: "greedy",
          headingInteractionEnabled: false,
          tiltInteractionEnabled: false,
        });

        mapDragListenerRef.current =
          mapRef.current.addListener?.("dragstart", () => {
            setCameraFollowing(false);
          }) ?? null;
      }

      markerRefs.current.forEach((marker) => {
        if ("setMap" in marker) marker.setMap(null);
        else marker.map = null;
      });
      markerRefs.current = [];
      routeRef.current?.setMap(null);

      const map = mapRef.current;

      const driverMarker = new AdvancedMarkerElement({
        map,
        position: {
          lat: data.driver.latitude,
          lng: data.driver.longitude,
        },
        title: "Repartidor",
        content: createDriverMapPinElement(),
        zIndex: 30,
      });
      driverMarkerRef.current = driverMarker;
      markerRefs.current.push(driverMarker);

      const customerMarker = new AdvancedMarkerElement({
        map,
        position: {
          lat: data.destination.latitude,
          lng: data.destination.longitude,
        },
        title: `${orderCode} · ${customerName}`,
        content: createDeliveryMapPinElement(orderCode),
        zIndex: 25,
      });
      markerRefs.current.push(customerMarker);

      const bounds = new google.maps.LatLngBounds();
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
          strokeColor: deliveryTravelModeColor(data.travelMode),
          strokeOpacity: 0.96,
          strokeWeight: 5,
          geodesic: true,
        });

        path.forEach((point) => {
          bounds.extend({ lat: point.lat(), lng: point.lng() });
        });

        const routeOrigin: NavigationPosition = {
          latitude: data.driver.latitude,
          longitude: data.driver.longitude,
          accuracy: Math.max(1, data.driver.accuracy ?? 1),
        };
        const forwardPoint = path.find((point) => {
          const candidate: NavigationPosition = {
            latitude: point.lat(),
            longitude: point.lng(),
            accuracy: 1,
          };
          return movementDistanceMeters(routeOrigin, candidate) >= 12;
        });

        if (forwardPoint) {
          routeHeadingRef.current = movementHeadingDegrees(
            routeOrigin,
            {
              latitude: forwardPoint.lat(),
              longitude: forwardPoint.lng(),
              accuracy: 1,
            },
          );
        }
      }

      if (preDelivery) {
        map.setTilt?.(0);
        map.setHeading?.(0);
        map.fitBounds(bounds, {
          // Antes de iniciar la entrega mostramos la ruta completa.
          top: 160,
          right: 54,
          bottom: 96,
          left: 54,
        });
      } else if (
        cameraFollowingRef.current &&
        lastHeadingRef.current == null &&
        routeHeadingRef.current != null
      ) {
        map.setZoom?.(17);
        map.setTilt?.(45);
        animateHeading(map, routeHeadingRef.current);
      }
    },
    [animateHeading, customerName, orderCode, preDelivery],
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
            deliveryTravelMode: travelMode ?? "VEHICLE",
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
    [token, travelMode],
  );

  useEffect(() => {
    if (navigationDisabled && open) {
      setOpen(false);
    }
  }, [navigationDisabled, open]);

  useEffect(() => {
    if (!open || navigationDisabled) return;

    let disposed = false;

    async function setup() {
      setLoading(true);
      setError("");

      try {
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

            // La cámara sigue la ubicación y el rumbo en cada actualización
            // del GPS. La ruta de Google se mantiene limitada a ~8 s para no
            // aumentar llamadas innecesarias.
            updateNavigationCamera(position);

            const now = Date.now();
            const shouldRoute =
              now - lastRouteAtRef.current >= 8000;

            if (!shouldRoute) return;

            lastRouteAtRef.current = now;

            try {
              const next = await requestNavigation(position);
              await drawMap(next);
              updateNavigationCamera(position);
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
  }, [
    drawMap,
    navigationDisabled,
    open,
    requestNavigation,
    resetMap,
    token,
    updateNavigationCamera,
  ]);

  function updateDepartureFromPointer(clientX: number) {
    const track = departureTrackRef.current;
    if (!track) return 0;

    const rect = track.getBoundingClientRect();
    const knobSize = 54;
    const padding = 4;
    const usable = Math.max(1, rect.width - knobSize - padding * 2);
    const raw = (clientX - rect.left - padding - knobSize / 2) / usable;
    const next = Math.min(1, Math.max(0, raw));
    setDepartureProgress(next);
    return next;
  }

  async function confirmDeparture() {
    if (
      departureBusy ||
      navigationStatus !== "READY" ||
      !canStartDelivery ||
      !travelMode
    ) {
      setDepartureProgress(0);
      return;
    }

    setDepartureBusy(true);
    setError("");

    try {
      const response = await fetch(
        `/api/repartidor/pedido/${encodeURIComponent(token)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "OUT_FOR_DELIVERY",
            deliveryTravelMode: travelMode,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible iniciar el domicilio.",
        );
      }

      setCameraFollowing(true);
      setNavigationStatus("OUT_FOR_DELIVERY");
      setDepartureProgress(0);
      router.refresh();
      window.setTimeout(() => router.refresh(), 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible iniciar el domicilio.",
      );
      setDepartureProgress(0);
    } finally {
      setDepartureDragging(false);
      setDepartureBusy(false);
    }
  }

  function finishDeparture(nextProgress = departureProgress) {
    setDepartureDragging(false);

    if (
      departureBusy ||
      navigationStatus !== "READY" ||
      !canStartDelivery ||
      !travelMode
    ) {
      setDepartureProgress(0);
      return;
    }

    if (nextProgress >= 0.82) {
      setDepartureProgress(1);
      void confirmDeparture();
      return;
    }

    setDepartureProgress(0);
  }

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
    if (arrivalBusy || navigationStatus !== "OUT_FOR_DELIVERY") return;

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

      setNavigationStatus("ARRIVED");
      setArrivalProgress(0);
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

    if (arrivalBusy || navigationStatus !== "OUT_FOR_DELIVERY") {
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
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
        `${navigation.driver.latitude},${navigation.driver.longitude}`,
      )}&destination=${encodeURIComponent(
        `${navigation.destination.latitude},${navigation.destination.longitude}`,
      )}&travelmode=${googleMapsUrlTravelMode(
        navigation.travelMode,
      )}&dir_action=navigate`
    : null;

  function openExternalMapsNavigation() {
    if (!navigation || !googleMapsUrl) return;

    const popup = window.open(
      googleMapsUrl,
      "_blank",
      "noopener,noreferrer",
    );
    if (!popup) {
      window.location.assign(googleMapsUrl);
    }
  }

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
          disabled={navigationDisabled}
          onClick={() => {
            if (!navigationDisabled) {
              setCameraFollowing(true);
              setOpen(true);
            }
          }}
          aria-label={
            navigationDisabled
              ? "Navegación finalizada"
              : "Abrir navegación"
          }
          title={
            navigationDisabled
              ? "Pedido finalizado"
              : "Navegar al cliente"
          }
          className={
            "flex h-10 w-10 items-center justify-center rounded-full transition " +
            (navigationDisabled
              ? "cursor-not-allowed bg-neutral-200 text-neutral-400 shadow-none"
              : "bg-[#e21a22] text-white shadow-[0_7px_16px_rgba(226,26,34,.22)] hover:bg-[#c9151c] active:scale-[.97]")
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
                <button
                  type="button"
                  onClick={openExternalMapsNavigation}
                  disabled={!googleMapsUrl}
                  aria-label="Abrir ruta en Google Maps"
                  title="Abrir en Google Maps"
                  className={
                    "flex h-10 w-10 items-center justify-center rounded-full border transition " +
                    (googleMapsUrl
                      ? "border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.10]"
                      : "cursor-not-allowed border-white/5 bg-white/[0.03] text-white/20")
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
                </button>

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

              <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 grid grid-cols-3 gap-1 rounded-[18px] border border-white/10 bg-[#111]/94 p-2.5 shadow-xl backdrop-blur-xl sm:left-4 sm:right-4">
                <div className="border-r border-white/10 px-2">
                  <span className="block text-[7px] font-black uppercase tracking-[.1em] text-white/40">
                    Modo
                  </span>
                  <b className="mt-1 block truncate text-[12px]">
                    {travelMode
                      ? deliveryTravelModeLabel(travelMode)
                      : preDelivery
                        ? "Vista previa"
                        : "—"}
                  </b>
                </div>
                <div className="border-r border-white/10 px-2">
                  <span className="block text-[7px] font-black uppercase tracking-[.1em] text-white/40">
                    Distancia
                  </span>
                  <b className="mt-1 block text-[12px]">
                    {navigation
                      ? formatDistance(navigation.route.distanceMeters)
                      : "—"}
                  </b>
                </div>
                <div className="px-2">
                  <span className="block text-[7px] font-black uppercase tracking-[.1em] text-white/40">
                    Tiempo
                  </span>
                  <b className="mt-1 block text-[12px]">
                    {navigation
                      ? formatDuration(navigation.route.durationSeconds)
                      : "—"}
                  </b>
                </div>
              </div>

              {deliveryActive && (
                <div
                  className={
                    "absolute right-3 z-20 sm:right-4 " +
                    (travelMode && travelMode !== "VEHICLE"
                      ? "top-[126px]"
                      : "top-[82px]")
                  }
                >
                  {cameraFollowing ? (
                    <div className="pointer-events-none flex h-9 items-center gap-2 rounded-full border border-white/10 bg-[#111]/90 px-3 text-[9px] font-bold uppercase tracking-[.07em] text-white/65 shadow-lg backdrop-blur-md">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                      Rumbo activo
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setCameraFollowing(true);
                        const latest = lastPositionRef.current;
                        const map = mapRef.current;
                        if (latest && map) {
                          const heading =
                            lastHeadingRef.current ??
                            routeHeadingRef.current;
                          const point =
                            heading != null
                              ? pointAheadOfPosition(
                                  latest,
                                  heading,
                                  cameraLookAheadMeters(
                                    travelMode,
                                    lastSpeedRef.current,
                                  ),
                                )
                              : {
                                  lat: latest.latitude,
                                  lng: latest.longitude,
                                };
                          if (map.panTo) map.panTo(point);
                          else map.setCenter?.(point);
                          map.setZoom?.(17);
                          map.setTilt?.(45);
                          if (heading != null) {
                            animateHeading(map, heading);
                          }
                        }
                      }}
                      className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-black/90 px-3 text-[9px] font-black uppercase tracking-[.07em] text-white shadow-xl backdrop-blur-md"
                    >
                      <span className="text-[14px]">➤</span>
                      Seguir
                    </button>
                  )}
                </div>
              )}

              {travelMode && travelMode !== "VEHICLE" && (
                <div className="pointer-events-none absolute left-3 right-3 top-[82px] z-20 rounded-[12px] border border-white/10 bg-[#111]/88 px-3 py-2 text-center text-[8px] font-semibold leading-4 text-white/48 backdrop-blur-md sm:left-4 sm:right-4">
                  Ruta orientativa. Verifica condiciones del camino y señalización durante el trayecto.
                </div>
              )}

              {loading && !navigation && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 text-[11px] font-bold text-white/75 backdrop-blur-sm">
                  Calculando ruta...
                </div>
              )}

              {navigation?.route.fallbackToVehicle && (
                <div className="absolute bottom-3 left-3 right-3 z-20 rounded-[16px] border border-amber-300/20 bg-[#211708]/95 px-3 py-2.5 text-[9px] font-semibold leading-4 text-amber-200 shadow-xl">
                  Google no devolvió una ruta específica para moto en este punto. Se muestra una ruta vial aproximada.
                </div>
              )}

              {error && (
                <div className="absolute bottom-3 left-3 right-3 z-20 rounded-[16px] border border-[#e21a22]/25 bg-[#210b0d]/95 px-3 py-3 text-[10px] font-semibold leading-4 text-[#ff8b8f] shadow-xl">
                  {error}
                </div>
              )}
            </div>

            {preDelivery && (
              <div className="border-t border-white/10 bg-[#0d0d0d] p-3 sm:p-4">
                <div className="mb-3">
                  <span className="block text-[8px] font-black uppercase tracking-[.11em] text-white/40">
                    ¿Cómo vas a entregar?
                  </span>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {DELIVERY_TRAVEL_MODE_OPTIONS.map((option) => {
                      const selected = travelMode === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setTravelMode(option.value);
                            setNavigation(null);
                            setCameraFollowing(true);
                            lastRouteAtRef.current = 0;
                            lastPositionRef.current = null;
                            lastHeadingRef.current = null;
                            routeHeadingRef.current = null;
                            lastSpeedRef.current = null;
                          }}
                          className={
                            "rounded-[14px] border px-2 py-2.5 text-center transition " +
                            (selected
                              ? "border-[#e21a22] bg-[#e21a22]/15 text-white"
                              : "border-white/10 bg-white/[0.045] text-white/55")
                          }
                        >
                          <span className="block text-lg">{option.emoji}</span>
                          <b className="mt-1 block text-[9px]">{option.label}</b>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[8px] leading-4 text-white/32">
                    Las rutas a pie y en moto dependen de la cobertura disponible de Google y pueden requerir precaución adicional.
                  </p>
                </div>

                {navigationStatus !== "READY" && (
                  <div className="mb-3 rounded-[14px] border border-emerald-300/15 bg-emerald-400/[0.07] px-3 py-2.5 text-[9px] font-semibold leading-4 text-emerald-100/65">
                    Puedes revisar la ubicación y preparar la ruta desde ahora. El inicio del domicilio se habilitará cuando el pedido esté listo.
                  </div>
                )}

                {navigationStatus === "READY" && (
                <div
                  ref={departureTrackRef}
                  className={
                    "relative h-[62px] w-full overflow-hidden rounded-full border backdrop-blur-md " +
                    (canStartDelivery && travelMode
                      ? "landing-menu-slider border-white/80 bg-white/95 shadow-[0_16px_44px_rgba(0,0,0,.20)]"
                      : "border-white/20 bg-white/70 shadow-[0_12px_30px_rgba(0,0,0,.18)]")
                  }
                >
                  <div
                    className="absolute inset-y-1 left-1 z-[1] rounded-full bg-[#e21a22]"
                    style={{
                      width: `calc(54px + (100% - 62px) * ${departureProgress})`,
                      transition: departureDragging
                        ? "none"
                        : "width 220ms cubic-bezier(.2,.8,.2,1)",
                    }}
                  />

                  <div
                    className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center px-[72px] text-center"
                    style={{
                      opacity: Math.max(0.18, 1 - departureProgress * 1.15),
                      transition: departureDragging
                        ? "none"
                        : "opacity 180ms ease",
                    }}
                  >
                    <span
                      className={
                        "truncate text-[10px] font-black uppercase tracking-[0.11em] " +
                        (canStartDelivery && travelMode
                          ? "landing-menu-slider-text text-black/75"
                          : "text-black/45")
                      }
                    >
                      {departureBusy
                        ? "Iniciando domicilio..."
                        : !canStartDelivery
                          ? "Verifica los productos primero"
                          : !travelMode
                            ? "Elige cómo vas a entregar"
                            : "Desliza para iniciar entrega"}
                    </span>
                  </div>

                  <button
                    type="button"
                    aria-label={
                      canStartDelivery
                        ? travelMode
                          ? "Desliza para iniciar entrega"
                          : "Elige cómo vas a entregar"
                        : "Verifica los productos primero"
                    }
                    disabled={departureBusy || !canStartDelivery || !travelMode}
                    className={
                      "absolute top-1 z-[4] flex h-[54px] w-[54px] touch-none select-none items-center justify-center rounded-full bg-black text-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[#e21a22] focus-visible:ring-offset-2 active:scale-[.98] disabled:cursor-not-allowed " +
                      (canStartDelivery && travelMode
                        ? "landing-menu-slider-knob " +
                          (!departureDragging && departureProgress === 0
                            ? "landing-menu-slider-knob-idle"
                            : "")
                        : "opacity-55 shadow-[0_8px_18px_rgba(0,0,0,.24)]")
                    }
                    style={{
                      left: `calc(4px + (100% - 62px) * ${departureProgress})`,
                      transition: departureDragging
                        ? "none"
                        : "left 220ms cubic-bezier(.2,.8,.2,1)",
                    }}
                    onPointerDown={(event) => {
                      if (departureBusy || !canStartDelivery || !travelMode) return;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDepartureDragging(true);
                      updateDepartureFromPointer(event.clientX);
                    }}
                    onPointerMove={(event) => {
                      if (!departureDragging || departureBusy) return;
                      updateDepartureFromPointer(event.clientX);
                    }}
                    onPointerUp={(event) => {
                      if (!departureDragging || departureBusy) return;
                      const next = updateDepartureFromPointer(event.clientX);
                      finishDeparture(next);
                    }}
                    onPointerCancel={() => {
                      if (!departureBusy) finishDeparture(0);
                    }}
                    onKeyDown={(event) => {
                      if (
                        (event.key === "Enter" || event.key === " ") &&
                        !departureBusy &&
                        canStartDelivery &&
                        travelMode
                      ) {
                        event.preventDefault();
                        setDepartureProgress(1);
                        void confirmDeparture();
                      }
                    }}
                  >
                    {departureBusy ? (
                      <span className="text-lg">…</span>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className={
                          "h-[22px] w-[22px] " +
                          (canStartDelivery ? "landing-menu-slider-arrow" : "")
                        }
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
                )}
              </div>
            )}

            {navigationStatus === "OUT_FOR_DELIVERY" && (
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
