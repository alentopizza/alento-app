import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PRODUCT_CATEGORY_TYPES = {
  pizzas: "PIZZA_SINGLE",
  antojos: "STANDARD",
  bebidas: "STANDARD",
  ingredientes: "MODIFIER",
} as const;

async function ensureCombosCategory() {
  const category = await prisma.category.upsert({
    where: { slug: "combos" },
    update: { name: "Combos", active: true, visibleInPos: true, sortOrder: 5 },
    create: { name: "Combos", slug: "combos", active: true, visibleInPos: true, sortOrder: 5 },
  });

  await prisma.product.updateMany({
    where: { type: "COMBO", categoryId: { not: category.id } },
    data: { categoryId: category.id },
  });

  return category;
}

function regularProductPrice(product: { type: string; basePrice: unknown }, minPizzaSizePrice: number) {
  const basePrice = product.basePrice == null ? 0 : Number(product.basePrice);
  return product.type === "PIZZA_SINGLE" ? minPizzaSizePrice + basePrice : basePrice;
}

function uniqueIntegerArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item: unknown) => Number(item)).filter((item: number) => Number.isInteger(item)))];
}

export async function GET() {
  await ensureCombosCategory();

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
              include: { options: { orderBy: { sortOrder: "asc" }, include: { product: true } } },
            },
            comboPizzaRules: {
              orderBy: { sortOrder: "asc" },
              include: {
                sizes: { include: { size: true } },
                flavors: { include: { product: true } },
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
      where: { featured: true, type: { notIn: ["MODIFIER", "INTERNAL"] } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        comboGroups: { orderBy: { sortOrder: "asc" }, include: { options: { orderBy: { sortOrder: "asc" }, include: { product: true } } } },
        comboPizzaRules: {
          orderBy: { sortOrder: "asc" },
          include: { sizes: { include: { size: true } }, flavors: { include: { product: true } } },
        },
      },
    }),
  ]);

  const minPizzaSizePrice = sizes.length ? Math.min(...sizes.map((size) => Number(size.basePrice))) : 0;

  const serializeProduct = (product: (typeof featuredProducts)[number]) => {
    const storedBasePrice = product.basePrice == null ? null : Number(product.basePrice);
    const comboDiscount = product.comboDiscount == null ? 0 : Number(product.comboDiscount);
    let regularMin = 0;
    let regularMax = 0;

    if (product.type === "COMBO") {
      for (const rule of product.comboPizzaRules) {
        const sizePrices = rule.sizes.map((item) => Number(item.size.basePrice));
        const flavorPrices = rule.flavors.map((item) => Number(item.product.basePrice ?? 0));
        if (sizePrices.length && flavorPrices.length) {
          regularMin += (Math.min(...sizePrices) + Math.min(...flavorPrices)) * rule.quantity;
          regularMax += (Math.max(...sizePrices) + Math.max(...flavorPrices)) * rule.quantity;
        }
      }

      for (const group of product.comboGroups) {
        const prices = group.options.map((option) => regularProductPrice(option.product, minPizzaSizePrice));
        if (prices.length) {
          regularMin += Math.min(...prices) * group.minSelections;
          regularMax += Math.max(...prices) * group.maxSelections;
        }
      }
    }

    const comboFinalMin = product.type === "COMBO" ? Math.max(0, regularMin - comboDiscount) : null;
    const comboFinalMax = product.type === "COMBO" ? Math.max(0, regularMax - comboDiscount) : null;

    return {
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      imageUrl2: product.imageUrl2,
      type: product.type,
      basePrice: product.type === "COMBO" && comboFinalMin != null ? comboFinalMin : storedBasePrice,
      active: product.active,
      visibleInPos: product.visibleInPos,
      featured: product.featured,
      sortOrder: product.sortOrder,
      comboDiscount: product.type === "COMBO" ? comboDiscount : null,
      comboRegularMin: product.type === "COMBO" ? regularMin : null,
      comboRegularMax: product.type === "COMBO" ? regularMax : null,
      comboFinalMin,
      comboFinalMax,
      comboPizzaRules: product.comboPizzaRules.map((rule) => ({
        id: rule.id,
        quantity: rule.quantity,
        sizeIds: rule.sizes.map((item) => item.sizeId),
        flavorIds: rule.flavors.map((item) => item.productId),
      })),
      comboGroups: product.comboGroups.map((group) => ({
        id: group.id,
        kind: group.kind,
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
      products: category.slug === "destacados" ? featuredProducts.map(serializeProduct) : category.products.map(serializeProduct),
    })),
    sizes: sizes.map((size) => ({ id: size.id, name: size.name, diameterCm: size.diameterCm, basePrice: Number(size.basePrice) })),
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const productId = Number(body.productId);
  if (!Number.isInteger(productId)) return NextResponse.json({ error: "Producto inválido." }, { status: 400 });

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
      ...(body.basePrice === null || body.basePrice === "" ? { basePrice: null } : Number.isFinite(Number(body.basePrice)) ? { basePrice: Number(body.basePrice) } : {}),
    },
  });

  return NextResponse.json({ product: { ...product, basePrice: product.basePrice == null ? null : Number(product.basePrice) } });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const productId = Number(body.productId);
  if (!Number.isInteger(productId)) return NextResponse.json({ error: "Producto inválido." }, { status: 400 });

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      type: true,
      _count: {
        select: {
          orderItems: true,
          comboOptions: true,
          comboFlavorOptions: true,
        },
      },
    },
  });

  if (!product) return NextResponse.json({ error: "El producto ya no existe." }, { status: 404 });

  const hasOrderHistory = product._count.orderItems > 0;
  const usedByCombos = product._count.comboOptions > 0 || product._count.comboFlavorOptions > 0;

  if (hasOrderHistory || usedByCombos) {
    return NextResponse.json({
      error: hasOrderHistory
        ? "Este producto ya tiene historial de pedidos y no puede eliminarse. Desactívalo u ocúltalo del POS para conservar la integridad histórica."
        : "Este producto está siendo usado por uno o más combos. Retíralo primero de esos combos o desactívalo.",
      canDelete: false,
      dependencies: {
        orderItems: product._count.orderItems,
        comboOptions: product._count.comboOptions,
        comboFlavorOptions: product._count.comboFlavorOptions,
      },
    }, { status: 409 });
  }

  try {
    await prisma.product.delete({ where: { id: productId } });
    return NextResponse.json({ deleted: true, productId, name: product.name });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2003") {
      return NextResponse.json({ error: "El producto tiene relaciones activas y no puede eliminarse. Desactívalo en su lugar." }, { status: 409 });
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.action === "createProduct") {
    const categorySlug = typeof body.categorySlug === "string" ? body.categorySlug.trim() : "";
    const productType = PRODUCT_CATEGORY_TYPES[categorySlug as keyof typeof PRODUCT_CATEGORY_TYPES];
    if (!productType) return NextResponse.json({ error: "Categoría no permitida para crear productos." }, { status: 400 });

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    const imageUrl2 = typeof body.imageUrl2 === "string" ? body.imageUrl2.trim() : "";
    const basePrice = Number(body.basePrice);

    if (!name) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
    if (!Number.isFinite(basePrice) || basePrice < 0) return NextResponse.json({ error: "El precio debe ser válido." }, { status: 400 });

    const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
    if (!category) return NextResponse.json({ error: "No existe la categoría seleccionada." }, { status: 400 });
    const sortOrder = await prisma.product.count({ where: { categoryId: category.id } });

    try {
      const product = await prisma.product.create({
        data: { categoryId: category.id, name, description: description || null, imageUrl: imageUrl || null, imageUrl2: imageUrl2 || null, type: productType, basePrice, active: true, visibleInPos: productType !== "MODIFIER", featured: false, sortOrder },
      });
      return NextResponse.json({ product }, { status: 201 });
    } catch (error) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2002") return NextResponse.json({ error: "Ya existe un producto con ese nombre en la categoría." }, { status: 409 });
      throw error;
    }
  }

  if (body.action === "createCombo" || body.action === "saveCombo") {
    const comboProductId = Number(body.comboProductId);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    const imageUrl2 = typeof body.imageUrl2 === "string" ? body.imageUrl2.trim() : "";
    const discountAmount = Number(body.discountAmount);
    const pizzaQuantity = Math.max(0, Number(body.pizzaQuantity) || 0);
    const pizzaSizeIds = uniqueIntegerArray(body.pizzaSizeIds);
    const pizzaFlavorIds = uniqueIntegerArray(body.pizzaFlavorIds);
    const snackQuantity = Math.max(0, Number(body.snackQuantity) || 0);
    const snackProductIds = uniqueIntegerArray(body.snackProductIds);
    const beverageQuantity = Math.max(0, Number(body.beverageQuantity) || 0);
    const beverageProductIds = uniqueIntegerArray(body.beverageProductIds);

    if (body.action === "createCombo" && !name) return NextResponse.json({ error: "El nombre del combo es obligatorio." }, { status: 400 });
    if (!Number.isFinite(discountAmount) || discountAmount < 0) return NextResponse.json({ error: "El descuento debe ser un valor válido." }, { status: 400 });
    if (pizzaQuantity > 0 && (!pizzaSizeIds.length || !pizzaFlavorIds.length)) return NextResponse.json({ error: "Selecciona tamaños y sabores permitidos para la pizza." }, { status: 400 });
    if (snackQuantity > 0 && !snackProductIds.length) return NextResponse.json({ error: "Selecciona al menos un antojo permitido." }, { status: 400 });
    if (beverageQuantity > 0 && !beverageProductIds.length) return NextResponse.json({ error: "Selecciona al menos una bebida permitida." }, { status: 400 });
    if (pizzaQuantity + snackQuantity + beverageQuantity === 0) return NextResponse.json({ error: "El combo debe incluir al menos un componente." }, { status: 400 });

    const combosCategory = await ensureCombosCategory();

    const [sizes, flavors, snacks, beverages] = await Promise.all([
      prisma.pizzaSize.findMany({ where: { id: { in: pizzaSizeIds }, active: true } }),
      prisma.product.findMany({ where: { id: { in: pizzaFlavorIds }, type: "PIZZA_SINGLE", active: true } }),
      prisma.product.findMany({ where: { id: { in: snackProductIds }, category: { slug: "antojos" }, active: true } }),
      prisma.product.findMany({ where: { id: { in: beverageProductIds }, category: { slug: "bebidas" }, active: true } }),
    ]);

    if (pizzaQuantity > 0 && (sizes.length !== pizzaSizeIds.length || flavors.length !== pizzaFlavorIds.length)) return NextResponse.json({ error: "Hay tamaños o sabores inválidos en el combo." }, { status: 400 });
    if (snackQuantity > 0 && snacks.length !== snackProductIds.length) return NextResponse.json({ error: "Hay antojos inválidos en el combo." }, { status: 400 });
    if (beverageQuantity > 0 && beverages.length !== beverageProductIds.length) return NextResponse.json({ error: "Hay bebidas inválidas en el combo." }, { status: 400 });

    const sizePrices = sizes.map((item) => Number(item.basePrice));
    const flavorPrices = flavors.map((item) => Number(item.basePrice ?? 0));
    const snackPrices = snacks.map((item) => Number(item.basePrice ?? 0));
    const beveragePrices = beverages.map((item) => Number(item.basePrice ?? 0));

    let regularMin = 0;
    let regularMax = 0;
    if (pizzaQuantity > 0) {
      regularMin += (Math.min(...sizePrices) + Math.min(...flavorPrices)) * pizzaQuantity;
      regularMax += (Math.max(...sizePrices) + Math.max(...flavorPrices)) * pizzaQuantity;
    }
    if (snackQuantity > 0) {
      regularMin += Math.min(...snackPrices) * snackQuantity;
      regularMax += Math.max(...snackPrices) * snackQuantity;
    }
    if (beverageQuantity > 0) {
      regularMin += Math.min(...beveragePrices) * beverageQuantity;
      regularMax += Math.max(...beveragePrices) * beverageQuantity;
    }

    if (discountAmount > regularMin) return NextResponse.json({ error: "El descuento no puede superar el valor normal mínimo del combo." }, { status: 400 });

    const finalMin = Math.max(0, regularMin - discountAmount);
    const finalMax = Math.max(0, regularMax - discountAmount);

    try {
      const combo = await prisma.$transaction(async (tx) => {
        let productId = comboProductId;
        if (body.action === "createCombo") {
          const sortOrder = await tx.product.count({ where: { categoryId: combosCategory.id } });
          const created = await tx.product.create({
            data: { categoryId: combosCategory.id, name, description: description || null, imageUrl: imageUrl || null, imageUrl2: imageUrl2 || null, type: "COMBO", basePrice: finalMin, comboDiscount: discountAmount, active: true, visibleInPos: true, featured: true, sortOrder },
          });
          productId = created.id;
        } else {
          if (!Number.isInteger(productId)) throw new Error("Combo inválido.");
          await tx.product.update({
            where: { id: productId },
            data: { categoryId: combosCategory.id, basePrice: finalMin, comboDiscount: discountAmount, ...(name ? { name } : {}), description: description || null, imageUrl: imageUrl || null, imageUrl2: imageUrl2 || null },
          });
          await tx.comboPizzaRule.deleteMany({ where: { comboProductId: productId } });
          await tx.comboGroup.deleteMany({ where: { comboProductId: productId } });
        }

        if (pizzaQuantity > 0) {
          const rule = await tx.comboPizzaRule.create({ data: { comboProductId: productId, quantity: pizzaQuantity, sortOrder: 0 } });
          await tx.comboPizzaSizeOption.createMany({ data: pizzaSizeIds.map((sizeId) => ({ ruleId: rule.id, sizeId })) });
          await tx.comboPizzaFlavorOption.createMany({ data: pizzaFlavorIds.map((pizzaProductId) => ({ ruleId: rule.id, productId: pizzaProductId })) });
        }

        if (snackQuantity > 0) {
          const group = await tx.comboGroup.create({ data: { comboProductId: productId, kind: "ANTOJO", name: "Antojo", minSelections: snackQuantity, maxSelections: snackQuantity, sortOrder: 1 } });
          await tx.comboOption.createMany({ data: snackProductIds.map((productId) => ({ groupId: group.id, productId, quantity: 1, priceDelta: 0 })) });
        }

        if (beverageQuantity > 0) {
          const group = await tx.comboGroup.create({ data: { comboProductId: productId, kind: "BEBIDA", name: "Bebida", minSelections: beverageQuantity, maxSelections: beverageQuantity, sortOrder: 2 } });
          await tx.comboOption.createMany({ data: beverageProductIds.map((productId) => ({ groupId: group.id, productId, quantity: 1, priceDelta: 0 })) });
        }

        return tx.product.findUniqueOrThrow({ where: { id: productId } });
      });

      return NextResponse.json({ combo: { ...combo, regularMin, regularMax, discountAmount, finalMin, finalMax } }, { status: body.action === "createCombo" ? 201 : 200 });
    } catch (error) {
      const prismaError = error as { code?: string; message?: string };
      if (prismaError.code === "P2002") return NextResponse.json({ error: "Ya existe un combo con ese nombre." }, { status: 409 });
      return NextResponse.json({ error: prismaError.message || "No fue posible guardar el combo." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
}
