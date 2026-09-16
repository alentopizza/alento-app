import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SETTINGS_KEY = "pos_settings";

const DEFAULT_BANDS = [
  { id: "band-1", minMeters: 0, maxMeters: 200, fee: 0, active: true },
  { id: "band-2", minMeters: 201, maxMeters: 500, fee: 5000, active: true },
];

type Band = { id: string; minMeters: number; maxMeters: number; fee: number; active: boolean };

export async function POST(request: NextRequest) {
  const body = await request.json();
  const distanceMeters = Number(body?.distanceMeters);

  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    return NextResponse.json({ error: "La distancia debe ser un número válido en metros." }, { status: 400 });
  }

  const saved = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
  const value = saved?.value as { deliveryBands?: Band[] } | null;
  const bands = Array.isArray(value?.deliveryBands) ? value.deliveryBands : DEFAULT_BANDS;
  const activeBands = bands
    .filter((band) => band.active !== false)
    .map((band) => ({
      ...band,
      minMeters: Number(band.minMeters),
      maxMeters: Number(band.maxMeters),
      fee: Number(band.fee),
    }))
    .sort((a, b) => a.minMeters - b.minMeters);

  const band = activeBands.find((item) => distanceMeters >= item.minMeters && distanceMeters <= item.maxMeters);

  if (!band) {
    return NextResponse.json({
      covered: false,
      distanceMeters,
      deliveryFee: null,
      maxCoverageMeters: Math.max(0, ...activeBands.map((item) => item.maxMeters)),
    });
  }

  return NextResponse.json({
    covered: true,
    distanceMeters,
    deliveryFee: band.fee,
    band,
    maxCoverageMeters: Math.max(0, ...activeBands.map((item) => item.maxMeters)),
  });
}
