import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const categoryPriority = new Map([
  ["destacados", 1],
  ["pizzas", 2],
  ["antojos", 3],
  ["bebidas", 4],
  ["combos", 5],
]);

const comboInclude = {
  comboPizzaRules: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      sizes: { include: { size: true } },
      flavors: { include: { product: true } },
    },
  },
  comboGroups: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      options: {
        orderBy: { sortOrder: "asc" as const },
        include: { product: true },
      },
    },
  },
} as const;

export async function GET() {
  try {
    const [categories, sizes, crusts, modifiers, featuredProducts, combos] = await Promise.all([
      prisma.category.findMany({
        where: { active: true, visibleInPos: true, slug: { not: "combos" } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          products: {
            where: { active: true, visibleInPos: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: comboInclude,
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
        include: comboInclude,
      }),
      prisma.product.findMany({
        where: { active: true, visibleInPos: true, type: "COMBO" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: comboInclude,
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
      comboDiscount: product.comboDiscount == null ? 0 : Number(product.comboDiscount),
      comboPizzaRules: product.comboPizzaRules.map((rule) => ({
        id: rule.id,
        quantity: rule.quantity,
        sizes: rule.sizes.map((item) => ({
          id: item.size.id,
          name: item.size.name,
          diameterCm: item.size.diameterCm,
          basePrice: Number(item.size.basePrice),
        })),
        flavors: rule.flavors.map((item) => ({
          id: item.product.id,
          name: item.product.name,
          basePrice: item.product.basePrice == null ? 0 : Number(item.product.basePrice),
          imageUrl: item.product.imageUrl,
        })),
      })),
      comboGroups: product.comboGroups.map((group) => ({
        id: group.id,
        kind: group.kind,
        name: group.name,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        options: group.options.map((option) => ({
          id: option.id,
          productId: option.product.id,
          productName: option.product.name,
          productType: option.product.type,
          basePrice: option.product.basePrice == null ? 0 : Number(option.product.basePrice),
          imageUrl: option.product.imageUrl,
          quantity: option.quantity,
          priceDelta: Number(option.priceDelta),
        })),
      })),
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

    const pizzaFlavors = [
      ...new Map(
        normalizedCategories
          .flatMap((category) => category.products)
          .filter((product) => product.type === "PIZZA_SINGLE")
          .map((product) => [product.id, product] as const),
      ).values(),
    ];

    return NextResponse.json({
      categories: normalizedCategories,
      pizzaFlavors,
      sizes: sizes.map((size) => ({
        id: size.id,
        name: size.name,
        diameterCm: size.diameterCm,
        basePrice: Number(size.basePrice),
      })),
      crusts: crusts.map((crust) => ({
        id: crust.id,
        name: crust.name,
        prices: crust.prices.map((price) => ({ sizeId: price.sizeId, price: Number(price.price) })),
      })),
      modifiers: modifiers.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        basePrice: product.basePrice == null ? 0 : Number(product.basePrice),
      })),
    });
  } catch (error) {
    console.error("Catalog API error", error);
    return NextResponse.json({ error: "No fue posible cargar el catálogo." }, { status: 500 });
  }
}
