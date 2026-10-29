import { NextRequest, NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/googleMapsServer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { error: "Las coordenadas seleccionadas no son válidas." },
        { status: 400 },
      );
    }

    const location = await reverseGeocode(latitude, longitude);

    return NextResponse.json({
      ok: true,
      location,
      validatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Customer address reverse geocode error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible identificar la dirección del punto seleccionado.",
      },
      { status: 500 },
    );
  }
}
