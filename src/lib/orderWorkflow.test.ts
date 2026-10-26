import { describe, expect, it } from "vitest";
import { orderCode, orderPrefix } from "@/lib/orderCode";
import {
  canTransition,
  fulfillmentLabel,
  nextStatus,
  statusLabel,
  workflowFor,
} from "@/lib/orderWorkflow";

describe("flujo de pedidos", () => {
  it("mantiene el flujo completo de domicilio", () => {
    expect(workflowFor("DELIVERY")).toEqual([
      "PREPARING",
      "PREPARED",
      "READY",
      "OUT_FOR_DELIVERY",
      "ARRIVED",
      "DELIVERED",
      "COMPLETED",
    ]);
  });

  it("mantiene el flujo corto para recoger y local", () => {
    expect(workflowFor("PICKUP")).toEqual([
      "PREPARING",
      "PREPARED",
      "READY",
      "COMPLETED",
    ]);
    expect(workflowFor("STORE")).toEqual(workflowFor("PICKUP"));
  });

  it("solo permite avanzar al siguiente estado válido", () => {
    expect(nextStatus("CONFIRMED", "DELIVERY")).toBe("PREPARING");
    expect(nextStatus("PREPARED", "DELIVERY")).toBe("READY");
    expect(canTransition("READY", "OUT_FOR_DELIVERY", "DELIVERY")).toBe(
      true,
    );
    expect(canTransition("READY", "COMPLETED", "DELIVERY")).toBe(false);
    expect(canTransition("READY", "COMPLETED", "PICKUP")).toBe(true);
    expect(nextStatus("COMPLETED", "PICKUP")).toBeNull();
  });

  it("conserva las etiquetas operativas aprobadas", () => {
    expect(statusLabel("PREPARING")).toBe("En preparación");
    expect(statusLabel("PREPARED")).toBe("Horneando");
    expect(statusLabel("READY")).toBe("Listo");
    expect(fulfillmentLabel("DELIVERY")).toBe("Domicilio");
    expect(fulfillmentLabel("PICKUP")).toBe("Recoger");
    expect(fulfillmentLabel("STORE")).toBe("Local");
  });
});

describe("códigos de pedido", () => {
  it("mapea prefijos comerciales conocidos", () => {
    expect(orderPrefix("POS")).toBe("POS");
    expect(orderPrefix("web")).toBe("WEB");
    expect(orderPrefix("WHATSAPP")).toBe("WSP");
    expect(orderPrefix("INSTAGRAM")).toBe("IG");
    expect(orderPrefix("FACEBOOK")).toBe("FB");
  });

  it("mantiene el formato de cuatro dígitos sin truncar números mayores", () => {
    expect(orderCode(1, "POS")).toBe("POS-0001");
    expect(orderCode(23, "WEB")).toBe("WEB-0023");
    expect(orderCode(12_345, "WEB")).toBe("WEB-12345");
  });
});
