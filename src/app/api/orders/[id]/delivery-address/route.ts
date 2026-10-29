import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { computeDrivingRoute } from "@/lib/googleMapsServer";
import {
  deliveryPricingHttpStatus,
  resolveDeliveryPricing,
  type DeliveryPricingSettings,
} from "@/lib/deliveryPricing";

const SETTINGS_KEY = "pos_settings";

type PosSettings = DeliveryPricingSettings;

function parseSettings(value: Prisma.JsonValue | null): PosSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as unknown as PosSettings;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function money(value: number) {
  return Math.round(value);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffSession(["ADMIN", "POS", "CASHIER"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  const { id: rawId } = await context.params;
  const orderId = Number(rawId);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      address: true,
      payments: { orderBy: { id: "asc" } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  }

  if (order.fulfillmentType !== "DELIVERY") {
    return NextResponse.json(
      { error: "Solo los pedidos a domicilio permiten editar la dirección." },
      { status: 409 },
    );
  }

  if (!order.customerId) {
    return NextResponse.json(
      { error: "Este domicilio no tiene un cliente asociado." },
      { status: 409 },
    );
  }

  if (["DELIVERED", "COMPLETED", "CANCELED"].includes(order.status)) {
    return NextResponse.json(
      { error: "Este pedido ya está cerrado y no permite cambiar la dirección." },
      { status: 409 },
    );
  }

  const body = await request.json();
  const formattedAddress = clean(body.formattedAddress);
  const placeId = clean(body.placeId);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const neighborhood = clean(body.neighborhood);
  const city = clean(body.city) || "Bogotá";
  const notes = clean(body.notes);

  if (
    !formattedAddress ||
    !placeId ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json(
      { error: "Selecciona y valida la dirección con Google Maps." },
      { status: 400 },
    );
  }

  const settingsRow = await prisma.appSetting.findUnique({
    where: { key: SETTINGS_KEY },
  });
  const settings = parseSettings(settingsRow?.value ?? null);

  try {
    let pricing;
    try {
      pricing = resolveDeliveryPricing({
        settings,
        destination: { latitude, longitude },
      });
    } catch (pricingError) {
      return NextResponse.json(
        {
          error:
            pricingError instanceof Error
              ? pricingError.message
              : "No fue posible calcular el domicilio.",
        },
        { status: deliveryPricingHttpStatus(pricingError) },
      );
    }

    const origin = pricing.origin;
    const destination = pricing.destination;

    let route:
      | {
          distanceMeters: number;
          durationSeconds: number | null;
        }
      | null = null;

    try {
      const drivingRoute = await computeDrivingRoute({
        origin,
        destination,
      });
      route = {
        distanceMeters: drivingRoute.distanceMeters,
        durationSeconds: drivingRoute.durationSeconds,
      };
    } catch (routeError) {
      console.warn(
        "Order address route unavailable; commercial distance remains valid",
        routeError,
      );
    }

    if (!pricing.covered || !pricing.band) {
      return NextResponse.json(
        { error: "La nueva dirección está fuera de cobertura para domicilio." },
        { status: 409 },
      );
    }

    const deliveryFee = pricing.deliveryFee ?? 0;
    const total = Math.max(
      0,
      money(Number(order.subtotal) + deliveryFee - Number(order.discount)),
    );
    const paidAmount = order.payments
      .filter((payment) => payment.status === "PAID")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    if (total < paidAmount) {
      return NextResponse.json(
        {
          error:
            `La nueva tarifa deja el total en $${total.toLocaleString("es-CO")}, por debajo de los $${paidAmount.toLocaleString("es-CO")} ya recibidos. Registra una devolución antes de aplicar este cambio.`,
        },
        { status: 409 },
      );
    }

    const outstanding = Math.max(0, total - paidAmount);
    const pendingPayment =
      order.payments.find(
        (payment) =>
          payment.status === "PENDING" || payment.status === "PARTIAL",
      ) ?? null;
    const fallbackMethod =
      pendingPayment?.method ||
      order.payments.find((payment) => payment.status === "PAID")?.method ||
      "Pago";

    const result = await prisma.$transaction(async (tx) => {
      let addressId = order.addressId;

      if (addressId) {
        const existing = await tx.customerAddress.findFirst({
          where: { id: addressId, customerId: order.customerId! },
          select: { id: true },
        });
        if (!existing) addressId = null;
      }

      if (!addressId) {
        const existing = await tx.customerAddress.findFirst({
          where: { customerId: order.customerId! },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          select: { id: true },
        });
        addressId = existing?.id ?? null;
      }

      await tx.customerAddress.updateMany({
        where: {
          customerId: order.customerId!,
          ...(addressId ? { id: { not: addressId } } : {}),
        },
        data: { isDefault: false },
      });

      if (addressId) {
        await tx.customerAddress.update({
          where: { id: addressId },
          data: {
            label: "Casa",
            address: formattedAddress,
            formattedAddress,
            placeId,
            latitude,
            longitude,
            neighborhood: neighborhood || null,
            city,
            notes: notes || null,
            isDefault: true,
          },
        });
      } else {
        const created = await tx.customerAddress.create({
          data: {
            customerId: order.customerId!,
            label: "Casa",
            address: formattedAddress,
            formattedAddress,
            placeId,
            latitude,
            longitude,
            neighborhood: neighborhood || null,
            city,
            notes: notes || null,
            isDefault: true,
          },
          select: { id: true },
        });
        addressId = created.id;
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          addressId,
          deliveryFee,
          deliveryZoneId: pricing.deliveryZoneId,
          deliveryZoneName: pricing.deliveryZoneName,
          deliveryDistanceMeters: Math.round(
            pricing.commercialDistanceMeters,
          ),
          total,
        },
      });

      if (outstanding > 0) {
        if (pendingPayment) {
          await tx.payment.update({
            where: { id: pendingPayment.id },
            data: {
              amount: outstanding,
              status: "PENDING",
              cashReceived: null,
              changeDue: null,
            },
          });
        } else {
          await tx.payment.create({
            data: {
              orderId: order.id,
              method: fallbackMethod,
              amount: outstanding,
              status: "PENDING",
            },
          });
        }
      } else if (pendingPayment) {
        await tx.payment.update({
          where: { id: pendingPayment.id },
          data: {
            amount: 0,
            status: "CANCELED",
            cashReceived: null,
            changeDue: null,
          },
        });
      }

      return tx.order.findUnique({
        where: { id: order.id },
        include: {
          customer: true,
          address: true,
          payments: true,
        },
      });
    });

    return NextResponse.json({
      order: result,
      route: {
        commercialDistanceMeters: Math.round(
          pricing.commercialDistanceMeters,
        ),
        distanceMeters: route?.distanceMeters ?? null,
        durationSeconds: route?.durationSeconds ?? null,
      },
    });
  } catch (error) {
    console.error("Order delivery address update error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible actualizar la dirección del domicilio.",
      },
      { status: 500 },
    );
  }
}
