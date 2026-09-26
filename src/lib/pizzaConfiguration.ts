import type { PizzaOrderConfiguration } from "@/lib/orderConfiguration";

export type PizzaConfigProduct = {
  id: number;
  name: string;
  type: string;
  basePrice: number | null;
};

export type PizzaConfigSize = {
  id: number;
  name: string;
  diameterCm: number;
  basePrice: number;
};

export type PizzaConfigFlavor = {
  id: number;
  name: string;
  basePrice: number | null;
};

export type PizzaConfigCrust = {
  id: number;
  name: string;
  prices: Array<{ sizeId: number; price: number }>;
};

export type PizzaConfigModifier = {
  id: number;
  name: string;
  basePrice: number;
};

export type PizzaDraftChoice = {
  sizeId: number | null;
  firstFlavorId: number | null;
  secondFlavorId: number | null;
  crustId: number | null;
  modifierIds: number[];
};

export function isTwoFlavorPizzaProduct(product: PizzaConfigProduct) {
  return (
    product.type === "PIZZA_TWO_FLAVORS" ||
    product.name.toLocaleLowerCase("es").includes("2 sabores")
  );
}

export function pizzaCrustPrice(
  crust: PizzaConfigCrust,
  sizeId: number | null,
) {
  if (!sizeId) return null;
  return crust.prices.find((price) => price.sizeId === sizeId)?.price ?? null;
}

export function estimatePizzaPrice(input: {
  product: PizzaConfigProduct;
  draft: PizzaDraftChoice;
  sizes: PizzaConfigSize[];
  flavors: PizzaConfigFlavor[];
  crusts: PizzaConfigCrust[];
  modifiers: PizzaConfigModifier[];
}) {
  if (!input.draft.sizeId) return 0;

  const size = input.sizes.find(
    (item) => item.id === input.draft.sizeId,
  );
  if (!size) return 0;

  const twoFlavors = isTwoFlavorPizzaProduct(input.product);
  const flavorIds = twoFlavors
    ? [input.draft.firstFlavorId, input.draft.secondFlavorId]
    : [input.product.id];
  const flavorPrices = flavorIds.map(
    (id) =>
      input.flavors.find((flavor) => flavor.id === id)?.basePrice ?? 0,
  );
  const crust = input.crusts.find(
    (item) => item.id === input.draft.crustId,
  );
  const crustPrice = crust
    ? pizzaCrustPrice(crust, size.id) ?? 0
    : 0;
  const modifiersPrice = twoFlavors
    ? 0
    : input.modifiers
        .filter((item) =>
          input.draft.modifierIds.includes(item.id),
        )
        .reduce((sum, item) => sum + item.basePrice, 0);

  return (
    size.basePrice +
    Math.max(0, ...flavorPrices) +
    crustPrice +
    modifiersPrice
  );
}

export function buildPizzaConfiguration(input: {
  product: PizzaConfigProduct;
  draft: PizzaDraftChoice;
  sizes: PizzaConfigSize[];
  flavors: PizzaConfigFlavor[];
  crusts: PizzaConfigCrust[];
  modifiers: PizzaConfigModifier[];
}) {
  if (!input.draft.sizeId) {
    throw new Error("Selecciona el tamaño.");
  }
  if (!input.draft.crustId) {
    throw new Error("Selecciona el borde.");
  }

  const size = input.sizes.find(
    (item) => item.id === input.draft.sizeId,
  );
  const crust = input.crusts.find(
    (item) => item.id === input.draft.crustId,
  );

  if (!size || !crust) {
    throw new Error(
      "La configuración seleccionada ya no está disponible.",
    );
  }

  const selectedCrustPrice = pizzaCrustPrice(crust, size.id);
  if (selectedCrustPrice == null) {
    throw new Error(
      "Ese borde no está disponible para este tamaño.",
    );
  }

  const twoFlavors = isTwoFlavorPizzaProduct(input.product);
  if (
    twoFlavors &&
    (!input.draft.firstFlavorId || !input.draft.secondFlavorId)
  ) {
    throw new Error("Selecciona los dos sabores.");
  }
  if (
    twoFlavors &&
    input.draft.firstFlavorId === input.draft.secondFlavorId
  ) {
    throw new Error("Los dos sabores deben ser diferentes.");
  }

  const flavorIds = twoFlavors
    ? [input.draft.firstFlavorId!, input.draft.secondFlavorId!]
    : [input.product.id];
  const selectedFlavors = flavorIds
    .map((id) => input.flavors.find((item) => item.id === id))
    .filter((item): item is PizzaConfigFlavor => Boolean(item));

  if (selectedFlavors.length !== flavorIds.length) {
    throw new Error("Uno de los sabores ya no está disponible.");
  }

  const selectedModifiers = twoFlavors
    ? []
    : input.modifiers.filter((modifier) =>
        input.draft.modifierIds.includes(modifier.id),
      );

  const configuration: PizzaOrderConfiguration = {
    schemaVersion: 1,
    kind: "PIZZA",
    productId: input.product.id,
    productName: input.product.name,
    size: {
      id: size.id,
      name: size.name,
      diameterCm: size.diameterCm,
      basePrice: size.basePrice,
    },
    flavors: selectedFlavors.map((flavor) => ({
      productId: flavor.id,
      name: flavor.name,
      portion: twoFlavors ? 0.5 : 1,
      basePrice: flavor.basePrice ?? 0,
    })),
    crust: {
      id: crust.id,
      name: crust.name,
      price: selectedCrustPrice,
    },
    modifiers: selectedModifiers.map((modifier) => ({
      productId: modifier.id,
      name: modifier.name,
      quantity: 1,
      unitPrice: modifier.basePrice,
    })),
  };

  const summary = [
    size.name,
    twoFlavors
      ? selectedFlavors
          .map((flavor) => `½ ${flavor.name}`)
          .join(" + ")
      : selectedFlavors[0]?.name,
    `Borde ${crust.name}`,
    ...selectedModifiers.map(
      (modifier) => `+ ${modifier.name}`,
    ),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    configuration,
    summary,
    estimatedUnitPrice: estimatePizzaPrice(input),
  };
}
