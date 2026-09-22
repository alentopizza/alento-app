import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/googleMapsServer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const address =
      typeof body?.address === "string" ? body.address.trim() : "";

    if (!address) {
      return NextResponse.json(
        { error: "Ingresa la dirección del local." },
        { status: 400 },
      );
    }

    const location = await geocodeAddress(address);

    return NextResponse.json({
      ok: true,
      location,
      validatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Store geocode error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible validar la ubicación con Google Maps.",
      },
      { status: 500 },
    );
  }
}
