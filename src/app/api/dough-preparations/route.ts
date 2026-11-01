import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

const SIZES = {
  personal: 190,
  mediana: 345,
  grande: 610,
  extra: 790,
} as const;

const RECIPE = {
  hydration: 0.58,
  adn: 0.05,
  sugar: 0.02,
  salt: 0.01,
  yeast: 0.005,
};

const FACTOR =
  1 +
  RECIPE.hydration +
  RECIPE.adn +
  RECIPE.sugar +
  RECIPE.salt +
  RECIPE.yeast;

type PreparationMode = "NORMAL" | "QUICK";

function normalizePreparationMode(value: unknown): PreparationMode {
  return value === "QUICK" ? "QUICK" : "NORMAL";
}

function normalizeCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function calculatePreparation(body: Record<string, unknown>) {
  const personal = normalizeCount(body.personal);
  const mediana = normalizeCount(body.mediana);
  const grande = normalizeCount(body.grande);
  const extra = normalizeCount(body.extra);

  const totalBalls = personal + mediana + grande + extra;
  const totalWeightGrams =
    personal * SIZES.personal +
    mediana * SIZES.mediana +
    grande * SIZES.grande +
    extra * SIZES.extra;

  const flour = totalWeightGrams / FACTOR;
  const water = flour * RECIPE.hydration;
  const adn = flour * RECIPE.adn;
  const sugar = flour * RECIPE.sugar;
  const salt = flour * RECIPE.salt;
  const yeast = flour * RECIPE.yeast;

  return {
    personal,
    mediana,
    grande,
    extra,
    totalBalls,
    totalWeightGrams,
    flour,
    water,
    adn,
    sugar,
    salt,
    yeast,
  };
}

function serialize(item: {
  id: number;
  createdAt: Date;
  createdByName: string;
  mode: string;
  personalCount: number;
  mediumCount: number;
  largeCount: number;
  extraLargeCount: number;
  totalBalls: number;
  totalWeightGrams: number;
  hydrationPct: unknown;
  adnPct: unknown;
  sugarPct: unknown;
  saltPct: unknown;
  yeastPct: unknown;
  flourGrams: unknown;
  waterGrams: unknown;
  adnGrams: unknown;
  sugarGrams: unknown;
  saltGrams: unknown;
  yeastGrams: unknown;
}) {
  return {
    id: item.id,
    createdAt: item.createdAt.toISOString(),
    createdByName: item.createdByName,
    mode: item.mode === "QUICK" ? "QUICK" : "NORMAL",
    counts: {
      personal: item.personalCount,
      mediana: item.mediumCount,
      grande: item.largeCount,
      extra: item.extraLargeCount,
    },
    totalBalls: item.totalBalls,
    totalWeightGrams: item.totalWeightGrams,
    formula: {
      hydrationPct: Number(item.hydrationPct),
      adnPct: Number(item.adnPct),
      sugarPct: Number(item.sugarPct),
      saltPct: Number(item.saltPct),
      yeastPct: Number(item.yeastPct),
    },
    ingredients: {
      flour: Number(item.flourGrams),
      water: Number(item.waterGrams),
      adn: Number(item.adnGrams),
      sugar: Number(item.sugarGrams),
      salt: Number(item.saltGrams),
      yeast: Number(item.yeastGrams),
    },
  };
}

export async function GET() {
  try {
    await requireStaffSession(["ADMIN", "KITCHEN"]);

    const items = await prisma.doughPreparation.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ preparations: items.map(serialize) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    }

    console.error("Error loading dough preparations", error);
    return NextResponse.json(
      { error: "No fue posible cargar el historial de preparaciones." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireStaffSession(["ADMIN", "KITCHEN"]);
    const body = await request.json();
    const mode = normalizePreparationMode(body?.mode);

    const {
      personal,
      mediana,
      grande,
      extra,
      totalBalls,
      totalWeightGrams,
      flour,
      water,
      adn,
      sugar,
      salt,
      yeast,
    } = calculatePreparation(body ?? {});

    if (totalBalls <= 0) {
      return NextResponse.json(
        { error: "Agrega por lo menos una bola a la preparación." },
        { status: 400 },
      );
    }

    const saved = await prisma.doughPreparation.create({
      data: {
        createdById: session.userId,
        createdByName: session.name,
        mode,
        personalCount: personal,
        mediumCount: mediana,
        largeCount: grande,
        extraLargeCount: extra,
        totalBalls,
        totalWeightGrams,
        hydrationPct: RECIPE.hydration * 100,
        adnPct: RECIPE.adn * 100,
        sugarPct: RECIPE.sugar * 100,
        saltPct: RECIPE.salt * 100,
        yeastPct: RECIPE.yeast * 100,
        flourGrams: flour,
        waterGrams: water,
        adnGrams: adn,
        sugarGrams: sugar,
        saltGrams: salt,
        yeastGrams: yeast,
      },
    });

    return NextResponse.json(
      { preparation: serialize(saved) },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    }

    console.error("Error creating dough preparation", error);
    return NextResponse.json(
      { error: "No fue posible guardar la preparación." },
      { status: 500 },
    );
  }
}


export async function PATCH(request: NextRequest) {
  try {
    await requireStaffSession(["ADMIN", "KITCHEN"]);

    const id = Number(request.nextUrl.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Preparación inválida." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const mode = normalizePreparationMode(body?.mode);
    const {
      personal,
      mediana,
      grande,
      extra,
      totalBalls,
      totalWeightGrams,
      flour,
      water,
      adn,
      sugar,
      salt,
      yeast,
    } = calculatePreparation(body ?? {});

    if (totalBalls <= 0) {
      return NextResponse.json(
        { error: "Agrega por lo menos una bola a la preparación." },
        { status: 400 },
      );
    }

    const updated = await prisma.doughPreparation.update({
      where: { id },
      data: {
        mode,
        personalCount: personal,
        mediumCount: mediana,
        largeCount: grande,
        extraLargeCount: extra,
        totalBalls,
        totalWeightGrams,
        hydrationPct: RECIPE.hydration * 100,
        adnPct: RECIPE.adn * 100,
        sugarPct: RECIPE.sugar * 100,
        saltPct: RECIPE.salt * 100,
        yeastPct: RECIPE.yeast * 100,
        flourGrams: flour,
        waterGrams: water,
        adnGrams: adn,
        sugarGrams: sugar,
        saltGrams: salt,
        yeastGrams: yeast,
      },
    });

    return NextResponse.json({ preparation: serialize(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    }

    const prismaError = error as { code?: string };
    if (prismaError.code === "P2025") {
      return NextResponse.json(
        { error: "La preparación ya no existe." },
        { status: 404 },
      );
    }

    console.error("Error updating dough preparation", error);
    return NextResponse.json(
      { error: "No fue posible actualizar la preparación." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireStaffSession(["ADMIN", "KITCHEN"]);

    const id = Number(request.nextUrl.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Preparación inválida." },
        { status: 400 },
      );
    }

    await prisma.doughPreparation.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    }

    const prismaError = error as { code?: string };
    if (prismaError.code === "P2025") {
      return NextResponse.json(
        { error: "La preparación ya no existe." },
        { status: 404 },
      );
    }

    console.error("Error deleting dough preparation", error);
    return NextResponse.json(
      { error: "No fue posible eliminar la preparación." },
      { status: 500 },
    );
  }
}
