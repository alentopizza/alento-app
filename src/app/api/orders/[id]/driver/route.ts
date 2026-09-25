import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { dispatchDriverAssignedNotification } from "@/lib/notifier";
import { sendDriverPush } from "@/lib/driverPush";
import { createDriverOrderToken } from "@/lib/driverTracking";
import { getDriverDeliveryCapacity } from "@/lib/driverCapacity";
import { orderCode as formatOrderCode } from "@/lib/orderCode";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffSession(["ADMIN", "POS", "CASHIER"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json({ error: forbidden ? "Sin permisos." : "No autorizado." }, { status: forbidden ? 403 : 401 });
  }

  const { id: rawId } = await context.params;
  const orderId = Number(rawId);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const driverId = Number(body?.driverId);
  if (!Number.isInteger(driverId) || driverId <= 0) {
    return NextResponse.json({ error: "Selecciona un repartidor válido." }, { status: 400 });
  }

  const [order, driver] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        sequenceNumber: true,
        source: true,
        driverId: true,
        fulfillmentType: true,
        status: true,
        total: true,
      },
    }),
    prisma.user.findFirst({
      where: {
        id: driverId,
        active: true,
        roles: { hasSome: ["DRIVER", "DISPATCH"] },
      },
      select: {
        id: true,
        name: true,
        whatsappCountryCode: true,
        whatsappPhone: true,
      },
    }),
  ]);

  if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  if (order.fulfillmentType !== "DELIVERY") {
    return NextResponse.json({ error: "Solo los pedidos a domicilio permiten asignar repartidor." }, { status: 409 });
  }
  if (["CANCELED", "COMPLETED"].includes(order.status)) {
    return NextResponse.json({ error: "Este pedido ya no permite asignar repartidor." }, { status: 409 });
  }
  if (!driver) return NextResponse.json({ error: "El repartidor no está disponible." }, { status: 404 });
  if (!driver.whatsappPhone) {
    return NextResponse.json({ error: "El repartidor no tiene número de WhatsApp configurado." }, { status: 409 });
  }

  const capacity = await getDriverDeliveryCapacity(driver.id, order.id);
  if (capacity.reached && order.driverId !== driver.id) {
    return NextResponse.json(
      {
        error:
          capacity.maxConcurrentDeliveries === 1
            ? `${driver.name} ya tiene 1 domicilio asignado, que es el máximo permitido.`
            : `${driver.name} ya tiene ${capacity.maxConcurrentDeliveries} domicilios asignados, que es el máximo permitido.`,
        capacity,
      },
      { status: 409 },
    );
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      driverId: driver.id,
      driverAssignedAt: new Date(),
    },
    select: {
      id: true,
      driverId: true,
      driverAssignedAt: true,
      driver: {
        select: {
          id: true,
          name: true,
          whatsappCountryCode: true,
          whatsappPhone: true,
        },
      },
    },
  });

  const displayOrderCode = formatOrderCode(
    order.sequenceNumber ?? order.id,
    order.source,
  );
  const notification = await dispatchDriverAssignedNotification({
    orderId: order.id,
    orderCode: displayOrderCode,
    total: Number(order.total),
    fulfillmentType: order.fulfillmentType,
    driverId: driver.id,
    driverName: driver.name,
    driverPhone: `${driver.whatsappCountryCode || "+57"}${driver.whatsappPhone}`,
  });

  if (!notification.ok) {
    console.warn("Driver assignment notification", {
      orderId: order.id,
      driverId: driver.id,
      reason: notification.reason,
    });
  }

  const pushNotification = await sendDriverPush({
    driverId: driver.id,
    title: `Alentó · ${displayOrderCode} asignado`,
    body: "Te asignaron un domicilio. Toca para revisar destino, productos y cobro.",
    url: `/repartidor/pedido/${createDriverOrderToken(
      order.id,
      driver.id,
    )}`,
    tag: `alento-driver-order-${order.id}`,
  });

  if (!pushNotification.ok && pushNotification.failed > 0) {
    console.warn("Driver assignment push", {
      orderId: order.id,
      driverId: driver.id,
      reason: pushNotification.reason,
    });
  }

  return NextResponse.json({
    order: updated,
    notification,
    pushNotification,
  });
}


export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffSession(["ADMIN", "POS", "CASHIER"]);
  } catch (error) {
    const forbidden =
      error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  const { id: rawId } = await context.params;
  const orderId = Number(rawId);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json(
      { error: "Pedido inválido." },
      { status: 400 },
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      driverId: true,
      fulfillmentType: true,
      status: true,
      driver: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json(
      { error: "Pedido no encontrado." },
      { status: 404 },
    );
  }

  if (order.fulfillmentType !== "DELIVERY") {
    return NextResponse.json(
      { error: "Este pedido no es un domicilio." },
      { status: 409 },
    );
  }

  if (!order.driverId) {
    return NextResponse.json(
      { error: "Este pedido no tiene repartidor asignado." },
      { status: 409 },
    );
  }

  if (["DELIVERED", "COMPLETED", "CANCELED"].includes(order.status)) {
    return NextResponse.json(
      { error: "Este pedido ya no permite desasignar repartidor." },
      { status: 409 },
    );
  }

  const resetToReady = ["OUT_FOR_DELIVERY", "ARRIVED"].includes(
    order.status,
  );

  const [updated] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        driverId: null,
        driverAssignedAt: null,
        driverLatitude: null,
        driverLongitude: null,
        driverLocationAccuracy: null,
        driverLocationUpdatedAt: null,
        ...(resetToReady ? { status: "READY" } : {}),
      },
      select: {
        id: true,
        status: true,
        driverId: true,
        driverAssignedAt: true,
      },
    }),
    prisma.orderItem.updateMany({
      where: { orderId: order.id },
      data: {
        driverVerifiedAt: null,
        driverVerifiedDriverId: null,
      },
    }),
  ]);

  return NextResponse.json({
    order: updated,
    previousDriver: order.driver,
    resetToReady,
  });
}
