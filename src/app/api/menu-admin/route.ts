import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const categories = await prisma.category.findMany({
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
  });

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
