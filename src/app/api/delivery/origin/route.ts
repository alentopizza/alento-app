import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SETTINGS_KEY = "pos_settings";

type SettingsValue = {
  store?: {
    address?: string;
    formattedAddress?: string;
    placeId?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
};

function coordinate(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  try {
    const saved = await prisma.appSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });
    const value = (saved?.value ?? null) as SettingsValue | null;

    const latitude = coordinate(value?.store?.latitude);
    const longitude = coordinate(value?.store?.longitude);

    if (latitude == null || longitude == null) {
      return NextResponse.json(
        { error: "La sede todavía no tiene una ubicación oficial guardada." },
        { status: 503 },
      );
    }

    return NextResponse.json({
      origin: {
        formattedAddress:
          value?.store?.formattedAddress ||
          value?.store?.address ||
          "Alentó Pizza",
        placeId: value?.store?.placeId || "",
        latitude,
        longitude,
      },
    });
  } catch (error) {
    console.error("Public delivery origin error", error);
    return NextResponse.json(
      { error: "No fue posible cargar la ubicación de Alentó." },
      { status: 500 },
    );
  }
}
