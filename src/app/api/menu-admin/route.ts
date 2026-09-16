import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [categories, sizes] = await Promise.all([
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
  ]);

  return NextResponse.json({
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      active: category.active,
      visibleInPos: category.visibleInPos,
      sortOrder: category.sortOrder,
      products: category.products.map((product) => ({
        id: product.id,
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        imageUrl2: product.imageUrl2,
        type: product.type,
        basePrice: product.basePrice == null ? null : Number(product.basePrice),
        active: product.active,
        visibleInPos: product.visibleInPos,
        featured: product.featured,
        sortOrder: product.sortOrder,
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
      })),
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

  if (body.action === "createIngredient") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    const price = Number(body.basePrice);

    if (!name) {
      return NextResponse.json({ error: "El nombre del ingrediente es obligatorio." }, { status: 400 });
    }

    const category = await prisma.category.findUnique({ where: { slug: "ingredientes" } });
    if (!category) {
      return NextResponse.json({ error: "No existe la categoría Ingredientes." }, { status: 400 });
    }

    try {
      const ingredient = await prisma.product.create({
        data: {
          categoryId: category.id,
          name,
          description: description || null,
          imageUrl: imageUrl || null,
          type: "MODIFIER",
          basePrice: Number.isFinite(price) && price >= 0 ? price : 5000,
          active: true,
          visibleInPos: false,
          featured: false,
          sortOrder: category.products?.length ?? 0,
        },
      });

      return NextResponse.json({
        ingredient: {
          ...ingredient,
          basePrice: ingredient.basePrice == null ? null : Number(ingredient.basePrice),
        },
      }, { status: 201 });
    } catch (error) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2002") {
        return NextResponse.json({ error: "Ya existe un ingrediente con ese nombre." }, { status: 409 });
      }
      throw error;
    }
  }

  const comboProductId = Number(body.comboProductId);
  const groups = Array.isArray(body.groups) ? body.groups : [];

  if (!Number.isInteger(comboProductId)) {
    return NextResponse.json({ error: "Combo inválido." }, { status: 400 });
  }

  const combo = await prisma.product.findUnique({ where: { id: comboProductId } });
  if (!combo || combo.type !== "COMBO") {
    return NextResponse.json({ error: "El producto no es un combo." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.comboGroup.deleteMany({ where: { comboProductId } });

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const options = Array.isArray(group.options) ? group.options : [];
      const createdGroup = await tx.comboGroup.create({
        data: {
          comboProductId,
          name: String(group.name || `Grupo ${groupIndex + 1}`),
          minSelections: Math.max(0, Number(group.minSelections) || 0),
          maxSelections: Math.max(1, Number(group.maxSelections) || 1),
          sortOrder: groupIndex,
        },
      });

      for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
        const option = options[optionIndex];
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
