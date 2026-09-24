import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readDriverOrderToken } from "@/lib/driverTracking";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const parsed = readDriverOrderToken(token);

  if (!parsed) {
    return NextResponse.json(
      { error: "Enlace de reparto inválido." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const itemId = Number(body?.itemId);
  const checked = Boolean(body?.checked);

  if (!Number.isInteger(itemId)) {
    return NextResponse.json(
      { error: "Producto inválido." },
      { status: 400 },
    );
  }

  const order = await prisma.order.findFirst({
    where: {
      id: parsed.orderId,
      driverId: parsed.driverId,
      fulfillmentType: "DELIVERY",
    },
    select: {
      id: true,
      status: true,
      items: {
        where: { id: itemId },
        select: { id: true },
      },
    },
  });

  if (!order) {
    return NextResponse.json(
      { error: "La orden ya no está asignada a este repartidor." },
      { status: 404 },
    );
  }

  if (order.status !== "READY") {
    return NextResponse.json(
      { error: "El pedido aún no está listo para verificar productos." },
      { status: 409 },
    );
  }

  if (!order.items[0]) {
    return NextResponse.json(
      { error: "Este producto no pertenece al pedido." },
      { status: 404 },
    );
  }

  const item = await prisma.orderItem.update({
    where: { id: itemId },
    data: checked
      ? {
          driverVerifiedAt: new Date(),
          driverVerifiedDriverId: parsed.driverId,
        }
      : {
          driverVerifiedAt: null,
          driverVerifiedDriverId: null,
        },
    select: {
      id: true,
      driverVerifiedAt: true,
      driverVerifiedDriverId: true,
    },
  });

  return NextResponse.json({ item });
}
