import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/auth";
import { computeDrivingRoute, reverseGeocode } from "@/lib/googleMapsServer";
import { normalizeOrderLine, type OrderLineInput } from "@/lib/orderLineNormalizer";
import { dispatchOrderCreatedNotification } from "@/lib/notifier";
import { createOrderTrackingToken } from "@/lib/orderTracking";

const SETTINGS_KEY = "pos_settings";

type DeliveryBand = {
  id: string;
  name?: string;
  minMeters: number;
  maxMeters: number;
  fee: number;
  active?: boolean;
};

type PaymentMethod = {
  id: string;
  name: string;
  active?: boolean;
};

type SettingsValue = {
  store?: {
    latitude?: number | null;
    longitude?: number | null;
  };
  deliveryBands?: DeliveryBand[];
  paymentMethods?: PaymentMethod[];
};

function digits(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function money(value: number) {
  return Math.round(value);
}

function isCash(method: PaymentMethod) {
  return (
    method.id.toLowerCase() === "cash" ||
    method.name.trim().toLowerCase() === "efectivo"
  );
}

function normalizedBands(value: SettingsValue | null) {
  return (Array.isArray(value?.deliveryBands) ? value.deliveryBands : [])
    .filter((band) => band.active !== false)
    .map((band) => ({
      ...band,
      minMeters: Number(band.minMeters),
      maxMeters: Number(band.maxMeters),
      fee: Number(band.fee),
    }))
    .filter(
      (band) =>
        Number.isFinite(band.minMeters) &&
        Number.isFinite(band.maxMeters) &&
        Number.isFinite(band.fee),
    )
    .sort((a, b) => a.minMeters - b.minMeters);
}

function activePayments(value: SettingsValue | null) {
  return (Array.isArray(value?.paymentMethods) ? value.paymentMethods : [])
    .filter((method) => method.active !== false)
    .map((method) => ({
      id: String(method.id || "").trim(),
      name: String(method.name || "").trim(),
      active: true,
    }))
    .filter((method) => method.id && method.name);
}

export async function GET() {
  try {
    const saved = await prisma.appSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });
    const value = (saved?.value ?? null) as SettingsValue | null;

    return NextResponse.json({
      paymentMethods: activePayments(value),
    });
  } catch (error) {
    console.error("Public checkout settings error", error);
    return NextResponse.json(
      { error: "No fue posible cargar las formas de pago." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fulfillmentType =
      body?.fulfillmentType === "DELIVERY" ? "DELIVERY" : "PICKUP";

    const customerInput = body?.customer ?? {};
    const countryCode = text(customerInput.countryCode) || "+57";
    const phone = digits(customerInput.phone);
    const name = text(customerInput.name);
    const email = text(customerInput.email).toLowerCase();

    if (!name || name.toUpperCase() === "NUEVO") {
      return NextResponse.json(
        { error: "Escribe tu nombre para continuar." },
        { status: 400 },
      );
    }

    if (phone.length < 7) {
      return NextResponse.json(
        { error: "Ingresa un número de teléfono válido." },
        { status: 400 },
      );
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json(
        { error: "Revisa el correo electrónico." },
        { status: 400 },
      );
    }

    const rawLines = Array.isArray(body?.items)
      ? (body.items as (OrderLineInput & { notes?: unknown })[])
      : [];

    if (!rawLines.length) {
      return NextResponse.json(
        { error: "El pedido no tiene productos." },
        { status: 400 },
      );
    }

    const saved = await prisma.appSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });
    const settings = (saved?.value ?? null) as SettingsValue | null;
    const paymentMethods = activePayments(settings);
    const paymentMethod = paymentMethods.find(
      (method) => method.id === text(body?.paymentMethodId),
    );

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Selecciona una forma de pago disponible." },
        { status: 400 },
      );
    }

    const normalizedLines = await Promise.all(
      rawLines.map((line) => normalizeOrderLine(line)),
    );

    const subtotal = normalizedLines.reduce(
      (sum, line) => sum + line.lineTotal,
      0,
    );

    let deliveryFee = 0;
    let deliveryZoneId: string | null = null;
    let deliveryZoneName: string | null = null;
    let resolvedDeliveryAddress: string | null = null;
    let resolvedDeliveryPlaceId: string | null = null;
    let resolvedDeliveryLatitude: number | null = null;
    let resolvedDeliveryLongitude: number | null = null;

    if (fulfillmentType === "DELIVERY") {
      const destination = body?.destination ?? {};
      const latitude = Number(destination.latitude);
      const longitude = Number(destination.longitude);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return NextResponse.json(
          { error: "Confirma nuevamente la dirección de domicilio." },
          { status: 400 },
        );
      }

      const storeLatitude = Number(settings?.store?.latitude);
      const storeLongitude = Number(settings?.store?.longitude);
      if (
        !Number.isFinite(storeLatitude) ||
        !Number.isFinite(storeLongitude)
      ) {
        return NextResponse.json(
          { error: "La ubicación de Alentó no está configurada." },
          { status: 503 },
        );
      }

      const route = await computeDrivingRoute({
        origin: {
          latitude: storeLatitude,
          longitude: storeLongitude,
        },
        destination: { latitude, longitude },
      });

      const bands = normalizedBands(settings);
      const band = bands.find(
        (item) =>
          route.distanceMeters >= item.minMeters &&
          route.distanceMeters <= item.maxMeters,
      );

      if (!band) {
        return NextResponse.json(
          { error: "La dirección quedó fuera de nuestra cobertura." },
          { status: 409 },
        );
      }

      deliveryFee = money(band.fee);
      deliveryZoneId = band.id;
      deliveryZoneName = band.name?.trim() || "Domicilio";

      resolvedDeliveryAddress = text(destination.formattedAddress);
      resolvedDeliveryPlaceId = text(destination.placeId) || null;
      resolvedDeliveryLatitude = latitude;
      resolvedDeliveryLongitude = longitude;

      if (!resolvedDeliveryAddress) {
        const geocoded = await reverseGeocode(latitude, longitude);
        resolvedDeliveryAddress = geocoded.formattedAddress;
        resolvedDeliveryPlaceId = resolvedDeliveryPlaceId || geocoded.placeId || null;
      }
    }

    const total = Math.max(0, subtotal + deliveryFee);
    const cashPayment = isCash(paymentMethod);
    const hasCashAmount =
      body?.cashReceived !== null &&
      body?.cashReceived !== undefined &&
      String(body.cashReceived).trim() !== "";
    const cashReceivedRaw = hasCashAmount ? Number(body.cashReceived) : null;
    const cashReceived =
      cashPayment && cashReceivedRaw != null ? money(cashReceivedRaw) : null;

    if (
      cashPayment &&
      cashReceivedRaw != null &&
      (!Number.isFinite(cashReceivedRaw) || (cashReceived ?? 0) < total)
    ) {
      return NextResponse.json(
        { error: `Si indicas "Paga con", el valor debe ser igual o mayor a ${total.toLocaleString("es-CO")}.` },
        { status: 400 },
      );
    }

    const changeDue =
      cashPayment && cashReceived != null ? cashReceived - total : null;

    const session = await getCustomerSession();
    const existingCustomer = session
      ? await prisma.customer.findUnique({
          where: { id: session.customerId },
          include: {
            addresses: {
              orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            },
          },
        })
      : await prisma.customer.findFirst({
          where: {
            OR: [
              { phone },
              { phone: `${digits(countryCode)}${phone}` },
            ],
          },
          include: {
            addresses: {
              orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            },
          },
        });

    const sessionOwnsCustomer =
      Boolean(session) && session?.customerId === existingCustomer?.id;

    const beveragesCategory = await prisma.category.findUnique({
      where: { slug: "bebidas" },
      select: { id: true },
    });
    const beverageCategoryId = beveragesCategory?.id ?? null;
    const requiresKitchen = (categoryId: number) =>
      beverageCategoryId == null || categoryId !== beverageCategoryId;
    const hasKitchenPreparation = normalizedLines.some((line) =>
      requiresKitchen(line.product.categoryId),
    );

    const order = await prisma.$transaction(async (tx) => {
      let customer = existingCustomer;

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            name,
            countryCode,
            phone,
            email: email || null,
          },
          include: {
            addresses: {
              orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            },
          },
        });
      } else if (sessionOwnsCustomer) {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            name,
            countryCode,
            email: email || null,
          },
          include: {
            addresses: {
              orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            },
          },
        });
      }

      let addressId: number | null = null;
      if (
        fulfillmentType === "DELIVERY" &&
        resolvedDeliveryAddress &&
        resolvedDeliveryLatitude != null &&
        resolvedDeliveryLongitude != null
      ) {
        const existingAddress = customer.addresses[0] ?? null;

        if (existingAddress) {
          const updatedAddress = await tx.customerAddress.update({
            where: { id: existingAddress.id },
            data: {
              address: resolvedDeliveryAddress,
              formattedAddress: resolvedDeliveryAddress,
              placeId: resolvedDeliveryPlaceId,
              latitude: resolvedDeliveryLatitude,
              longitude: resolvedDeliveryLongitude,
              city: existingAddress.city || "Bogotá",
              isDefault: true,
            },
          });
          addressId = updatedAddress.id;

          await tx.customerAddress.deleteMany({
            where: {
              customerId: customer.id,
              id: { not: existingAddress.id },
            },
          });
        } else {
          const createdAddress = await tx.customerAddress.create({
            data: {
              customerId: customer.id,
              label: "Casa",
              address: resolvedDeliveryAddress,
              formattedAddress: resolvedDeliveryAddress,
              placeId: resolvedDeliveryPlaceId,
              latitude: resolvedDeliveryLatitude,
              longitude: resolvedDeliveryLongitude,
              city: "Bogotá",
              isDefault: true,
            },
          });
          addressId = createdAddress.id;
        }
      }

      const sequence = await tx.orderSequence.upsert({
        where: { id: 1 },
        create: { id: 1, current: 1 },
        update: { current: { increment: 1 } },
      });

      return tx.order.create({
        data: {
          sequenceNumber: sequence.current,
          customerId: customer.id,
          addressId,
          deliveryZoneId,
          deliveryZoneName,
          discountSource: "NONE",
          status: hasKitchenPreparation ? "PREPARING" : "READY",
          fulfillmentType,
          source: "WEB",
          subtotal,
          deliveryFee,
          discount: 0,
          total,
          items: {
            create: normalizedLines.map((line, index) => {
              const note =
                typeof rawLines[index]?.notes === "string"
                  ? rawLines[index].notes.trim().slice(0, 120)
                  : "";
              return {
                productId: line.product.id,
                productName: line.product.name,
                unitPrice: line.unitPrice,
                quantity: line.quantity,
                preparedQuantity: requiresKitchen(line.product.categoryId)
                  ? 0
                  : line.quantity,
                lineTotal: line.lineTotal,
                configuration: line.configuration,
                notes: note || null,
              };
            }),
          },
          payments: {
            create: {
              method: paymentMethod.name,
              amount: total,
              cashReceived,
              changeDue,
              status: "PENDING",
            },
          },
        },
        include: {
          customer: true,
          address: true,
          payments: true,
        },
      });
    });

    const code = `WEB-${String(order.sequenceNumber).padStart(4, "0")}`;
    let notification:
      | Awaited<ReturnType<typeof dispatchOrderCreatedNotification>>
      | { ok: false; status: "failed"; reason: string };

    try {
      notification = await dispatchOrderCreatedNotification({
        orderId: order.id,
        customerId: order.customer!.id,
        customerName: order.customer!.name,
        phone: `${order.customer!.countryCode || "+57"}${order.customer!.phone || ""}`,
        orderCode: code,
        total: Number(order.total),
        fulfillmentType: order.fulfillmentType,
      });
    } catch (error) {
      notification = {
        ok: false,
        status: "failed",
        reason:
          error instanceof Error
            ? error.message
            : "No fue posible enviar la notificación.",
      };
    }

    let trackingPath: string | null = null;
    try {
      trackingPath = `/seguimiento/${createOrderTrackingToken(order.id)}`;
    } catch {
      trackingPath = null;
    }

    return NextResponse.json(
      {
        order: {
          id: order.id,
          sequenceNumber: order.sequenceNumber,
          code,
          status: order.status,
          fulfillmentType: order.fulfillmentType,
          subtotal: Number(order.subtotal),
          deliveryFee: Number(order.deliveryFee),
          total: Number(order.total),
          paymentMethod: paymentMethod.name,
          trackingPath,
          authenticatedCustomer: Boolean(session),
        },
        notification,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Public checkout order error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible crear el pedido.",
      },
      { status: 500 },
    );
  }
}
