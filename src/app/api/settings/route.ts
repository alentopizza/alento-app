import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_DRIVER_MAX_CONCURRENT_DELIVERIES,
  normalizeDriverMaxConcurrentDeliveries,
} from "@/lib/driverCapacity";
import {
  DEFAULT_DRIVER_ACCEPTANCE_RADIUS_METERS,
  normalizeDriverAcceptanceRadiusMeters,
} from "@/lib/driverAcceptanceZone";
import {
  DEFAULT_DRIVER_EARNING_PERCENT,
  DEFAULT_FREE_DELIVERY_EARNING,
  normalizeDriverCompensationSettings,
} from "@/lib/driverCompensation";

const SETTINGS_KEY = "pos_settings";

type DeliveryBand = {
  id: string;
  name: string;
  minMeters: number;
  maxMeters: number;
  fee: number;
  active: boolean;
};

type PaymentMethodSetting = {
  id: string;
  name: string;
  active: boolean;
};

type PosSettings = {
  store: {
    address: string;
    mapsUrl: string;
    placeId: string;
    latitude: number | null;
    longitude: number | null;
    formattedAddress: string;
  };
  deliveryBands: DeliveryBand[];
  paymentMethods: PaymentMethodSetting[];
  customerManagement: {
    bulkDeleteEnabled: boolean;
  };
  driverManagement: {
    maxConcurrentDeliveries: number;
    acceptanceRadiusMeters: number;
    earningPercent: number;
    freeDeliveryEarning: number;
  };
};

function defaultBandName(fee: number, index: number) {
  if (fee === 0) return "Domicilio sin costo";
  return `Domicilio ${index + 1}`;
}

const DEFAULT_POS_SETTINGS: PosSettings = {
  store: {
    address: "Av. Calle 43 Sur #79A-33, Bogotá",
    mapsUrl: "https://maps.app.goo.gl/po5MesvuTLifpwyz7",
    placeId: "",
    latitude: null,
    longitude: null,
    formattedAddress: "",
  },
  deliveryBands: [
    { id: "band-1", name: "Zona cercana", minMeters: 0, maxMeters: 200, fee: 0, active: true },
    { id: "band-2", name: "Zona intermedia", minMeters: 201, maxMeters: 500, fee: 5000, active: true },
    { id: "band-3", name: "Zona extendida", minMeters: 501, maxMeters: 1000, fee: 10000, active: true },
  ],
  paymentMethods: [
    { id: "cash", name: "Efectivo", active: true },
    { id: "nequi", name: "Nequi", active: true },
    { id: "daviplata", name: "DaviPlata", active: true },
    { id: "card", name: "Tarjeta", active: true },
    { id: "key", name: "Llave", active: true },
  ],
  customerManagement: {
    bulkDeleteEnabled: true,
  },
  driverManagement: {
    maxConcurrentDeliveries: DEFAULT_DRIVER_MAX_CONCURRENT_DELIVERIES,
    acceptanceRadiusMeters: DEFAULT_DRIVER_ACCEPTANCE_RADIUS_METERS,
    earningPercent: DEFAULT_DRIVER_EARNING_PERCENT,
    freeDeliveryEarning: DEFAULT_FREE_DELIVERY_EARNING,
  },
};

