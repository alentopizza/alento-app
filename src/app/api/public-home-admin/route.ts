import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PUBLIC_HOME_SETTINGS,
  PUBLIC_HOME_SETTING_KEY,
  normalizePublicHomeSettings,
} from "@/lib/publicHome";

async function availableProducts() {
  return prisma.product.findMany({
    where: {
      active: true,
      visibleInPos: true,
      type: { notIn: ["MODIFIER", "INTERNAL"] },
    },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      imageUrl: true,
      basePrice: true,
    },
  });
}

export async function GET() {
  const [saved, products] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: PUBLIC_HOME_SETTING_KEY } }),
    availableProducts(),
  ]);

  return NextResponse.json({
    settings: saved
      ? normalizePublicHomeSettings(saved.value)
      : DEFAULT_PUBLIC_HOME_SETTINGS,
    products: products.map((product) => ({
      ...product,
      basePrice: product.basePrice == null ? null : Number(product.basePrice),
    })),
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const settings = normalizePublicHomeSettings(body?.settings);

  const banners = [
    { label: "principal", value: settings.primaryBanner },
    { label: "secundario", value: settings.secondaryBanner },
  ];

  for (const banner of banners) {
    if (banner.value.active && !banner.value.imageUrl) {
      return NextResponse.json(
        { error: `El banner ${banner.label} está activo pero no tiene imagen.` },
        { status: 400 },
      );
    }
    if (banner.value.active && !banner.value.productId) {
      return NextResponse.json(
        { error: `Selecciona el producto vinculado al banner ${banner.label}.` },
        { status: 400 },
      );
    }
  }

  const productIds = [...new Set(
    banners
      .map((banner) => banner.value.productId)
      .filter((id): id is number => Number.isInteger(id)),
  )];

  if (productIds.length) {
    const validProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        active: true,
        visibleInPos: true,
        type: { notIn: ["MODIFIER", "INTERNAL"] },
      },
      select: { id: true },
    });

    if (validProducts.length !== productIds.length) {
      return NextResponse.json(
        { error: "Uno de los productos vinculados ya no está disponible en el catálogo." },
        { status: 400 },
      );
    }
  }

  const saved = await prisma.appSetting.upsert({
    where: { key: PUBLIC_HOME_SETTING_KEY },
    update: { value: settings },
    create: { key: PUBLIC_HOME_SETTING_KEY, value: settings },
  });

  return NextResponse.json({
    settings: normalizePublicHomeSettings(saved.value),
  });
}
