import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  productFindUnique: vi.fn(),
  productFindMany: vi.fn(),
  productFindFirst: vi.fn(),
  pizzaSizeFindFirst: vi.fn(),
  pizzaCrustFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findUnique: mocks.productFindUnique,
      findMany: mocks.productFindMany,
      findFirst: mocks.productFindFirst,
    },
    pizzaSize: {
      findFirst: mocks.pizzaSizeFindFirst,
    },
    pizzaCrust: {
      findFirst: mocks.pizzaCrustFindFirst,
    },
  },
}));

import { normalizeOrderLine } from "@/lib/orderLineNormalizer";

const standardProduct = {
  id: 1,
  name: "Gaseosa",
  type: "STANDARD",
  basePrice: 4_500,
  active: true,
  visibleInPos: true,
  couponEligible: true,
};

const customPizzaProduct = {
  id: 10,
  name: "Arma Tu Pizza",
  type: "PIZZA_CUSTOM",
  basePrice: null,
  active: true,
  visibleInPos: true,
  couponEligible: true,
};

const size = {
  id: 20,
  name: "Personal",
  diameterCm: 22,
  basePrice: 14_900,
  active: true,
};

const crust = {
  id: 30,
  name: "Queso",
  active: true,
  prices: [{ price: 3_000 }],
};

describe("normalización canónica de líneas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recalcula un producto estándar desde el catálogo y no desde el cliente", async () => {
    mocks.productFindUnique.mockResolvedValue(standardProduct);

    const result = await normalizeOrderLine({
      productId: standardProduct.id,
      quantity: 2,
    });

    expect(result.unitPrice).toBe(4_500);
    expect(result.lineTotal).toBe(9_000);
    expect(result.eligible).toBe(true);
    expect(result.configuration).toEqual({
      schemaVersion: 1,
      kind: "STANDARD",
      productId: 1,
      productName: "Gaseosa",
    });
  });

  it("respeta couponEligible=false incluso en un producto estándar", async () => {
    mocks.productFindUnique.mockResolvedValue({
      ...standardProduct,
      couponEligible: false,
    });

    const result = await normalizeOrderLine({
      productId: standardProduct.id,
      quantity: 1,
    });

    expect(result.eligible).toBe(false);
  });

  it("rechaza productos inactivos o que ya no son visibles en POS", async () => {
    mocks.productFindUnique.mockResolvedValue({
      ...standardProduct,
      active: false,
    });

    await expect(
      normalizeOrderLine({
        productId: standardProduct.id,
        quantity: 1,
      }),
    ).rejects.toThrow("Uno de los productos ya no está disponible.");
  });

  it("Arma Tu Pizza cobra la mitad con más ingredientes", async () => {
    mocks.productFindUnique.mockResolvedValue(customPizzaProduct);
    mocks.pizzaSizeFindFirst.mockResolvedValue(size);
    mocks.pizzaCrustFindFirst.mockResolvedValue(crust);
    mocks.productFindMany.mockResolvedValue([
      {
        id: 101,
        name: "Pepperoni",
        basePrice: 2_000,
        active: true,
        type: "MODIFIER",
      },
      {
        id: 102,
        name: "Jamón",
        basePrice: 1_500,
        active: true,
        type: "MODIFIER",
      },
      {
        id: 103,
        name: "Pollo",
        basePrice: 2_500,
        active: true,
        type: "MODIFIER",
      },
    ]);

    const result = await normalizeOrderLine({
      productId: customPizzaProduct.id,
      quantity: 2,
      configuration: {
        kind: "PIZZA_CUSTOM",
        size: { id: size.id },
        crust: { id: crust.id },
        mode: "HALF_HALF",
        firstHalfIngredients: [
          { productId: 101 },
          { productId: 102 },
        ],
        secondHalfIngredients: [{ productId: 103 }],
      },
    });

    expect(result.unitPrice).toBe(21_400);
    expect(result.lineTotal).toBe(42_800);

    const configuration = result.configuration as {
      billableIngredientCount: number;
      ingredientCharge: number;
    };

    expect(configuration.billableIngredientCount).toBe(2);
    expect(configuration.ingredientCharge).toBe(3_500);
  });

  it("en empate de ingredientes cobra la mitad de mayor valor", async () => {
    mocks.productFindUnique.mockResolvedValue(customPizzaProduct);
    mocks.pizzaSizeFindFirst.mockResolvedValue(size);
    mocks.pizzaCrustFindFirst.mockResolvedValue(crust);
    mocks.productFindMany.mockResolvedValue([
      {
        id: 101,
        name: "Pepperoni",
        basePrice: 2_000,
        active: true,
        type: "MODIFIER",
      },
      {
        id: 103,
        name: "Pollo",
        basePrice: 2_500,
        active: true,
        type: "MODIFIER",
      },
    ]);

    const result = await normalizeOrderLine({
      productId: customPizzaProduct.id,
      quantity: 1,
      configuration: {
        kind: "PIZZA_CUSTOM",
        size: { id: size.id },
        crust: { id: crust.id },
        mode: "HALF_HALF",
        firstHalfIngredients: [{ productId: 101 }],
        secondHalfIngredients: [{ productId: 103 }],
      },
    });

    expect(result.unitPrice).toBe(20_400);

    const configuration = result.configuration as {
      billableIngredientCount: number;
      ingredientCharge: number;
    };

    expect(configuration.billableIngredientCount).toBe(1);
    expect(configuration.ingredientCharge).toBe(2_500);
  });
});
