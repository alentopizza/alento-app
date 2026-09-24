import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { createDriverOrderToken } from "@/lib/driverTracking";
import { getDriverDeliveryCapacity } from "@/lib/driverCapacity";

const CLAIMABLE_STATUSES = [
  "CONFIRMED",
  "PREPARING",
  "PREPARED",
  "READY",
] as const;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireStaffSession(["DRIVER", "DISPATCH"]);
    const { id: rawId } = await context.params;
    const orderId = Number(rawId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: "Pedido inválido." },
        { status: 400 },
      );
    }

    const driver = await prisma.user.findFirst({
      where: {
        id: session.userId,
        active: true,
        roles: { hasSome: ["DRIVER", "DISPATCH"] },
      },
      select: {
        id: true,
        driverAvailable: true,
      },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Repartidor no disponible." },
        { status: 404 },
      );
    }

    if (!driver.driverAvailable) {
      return NextResponse.json(
        { error: "Ponte Activo antes de tomar una solicitud." },
        { status: 409 },
      );
    }

    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        driverId: true,
        status: true,
        fulfillmentType: true,
      },
    });

    if (!existing || existing.fulfillmentType !== "DELIVERY") {
      return NextResponse.json(
        { error: "Solicitud no encontrada." },
        { status: 404 },
      );
    }

    if (existing.driverId === session.userId) {
      const token = createDriverOrderToken(orderId, session.userId);
      return NextResponse.json({
        order: { id: orderId },
        href: `/repartidor/pedido/${token}`,
      });
    }

    if (existing.driverId != null) {
      return NextResponse.json(
        { error: "Otro repartidor ya tomó esta solicitud." },
        { status: 409 },
      );
    }

    if (
      !CLAIMABLE_STATUSES.includes(
        existing.status as (typeof CLAIMABLE_STATUSES)[number],
      )
    ) {
      return NextResponse.json(
        { error: "Este pedido ya no está disponible para autoasignación." },
        { status: 409 },
      );
    }

    const capacity = await getDriverDeliveryCapacity(session.userId, orderId);
    if (capacity.reached) {
      return NextResponse.json(
        {
          error:
            capacity.maxConcurrentDeliveries === 1
              ? "Ya tienes el máximo de 1 domicilio asignado. Finalízalo antes de tomar otro."
              : `Ya tienes el máximo de ${capacity.maxConcurrentDeliveries} domicilios asignados. Finaliza uno antes de tomar otro.`,
          capacity,
        },
        { status: 409 },
      );
    }

    const result = await prisma.order.updateMany({
      where: {
        id: orderId,
        driverId: null,
        fulfillmentType: "DELIVERY",
        status: { in: [...CLAIMABLE_STATUSES] },
      },
      data: {
        driverId: session.userId,
        driverAssignedAt: new Date(),
      },
    });

    if (result.count !== 1) {
      return NextResponse.json(
        { error: "Otro repartidor acaba de tomar esta solicitud." },
        { status: 409 },
      );
    }

    const token = createDriverOrderToken(orderId, session.userId);
    return NextResponse.json({
      order: { id: orderId },
      href: `/repartidor/pedido/${token}`,
    });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }
}
