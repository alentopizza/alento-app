import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const categoryPriority = new Map([
  ["destacados", 1],
  ["pizzas", 2],
  ["antojos", 3],
  ["bebidas", 4],
  ["combos", 5],
]);

export async function GET() {
  const [categories, sizes, crusts, modifiers, featuredProducts, combos] = await Promise.all([
    prisma.category.findMany({
      where: { active: true, visibleInPos: true, slug: { not: "combos" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        products: {
          where: { active: true, visibleInPos: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
    }),
    prisma.pizzaSize.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { diameterCm: "asc" }],
    }),
    prisma.pizzaCrust.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { prices: true },
    }),
    prisma.product.findMany({
      where: { active: true, type: "MODIFIER", category: { slug: "ingredientes" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      where: { active: true, visibleInPos: true, featured: true, type: { notIn: ["MODIFIER", "INTERNAL"] } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      where: { active: true, visibleInPos: true, type: "COMBO" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const normalizeProduct = (product: (typeof featuredProducts)[number]) => ({
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
    products: category.slug === "destacados"
      ? featuredProducts.map(normalizeProduct)
      : category.products.filter((product) => product.type !== "COMBO").map(normalizeProduct),
  }));

  if (combos.length) {
    normalizedCategories.push({
      id: -5,
      name: "Combos",
      slug: "combos",
      imageUrl: null,
      products: combos.map(normalizeProduct),
    });
  }

  normalizedCategories.sort((a, b) => {
    const aPriority = categoryPriority.get(a.slug) ?? 100;
    const bPriority = categoryPriority.get(b.slug) ?? 100;
    return aPriority - bPriority || a.name.localeCompare(b.name, "es");
  });

  return NextResponse.json({
    categories: normalizedCategories,
    pizzaFlavors: normalizedCategories.flatMap((category) => category.products).filter((product) => product.type === "PIZZA_SINGLE"),
    sizes: sizes.map((size) => ({ id: size.id, name: size.name, diameterCm: size.diameterCm, basePrice: Number(size.basePrice) })),
    crusts: crusts.map((crust) => ({ id: crust.id, name: crust.name, prices: crust.prices.map((price) => ({ sizeId: price.sizeId, price: Number(price.price) })) })),
    modifiers: modifiers.map(normalizeProduct),
  });
}
