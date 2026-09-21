import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { dispatchDriverAssignedNotification } from "@/lib/notifier";

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

  const orderCode = `POS-${String(order.sequenceNumber ?? order.id).padStart(4, "0")}`;
  const notification = await dispatchDriverAssignedNotification({
    orderId: order.id,
    orderCode,
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

  return NextResponse.json({ order: updated, notification });
}
