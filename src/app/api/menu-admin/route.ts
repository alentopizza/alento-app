import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PRODUCT_CATEGORY_TYPES = {
  pizzas: "PIZZA_SINGLE",
  antojos: "STANDARD",
  bebidas: "STANDARD",
  ingredientes: "MODIFIER",
} as const;

async function getMinimumPizzaSizePrice() {
  const size = await prisma.pizzaSize.findFirst({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { diameterCm: "asc" }],
  });
  return size ? Number(size.basePrice) : 0;
}

function regularProductPrice(product: { type: string; basePrice: unknown }, minPizzaSizePrice: number) {
  const basePrice = product.basePrice == null ? 0 : Number(product.basePrice);
  if (product.type === "PIZZA_SINGLE") return minPizzaSizePrice + basePrice;
  return basePrice;
}

export async function GET() {
  const [categories, sizes, featuredProducts] = await Promise.all([
    prisma.category.findMany({
      where: { slug: { not: "insumos" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        products: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            comboGroups: {
              orderBy: { sortOrder: "asc" },
              include: {
                options: {
                  orderBy: { sortOrder: "asc" },
                  include: { product: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.pizzaSize.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { diameterCm: "asc" }],
    }),
    prisma.product.findMany({
      where: {
        featured: true,
        type: { notIn: ["MODIFIER", "INTERNAL"] },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        comboGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            options: {
              orderBy: { sortOrder: "asc" },
              include: { product: true },
            },
          },
        },
      },
    }),
  ]);

  const minPizzaSizePrice = sizes.length ? Math.min(...sizes.map((size) => Number(size.basePrice))) : 0;

  const serializeProduct = (product: (typeof featuredProducts)[number]) => {
    const comboRegularTotal = product.type === "COMBO"
      ? product.comboGroups.reduce((total, group) => total + group.options.reduce((groupTotal, option) => {
          return groupTotal + regularProductPrice(option.product, minPizzaSizePrice) * option.quantity;
        }, 0), 0)
      : null;
    const finalPrice = product.basePrice == null ? null : Number(product.basePrice);

    return {
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      imageUrl2: product.imageUrl2,
      type: product.type,
      basePrice: finalPrice,
      active: product.active,
      visibleInPos: product.visibleInPos,
      featured: product.featured,
      sortOrder: product.sortOrder,
      comboRegularTotal,
      comboDiscount: comboRegularTotal != null && finalPrice != null ? Math.max(0, comboRegularTotal - finalPrice) : null,
      comboGroups: product.comboGroups.map((group) => ({
        id: group.id,
        name: group.name,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        sortOrder: group.sortOrder,
        options: group.options.map((option) => ({
          id: option.id,
          productId: option.productId,
          productName: option.product.name,
          quantity: option.quantity,
          priceDelta: Number(option.priceDelta),
          sortOrder: option.sortOrder,
        })),
      })),
    };
  };

  return NextResponse.json({
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      active: category.active,
      visibleInPos: category.visibleInPos,
      sortOrder: category.sortOrder,
      products: category.slug === "destacados"
        ? featuredProducts.map(serializeProduct)
        : category.products.map(serializeProduct),
    })),
    sizes: sizes.map((size) => ({
      id: size.id,
      name: size.name,
      diameterCm: size.diameterCm,
      basePrice: Number(size.basePrice),
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const productId = Number(body.productId);

  if (!Number.isInteger(productId)) {
    return NextResponse.json({ error: "Producto inválido." }, { status: 400 });
  }

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
      ...(typeof body.description === "string" ? { description: body.description.trim() || null } : {}),
      ...(typeof body.imageUrl === "string" ? { imageUrl: body.imageUrl.trim() || null } : {}),
      ...(typeof body.imageUrl2 === "string" ? { imageUrl2: body.imageUrl2.trim() || null } : {}),
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      ...(typeof body.visibleInPos === "boolean" ? { visibleInPos: body.visibleInPos } : {}),
      ...(typeof body.featured === "boolean" ? { featured: body.featured } : {}),
      ...(body.basePrice === null || body.basePrice === ""
        ? { basePrice: null }
        : Number.isFinite(Number(body.basePrice))
          ? { basePrice: Number(body.basePrice) }
          : {}),
    },
  });

  return NextResponse.json({
    product: {
      ...product,
      basePrice: product.basePrice == null ? null : Number(product.basePrice),
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.action === "createProduct") {
    const categorySlug = typeof body.categorySlug === "string" ? body.categorySlug.trim() : "";
    const productType = PRODUCT_CATEGORY_TYPES[categorySlug as keyof typeof PRODUCT_CATEGORY_TYPES];
    if (!productType) {
      return NextResponse.json({ error: "Categoría no permitida para crear productos." }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    const imageUrl2 = typeof body.imageUrl2 === "string" ? body.imageUrl2.trim() : "";
    const basePrice = Number(body.basePrice);

    if (!name) {
      return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
    }
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      return NextResponse.json({ error: "El precio debe ser válido." }, { status: 400 });
    }

    const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
    if (!category) {
      return NextResponse.json({ error: "No existe la categoría seleccionada." }, { status: 400 });
    }

    const sortOrder = await prisma.product.count({ where: { categoryId: category.id } });

    try {
      const product = await prisma.product.create({
        data: {
          categoryId: category.id,
          name,
          description: description || null,
          imageUrl: imageUrl || null,
          imageUrl2: imageUrl2 || null,
          type: productType,
          basePrice,
          active: true,
          visibleInPos: productType !== "MODIFIER",
          featured: false,
          sortOrder,
        },
      });

      return NextResponse.json({ product }, { status: 201 });
    } catch (error) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2002") {
        return NextResponse.json({ error: "Ya existe un producto con ese nombre en la categoría." }, { status: 409 });
      }
      throw error;
    }
  }

  if (body.action === "createCombo") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    const imageUrl2 = typeof body.imageUrl2 === "string" ? body.imageUrl2.trim() : "";
    const finalPrice = Number(body.finalPrice);
    const rawProductIds: unknown[] = Array.isArray(body.productIds) ? body.productIds : [];
    const productIds = [...new Set(
      rawProductIds
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isInteger(value)),
    )];

    if (!name) {
      return NextResponse.json({ error: "El nombre del combo es obligatorio." }, { status: 400 });
    }
    if (!Number.isFinite(finalPrice) || finalPrice < 0) {
      return NextResponse.json({ error: "El valor final del combo debe ser válido." }, { status: 400 });
    }
    if (productIds.length < 2) {
      return NextResponse.json({ error: "Selecciona al menos dos productos para el combo." }, { status: 400 });
    }

    const [category, products, minPizzaSizePrice] = await Promise.all([
      prisma.category.findUnique({ where: { slug: "destacados" } }),
      prisma.product.findMany({
        where: {
          id: { in: productIds },
          type: { in: ["STANDARD", "PIZZA_SINGLE"] },
        },
      }),
      getMinimumPizzaSizePrice(),
    ]);

    if (!category) {
      return NextResponse.json({ error: "No existe la categoría Destacados." }, { status: 400 });
    }
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "Uno o más productos no son válidos para un combo." }, { status: 400 });
    }

    const regularTotal = products.reduce((total, product) => total + regularProductPrice(product, minPizzaSizePrice), 0);
    if (finalPrice > regularTotal) {
      return NextResponse.json({ error: "El valor del combo no puede superar el valor normal de los productos." }, { status: 400 });
    }

    const sortOrder = await prisma.product.count({ where: { categoryId: category.id } });

    try {
      const combo = await prisma.$transaction(async (tx) => {
        const createdCombo = await tx.product.create({
          data: {
            categoryId: category.id,
            name,
            description: description || null,
            imageUrl: imageUrl || null,
            imageUrl2: imageUrl2 || null,
            type: "COMBO",
            basePrice: finalPrice,
            active: true,
            visibleInPos: true,
            featured: true,
            sortOrder,
          },
        });

        const group = await tx.comboGroup.create({
          data: {
            comboProductId: createdCombo.id,
            name: "Incluye",
            minSelections: products.length,
            maxSelections: products.length,
            sortOrder: 0,
          },
        });

        for (let index = 0; index < products.length; index += 1) {
          await tx.comboOption.create({
            data: {
              groupId: group.id,
              productId: products[index].id,
              quantity: 1,
              priceDelta: 0,
              sortOrder: index,
            },
          });
        }

        return createdCombo;
      });

      return NextResponse.json({
        combo: {
          ...combo,
          regularTotal,
          discount: Math.max(0, regularTotal - finalPrice),
          finalPrice,
        },
      }, { status: 201 });
    } catch (error) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2002") {
        return NextResponse.json({ error: "Ya existe un combo con ese nombre." }, { status: 409 });
      }
      throw error;
    }
  }

  const comboProductId = Number(body.comboProductId);
  const rawGroups: unknown[] = Array.isArray(body.groups) ? body.groups : [];

  if (!Number.isInteger(comboProductId)) {
    return NextResponse.json({ error: "Combo inválido." }, { status: 400 });
  }

  const combo = await prisma.product.findUnique({ where: { id: comboProductId } });
  if (!combo || combo.type !== "COMBO") {
    return NextResponse.json({ error: "El producto no es un combo." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.comboGroup.deleteMany({ where: { comboProductId } });

    for (let groupIndex = 0; groupIndex < rawGroups.length; groupIndex += 1) {
      const group = rawGroups[groupIndex] as {
        name?: unknown;
        minSelections?: unknown;
        maxSelections?: unknown;
        options?: unknown;
      };
      const rawOptions: unknown[] = Array.isArray(group.options) ? group.options : [];
      const createdGroup = await tx.comboGroup.create({
        data: {
          comboProductId,
          name: String(group.name || `Grupo ${groupIndex + 1}`),
          minSelections: Math.max(0, Number(group.minSelections) || 0),
          maxSelections: Math.max(1, Number(group.maxSelections) || 1),
          sortOrder: groupIndex,
        },
      });

      for (let optionIndex = 0; optionIndex < rawOptions.length; optionIndex += 1) {
        const option = rawOptions[optionIndex] as {
          productId?: unknown;
          quantity?: unknown;
          priceDelta?: unknown;
        };
        const productId = Number(option.productId);
        if (!Number.isInteger(productId)) continue;

        await tx.comboOption.create({
          data: {
            groupId: createdGroup.id,
            productId,
            quantity: Math.max(1, Number(option.quantity) || 1),
            priceDelta: Number(option.priceDelta) || 0,
            sortOrder: optionIndex,
          },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
