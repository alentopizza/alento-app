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

function todayBogota() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${map.year}-${map.month}-${map.day}`;
}

function monthStartBogota() {
  const today = todayBogota();
  return `${today.slice(0, 7)}-01`;
}

function validDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function paymentRangeBounds(
  startText: string | null,
  endText: string | null,
) {
  const fallbackEnd = todayBogota();
  const fallbackStart = monthStartBogota();
  const startDate = validDate(startText) ? startText! : fallbackStart;
  const endDate = validDate(endText) ? endText! : fallbackEnd;
  const start = new Date(`${startDate}T00:00:00-05:00`);
  const endDay = new Date(`${endDate}T00:00:00-05:00`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(endDay.getTime()) ||
    endDay < start
  ) {
    throw new Error("INVALID_PAYMENT_DATE_RANGE");
  }

  return {
    startDate,
    endDate,
    start,
    endExclusive: new Date(endDay.getTime() + 24 * 60 * 60 * 1000),
  };
}

function normalizePaymentLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveCanonicalPaymentMethod(
  value: string,
  methods: PaymentMethodSetting[],
) {
  const normalized = normalizePaymentLabel(value);
  return (
    methods.find(
      (method) =>
        normalizePaymentLabel(method.name) === normalized ||
        normalizePaymentLabel(method.id) === normalized,
    ) ?? null
  );
}

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

  const rawPaymentMethods = Array.isArray(raw.paymentMethods)
    ? raw.paymentMethods
    : [];

  const paymentMethods = DEFAULT_POS_SETTINGS.paymentMethods.map((canonical) => {
    const saved = rawPaymentMethods.find(
      (method) => method?.id === canonical.id,
    );

    return {
      ...canonical,
      active: saved?.active !== false,
    };
  });

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

export async function GET(request: NextRequest) {
  try {
    const { startDate, endDate, start, endExclusive } =
      paymentRangeBounds(
        request.nextUrl.searchParams.get("startDate"),
        request.nextUrl.searchParams.get("endDate"),
      );

    const [saved, paymentUsageRows] = await Promise.all([
      prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } }),
      prisma.payment.groupBy({
        by: ["method"],
        where: {
          status: "PAID",
          paidAt: { gte: start, lt: endExclusive },
          order: { status: { not: "CANCELED" } },
        },
        _count: { id: true },
        _sum: { amount: true },
        _max: { paidAt: true },
      }),
    ]);

    const settings = saved
      ? normalizeSettings(saved.value)
      : DEFAULT_POS_SETTINGS;

    const usageById = new Map<
      string,
      {
        transactionCount: number;
        amount: number;
        lastUsedAt: Date | null;
      }
    >();

    let unclassifiedTransactions = 0;
    let unclassifiedAmount = 0;

    for (const row of paymentUsageRows) {
      const canonical = resolveCanonicalPaymentMethod(
        row.method,
        settings.paymentMethods,
      );
      const transactionCount = row._count.id;
      const amount = Number(row._sum.amount ?? 0);
      const lastUsedAt = row._max.paidAt ?? null;

      if (!canonical) {
        unclassifiedTransactions += transactionCount;
        unclassifiedAmount += amount;
        continue;
      }

      const current = usageById.get(canonical.id) ?? {
        transactionCount: 0,
        amount: 0,
        lastUsedAt: null,
      };

      current.transactionCount += transactionCount;
      current.amount += amount;
      if (
        lastUsedAt &&
        (!current.lastUsedAt || lastUsedAt > current.lastUsedAt)
      ) {
        current.lastUsedAt = lastUsedAt;
      }

      usageById.set(canonical.id, current);
    }

    const totalTransactions = [...usageById.values()].reduce(
      (sum, item) => sum + item.transactionCount,
      0,
    );
    const totalAmount = [...usageById.values()].reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    const paymentStats = settings.paymentMethods.map((method) => {
      const usage = usageById.get(method.id) ?? {
        transactionCount: 0,
        amount: 0,
        lastUsedAt: null,
      };

      return {
        id: method.id,
        name: method.name,
        active: method.active,
        transactionCount: usage.transactionCount,
        amount: usage.amount,
        usagePercent:
          totalTransactions > 0
            ? Math.round(
                (usage.transactionCount / totalTransactions) * 1000,
              ) / 10
            : 0,
        amountPercent:
          totalAmount > 0
            ? Math.round((usage.amount / totalAmount) * 1000) / 10
            : 0,
        lastUsedAt: usage.lastUsedAt,
      };
    });

    return NextResponse.json({
      settings,
      paymentStats,
      paymentSummary: {
        startDate,
        endDate,
        totalTransactions,
        totalAmount,
        unclassifiedTransactions,
        unclassifiedAmount,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INVALID_PAYMENT_DATE_RANGE"
    ) {
      return NextResponse.json(
        { error: "El rango de fechas de pagos no es válido." },
        { status: 400 },
      );
    }

    console.error("Settings payment stats error", error);
    return NextResponse.json(
      { error: "No fue posible cargar la configuración." },
      { status: 500 },
    );
  }
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
