import { describe, expect, it } from "vitest";
import {
  DeliveryPricingError,
  deliveryPricingHttpStatus,
  finiteCoordinate,
  normalizeDeliveryBands,
  resolveDeliveryPricing,
} from "@/lib/deliveryPricing";

describe("tarifas y cobertura de domicilio", () => {
  it("normaliza coordenadas numéricas y rechaza valores inválidos", () => {
    expect(finiteCoordinate("4.6")).toBe(4.6);
    expect(finiteCoordinate("-74.1")).toBe(-74.1);
    expect(finiteCoordinate("sin-coordenada")).toBeNull();
  });

  it("filtra bandas inactivas o inválidas y ordena por distancia", () => {
    const bands = normalizeDeliveryBands({
      deliveryBands: [
        {
          id: "far",
          minMeters: 501,
          maxMeters: 1000,
          fee: 8000,
          active: true,
        },
        {
          id: "off",
          minMeters: 0,
          maxMeters: 100,
          fee: 1000,
          active: false,
        },
        {
          id: "invalid",
          minMeters: 300,
          maxMeters: 200,
          fee: 5000,
          active: true,
        },
        {
          id: "near",
          minMeters: 0,
          maxMeters: 500,
          fee: 4000,
          active: true,
        },
      ],
    });

    expect(bands.map((band) => band.id)).toEqual(["near", "far"]);
  });

  it("selecciona la banda correcta y redondea la tarifa", () => {
    const result = resolveDeliveryPricing({
      settings: {
        store: { latitude: 4.6, longitude: -74.1 },
        deliveryBands: [
          {
            id: "near",
            name: "Zona cercana",
            minMeters: 0,
            maxMeters: 500,
            fee: 4500.4,
            active: true,
          },
        ],
      },
      destination: { latitude: 4.6, longitude: -74.1 },
    });

    expect(result.covered).toBe(true);
    expect(result.deliveryZoneId).toBe("near");
    expect(result.deliveryZoneName).toBe("Zona cercana");
    expect(result.deliveryFee).toBe(4500);
    expect(result.commercialDistanceMeters).toBe(0);
  });

  it("marca fuera de cobertura sin inventar tarifa", () => {
    const result = resolveDeliveryPricing({
      settings: {
        store: { latitude: 4.6, longitude: -74.1 },
        deliveryBands: [
          {
            id: "near",
            minMeters: 0,
            maxMeters: 500,
            fee: 4000,
            active: true,
          },
        ],
      },
      destination: { latitude: 4.62, longitude: -74.1 },
    });

    expect(result.covered).toBe(false);
    expect(result.deliveryFee).toBeNull();
    expect(result.deliveryZoneId).toBeNull();
    expect(result.maxCoverageMeters).toBe(500);
  });

  it("rechaza un destino geográficamente inválido", () => {
    expect(() =>
      resolveDeliveryPricing({
        settings: {
          store: { latitude: 4.6, longitude: -74.1 },
          deliveryBands: [
            {
              id: "near",
              minMeters: 0,
              maxMeters: 500,
              fee: 4000,
            },
          ],
        },
        destination: { latitude: 120, longitude: -74.1 },
      }),
    ).toThrowError(DeliveryPricingError);
  });

  it("distingue falta de sede y falta de bandas activas", () => {
    try {
      resolveDeliveryPricing({
        settings: { deliveryBands: [] },
        destination: { latitude: 4.6, longitude: -74.1 },
      });
      throw new Error("Debió fallar por ubicación de sede.");
    } catch (error) {
      expect(error).toBeInstanceOf(DeliveryPricingError);
      expect((error as DeliveryPricingError).code).toBe(
        "STORE_LOCATION_MISSING",
      );
      expect(deliveryPricingHttpStatus(error)).toBe(503);
    }

    try {
      resolveDeliveryPricing({
        settings: {
          store: { latitude: 4.6, longitude: -74.1 },
          deliveryBands: [],
        },
        destination: { latitude: 4.6, longitude: -74.1 },
      });
      throw new Error("Debió fallar por bandas.");
    } catch (error) {
      expect(error).toBeInstanceOf(DeliveryPricingError);
      expect((error as DeliveryPricingError).code).toBe("NO_ACTIVE_BANDS");
      expect(deliveryPricingHttpStatus(error)).toBe(400);
    }
  });
});
