import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

async function driverSession() {
  return requireStaffSession(["DRIVER", "DISPATCH"]);
}

export async function GET() {
  try {
    const session = await driverSession();
    const driver = await prisma.user.findFirst({
      where: {
        id: session.userId,
        active: true,
        roles: { hasSome: ["DRIVER", "DISPATCH"] },
      },
      select: {
        id: true,
        name: true,
        driverAvailable: true,
        driverLatitude: true,
        driverLongitude: true,
        driverLocationAccuracy: true,
        driverLocationUpdatedAt: true,
      },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Repartidor no disponible." },
        { status: 404 },
      );
    }

    return NextResponse.json({ driver });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await driverSession();
    const body = await request.json().catch(() => ({}));

    if (typeof body?.active !== "boolean") {
      return NextResponse.json(
        { error: "Estado de disponibilidad inválido." },
        { status: 400 },
      );
    }

    if (!body.active) {
      const assignedPending = await prisma.order.count({
        where: {
          driverId: session.userId,
          fulfillmentType: "DELIVERY",
          status: {
            notIn: ["DELIVERED", "COMPLETED", "CANCELED"],
          },
        },
      });

      if (assignedPending > 0) {
        return NextResponse.json(
          {
            error:
              assignedPending === 1
                ? "Tienes 1 domicilio asignado sin entregar. Finalízalo antes de ponerte Inactivo."
                : `Tienes ${assignedPending} domicilios asignados sin entregar. Finalízalos antes de ponerte Inactivo.`,
            assignedPending,
          },
          { status: 409 },
        );
      }
    }

    const driver = await prisma.user.update({
      where: { id: session.userId },
      data: body.active
        ? { driverAvailable: true }
        : {
            driverAvailable: false,
            driverLatitude: null,
            driverLongitude: null,
            driverLocationAccuracy: null,
            driverLocationUpdatedAt: null,
          },
      select: {
        id: true,
        name: true,
        driverAvailable: true,
        driverLatitude: true,
        driverLongitude: true,
        driverLocationAccuracy: true,
        driverLocationUpdatedAt: true,
      },
    });

    return NextResponse.json({ driver });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }
}
