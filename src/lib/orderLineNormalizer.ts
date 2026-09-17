import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRecord } from "@/lib/orderConfiguration";

export type OrderLineInput = {
  productId: number;
  quantity: number;
  configuration?: unknown;
};

export type NormalizedOrderLine = {
  product: Awaited<ReturnType<typeof prisma.product.findUnique>> & {
    id: number;
    name: string;
    type: string;
    couponEligible: boolean;
  };
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  eligible: boolean;
  configuration: Prisma.InputJsonValue;
};

function money(value: number) {
  return Math.round(value);
}

function numberId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function positiveQuantity(value: unknown, fallback = 1) {
  const parsed = Math.floor(Number(value ?? fallback));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function normalizeStandardLine(
  product: NonNullable<Awaited<ReturnType<typeof prisma.product.findUnique>>>,
  quantity: number,
): Promise<NormalizedOrderLine> {
  if (product.basePrice == null) throw new Error(`${product.name} no tiene precio configurado.`);
  const unitPrice = money(Number(product.basePrice));
  return {
    product: product as NormalizedOrderLine["product"],
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
    eligible: product.type !== "COMBO" && product.couponEligible,
    configuration: {
      schemaVersion: 1,
      kind: "STANDARD",
      productId: product.id,
      productName: product.name,
    },
  };
}

async function normalizePizzaLine(
  product: NonNullable<Awaited<ReturnType<typeof prisma.product.findUnique>>>,
  quantity: number,
  configuration: unknown,
): Promise<NormalizedOrderLine> {
  if (!isRecord(configuration) || String(configuration.kind).toUpperCase() !== "PIZZA") {
    throw new Error(`${product.name} necesita configuración estructurada de pizza.`);
  }

  const sizeRaw = isRecord(configuration.size) ? configuration.size : null;
  const sizeId = numberId(sizeRaw?.id);
  if (!sizeId) throw new Error(`${product.name}: tamaño inválido.`);
  const size = await prisma.pizzaSize.findFirst({ where: { id: sizeId, active: true } });
  if (!size) throw new Error(`${product.name}: el tamaño seleccionado ya no está disponible.`);

  const flavorsRaw = Array.isArray(configuration.flavors) ? configuration.flavors : [];
  const expectedFlavorCount = product.type === "PIZZA_TWO_FLAVORS" ? 2 : 1;
  if (flavorsRaw.length !== expectedFlavorCount) throw new Error(`${product.name}: cantidad de sabores inválida.`);

  const flavorIds = flavorsRaw.map((flavor) => isRecord(flavor) ? numberId(flavor.productId) : null);
  if (flavorIds.some((id) => !id)) throw new Error(`${product.name}: sabor inválido.`);
  if (new Set(flavorIds).size !== flavorIds.length) throw new Error(`${product.name}: los sabores deben ser diferentes.`);

  const flavors = await prisma.product.findMany({
    where: { id: { in: flavorIds as number[] }, active: true, visibleInPos: true, type: "PIZZA_SINGLE" },
  });
  if (flavors.length !== flavorIds.length) throw new Error(`${product.name}: uno de los sabores ya no está disponible.`);
  if (product.type === "PIZZA_SINGLE" && flavorIds[0] !== product.id) throw new Error(`${product.name}: el sabor no corresponde al producto.`);

  const crustRaw = isRecord(configuration.crust) ? configuration.crust : null;
  const crustId = numberId(crustRaw?.id);
  if (!crustId) throw new Error(`${product.name}: borde inválido.`);
  const crust = await prisma.pizzaCrust.findFirst({
    where: { id: crustId, active: true },
    include: { prices: { where: { sizeId: size.id } } },
  });
  if (!crust || !crust.prices[0]) throw new Error(`${product.name}: el borde no tiene precio para ese tamaño.`);
  const crustPrice = money(Number(crust.prices[0].price));

  const modifiersRaw = Array.isArray(configuration.modifiers) ? configuration.modifiers : [];
  const modifierIds = modifiersRaw.map((modifier) => isRecord(modifier) ? numberId(modifier.productId) : null);
  if (modifierIds.some((id) => !id)) throw new Error(`${product.name}: ingrediente extra inválido.`);
  const uniqueModifierIds = [...new Set(modifierIds as number[])];
  const modifiers = uniqueModifierIds.length
    ? await prisma.product.findMany({ where: { id: { in: uniqueModifierIds }, active: true, type: "MODIFIER" } })
    : [];
  if (modifiers.length !== uniqueModifierIds.length) throw new Error(`${product.name}: uno de los ingredientes extra ya no está disponible.`);

  const modifierSnapshots = modifiersRaw.map((raw) => {
    const record = raw as Record<string, unknown>;
    const id = numberId(record.productId)!;
    const modifier = modifiers.find((item) => item.id === id)!;
    const modifierQuantity = positiveQuantity(record.quantity, 1);
    const modifierPrice = money(Number(modifier.basePrice ?? 0));
    return { productId: modifier.id, name: modifier.name, quantity: modifierQuantity, unitPrice: modifierPrice };
  });

  const flavorSnapshots = flavorIds.map((id, index) => {
    const flavor = flavors.find((item) => item.id === id)!;
    return {
      productId: flavor.id,
      name: flavor.name,
      portion: expectedFlavorCount === 2 ? 0.5 : 1,
      basePrice: money(Number(flavor.basePrice ?? 0)),
      position: index + 1,
    };
  });

  const flavorPrice = Math.max(...flavorSnapshots.map((flavor) => flavor.basePrice));
  const modifiersPrice = modifierSnapshots.reduce((sum, modifier) => sum + modifier.unitPrice * modifier.quantity, 0);
  const unitPrice = money(Number(size.basePrice)) + flavorPrice + crustPrice + modifiersPrice;

  return {
    product: product as NormalizedOrderLine["product"],
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
    eligible: product.couponEligible,
    configuration: {
      schemaVersion: 1,
      kind: "PIZZA",
      productId: product.id,
      productName: product.name,
      size: { id: size.id, name: size.name, diameterCm: size.diameterCm, basePrice: money(Number(size.basePrice)) },
      flavors: flavorSnapshots,
      crust: { id: crust.id, name: crust.name, price: crustPrice },
      modifiers: modifierSnapshots,
    },
  };
}

async function normalizeComboLine(
  product: NonNullable<Awaited<ReturnType<typeof prisma.product.findUnique>>>,
  quantity: number,
  configuration: unknown,
): Promise<NormalizedOrderLine> {
  if (!isRecord(configuration) || String(configuration.kind).toUpperCase() !== "COMBO") {
    throw new Error(`${product.name} necesita configuración estructurada de combo.`);
  }

  const combo = await prisma.product.findFirst({
    where: { id: product.id, active: true, type: "COMBO" },
    include: {
      comboPizzaRules: {
        orderBy: { sortOrder: "asc" },
        include: { sizes: { include: { size: true } }, flavors: { include: { product: true } } },
      },
      comboGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" }, include: { product: true } } },
      },
    },
  });
  if (!combo) throw new Error(`${product.name} ya no está disponible.`);

  const pizzasRaw = Array.isArray(configuration.pizzas) ? configuration.pizzas : [];
  const expectedPizzaCount = combo.comboPizzaRules.reduce((sum, rule) => sum + rule.quantity, 0);
  if (pizzasRaw.length !== expectedPizzaCount) throw new Error(`${product.name}: la cantidad de pizzas del combo no coincide.`);

  const pizzaSnapshots: Prisma.InputJsonObject[] = [];
  let regularPrice = 0;
  let pizzaCursor = 0;
  for (const rule of combo.comboPizzaRules) {
    for (let index = 0; index < rule.quantity; index += 1) {
      const raw = pizzasRaw[pizzaCursor++];
      if (!isRecord(raw)) throw new Error(`${product.name}: pizza de combo inválida.`);
      const rawSize = isRecord(raw.size) ? raw.size : raw;
      const rawFlavor = isRecord(raw.flavor) ? raw.flavor : raw;
      const sizeId = numberId(rawSize.id ?? raw.sizeId);
      const flavorId = numberId(rawFlavor.productId ?? raw.flavorId);
      const sizeOption = rule.sizes.find((item) => item.sizeId === sizeId);
      const flavorOption = rule.flavors.find((item) => item.productId === flavorId);
      if (!sizeOption || !flavorOption || !sizeOption.size.active || !flavorOption.product.active) {
        throw new Error(`${product.name}: una pizza contiene tamaño o sabor no permitido.`);
      }
      const sizePrice = money(Number(sizeOption.size.basePrice));
      const flavorPrice = money(Number(flavorOption.product.basePrice ?? 0));
      regularPrice += sizePrice + flavorPrice;
      pizzaSnapshots.push({
        ruleId: rule.id,
        size: { id: sizeOption.size.id, name: sizeOption.size.name, diameterCm: sizeOption.size.diameterCm, basePrice: sizePrice },
        flavor: { productId: flavorOption.product.id, name: flavorOption.product.name, portion: 1, basePrice: flavorPrice },
      });
    }
  }

  const groupsRaw = Array.isArray(configuration.groups) ? configuration.groups : [];
  const groupSnapshots: Prisma.InputJsonObject[] = [];
  for (const group of combo.comboGroups) {
    const rawGroup = groupsRaw.find((raw) => isRecord(raw) && Number(raw.groupId) === group.id);
    const selectionsRaw = rawGroup && isRecord(rawGroup) && Array.isArray(rawGroup.selections) ? rawGroup.selections : [];
    if (selectionsRaw.length < group.minSelections || selectionsRaw.length > group.maxSelections) {
      throw new Error(`${product.name}: selección inválida en ${group.name}.`);
    }
    const selectionSnapshots: Prisma.InputJsonObject[] = [];
    for (const rawSelection of selectionsRaw) {
      if (!isRecord(rawSelection)) throw new Error(`${product.name}: opción de combo inválida.`);
      const productId = numberId(rawSelection.productId);
      const option = group.options.find((item) => item.productId === productId);
      if (!option || !option.product.active) throw new Error(`${product.name}: una opción de ${group.name} ya no está permitida.`);
      const optionQuantity = positiveQuantity(option.quantity, 1);
      const unitPrice = money(Number(option.product.basePrice ?? 0));
      const priceDelta = money(Number(option.priceDelta));
      regularPrice += (unitPrice + priceDelta) * optionQuantity;
      selectionSnapshots.push({
        optionId: option.id,
        productId: option.product.id,
        name: option.product.name,
        quantity: optionQuantity,
        unitPrice,
        priceDelta,
      });
    }
    groupSnapshots.push({ groupId: group.id, kind: group.kind, name: group.name, selections: selectionSnapshots });
  }

  const comboDiscount = money(Number(combo.comboDiscount ?? 0));
  const unitPrice = Math.max(0, regularPrice - comboDiscount);
  return {
    product: product as NormalizedOrderLine["product"],
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
    eligible: false,
    configuration: {
      schemaVersion: 1,
      kind: "COMBO",
      comboProductId: combo.id,
      comboName: combo.name,
      comboDiscount,
      pizzas: pizzaSnapshots,
      groups: groupSnapshots,
    },
  };
}

export async function normalizeOrderLine(line: OrderLineInput): Promise<NormalizedOrderLine> {
  const product = await prisma.product.findUnique({ where: { id: Number(line.productId) } });
  if (!product || !product.active || !product.visibleInPos) throw new Error("Uno de los productos ya no está disponible.");
  const quantity = positiveQuantity(line.quantity, 1);

  if (product.type === "PIZZA_SINGLE" || product.type === "PIZZA_TWO_FLAVORS") {
    return normalizePizzaLine(product, quantity, line.configuration);
  }
  if (product.type === "COMBO") {
    return normalizeComboLine(product, quantity, line.configuration);
  }
  return normalizeStandardLine(product, quantity);
}
