import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLUB_ALENTO_SETTINGS,
  clubPointsForAmount,
  normalizeClubAlentoSettings,
  pointsPerThousandFromPercent,
} from "@/lib/clubAlento";

describe("Club Alentó", () => {
  it("usa valores por defecto cuando la configuración no existe", () => {
    expect(normalizeClubAlentoSettings(null)).toEqual(
      DEFAULT_CLUB_ALENTO_SETTINGS,
    );
  });

  it("conserva el interruptor enabled y limita valores fuera de rango", () => {
    expect(
      normalizeClubAlentoSettings({
        enabled: false,
        earnRatePercent: 125,
        minimumRedemptionPurchase: -200,
        pointValueCop: 0,
      }),
    ).toEqual({
      enabled: false,
      earnRatePercent: 100,
      minimumRedemptionPurchase: 0,
      pointValueCop: 0.01,
    });
  });

  it("recupera defaults para números inválidos", () => {
    const result = normalizeClubAlentoSettings({
      earnRatePercent: "no-numero",
      minimumRedemptionPurchase: Number.NaN,
      pointValueCop: Number.POSITIVE_INFINITY,
    });

    expect(result.earnRatePercent).toBe(
      DEFAULT_CLUB_ALENTO_SETTINGS.earnRatePercent,
    );
    expect(result.minimumRedemptionPurchase).toBe(
      DEFAULT_CLUB_ALENTO_SETTINGS.minimumRedemptionPurchase,
    );
    expect(result.pointValueCop).toBe(
      DEFAULT_CLUB_ALENTO_SETTINGS.pointValueCop,
    );
  });

  it("calcula puntos redondeando siempre hacia abajo", () => {
    expect(clubPointsForAmount(14_999, 5)).toBe(749);
    expect(clubPointsForAmount(20_000, 5)).toBe(1_000);
  });

  it("nunca genera puntos negativos", () => {
    expect(clubPointsForAmount(-20_000, 5)).toBe(0);
    expect(clubPointsForAmount(20_000, -5)).toBe(0);
  });

  it("convierte porcentaje a puntos por mil de forma estable", () => {
    expect(pointsPerThousandFromPercent(5)).toBe(50);
    expect(pointsPerThousandFromPercent(7.5)).toBe(75);
    expect(pointsPerThousandFromPercent(-2)).toBe(0);
  });
});
