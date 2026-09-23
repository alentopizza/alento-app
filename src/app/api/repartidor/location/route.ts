import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireStaffSession(["DRIVER", "DISPATCH"]);
    const body = await request.json().catch(() => ({}));
    const latitude = finite(body?.latitude);
    const longitude = finite(body?.longitude);
    const accuracy = finite(body?.accuracy);

    if (
      latitude == null ||
      longitude == null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { error: "La ubicación no es válida." },
        { status: 400 },
      );
    }

    const driver = await prisma.user.findFirst({
      where: {
        id: session.userId,
        active: true,
        roles: { hasSome: ["DRIVER", "DISPATCH"] },
      },
      select: { id: true, driverAvailable: true },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Repartidor no disponible." },
        { status: 404 },
      );
    }

    if (!driver.driverAvailable) {
      return NextResponse.json(
        { error: "El repartidor está inactivo." },
        { status: 409 },
      );
    }

    const updatedAt = new Date();
    await prisma.user.update({
      where: { id: driver.id },
      data: {
        driverLatitude: latitude,
        driverLongitude: longitude,
        driverLocationAccuracy:
          accuracy != null && accuracy >= 0 ? accuracy : null,
        driverLocationUpdatedAt: updatedAt,
      },
    });

    return NextResponse.json({
      location: {
        latitude,
        longitude,
        accuracy:
          accuracy != null && accuracy >= 0 ? accuracy : null,
        updatedAt: updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }
}
