"use client";

import { useCallback, useEffect, useState } from "react";
import OrderStatusSelector from "@/components/OrderStatusSelector";
import { orderCode } from "@/lib/orderCode";
import type { FulfillmentType, OrderStatus } from "@/lib/orderWorkflow";

type OrderSummary = {
  id: number;
  sequenceNumber: number | null;
  source: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
};

const TRIGGER_SELECTOR = [
  "article.group div.ml-auto > a",
  "article.group div.ml-auto > button",
  "article.group div.ml-auto > span",
  "aside footer > div > a:last-child",
  "aside footer > div > button:last-child",
  "aside footer > div > span:last-child",
].join(",");

function displayedCode(order: OrderSummary) {
  return orderCode(order.sequenceNumber ?? order.id, order.source);
}

function codeFromTrigger(trigger: HTMLElement) {
  const card = trigger.closest("article.group");
  if (card) return card.querySelector("h2")?.textContent?.trim() ?? "";
  const drawer = trigger.closest("aside");
  return drawer?.querySelector("header h2")?.textContent?.trim() ?? "";
}

function isCanceledContext(trigger: HTMLElement) {
  const card = trigger.closest("article.group");
  if (card) {
    const status = card.querySelector(":scope > div:first-child > span:first-child")?.textContent?.trim().toLowerCase();
    return status === "cancelado";
  }
  const drawer = trigger.closest("aside");
  return drawer?.textContent?.toLowerCase().includes("cancelado") ?? false;
}

function decorateStatusTriggers() {
  document.querySelectorAll<HTMLElement>(TRIGGER_SELECTOR).forEach((trigger) => {
    if (isCanceledContext(trigger)) return;

    trigger.dataset.orderStatusTrigger = "true";
    trigger.textContent = "ESTADOS";
    trigger.setAttribute("aria-label", "Cambiar estado del pedido");
    trigger.setAttribute("title", "Cambiar estado del pedido");
    trigger.style.background = "#000000";
    trigger.style.color = "#ffffff";
    trigger.style.borderColor = "#000000";
    trigger.style.cursor = "pointer";
    trigger.style.fontWeight = "800";
    trigger.style.letterSpacing = "0.03em";
  });
}

export default function OrdersStatusController() {
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const loadOrderForTrigger = useCallback(async (trigger: HTMLElement) => {
    const code = codeFromTrigger(trigger);
    if (!code) return;

    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar los pedidos.");

      const orders = (data.orders ?? []) as OrderSummary[];
      const order = orders.find((item) => displayedCode(item) === code);
      if (!order) throw new Error("No fue posible identificar el pedido seleccionado.");
      if (order.status === "CANCELED") throw new Error("Los pedidos cancelados se gestionan fuera del selector de estados.");

      setSelectedOrder(order);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No fue posible abrir los estados del pedido.");
    }
  }, []);

  useEffect(() => {
    decorateStatusTriggers();

    const observer = new MutationObserver(() => decorateStatusTriggers());
    observer.observe(document.body, { childList: true, subtree: true });

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const trigger = target?.closest<HTMLElement>("[data-order-status-trigger='true']");
      if (!trigger) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void loadOrderForTrigger(trigger);
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
    };
  }, [loadOrderForTrigger]);

  async function selectStatus(status: OrderStatus) {
    if (!selectedOrder || busy || status === selectedOrder.status) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible actualizar el estado.");

      setSelectedOrder(null);
      window.setTimeout(() => {
        document.querySelector<HTMLButtonElement>("button[aria-label='Actualizar']")?.click();
        decorateStatusTriggers();
      }, 0);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No fue posible actualizar el estado del pedido.");
    } finally {
      setBusy(false);
    }
  }

  if (!selectedOrder) return null;

  return (
    <OrderStatusSelector
      orderCode={displayedCode(selectedOrder)}
      currentStatus={selectedOrder.status}
      fulfillmentType={selectedOrder.fulfillmentType}
      busy={busy}
      onClose={() => !busy && setSelectedOrder(null)}
      onSelect={(status) => void selectStatus(status)}
    />
  );
}
