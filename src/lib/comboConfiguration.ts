import type { ComboOrderConfiguration } from "@/lib/orderConfiguration";

export type ComboDraftChoice = {
  ruleId: number;
  sizeId: number | null;
  flavorCount: 1 | 2;
  firstFlavorId: number | null;
  secondFlavorId: number | null;
};

export type ComboCatalogSize = {
  id: number;
  name: string;
  diameterCm: number;
  basePrice: number;
};

export type ComboCatalogFlavor = {
  id: number;
  name: string;
  basePrice: number;
};

export type ComboCatalogRule = {
  id: number;
  quantity: number;
  sizes: ComboCatalogSize[];
  flavors: ComboCatalogFlavor[];
};

export type ComboCatalogOption = {
  id: number;
  productId: number;
  productName: string;
  basePrice: number;
  quantity: number;
  priceDelta: number;
};

export type ComboCatalogGroup = {
  id: number;
  kind: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: ComboCatalogOption[];
};

export type ComboCatalogProduct = {
  id: number;
  name: string;
  comboDiscount?: number;
  comboPizzaRules?: ComboCatalogRule[];
  comboGroups?: ComboCatalogGroup[];
};

export function createComboDraft(product: ComboCatalogProduct) {
  const pizzas: ComboDraftChoice[] = [];

  for (const rule of product.comboPizzaRules ?? []) {
    for (let index = 0; index < rule.quantity; index += 1) {
      pizzas.push({
        ruleId: rule.id,
        sizeId: rule.sizes[0]?.id ?? null,
        flavorCount: 1,
        firstFlavorId: rule.flavors[0]?.id ?? null,
        secondFlavorId: null,
      });
    }
  }

  const groupSelections: Record<number, number[]> = {};
  for (const group of product.comboGroups ?? []) {
    groupSelections[group.id] = group.options
      .slice(0, group.minSelections)
      .map((option) => option.productId);
  }

  return { pizzas, groupSelections };
}

export function estimateComboPrice(input: {
  product: ComboCatalogProduct;
  pizzas: ComboDraftChoice[];
  groupSelections: Record<number, number[]>;
}) {
  let regular = 0;

  for (const choice of input.pizzas) {
    const rule = input.product.comboPizzaRules?.find(
      (item) => item.id === choice.ruleId,
    );
    if (!rule) continue;

    const sizePrice =
      rule.sizes.find((item) => item.id === choice.sizeId)?.basePrice ?? 0;
    const flavorIds =
      choice.flavorCount === 2
        ? [choice.firstFlavorId, choice.secondFlavorId]
        : [choice.firstFlavorId];
    const flavorPrices = flavorIds.map(
      (id) =>
        rule.flavors.find((item) => item.id === id)?.basePrice ?? 0,
    );

    regular +=
      sizePrice +
      (flavorPrices.length ? Math.max(...flavorPrices) : 0);
  }

  for (const group of input.product.comboGroups ?? []) {
    for (const productId of input.groupSelections[group.id] ?? []) {
      const option = group.options.find(
        (item) => item.productId === productId,
      );
      if (option) {
        regular +=
          (option.basePrice + option.priceDelta) *
          Math.max(1, option.quantity);
      }
    }
  }

  return Math.max(0, regular - (input.product.comboDiscount ?? 0));
}

export function buildComboConfiguration(input: {
  product: ComboCatalogProduct;
  pizzas: ComboDraftChoice[];
  groupSelections: Record<number, number[]>;
}) {
  if (
    input.pizzas.some(
      (pizza) =>
        !pizza.sizeId ||
        !pizza.firstFlavorId ||
        (pizza.flavorCount === 2 && !pizza.secondFlavorId),
    )
  ) {
    throw new Error("Completa todas las pizzas del combo.");
  }

  if (
    input.pizzas.some(
      (pizza) =>
        pizza.flavorCount === 2 &&
        pizza.firstFlavorId === pizza.secondFlavorId,
    )
  ) {
    throw new Error("Los dos sabores de una pizza deben ser diferentes.");
  }

  for (const group of input.product.comboGroups ?? []) {
    const count = (input.groupSelections[group.id] ?? []).length;
    if (count < group.minSelections || count > group.maxSelections) {
      throw new Error(`Completa la selección de ${group.name}.`);
    }
  }

  const pizzas: ComboOrderConfiguration["pizzas"] = input.pizzas.map(
    (choice) => {
      const rule = input.product.comboPizzaRules?.find(
        (item) => item.id === choice.ruleId,
      );
      if (!rule) {
        throw new Error(
          "Una regla del combo ya no está disponible. Vuelve a seleccionar el combo.",
        );
      }

      const size = rule.sizes.find(
        (item) => item.id === choice.sizeId,
      );
      const flavorIds =
        choice.flavorCount === 2
          ? [choice.firstFlavorId!, choice.secondFlavorId!]
          : [choice.firstFlavorId!];
      const selectedFlavors = flavorIds.map((flavorId) =>
        rule.flavors.find((item) => item.id === flavorId),
      );

      if (!size || selectedFlavors.some((flavor) => !flavor)) {
        throw new Error(
          "Un tamaño o sabor del combo ya no está disponible.",
        );
      }

      const flavors = selectedFlavors.map((flavor) => ({
        productId: flavor!.id,
        name: flavor!.name,
        portion: choice.flavorCount === 2 ? 0.5 : 1,
        basePrice: flavor!.basePrice,
      }));

      return {
        ruleId: rule.id,
        size: {
          id: size.id,
          name: size.name,
          diameterCm: size.diameterCm,
          basePrice: size.basePrice,
        },
        flavor: flavors[0],
        flavors,
      };
    },
  );

  const groups: ComboOrderConfiguration["groups"] = [];
  for (const group of input.product.comboGroups ?? []) {
    const selections: ComboOrderConfiguration["groups"][number]["selections"] =
      [];

    for (const productId of input.groupSelections[group.id] ?? []) {
      const option = group.options.find(
        (item) => item.productId === productId,
      );
      if (!option) {
        throw new Error(
          `Una opción de ${group.name} ya no está disponible.`,
        );
      }

      selections.push({
        optionId: option.id,
        productId: option.productId,
        name: option.productName,
        quantity: Math.max(1, option.quantity),
        unitPrice: option.basePrice,
        priceDelta: option.priceDelta,
      });
    }

    groups.push({
      groupId: group.id,
      kind: group.kind,
      name: group.name,
      selections,
    });
  }

  const configuration: ComboOrderConfiguration = {
    schemaVersion: 1,
    kind: "COMBO",
    comboProductId: input.product.id,
    comboName: input.product.name,
    comboDiscount: input.product.comboDiscount ?? 0,
    pizzas,
    groups,
  };

  const summary = [
    ...pizzas.map((pizza, index) => {
      const flavors = pizza.flavors?.length
        ? pizza.flavors
        : [pizza.flavor];
      const flavorText =
        flavors.length > 1
          ? flavors
              .map((flavor) => `½ ${flavor.name}`)
              .join(" + ")
          : flavors[0]?.name ?? "";
      return `Pizza ${index + 1}: ${pizza.size.name} ${flavorText}`;
    }),
    ...groups.map(
      (group) =>
        `${group.name}: ${group.selections
          .map((selection) =>
            `${selection.quantity > 1 ? `${selection.quantity}× ` : ""}${selection.name}`,
          )
          .join(", ")}`,
    ),
  ].join(" · ");

  return {
    configuration,
    summary,
    estimatedUnitPrice: estimateComboPrice(input),
  };
}
