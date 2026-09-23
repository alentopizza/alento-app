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
