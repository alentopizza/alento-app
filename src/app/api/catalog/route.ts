import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FEATURED_ORDER_SETTING_KEY = "menu.featuredProductOrder";

function readFeaturedOrder(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item)))];
}

function sortFeaturedProducts<T extends { id: number; sortOrder: number; name: string }>(products: T[], storedOrder: number[]) {
  const rank = new Map(storedOrder.map((id, index) => [id, index] as const));
  return [...products].sort((a, b) => {
    const aRank = rank.get(a.id);
    const bRank = rank.get(b.id);
    if (aRank != null || bRank != null) {
      if (aRank == null) return 1;
      if (bRank == null) return -1;
      if (aRank !== bRank) return aRank - bRank;
    }
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es");
  });
}

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
    const [categories, sizes, crusts, modifiers, featuredProducts, combos, featuredOrderSetting] = await Promise.all([
      prisma.category.findMany({
        where: { active: true, visibleInPos: true, slug: { not: "insumos" } },
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
        where: {
          active: true,
          type: "MODIFIER",
          category: { slug: "ingredientes" },
          OR: [
            { ingredientGroupId: null },
            { ingredientGroup: { is: { active: true } } },
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { ingredientGroup: true },
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
      prisma.appSetting.findUnique({ where: { key: FEATURED_ORDER_SETTING_KEY } }),
    ]);

    const orderedFeaturedProducts = sortFeaturedProducts(
      featuredProducts,
      readFeaturedOrder(featuredOrderSetting?.value),
    );

    const normalizeProduct = (product: (typeof featuredProducts)[number]) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      imageUrl2: product.imageUrl2,
      type: product.type,
      basePrice: product.basePrice == null ? null : Number(product.basePrice),
      couponEligible: product.couponEligible,
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
          description: item.product.description,
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
      sortOrder: category.sortOrder,
      products: category.slug === "destacados"
        ? orderedFeaturedProducts.map(normalizeProduct)
        : category.slug === "combos"
          ? combos.map(normalizeProduct)
          : category.products.filter((product) => product.type !== "COMBO").map(normalizeProduct),
    }));

    normalizedCategories.sort((a, b) =>
      a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es"),
    );

    const pizzaFlavors = [
      ...new Map(
        normalizedCategories
          .flatMap((category) => category.products)
          .filter((product) => product.type === "PIZZA_SINGLE")
          .map((product) => [product.id, product] as const),
      ).values(),
    ];

    const response = NextResponse.json({
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
      modifiers: modifiers
        .sort((a, b) => {
          const aOrder = a.ingredientGroup?.sortOrder ?? 9999;
          const bOrder = b.ingredientGroup?.sortOrder ?? 9999;
          return (
            aOrder - bOrder ||
            a.sortOrder - b.sortOrder ||
            a.name.localeCompare(b.name, "es")
          );
        })
        .map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          basePrice: product.basePrice == null ? 0 : Number(product.basePrice),
          ingredientGroupId: product.ingredientGroup?.active
            ? product.ingredientGroup.id
            : null,
          ingredientGroupName: product.ingredientGroup?.active
            ? product.ingredientGroup.name
            : null,
          ingredientGroupSlug: product.ingredientGroup?.active
            ? product.ingredientGroup.slug
            : null,
          ingredientGroupSortOrder: product.ingredientGroup?.active
            ? product.ingredientGroup.sortOrder
            : 9999,
        })),
    });

    response.headers.set(
      "Cache-Control",
      "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
    );
    return response;
  } catch (error) {
    console.error("Catalog API error", error);
    return NextResponse.json({ error: "No fue posible cargar el catálogo." }, { status: 500 });
  }
}
