import type {
  CustomPizzaMode,
  CustomPizzaOrderConfiguration,
} from "@/lib/orderConfiguration";
import { pizzaCrustPrice } from "@/lib/pizzaConfiguration";

export type CustomPizzaProduct = {
  id: number;
  name: string;
  type: string;
  basePrice: number | null;
};

export type CustomPizzaSize = {
  id: number;
  name: string;
  diameterCm: number;
  basePrice: number;
};

export type CustomPizzaCrust = {
  id: number;
  name: string;
  prices: Array<{ sizeId: number; price: number }>;
};

export type CustomPizzaIngredient = {
  id: number;
  name: string;
};

export type CustomPizzaDraftChoice = {
  sizeId: number | null;
  crustId: number | null;
  mode: CustomPizzaMode | null;
  wholeIngredientIds: number[];
  firstHalfIngredientIds: number[];
  secondHalfIngredientIds: number[];
};

function uniqueIds(values: number[]) {
  return [...new Set(values)];
}

function selectedIngredients(
  ids: number[],
  ingredients: CustomPizzaIngredient[],
) {
  const unique = uniqueIds(ids);
  return unique
    .map((id) => ingredients.find((item) => item.id === id))
    .filter((item): item is CustomPizzaIngredient => Boolean(item));
}

export function customPizzaBillableIngredientCount(
  draft: CustomPizzaDraftChoice,
) {
  if (draft.mode === "WHOLE") {
    return uniqueIds(draft.wholeIngredientIds).length;
  }

  if (draft.mode === "HALF_HALF") {
    return Math.max(
      uniqueIds(draft.firstHalfIngredientIds).length,
      uniqueIds(draft.secondHalfIngredientIds).length,
    );
  }

  return 0;
}

export function estimateCustomPizzaPrice(input: {
  product: CustomPizzaProduct;
  draft: CustomPizzaDraftChoice;
  sizes: CustomPizzaSize[];
  crusts: CustomPizzaCrust[];
}) {
  if (!input.draft.sizeId) return 0;

  const size = input.sizes.find((item) => item.id === input.draft.sizeId);
  if (!size) return 0;

  const crust = input.crusts.find((item) => item.id === input.draft.crustId);
  const crustPrice = crust
    ? pizzaCrustPrice(crust, size.id) ?? 0
    : 0;

  const ingredientUnitPrice = Math.max(
    0,
    Number(input.product.basePrice ?? 0),
  );

  return (
    size.basePrice +
    crustPrice +
    customPizzaBillableIngredientCount(input.draft) * ingredientUnitPrice
  );
}

export function buildCustomPizzaConfiguration(input: {
  product: CustomPizzaProduct;
  draft: CustomPizzaDraftChoice;
  sizes: CustomPizzaSize[];
  crusts: CustomPizzaCrust[];
  ingredients: CustomPizzaIngredient[];
}) {
  if (input.product.type !== "PIZZA_CUSTOM") {
    throw new Error("Este producto no usa el configurador Arma Tu Pizza.");
  }

  if (!input.draft.sizeId) {
    throw new Error("Selecciona el tamaño.");
  }

  if (!input.draft.crustId) {
    throw new Error("Selecciona el borde.");
  }

  if (!input.draft.mode) {
    throw new Error("Selecciona si la pizza es completa o mitad y mitad.");
  }

  const size = input.sizes.find((item) => item.id === input.draft.sizeId);
  const crust = input.crusts.find((item) => item.id === input.draft.crustId);

  if (!size || !crust) {
    throw new Error("La configuración seleccionada ya no está disponible.");
  }

  const selectedCrustPrice = pizzaCrustPrice(crust, size.id);
  if (selectedCrustPrice == null) {
    throw new Error("Ese borde no está disponible para este tamaño.");
  }

  const ingredientUnitPrice = Math.max(
    0,
    Number(input.product.basePrice ?? 0),
  );
  if (ingredientUnitPrice <= 0) {
    throw new Error("El precio por ingrediente no está configurado.");
  }

  const whole =
    input.draft.mode === "WHOLE"
      ? selectedIngredients(input.draft.wholeIngredientIds, input.ingredients)
      : [];
  const firstHalf =
    input.draft.mode === "HALF_HALF"
      ? selectedIngredients(
          input.draft.firstHalfIngredientIds,
          input.ingredients,
        )
      : [];
  const secondHalf =
    input.draft.mode === "HALF_HALF"
      ? selectedIngredients(
          input.draft.secondHalfIngredientIds,
          input.ingredients,
        )
      : [];

  const requestedIds =
    input.draft.mode === "WHOLE"
      ? uniqueIds(input.draft.wholeIngredientIds)
      : uniqueIds([
          ...input.draft.firstHalfIngredientIds,
          ...input.draft.secondHalfIngredientIds,
        ]);
  const resolvedIds = new Set(
    [...whole, ...firstHalf, ...secondHalf].map((item) => item.id),
  );

  if (requestedIds.some((id) => !resolvedIds.has(id))) {
    throw new Error("Uno de los ingredientes ya no está disponible.");
  }

  const billableIngredientCount =
    input.draft.mode === "WHOLE"
      ? whole.length
      : Math.max(firstHalf.length, secondHalf.length);

  const snapshot = (
    ingredient: CustomPizzaIngredient,
  ) => ({
    productId: ingredient.id,
    name: ingredient.name,
    unitPrice: ingredientUnitPrice,
  });

  const configuration: CustomPizzaOrderConfiguration = {
    schemaVersion: 1,
    kind: "PIZZA_CUSTOM",
    productId: input.product.id,
    productName: input.product.name,
    size: {
      id: size.id,
      name: size.name,
      diameterCm: size.diameterCm,
      basePrice: size.basePrice,
    },
    crust: {
      id: crust.id,
      name: crust.name,
      price: selectedCrustPrice,
    },
    mode: input.draft.mode,
    ingredientUnitPrice,
    wholeIngredients: whole.map(snapshot),
    firstHalfIngredients: firstHalf.map(snapshot),
    secondHalfIngredients: secondHalf.map(snapshot),
    billableIngredientCount,
  };

  const ingredientSummary =
    input.draft.mode === "WHOLE"
      ? whole.length
        ? whole.map((item) => item.name).join(", ")
        : "Sin ingredientes"
      : `Mitad 1: ${
          firstHalf.length
            ? firstHalf.map((item) => item.name).join(", ")
            : "sin ingredientes"
        } · Mitad 2: ${
          secondHalf.length
            ? secondHalf.map((item) => item.name).join(", ")
            : "sin ingredientes"
        }`;

  const summary = [
    size.name,
    `Borde ${crust.name}`,
    input.draft.mode === "WHOLE" ? "Completa" : "Mitad y mitad",
    ingredientSummary,
  ].join(" · ");

  return {
    configuration,
    summary,
    estimatedUnitPrice: estimateCustomPizzaPrice({
      product: input.product,
      draft: input.draft,
      sizes: input.sizes,
      crusts: input.crusts,
    }),
  };
}
