"use client";

import { useCallback, useEffect, useState } from "react";
import OrderStatusSelector from "@/components/OrderStatusSelector";
import { orderCode } from "@/lib/orderCode";
import type { FulfillmentType, OrderStatus } from "@/lib/orderWorkflow";

type OrderPayment = {
  amount: number | string;
  status: string;
};

type OrderSummary = {
  id: number;
  sequenceNumber: number | null;
  source: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  total: number | string;
  payments: OrderPayment[];
  driverId?: number | null;
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

function pendingBalance(order: OrderSummary) {
  const paid = order.payments
    .filter((payment) => payment.status === "PAID")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  return Math.max(0, Number(order.total) - paid);
}

function codeFromTrigger(trigger: HTMLElement) {
  const card = trigger.closest("article.group");
  if (card) return card.querySelector("h2")?.textContent?.trim() ?? "";
  const drawer = trigger.closest("aside");
  return drawer?.querySelector("header h2")?.textContent?.trim() ?? "";
}

function isClosedContext(trigger: HTMLElement) {
  const card = trigger.closest("article.group");
  if (card) {
    const status = card
      .querySelector(":scope > div:first-child > span:first-child")
      ?.textContent?.trim()
      .toLowerCase();

    return status === "cancelado" || status === "finalizado";
  }

  const drawer = trigger.closest("aside");
  const text = drawer?.textContent?.toLowerCase() ?? "";
  return text.includes("cancelado") || text.includes("finalizado");
}

function decorateStatusTriggers() {
  document.querySelectorAll<HTMLElement>(TRIGGER_SELECTOR).forEach((trigger) => {
    if (isClosedContext(trigger)) {
      trigger.dataset.orderStatusTrigger = "false";
      trigger.hidden = true;
      trigger.style.display = "none";
      return;
    }

    trigger.hidden = false;
    trigger.style.display = "";
    if (
      trigger.dataset.orderStatusTrigger === "true" &&
      trigger.textContent?.trim() === "ESTADOS"
    ) {
      return;
    }

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
  const [driverBusy, setDriverBusy] = useState(false);
  const [drivers, setDrivers] = useState<Array<{ id: number; name: string; ready: boolean }>>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [alert, setAlert] = useState<{ tone: "success" | "error"; title: string; message: string } | null>(null);

  const loadOrderForTrigger = useCallback(async (trigger: HTMLElement) => {
    const code = codeFromTrigger(trigger);
    if (!code) return;

    try {
      const [ordersResponse, driversResponse] = await Promise.all([
        fetch("/api/orders", { cache: "no-store" }),
        fetch("/api/drivers", { cache: "no-store" }),
      ]);
      const data = await ordersResponse.json();
      const driverData = await driversResponse.json().catch(() => ({}));
      if (!ordersResponse.ok) throw new Error(data.error || "No fue posible cargar los pedidos.");

      const orders = (data.orders ?? []) as OrderSummary[];
      if (driversResponse.ok) setDrivers(driverData.drivers ?? []);
      const order = orders.find((item) => displayedCode(item) === code);
      if (!order) throw new Error("No fue posible identificar el pedido seleccionado.");
      if (["CANCELED", "COMPLETED"].includes(order.status)) {
        throw new Error("Este pedido ya está cerrado y no necesita gestión de estados.");
      }

      setSelectedOrder(order);
      setSelectedDriverId(order.driverId ?? null);
    } catch (error) {
      setAlert({
        tone: "error",
        title: "No fue posible abrir el pedido",
        message: error instanceof Error ? error.message : "No fue posible abrir los estados del pedido.",
      });
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
      setAlert({
        tone: "error",
        title: "No fue posible actualizar el estado",
        message: error instanceof Error ? error.message : "No fue posible actualizar el estado del pedido.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function unassignDriver() {
    if (!selectedOrder?.driverId || driverBusy) return;

    const driver = drivers.find(
      (item) => item.id === selectedOrder.driverId,
    );

    const accepted = window.confirm(
      `¿Desasignar a ${driver?.name || "este repartidor"} de ${displayedCode(
        selectedOrder,
      )}?`,
    );
    if (!accepted) return;

    setDriverBusy(true);

    try {
      const response = await fetch(
        `/api/orders/${selectedOrder.id}/driver`,
        { method: "DELETE" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible desasignar el repartidor.",
        );
      }

      setSelectedOrder((current) =>
        current
          ? {
              ...current,
              driverId: null,
              status: data.order?.status ?? current.status,
            }
          : current,
      );
      setSelectedDriverId(null);

      setAlert({
        tone: "success",
        title: "Repartidor desasignado",
        message: data.resetToReady
          ? "El domicilio volvió a Listo para que pueda ser asignado nuevamente."
          : "El domicilio quedó disponible para una nueva asignación.",
      });

      window.setTimeout(() => {
        document
          .querySelector<HTMLButtonElement>(
            "button[aria-label='Actualizar']",
          )
          ?.click();
        decorateStatusTriggers();
      }, 0);
    } catch (error) {
      setAlert({
        tone: "error",
        title: "No fue posible desasignar",
        message:
          error instanceof Error
            ? error.message
            : "No fue posible desasignar el repartidor.",
      });
    } finally {
      setDriverBusy(false);
    }
  }

  async function assignDriver() {
    if (!selectedOrder || !selectedDriverId || driverBusy) return;
    const driverId = selectedDriverId;
    setDriverBusy(true);
    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}/driver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible asignar el repartidor.");
      setSelectedOrder((current) => current ? { ...current, driverId } : current);
      const driver = drivers.find((item) => item.id === driverId);
      setAlert(
        data.notification?.ok === false
          ? {
              tone: "error",
              title: driver ? `${driver.name} quedó asignado` : "Repartidor asignado",
              message: `La asignación se guardó, pero la notificación no pudo enviarse: ${data.notification.reason}`,
            }
          : {
              tone: "success",
              title: driver ? `${driver.name} quedó asignado` : "Repartidor asignado",
              message: "La orden se guardó y la notificación de WhatsApp fue enviada correctamente.",
            },
      );
    } catch (error) {
      setAlert({
        tone: "error",
        title: "No fue posible asignar el repartidor",
        message: error instanceof Error ? error.message : "No fue posible asignar el repartidor.",
      });
    } finally {
      setDriverBusy(false);
    }
  }

  if (!selectedOrder) return null;

  return (
    <>
    <OrderStatusSelector
      orderCode={displayedCode(selectedOrder)}
      currentStatus={selectedOrder.status}
      fulfillmentType={selectedOrder.fulfillmentType}
      pendingBalance={pendingBalance(selectedOrder)}
      busy={busy}
      drivers={drivers}
      assignedDriverId={selectedOrder.driverId ?? null}
      selectedDriverId={selectedDriverId}
      driverBusy={driverBusy}
      onDriverChange={setSelectedDriverId}
      onConfirmDriver={() => void assignDriver()}
      onUnassignDriver={() => void unassignDriver()}
      onClose={() => !busy && !driverBusy && setSelectedOrder(null)}
      onSelect={(status) => void selectStatus(status)}
    />

    {alert && (
      <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[3px]" onClick={() => setAlert(null)}>
        <div
          className="w-full max-w-[430px] overflow-hidden rounded-[26px] border border-white/10 bg-white shadow-[0_30px_90px_rgba(0,0,0,.30)]"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="bg-[radial-gradient(circle_at_88%_14%,rgba(229,28,17,.30),transparent_26%),linear-gradient(135deg,#09090a,#1b1516)] px-5 py-5 text-white">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black ${alert.tone === "success" ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"}`}>
                {alert.tone === "success" ? "✓" : "!"}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40">Alentó Pizza</p>
                <h3 className="mt-1 text-xl font-black tracking-[-.025em]">{alert.title}</h3>
              </div>
            </div>
          </header>
          <div className="p-5">
            <p className="text-sm leading-6 text-neutral-600">{alert.message}</p>
            <button
              type="button"
              onClick={() => setAlert(null)}
              className="mt-5 h-11 w-full rounded-xl bg-neutral-950 px-4 text-[11px] font-black uppercase tracking-[0.06em] text-white"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
