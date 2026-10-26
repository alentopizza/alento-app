import { describe, expect, it } from "vitest";
import {
  ORDER_KITCHEN_LEAD_MINUTES,
  isInKitchenWindow,
  kitchenWindowStartsAt,
  parseScheduledFor,
  scheduleStatusForKitchen,
  scheduledServiceWindow,
  validateFutureSchedule,
  validateScheduledServiceHours,
} from "@/lib/orderScheduling";

describe("programación de pedidos", () => {
  it("interpreta ausencia de programación como pedido inmediato", () => {
    expect(parseScheduledFor(null)).toBeNull();
    expect(parseScheduledFor("")).toBeNull();
  });

  it("rechaza fechas programadas inválidas", () => {
    expect(() => parseScheduledFor(123)).toThrow(
      "La fecha programada no es válida.",
    );
    expect(() => parseScheduledFor("fecha-invalida")).toThrow(
      "La fecha programada no es válida.",
    );
  });

  it("rechaza una hora programada que no esté en el futuro", () => {
    const now = new Date("2026-10-26T20:00:00.000Z");

    expect(() =>
      validateFutureSchedule(
        new Date("2026-10-26T20:00:00.000Z"),
        now,
      ),
    ).toThrow("La hora programada debe estar en el futuro.");

    expect(
      validateFutureSchedule(
        new Date("2026-10-26T20:01:00.000Z"),
        now,
      )?.toISOString(),
    ).toBe("2026-10-26T20:01:00.000Z");
  });

  it("abre la ventana de Cocina exactamente 30 minutos antes", () => {
    expect(ORDER_KITCHEN_LEAD_MINUTES).toBe(30);

    const scheduled = new Date("2026-10-26T22:00:00.000Z");
    expect(kitchenWindowStartsAt(scheduled).toISOString()).toBe(
      "2026-10-26T21:30:00.000Z",
    );

    expect(
      isInKitchenWindow(
        scheduled,
        new Date("2026-10-26T21:29:59.999Z"),
      ),
    ).toBe(false);
    expect(
      isInKitchenWindow(
        scheduled,
        new Date("2026-10-26T21:30:00.000Z"),
      ),
    ).toBe(true);
  });

  it("asigna el estado inicial correcto según preparación y ventana", () => {
    const now = new Date("2026-10-26T20:00:00.000Z");

    expect(scheduleStatusForKitchen(false, null, now)).toBe("READY");
    expect(
      scheduleStatusForKitchen(
        true,
        new Date("2026-10-26T22:00:00.000Z"),
        now,
      ),
    ).toBe("CONFIRMED");
    expect(
      scheduleStatusForKitchen(
        true,
        new Date("2026-10-26T20:20:00.000Z"),
        now,
      ),
    ).toBe("PREPARING");
  });

  it("respeta horario regular en zona America/Bogota", () => {
    const openBoundary = scheduledServiceWindow(
      new Date("2026-10-26T19:00:00.000Z"),
      undefined,
    );
    const beforeClose = scheduledServiceWindow(
      new Date("2026-10-27T02:59:00.000Z"),
      undefined,
    );
    const closeBoundary = scheduledServiceWindow(
      new Date("2026-10-27T03:00:00.000Z"),
      undefined,
    );

    expect(openBoundary.valid).toBe(true);
    expect(beforeClose.valid).toBe(true);
    expect(closeBoundary.valid).toBe(false);
  });

  it("reconoce la madrugada como parte del horario nocturno del día anterior", () => {
    const hours = [
      { day: "MON", enabled: true, open: "18:00", close: "02:00" },
    ];

    const result = scheduledServiceWindow(
      new Date("2026-10-27T06:00:00.000Z"),
      hours,
    );

    expect(result.valid).toBe(true);
    expect(result.day).toBe("MON");
  });

  it("impide programar en un día cerrado", () => {
    const hours = [
      { day: "MON", enabled: false, open: "14:00", close: "22:00" },
    ];

    expect(() =>
      validateScheduledServiceHours(
        new Date("2026-10-26T21:00:00.000Z"),
        hours,
      ),
    ).toThrow(
      "No se reciben pedidos programados el lunes porque el servicio está cerrado.",
    );
  });
});
