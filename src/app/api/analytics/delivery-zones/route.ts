import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import {
  normalizeDeliveryBands,
  type DeliveryPricingSettings,
} from "@/lib/deliveryPricing";
import { directDistanceMeters } from "@/lib/deliveryDistance";
import { orderCode } from "@/lib/orderCode";

const SETTINGS_KEY = "pos_settings";

type SettingsValue = DeliveryPricingSettings & {
  store?: {
    address?: string;
    formattedAddress?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
};

function coordinate(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

function rangeBounds(startText: string | null, endText: string | null) {
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
    throw new Error("INVALID_RANGE");
  }

  return {
    startDate,
    endDate,
    start,
    endExclusive: new Date(endDay.getTime() + 24 * 60 * 60 * 1000),
  };
}

function normalizedName(value: string | null | undefined) {
  return String(value ?? "").trim().toLocaleLowerCase("es");
}

export async function GET(request: NextRequest) {
  try {
    await requireStaffSession(["ADMIN", "POS", "CASHIER", "DISPATCH"]);

    const { startDate, endDate, start, endExclusive } = rangeBounds(
      request.nextUrl.searchParams.get("startDate"),
      request.nextUrl.searchParams.get("endDate"),
    );

    const [settingsRow, orders] = await Promise.all([
      prisma.appSetting.findUnique({
        where: { key: SETTINGS_KEY },
        select: { value: true },
      }),
      prisma.order.findMany({
        where: {
          fulfillmentType: "DELIVERY",
          status: { notIn: ["DRAFT", "CANCELED"] },
          OR: [
            {
              scheduledFor: null,
              createdAt: { gte: start, lt: endExclusive },
            },
            {
              scheduledFor: { gte: start, lt: endExclusive },
            },
          ],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          sequenceNumber: true,
          source: true,
          status: true,
          createdAt: true,
          scheduledFor: true,
          total: true,
          deliveryFee: true,
          deliveryZoneId: true,
          deliveryZoneName: true,
          deliveryDistanceMeters: true,
          customer: {
            select: { name: true },
          },
          address: {
            select: {
              address: true,
              formattedAddress: true,
              latitude: true,
              longitude: true,
            },
          },
          payments: {
            where: { status: "PAID" },
            select: { amount: true },
          },
        },
      }),
    ]);

    const settings = (settingsRow?.value ?? null) as SettingsValue | null;
    const bands = normalizeDeliveryBands(settings);
    const storeLatitude = coordinate(settings?.store?.latitude);
    const storeLongitude = coordinate(settings?.store?.longitude);
    const store =
      storeLatitude != null && storeLongitude != null
        ? {
            name: "Alentó Pizza",
            address:
              settings?.store?.formattedAddress ||
              settings?.store?.address ||
              "Alentó Pizza",
            latitude: storeLatitude,
            longitude: storeLongitude,
          }
        : null;

    const currentById = new Map(bands.map((band) => [band.id, band]));
    const currentByName = new Map(
      bands.map((band) => [normalizedName(band.name), band]),
    );

    type ZoneStats = {
      id: string;
      name: string;
      minMeters: number | null;
      maxMeters: number | null;
      configuredFee: number | null;
      current: boolean;
      orderCount: number;
      orderValue: number;
      paidAmount: number;
      deliveryRevenue: number;
      reconstructedCount: number;
      lastOrderAt: Date | null;
    };

    const zoneStats = new Map<string, ZoneStats>();

    bands.forEach((band) => {
      zoneStats.set(band.id, {
        id: band.id,
        name: band.name?.trim() || "Domicilio",
        minMeters: band.minMeters,
        maxMeters: band.maxMeters,
        configuredFee: band.fee,
        current: true,
        orderCount: 0,
        orderValue: 0,
        paidAmount: 0,
        deliveryRevenue: 0,
        reconstructedCount: 0,
        lastOrderAt: null,
      });
    });

    let unclassifiedOrders = 0;
    let unclassifiedValue = 0;
    let unclassifiedPaid = 0;
    let reconstructedOrders = 0;

    const pins: Array<{
      orderId: number;
      code: string;
      zoneId: string | null;
      zoneName: string | null;
      latitude: number;
      longitude: number;
      address: string;
      customerName: string;
      status: string;
      createdAt: string;
      scheduledFor: string | null;
      total: number;
      paidAmount: number;
      deliveryFee: number;
      distanceMeters: number | null;
      reconstructed: boolean;
    }> = [];

    for (const order of orders) {
      const latitude = coordinate(order.address?.latitude);
      const longitude = coordinate(order.address?.longitude);
      const paidAmount = order.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );
      const orderValue = Number(order.total);
      const deliveryRevenue = Number(order.deliveryFee);

      let distanceMeters =
        order.deliveryDistanceMeters == null
          ? null
          : Number(order.deliveryDistanceMeters);

      if (
        distanceMeters == null &&
        store &&
        latitude != null &&
        longitude != null
      ) {
        distanceMeters = Math.round(
          directDistanceMeters({
            origin: {
              latitude: store.latitude,
              longitude: store.longitude,
            },
            destination: { latitude, longitude },
          }),
        );
      }

      let band =
        (order.deliveryZoneId
          ? currentById.get(order.deliveryZoneId)
          : undefined) ??
        (order.deliveryZoneName
          ? currentByName.get(normalizedName(order.deliveryZoneName))
          : undefined) ??
        null;

      let reconstructed = false;

      if (!band && !order.deliveryZoneId && distanceMeters != null) {
        band =
          bands.find(
            (candidate) =>
              distanceMeters! >= candidate.minMeters &&
              distanceMeters! <= candidate.maxMeters,
          ) ?? null;
        reconstructed = Boolean(band);
      }

      let zoneId: string | null = null;
      let zoneName: string | null = null;

      if (band) {
        zoneId = band.id;
        zoneName = band.name?.trim() || "Domicilio";
      } else if (order.deliveryZoneId || order.deliveryZoneName) {
        zoneId =
          order.deliveryZoneId ||
          `historical:${normalizedName(order.deliveryZoneName) || order.id}`;
        zoneName = order.deliveryZoneName?.trim() || "Zona histórica";

        if (!zoneStats.has(zoneId)) {
          zoneStats.set(zoneId, {
            id: zoneId,
            name: zoneName,
            minMeters: null,
            maxMeters: null,
            configuredFee: null,
            current: false,
            orderCount: 0,
            orderValue: 0,
            paidAmount: 0,
            deliveryRevenue: 0,
            reconstructedCount: 0,
            lastOrderAt: null,
          });
        }
      }

      if (!zoneId) {
        unclassifiedOrders += 1;
        unclassifiedValue += orderValue;
        unclassifiedPaid += paidAmount;
      } else {
        const stats = zoneStats.get(zoneId)!;
        stats.orderCount += 1;
        stats.orderValue += orderValue;
        stats.paidAmount += paidAmount;
        stats.deliveryRevenue += deliveryRevenue;
        if (reconstructed) {
          stats.reconstructedCount += 1;
          reconstructedOrders += 1;
        }
        const businessAt = order.scheduledFor ?? order.createdAt;
        if (!stats.lastOrderAt || businessAt > stats.lastOrderAt) {
          stats.lastOrderAt = businessAt;
        }
      }

      if (latitude != null && longitude != null) {
        pins.push({
          orderId: order.id,
          code: orderCode(
            order.sequenceNumber ?? order.id,
            order.source,
          ),
          zoneId,
          zoneName,
          latitude,
          longitude,
          address:
            order.address?.formattedAddress ||
            order.address?.address ||
            "Destino",
          customerName: order.customer?.name ?? "Cliente",
          status: order.status,
          createdAt: order.createdAt.toISOString(),
          scheduledFor: order.scheduledFor?.toISOString() ?? null,
          total: orderValue,
          paidAmount,
          deliveryFee: deliveryRevenue,
          distanceMeters,
          reconstructed,
        });
      }
    }

    const classifiedOrders = [...zoneStats.values()].reduce(
      (sum, zone) => sum + zone.orderCount,
      0,
    );
    const totalOrders = orders.length;
    const totalOrderValue = orders.reduce(
      (sum, order) => sum + Number(order.total),
      0,
    );
    const totalPaidAmount = orders.reduce(
      (sum, order) =>
        sum +
        order.payments.reduce(
          (paid, payment) => paid + Number(payment.amount),
          0,
        ),
      0,
    );
    const totalDeliveryRevenue = orders.reduce(
      (sum, order) => sum + Number(order.deliveryFee),
      0,
    );

    const zones = [...zoneStats.values()]
      .map((zone) => ({
        ...zone,
        averageTicket:
          zone.orderCount > 0 ? zone.orderValue / zone.orderCount : 0,
        sharePercent:
          classifiedOrders > 0
            ? Math.round(
                (zone.orderCount / classifiedOrders) * 1000,
              ) / 10
            : 0,
        lastOrderAt: zone.lastOrderAt?.toISOString() ?? null,
      }))
      .sort(
        (a, b) =>
          b.orderCount - a.orderCount ||
          b.orderValue - a.orderValue ||
          a.name.localeCompare(b.name, "es"),
      );

    const topZone = zones.find((zone) => zone.orderCount > 0) ?? null;

    return NextResponse.json({
      range: { startDate, endDate },
      store,
      zones,
      pins,
      summary: {
        totalOrders,
        classifiedOrders,
        unclassifiedOrders,
        unclassifiedValue,
        unclassifiedPaid,
        reconstructedOrders,
        totalOrderValue,
        totalPaidAmount,
        totalDeliveryRevenue,
        averageTicket:
          totalOrders > 0 ? totalOrderValue / totalOrders : 0,
        topZone: topZone
          ? {
              id: topZone.id,
              name: topZone.name,
              orders: topZone.orderCount,
              sharePercent: topZone.sharePercent,
            }
          : null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Sin permisos." },
        { status: 403 },
      );
    }

    if (message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401 },
      );
    }

    if (message === "INVALID_RANGE") {
      return NextResponse.json(
        { error: "El rango de fechas no es válido." },
        { status: 400 },
      );
    }

    console.error("Delivery zone analytics error", error);
    return NextResponse.json(
      { error: "No fue posible cargar la analítica de zonas." },
      { status: 500 },
    );
  }
}
