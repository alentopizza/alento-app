import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  };
  deliveryBands: DeliveryBand[];
  paymentMethods: PaymentMethodSetting[];
};

function defaultBandName(fee: number, index: number) {
  if (fee === 0) return "Domicilio sin costo";
  return `Domicilio ${index + 1}`;
}

const DEFAULT_POS_SETTINGS: PosSettings = {
  store: {
    address: "Av. Calle 43 Sur #79A-33, Bogotá",
    mapsUrl: "https://maps.app.goo.gl/po5MesvuTLifpwyz7",
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
};

function normalizeSettings(value: unknown): PosSettings {
  if (!value || typeof value !== "object") return DEFAULT_POS_SETTINGS;
  const raw = value as Partial<PosSettings>;

  const store = raw.store && typeof raw.store === "object"
    ? {
        address: typeof raw.store.address === "string" ? raw.store.address : DEFAULT_POS_SETTINGS.store.address,
        mapsUrl: typeof raw.store.mapsUrl === "string" ? raw.store.mapsUrl : DEFAULT_POS_SETTINGS.store.mapsUrl,
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

  return {
    store,
    deliveryBands: deliveryBands.length ? deliveryBands.sort((a, b) => a.minMeters - b.minMeters) : DEFAULT_POS_SETTINGS.deliveryBands,
    paymentMethods: paymentMethods.length ? paymentMethods : DEFAULT_POS_SETTINGS.paymentMethods,
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

  if (!settings.deliveryBands.some((band) => band.active)) {
    return NextResponse.json({ error: "Debe existir al menos una tarifa de domicilio activa." }, { status: 400 });
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
