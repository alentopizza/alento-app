import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

const ACTIVE_DELIVERY_STATUSES = [
  "CONFIRMED",
  "PREPARING",
  "PREPARED",
  "READY",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
] as const;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffSession(["ADMIN", "POS", "CASHIER", "DISPATCH"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  const { id: rawId } = await context.params;
  const driverId = Number(rawId);

  if (!Number.isInteger(driverId) || driverId <= 0) {
    return NextResponse.json(
      { error: "Repartidor inválido." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body?.active !== "boolean") {
    return NextResponse.json(
      { error: "Estado de disponibilidad inválido." },
      { status: 400 },
    );
  }

  const driver = await prisma.user.findFirst({
    where: {
      id: driverId,
      active: true,
      roles: { hasSome: ["DRIVER", "DISPATCH"] },
    },
    select: {
      id: true,
      name: true,
      driverAvailable: true,
    },
  });

  if (!driver) {
    return NextResponse.json(
      { error: "Repartidor no encontrado." },
      { status: 404 },
    );
  }

  if (!body.active) {
    const assignedPending = await prisma.order.count({
      where: {
        driverId,
        fulfillmentType: "DELIVERY",
        status: { in: [...ACTIVE_DELIVERY_STATUSES] },
      },
    });

    if (assignedPending > 0) {
      return NextResponse.json(
        {
          error:
            assignedPending === 1
              ? `${driver.name} tiene 1 domicilio asignado. Finalízalo o desasígnalo antes de desconectarlo.`
              : `${driver.name} tiene ${assignedPending} domicilios asignados. Finalízalos o desasígnalos antes de desconectarlo.`,
          assignedPending,
        },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: driverId },
    data: body.active
      ? {
          driverAvailable: true,
        }
      : {
          driverAvailable: false,
          driverLatitude: null,
          driverLongitude: null,
          driverLocationAccuracy: null,
          driverLocationUpdatedAt: null,
          driverLocationSource: null,
        },
    select: {
      id: true,
      name: true,
      driverAvailable: true,
      driverLatitude: true,
      driverLongitude: true,
      driverLocationAccuracy: true,
      driverLocationUpdatedAt: true,
      driverLocationSource: true,
    },
  });

  return NextResponse.json({
    driver: {
      id: updated.id,
      name: updated.name,
      available: updated.driverAvailable,
      latitude: updated.driverLatitude,
      longitude: updated.driverLongitude,
      accuracy: updated.driverLocationAccuracy,
      updatedAt: updated.driverLocationUpdatedAt?.toISOString() ?? null,
      source: updated.driverLocationSource,
    },
    message: body.active
      ? `${updated.name} quedó habilitado. Su GPS aparecerá cuando la app del repartidor esté abierta.`
      : `${updated.name} quedó desconectado del reparto.`,
  });
}
