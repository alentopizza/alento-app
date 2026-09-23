"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const LOGO =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

const HOME_GPS_KEY = "alento-driver-home-gps";

type DriverState = {
  id: number;
  name: string;
  driverAvailable: boolean;
  driverLatitude: number | null;
  driverLongitude: number | null;
  driverLocationAccuracy: number | null;
  driverLocationUpdatedAt: string | null;
};

type DriverRequest = {
  id: number;
  code: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  customerName: string;
  address: {
    address: string;
    neighborhood: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  itemCount: number;
  assignment: {
    driverId: number;
    driverName: string;
    own: boolean;
  } | null;
  claimable: boolean;
  href: string | null;
};

type DriverTab = "requests" | "performance" | "wallet";

type GoogleMarker = {
  setMap: (map: GoogleMap | null) => void;
  addListener: (event: string, listener: () => void) => unknown;
};

type GoogleMap = {
  fitBounds: (
    bounds: unknown,
    padding?: number | { top: number; right: number; bottom: number; left: number },
  ) => void;
  panTo: (point: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
};

type GoogleBounds = {
  extend: (point: { lat: number; lng: number }) => void;
};

type GoogleRuntime = {
  maps: {
    importLibrary: (name: string) => Promise<unknown>;
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Marker: new (options: Record<string, unknown>) => GoogleMarker;
    LatLngBounds: new () => GoogleBounds;
  };
};

function getGoogle() {
  return (window as typeof window & { google?: GoogleRuntime }).google;
}

function installGoogleMaps(key: string) {
  if (getGoogle()?.maps?.importLibrary) return;

  const id = "alento-driver-home-google-maps";
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

async function loadGoogleMaps() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new Error("Google Maps no está configurado.");

  installGoogleMaps(key);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const runtime = getGoogle();
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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    CONFIRMED: "Confirmado",
    PREPARING: "Preparando",
    PREPARED: "Horneando",
    READY: "Listo",
    OUT_FOR_DELIVERY: "En camino",
    ARRIVED: "Llegó",
  };
  return labels[status] ?? status;
}

export default function DriverHome({
  initialDriver,
}: {
  initialDriver: DriverState;
}) {
  const router = useRouter();
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const markerRefs = useRef<GoogleMarker[]>([]);
  const watchRef = useRef<number | null>(null);
  const lastGpsSyncRef = useRef(0);

  const [driver, setDriver] = useState(initialDriver);
  const [orders, setOrders] = useState<DriverRequest[]>([]);
  const [tab, setTab] = useState<DriverTab>("requests");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busyAvailability, setBusyAvailability] = useState(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? null,
    [orders, selectedId],
  );

  const availableCount = useMemo(
    () => orders.filter((order) => order.claimable).length,
    [orders],
  );

  const stopGps = useCallback((clearIntent = false) => {
    if (watchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    watchRef.current = null;
    lastGpsSyncRef.current = 0;

    if (clearIntent) {
      window.localStorage.removeItem(HOME_GPS_KEY);
    }
  }, []);

  const startGps = useCallback(() => {
    if (watchRef.current != null) return;

    if (!navigator.geolocation) {
      setError("Este dispositivo no permite compartir ubicación.");
      return;
    }

    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        setDriver((current) => ({
          ...current,
          driverLatitude: latitude,
          driverLongitude: longitude,
          driverLocationAccuracy: accuracy,
          driverLocationUpdatedAt: new Date().toISOString(),
        }));

        const now = Date.now();
        if (now - lastGpsSyncRef.current < 5000) return;
        lastGpsSyncRef.current = now;

        void fetch("/api/repartidor/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude, longitude, accuracy }),
        }).then(async (response) => {
          if (response.status === 409) {
            stopGps(true);
            setDriver((current) => ({
              ...current,
              driverAvailable: false,
              driverLatitude: null,
              driverLongitude: null,
              driverLocationAccuracy: null,
              driverLocationUpdatedAt: null,
            }));
          }
        }).catch(() => undefined);
      },
      (geoError) => {
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Debes permitir el acceso a la ubicación para ponerte Activo."
            : "No fue posible obtener tu ubicación.",
        );
        stopGps(true);

        void fetch("/api/repartidor/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: false }),
        }).catch(() => undefined);

        setDriver((current) => ({
          ...current,
          driverAvailable: false,
          driverLatitude: null,
          driverLongitude: null,
          driverLocationAccuracy: null,
          driverLocationUpdatedAt: null,
        }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );
  }, [stopGps]);

  const refreshState = useCallback(async () => {
    const response = await fetch("/api/repartidor/state", {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) return;

    const next = data.driver as DriverState;
    setDriver(next);

    if (!next.driverAvailable && watchRef.current != null) {
      stopGps(true);
    }
  }, [stopGps]);

  const refreshOrders = useCallback(async () => {
    const response = await fetch("/api/repartidor/requests", {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) return;
    const next = (data.orders ?? []) as DriverRequest[];
    setOrders(next);
    setSelectedId((current) =>
      current && !next.some((order) => order.id === current)
        ? null
        : current,
    );
  }, []);

  useEffect(() => {
    void refreshOrders();

    const stateTimer = window.setInterval(() => {
      void refreshState();
    }, 5000);

    const ordersTimer = window.setInterval(() => {
      void refreshOrders();
    }, 5000);

    if (
      initialDriver.driverAvailable &&
      window.localStorage.getItem(HOME_GPS_KEY) === "1"
    ) {
      startGps();
    }

    return () => {
      window.clearInterval(stateTimer);
      window.clearInterval(ordersTimer);
      stopGps(false);
    };
  }, [initialDriver.driverAvailable, refreshOrders, refreshState, startGps, stopGps]);

  async function changeAvailability(active: boolean) {
    if (busyAvailability || active === driver.driverAvailable) return;

    setBusyAvailability(true);
    setError("");

    try {
      const response = await fetch("/api/repartidor/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible cambiar tu estado.");
      }

      setDriver(data.driver);

      if (active) {
        window.localStorage.setItem(HOME_GPS_KEY, "1");
        startGps();
      } else {
        stopGps(true);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible cambiar tu estado.",
      );
    } finally {
      setBusyAvailability(false);
    }
  }

  async function claim(order: DriverRequest) {
    if (claimingId != null) return;

    setClaimingId(order.id);
    setError("");

    try {
      const response = await fetch(
        `/api/repartidor/requests/${order.id}/claim`,
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible tomar la solicitud.");
      }

      if (data.href) {
        router.push(data.href);
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible tomar la solicitud.",
      );
      void refreshOrders();
    } finally {
      setClaimingId(null);
    }
  }

  useEffect(() => {
    if (tab !== "requests" || !mapHostRef.current) return;

    let disposed = false;

    async function renderMap() {
      try {
        const google = await loadGoogleMaps();
        await google.maps.importLibrary("maps");

        if (disposed || !mapHostRef.current) return;

        const requestWithLocation = orders.filter(
          (order) =>
            order.address?.latitude != null &&
            order.address?.longitude != null,
        );

        const center =
          driver.driverLatitude != null && driver.driverLongitude != null
            ? {
                lat: driver.driverLatitude,
                lng: driver.driverLongitude,
              }
            : requestWithLocation[0]?.address?.latitude != null &&
                requestWithLocation[0]?.address?.longitude != null
              ? {
                  lat: requestWithLocation[0].address.latitude,
                  lng: requestWithLocation[0].address.longitude,
                }
              : { lat: 4.6097, lng: -74.0817 };

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapHostRef.current, {
            center,
            zoom: 13,
            mapId: "b0bfaae2809a720a6204509b",
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
          });
        }

        markerRefs.current.forEach((marker) => marker.setMap(null));
        markerRefs.current = [];

        const bounds = new google.maps.LatLngBounds();
        let points = 0;

        if (
          driver.driverLatitude != null &&
          driver.driverLongitude != null
        ) {
          const point = {
            lat: driver.driverLatitude,
            lng: driver.driverLongitude,
          };
          const marker = new google.maps.Marker({
            map: mapRef.current,
            position: point,
            title: driver.name,
            label: {
              text: "🛵",
              fontSize: "17px",
            },
            zIndex: 50,
          });
          markerRefs.current.push(marker);
          bounds.extend(point);
          points += 1;
        }

        requestWithLocation.forEach((order) => {
          const point = {
            lat: order.address!.latitude!,
            lng: order.address!.longitude!,
          };

          const marker = new google.maps.Marker({
            map: mapRef.current!,
            position: point,
            title: `${order.code} · ${order.customerName}`,
            label: {
              text: order.code.split("-").pop()?.slice(-2) || "•",
              color: "#ffffff",
              fontSize: "9px",
              fontWeight: "700",
            },
            zIndex: order.claimable ? 30 : order.assignment?.own ? 40 : 20,
          });

          marker.addListener("click", () => {
            setSelectedId(order.id);
            mapRef.current?.panTo(point);
            mapRef.current?.setZoom(15);
          });

          markerRefs.current.push(marker);
          bounds.extend(point);
          points += 1;
        });

        if (points > 1 && !selectedOrder) {
          mapRef.current.fitBounds(bounds, {
            top: 110,
            right: 46,
            bottom: 240,
            left: 46,
          });
        } else if (points === 1) {
          mapRef.current.panTo(center);
          mapRef.current.setZoom(14);
        }
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

    void renderMap();

    return () => {
      disposed = true;
    };
  }, [
    driver.driverLatitude,
    driver.driverLongitude,
    driver.name,
    orders,
    selectedOrder,
    tab,
  ]);

  useEffect(() => {
    if (!selectedOrder?.address || !mapRef.current) return;
    const { latitude, longitude } = selectedOrder.address;
    if (latitude == null || longitude == null) return;
    mapRef.current.panTo({ lat: latitude, lng: longitude });
    mapRef.current.setZoom(15);
  }, [selectedOrder]);

  const navItems: Array<{
    id: DriverTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "requests",
      label: "Solicitudes",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 21s7-5.1 7-12A7 7 0 1 0 5 9c0 6.9 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.2" />
        </svg>
      ),
    },
    {
      id: "performance",
      label: "Desempeño",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        </svg>
      ),
    },
    {
      id: "wallet",
      label: "Cartera",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H19a2 2 0 0 1 2 2v12H5.5A2.5 2.5 0 0 1 3 15.5v-9Z" />
          <path d="M16 10h5v4h-5a2 2 0 0 1 0-4Z" />
        </svg>
      ),
    },
  ];

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#080808] text-white">
      {tab === "requests" ? (
        <div className="absolute inset-0">
          <div ref={mapHostRef} className="absolute inset-0 bg-[#efefeb]" />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#080808] px-6 pb-28 pt-28">
          <div className="w-full max-w-[430px] rounded-[26px] border border-white/10 bg-[#111] p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,.35)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e21a22]/12 text-[#ff454b]">
              {navItems.find((item) => item.id === tab)?.icon}
            </div>
            <p className="mt-4 text-[9px] font-black uppercase tracking-[0.14em] text-[#ff454b]">
              {tab === "performance" ? "Desempeño" : "Cartera"}
            </p>
            <h2 className="mt-2 text-[22px] font-black">
              Lo terminamos en la siguiente fase
            </h2>
            <p className="mt-2 text-[11px] leading-5 text-white/45">
              La navegación ya queda creada para mantener la experiencia exclusiva del repartidor.
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-[max(12px,env(safe-area-inset-top))] sm:px-5">
        <div className="pointer-events-auto mx-auto flex max-w-[760px] items-center justify-between gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_8px_24px_rgba(0,0,0,.16)]">
            <img src={LOGO} alt="Alentó Pizza" className="h-10 w-10 rounded-xl object-cover" />
          </div>

          <div className="flex min-w-0 flex-1 items-center rounded-full border border-black/10 bg-white/96 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,.15)] backdrop-blur-xl">
            <button
              type="button"
              disabled={busyAvailability}
              onClick={() => void changeAvailability(false)}
              className={
                "h-10 flex-1 rounded-full text-[11px] font-black transition " +
                (!driver.driverAvailable
                  ? "bg-[#111] text-white shadow-sm"
                  : "text-neutral-400")
              }
            >
              Inactivo
            </button>
            <button
              type="button"
              disabled={busyAvailability}
              onClick={() => void changeAvailability(true)}
              className={
                "h-10 flex-1 rounded-full text-[11px] font-black transition " +
                (driver.driverAvailable
                  ? "bg-[#e21a22] text-white shadow-[0_6px_18px_rgba(226,26,34,.25)]"
                  : "text-neutral-400")
              }
            >
              Activo
            </button>
          </div>

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-white shadow-[0_8px_24px_rgba(0,0,0,.16)]">
            <span
              className={
                "h-2.5 w-2.5 rounded-full " +
                (driver.driverAvailable
                  ? "bg-[#e21a22] shadow-[0_0_12px_rgba(226,26,34,.65)]"
                  : "bg-neutral-300")
              }
            />
          </div>
        </div>
      </div>

      {tab === "requests" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[92px] z-30 px-3 sm:px-5">
          <div className="pointer-events-auto mx-auto max-w-[760px]">
            <div className="mb-2 flex items-center justify-between rounded-full border border-white/10 bg-[#111]/94 px-4 py-2.5 text-white shadow-xl backdrop-blur-xl">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#ff454b]">
                  Solicitudes
                </span>
                <b className="ml-2 text-[11px]">{orders.length}</b>
              </div>
              <span className="text-[9px] font-semibold text-white/45">
                {availableCount} disponibles
              </span>
            </div>

            <div className="flex snap-x gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {orders.length ? (
                orders.map((order) => {
                  const own = Boolean(order.assignment?.own);
                  const assignedOther =
                    Boolean(order.assignment) && !order.assignment?.own;

                  return (
                    <article
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      className={
                        "min-w-[286px] snap-start overflow-hidden rounded-[20px] border bg-[#111]/96 text-white shadow-[0_16px_42px_rgba(0,0,0,.28)] backdrop-blur-xl sm:min-w-[310px] " +
                        (selectedId === order.id
                          ? "border-[#e21a22]/60"
                          : "border-white/10")
                      }
                    >
                      <div className="p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <b className="text-[12px] font-black">{order.code}</b>
                              <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[8px] font-black uppercase text-white/55">
                                {statusLabel(order.status)}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[10px] font-semibold text-white/70">
                              {order.customerName}
                            </p>
                          </div>
                          <b className="shrink-0 text-[12px] text-[#ff454b]">
                            {money(order.total)}
                          </b>
                        </div>

                        <p className="mt-2 line-clamp-2 text-[9px] leading-4 text-white/42">
                          {order.address?.address || "Dirección pendiente"}
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                          <span className="text-[9px] font-semibold text-white/40">
                            {order.itemCount} producto{order.itemCount === 1 ? "" : "s"}
                          </span>

                          {own && order.href ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push(order.href!);
                              }}
                              className="h-9 rounded-xl bg-white px-3 text-[10px] font-black text-black"
                            >
                              Abrir pedido
                            </button>
                          ) : order.claimable ? (
                            <button
                              type="button"
                              disabled={!driver.driverAvailable || claimingId != null}
                              onClick={(event) => {
                                event.stopPropagation();
                                void claim(order);
                              }}
                              className="h-9 rounded-xl bg-[#e21a22] px-3 text-[10px] font-black text-white disabled:bg-white/10 disabled:text-white/30"
                            >
                              {claimingId === order.id
                                ? "Tomando..."
                                : driver.driverAvailable
                                  ? "Autoasignarme"
                                  : "Actívate para tomar"}
                            </button>
                          ) : assignedOther ? (
                            <span className="max-w-[130px] truncate text-right text-[9px] font-semibold text-white/35">
                              {order.assignment?.driverName}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="w-full rounded-[20px] border border-white/10 bg-[#111]/94 px-4 py-5 text-center text-[10px] font-semibold text-white/45 backdrop-blur-xl">
                  No hay domicilios en proceso.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute left-3 right-3 top-[86px] z-40 mx-auto max-w-[520px] rounded-[16px] border border-[#e21a22]/25 bg-[#210b0d]/95 px-3.5 py-3 text-[10px] font-semibold leading-4 text-[#ff8b8f] shadow-xl backdrop-blur-xl">
          {error}
        </div>
      )}

      <nav className="absolute inset-x-0 bottom-0 z-40 px-3 pb-[max(10px,env(safe-area-inset-bottom))] sm:px-5">
        <div className="mx-auto grid h-[72px] max-w-[620px] grid-cols-3 overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_16px_44px_rgba(0,0,0,.22)]">
          {navItems.map((item) => {
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={
                  "relative flex flex-col items-center justify-center gap-1 text-[9px] font-black transition " +
                  (active ? "text-[#e21a22]" : "text-neutral-400")
                }
              >
                {item.icon}
                <span>{item.label}</span>
                {active && (
                  <span className="absolute bottom-1 h-[3px] w-8 rounded-full bg-[#e21a22]" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
