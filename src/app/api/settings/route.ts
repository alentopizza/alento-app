import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SETTINGS_KEY = "pos_settings";

export type DeliveryBand = {
  id: string;
  minMeters: number;
  maxMeters: number;
  fee: number;
  active: boolean;
};

export type PaymentMethodSetting = {
  id: string;
  name: string;
  active: boolean;
};

export type PosSettings = {
  store: {
    address: string;
    mapsUrl: string;
  };
  deliveryBands: DeliveryBand[];
  paymentMethods: PaymentMethodSetting[];
};

export const DEFAULT_POS_SETTINGS: PosSettings = {
  store: {
    address: "Av. Calle 43 Sur #79A-33, Bogotá",
    mapsUrl: "https://maps.app.goo.gl/po5MesvuTLifpwyz7",
  },
  deliveryBands: [
    { id: "band-1", minMeters: 0, maxMeters: 200, fee: 0, active: true },
    { id: "band-2", minMeters: 201, maxMeters: 500, fee: 5000, active: true },
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
        .map((band, index) => ({
          id: typeof band?.id === "string" && band.id ? band.id : `band-${index + 1}`,
          minMeters: Math.max(0, Number(band?.minMeters ?? 0)),
          maxMeters: Math.max(0, Number(band?.maxMeters ?? 0)),
          fee: Math.max(0, Number(band?.fee ?? 0)),
          active: band?.active !== false,
        }))
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

  for (const band of settings.deliveryBands) {
    if (band.maxMeters < band.minMeters) {
      return NextResponse.json({ error: "Cada rango debe terminar en una distancia mayor o igual a su inicio." }, { status: 400 });
    }
  }

  const activeBands = settings.deliveryBands.filter((band) => band.active).sort((a, b) => a.minMeters - b.minMeters);
  for (let index = 1; index < activeBands.length; index += 1) {
    if (activeBands[index].minMeters <= activeBands[index - 1].maxMeters) {
      return NextResponse.json({ error: "Los rangos activos de domicilio no pueden superponerse." }, { status: 400 });
    }
  }

  const saved = await prisma.appSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: settings },
    create: { key: SETTINGS_KEY, value: settings },
  });

  return NextResponse.json({ settings: normalizeSettings(saved.value) });
}