function normalizeSettings(value: unknown): PosSettings {
  if (!value || typeof value !== "object") return DEFAULT_POS_SETTINGS;
  const raw = value as Partial<PosSettings>;

  const store = raw.store && typeof raw.store === "object"
    ? {
        address: typeof raw.store.address === "string" ? raw.store.address : DEFAULT_POS_SETTINGS.store.address,
        mapsUrl: typeof raw.store.mapsUrl === "string" ? raw.store.mapsUrl : DEFAULT_POS_SETTINGS.store.mapsUrl,
        placeId: typeof raw.store.placeId === "string" ? raw.store.placeId : "",
        latitude: Number.isFinite(Number(raw.store.latitude)) ? Number(raw.store.latitude) : null,
        longitude: Number.isFinite(Number(raw.store.longitude)) ? Number(raw.store.longitude) : null,
        formattedAddress: typeof raw.store.formattedAddress === "string" ? raw.store.formattedAddress : "",
      }
    : DEFAULT_POS_SETTINGS.store;

  const deliveryBands = Array.isArray(raw.deliveryBands)
    ? raw.deliveryBands
        .map((band, index) => {
          const fee = Math.max(0, Number(band?.fee ?? 0));
          return {
            id: typeof band?.id === "string" && band.id ? band.id : `band-${index + 1}`,
            name: typeof band?.name === "string" && band.name.trim() ? band.name.trim() : defaultBandName(fee, index),
            minMeters: Math.max(0, Number(band?.minMeters ?? index * 500)),
            maxMeters: Math.max(0, Number(band?.maxMeters ?? ((index + 1) * 500))),
            fee,
            active: band?.active !== false,
          };
        })
        .filter((band) => Number.isFinite(band.minMeters) && Number.isFinite(band.maxMeters) && Number.isFinite(band.fee))
    : DEFAULT_POS_SETTINGS.deliveryBands;

  const paymentMethods = Array.isArray(raw.paymentMethods)
    ? raw.paymentMethods
        .map((method, index) => ({
          id: typeof method?.id === "string" && method.id ? method.id : `payment-${index + 1}`,
          name: typeof method?.name === "string" ? method.name.trim() : "",
          active: method?.active !== false,
        }))
        .filter((method) => method.name.length > 0)
    : DEFAULT_POS_SETTINGS.paymentMethods;

  const customerManagement = raw.customerManagement && typeof raw.customerManagement === "object"
    ? {
        bulkDeleteEnabled: raw.customerManagement.bulkDeleteEnabled !== false,
      }
    : DEFAULT_POS_SETTINGS.customerManagement;

  const compensation = normalizeDriverCompensationSettings({
    driverManagement: raw.driverManagement,
  });

  const driverManagement =
    raw.driverManagement && typeof raw.driverManagement === "object"
      ? {
          maxConcurrentDeliveries: normalizeDriverMaxConcurrentDeliveries(
            raw.driverManagement.maxConcurrentDeliveries,
          ),
          acceptanceRadiusMeters: normalizeDriverAcceptanceRadiusMeters(
            raw.driverManagement.acceptanceRadiusMeters,
          ),
          earningPercent: compensation.earningPercent,
          freeDeliveryEarning: compensation.freeDeliveryEarning,
        }
      : DEFAULT_POS_SETTINGS.driverManagement;

  return {
    store,
    deliveryBands: deliveryBands.length ? deliveryBands.sort((a, b) => a.minMeters - b.minMeters) : DEFAULT_POS_SETTINGS.deliveryBands,
    paymentMethods: paymentMethods.length ? paymentMethods : DEFAULT_POS_SETTINGS.paymentMethods,
    customerManagement,
    driverManagement,
  };
}

export async function GET() {
  const saved = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
  const settings = saved ? normalizeSettings(saved.value) : DEFAULT_POS_SETTINGS;
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const settings = normalizeSettings(body?.settings);

  const activeBands = settings.deliveryBands
    .filter((band) => band.active)
    .sort((a, b) => a.minMeters - b.minMeters);

  if (!activeBands.length) {
    return NextResponse.json({ error: "Debe existir al menos una tarifa de domicilio activa." }, { status: 400 });
  }

  for (const band of activeBands) {
    if (band.maxMeters < band.minMeters) {
      return NextResponse.json(
        { error: `La zona "${band.name}" tiene un rango inválido: la distancia final debe ser mayor o igual a la inicial.` },
        { status: 400 },
      );
    }
  }

  if (activeBands[0].minMeters !== 0) {
    return NextResponse.json(
      { error: "La primera zona activa debe comenzar en 0 metros para no dejar un vacío junto a Alentó." },
      { status: 400 },
    );
  }

  for (let index = 1; index < activeBands.length; index += 1) {
    const previous = activeBands[index - 1];
    const current = activeBands[index];

    if (current.minMeters <= previous.maxMeters) {
      return NextResponse.json(
        { error: `Las zonas "${previous.name}" y "${current.name}" se están solapando.` },
        { status: 400 },
      );
    }

    if (current.minMeters !== previous.maxMeters + 1) {
      return NextResponse.json(
        { error: `Hay un espacio sin cobertura entre "${previous.name}" y "${current.name}". Ajusta el siguiente rango para que empiece en ${previous.maxMeters + 1} m.` },
        { status: 400 },
      );
    }
  }

  if (!settings.paymentMethods.some((method) => method.active)) {
    return NextResponse.json({ error: "Debe existir al menos un medio de pago activo." }, { status: 400 });
  }

  const saved = await prisma.appSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: settings },
    create: { key: SETTINGS_KEY, value: settings },
  });

  return NextResponse.json({ settings: normalizeSettings(saved.value) });
}
