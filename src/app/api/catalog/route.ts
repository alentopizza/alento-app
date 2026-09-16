import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { active: true, visibleInPos: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      products: {
        where: { active: true, visibleInPos: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  const sizes = await prisma.pizzaSize.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { diameterCm: "asc" }],
  });

  const crusts = await prisma.pizzaCrust.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { prices: true },
  });

  const modifiers = await prisma.product.findMany({
    where: { active: true, type: "MODIFIER", category: { slug: "ingredientes" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const normalizeProduct = (product: any) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    imageUrl2: product.imageUrl2,
    type: product.type,
    basePrice: product.basePrice == null ? null : Number(product.basePrice),
    featured: product.featured,
  });

  const normalizedCategories = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    imageUrl: category.imageUrl,
    products: category.products.map(normalizeProduct),
  }));

  return NextResponse.json({
    categories: normalizedCategories,
    pizzaFlavors: normalizedCategories.flatMap((category) => category.products).filter((product) => product.type === "PIZZA_SINGLE"),
    sizes: sizes.map((size) => ({ id: size.id, name: size.name, diameterCm: size.diameterCm, basePrice: Number(size.basePrice) })),
    crusts: crusts.map((crust) => ({ id: crust.id, name: crust.name, prices: crust.prices.map((price) => ({ sizeId: price.sizeId, price: Number(price.price) })) })),
    modifiers: modifiers.map(normalizeProduct),
  });
}
