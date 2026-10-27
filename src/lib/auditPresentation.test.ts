import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  auditDetailForDisplay,
  auditEntityLabel,
  auditSourceLabel,
  auditSummaryLabel,
} from "@/lib/auditPresentation";

describe("audit presentation in es-CO", () => {
  it("traduce acciones, entidades y origen técnico", () => {
    expect(auditActionLabel("ORDER_STATUS_CHANGED")).toBe(
      "Estado del pedido actualizado",
    );
    expect(auditEntityLabel("PAYMENT")).toBe("Pago");
    expect(auditSourceLabel("api/orders/[id]/payment")).toBe(
      "Pedidos · registro de pago",
    );
  });

  it("traduce estados en resúmenes históricos sin cambiar el dato persistido", () => {
    expect(
      auditSummaryLabel("Pedido #801: PREPARED → READY."),
    ).toBe("Pedido #801: Horneando → Listo.");
  });

  it("presenta detalles con claves y valores legibles en español", () => {
    expect(
      auditDetailForDisplay({
        status: "PREPARED",
        fulfillmentType: "DELIVERY",
        source: "POS",
        balanceAfter: 14900,
      }),
    ).toEqual({
      Estado: "Horneando",
      "Tipo de pedido": "Domicilio",
      Origen: "Punto de venta",
      "Saldo después": 14900,
    });
  });
});
