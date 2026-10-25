export type PizzaFlavorSnapshot = {
  productId: number;
  name: string;
  portion: number;
  basePrice: number;
};

export type PizzaModifierSnapshot = {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type PizzaOrderConfiguration = {
  schemaVersion: 1;
  kind: "PIZZA";
  productId: number;
  productName: string;
  size: {
    id: number;
    name: string;
    diameterCm: number;
    basePrice: number;
  };
  flavors: PizzaFlavorSnapshot[];
  crust: {
    id: number;
    name: string;
    price: number;
  };
  modifiers: PizzaModifierSnapshot[];
};


export type CustomPizzaMode = "WHOLE" | "HALF_HALF";

export type CustomPizzaIngredientSnapshot = {
  productId: number;
  name: string;
  unitPrice: number;
};

export type CustomPizzaOrderConfiguration = {
  schemaVersion: 1;
  kind: "PIZZA_CUSTOM";
  productId: number;
  productName: string;
  size: {
    id: number;
    name: string;
    diameterCm: number;
    basePrice: number;
  };
  crust: {
    id: number;
    name: string;
    price: number;
  };
  mode: CustomPizzaMode;
  ingredientUnitPrice: number;
  wholeIngredients: CustomPizzaIngredientSnapshot[];
  firstHalfIngredients: CustomPizzaIngredientSnapshot[];
  secondHalfIngredients: CustomPizzaIngredientSnapshot[];
  billableIngredientCount: number;
};

export type ComboPizzaSnapshot = {
  ruleId: number;
  size: {
    id: number;
    name: string;
    diameterCm: number;
    basePrice: number;
  };
  // Se conserva "flavor" para compatibilidad con pedidos históricos y
  // consumidores antiguos. Los combos creados desde el POS también pueden
  // guardar "flavors" con una o dos mitades.
  flavor: PizzaFlavorSnapshot;
  flavors?: PizzaFlavorSnapshot[];
};

export type ComboSelectionSnapshot = {
  optionId: number;
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  priceDelta: number;
};

export type ComboGroupSnapshot = {
  groupId: number;
  kind: string;
  name: string;
  selections: ComboSelectionSnapshot[];
};

export type ComboOrderConfiguration = {
  schemaVersion: 1;
  kind: "COMBO";
  comboProductId: number;
  comboName: string;
  comboDiscount: number;
  pizzas: ComboPizzaSnapshot[];
  groups: ComboGroupSnapshot[];
};

export type StandardOrderConfiguration = {
  schemaVersion: 1;
  kind: "STANDARD";
  productId: number;
  productName: string;
};

export type OrderLineConfiguration =
  | PizzaOrderConfiguration
  | CustomPizzaOrderConfiguration
  | ComboOrderConfiguration
  | StandardOrderConfiguration;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function configurationKind(value: unknown) {
  if (!isRecord(value)) return null;
  return typeof value.kind === "string" ? value.kind.toUpperCase() : null;
}
