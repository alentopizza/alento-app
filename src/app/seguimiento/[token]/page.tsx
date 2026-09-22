import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readOrderTrackingToken } from "@/lib/orderTracking";
import LivePageRefresh from "@/components/LivePageRefresh";
import { getCustomerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LOGO_URL =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

const STATUS_FLOW = [
  "PREPARING",
  "PREPARED",
  "READY",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
  "DELIVERED",
  "COMPLETED",
] as const;

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Pedido recibido",
  CONFIRMED: "Pedido confirmado",
  PREPARING: "Estamos preparando tu pedido",
  PREPARED: "Tu pedido está horneándose",
  READY: "Tu pedido está listo",
  OUT_FOR_DELIVERY: "Tu pedido va en camino",
  ARRIVED: "Tu pedido llegó",
  DELIVERED: "Pedido entregado",
  COMPLETED: "Pedido completado",
  CANCELED: "Pedido cancelado",
};

const STATUS_COPY: Record<string, string> = {
  DRAFT: "Recibimos la información de tu pedido.",
  CONFIRMED: "Tu pedido fue confirmado.",
  PREPARING: "Nuestro equipo ya está trabajando en tu pedido.",
  PREPARED: "Terminamos el armado y tu pedido está en el horno.",
  READY: "Todo está listo para el siguiente paso.",
  OUT_FOR_DELIVERY: "Tu pedido salió de Alentó y va hacia ti.",
  ARRIVED: "El repartidor ya llegó al punto de entrega.",
  DELIVERED: "Gracias por elegir Alentó Pizza.",
  COMPLETED: "Gracias por tu compra. Esperamos verte muy pronto.",
  CANCELED: "Este pedido fue cancelado.",
};

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function fulfillmentLabel(value: string) {
  const labels: Record<string, string> = {
    DELIVERY: "Domicilio",
    PICKUP: "Recoger en tienda",
    STORE: "Consumo en local",
  };
  return labels[value] ?? value;
}

function progressFor(status: string) {
  if (status === "CANCELED") return 0;
  if (status === "DRAFT" || status === "CONFIRMED") return 8;
  const index = STATUS_FLOW.indexOf(status as (typeof STATUS_FLOW)[number]);
  if (index < 0) return 8;
  return Math.round(((index + 1) / STATUS_FLOW.length) * 100);
}

function trackingStages(fulfillmentType: string, status: string) {
  const delivery = [
    { label: "Preparando", statuses: ["DRAFT", "CONFIRMED", "PREPARING"] },
    { label: "Horneando", statuses: ["PREPARED"] },
    { label: "Listo", statuses: ["READY"] },
    { label: "En camino", statuses: ["OUT_FOR_DELIVERY"] },
    { label: "Entregado", statuses: ["ARRIVED", "DELIVERED", "COMPLETED"] },
  ];

  const pickup = [
    { label: "Preparando", statuses: ["DRAFT", "CONFIRMED", "PREPARING"] },
    { label: "Horneando", statuses: ["PREPARED"] },
    { label: "Listo para recoger", statuses: ["READY"] },
    { label: "Finalizado", statuses: ["COMPLETED"] },
  ];

  const stages = fulfillmentType === "DELIVERY" ? delivery : pickup;
  let current = stages.findIndex((stage) => stage.statuses.includes(status));
  if (current < 0) current = status === "CANCELED" ? 0 : stages.length - 1;

  return { stages, current };
}

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const orderId = readOrderTrackingToken(token);
  if (!orderId) notFound();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      sequenceNumber: true,
      source: true,
      customerId: true,
      status: true,
      fulfillmentType: true,
      total: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          name: true,
        },
      },
      items: {
        orderBy: { id: "asc" },
        select: {
          productName: true,
          quantity: true,
        },
      },
    },
  });

  if (!order) notFound();

  const session = await getCustomerSession();
  const ownOrder = Boolean(session && session.customerId === order.customerId);
  const code = `${order.source}-${String(order.sequenceNumber ?? order.id).padStart(4, "0")}`;
  const progress = progressFor(order.status);
  const { stages, current } = trackingStages(order.fulfillmentType, order.status);
  const activeLabel = STATUS_LABEL[order.status] ?? order.status;
  const activeCopy = STATUS_COPY[order.status] ?? "Estamos actualizando tu pedido.";

  return (
    <main className="min-h-screen bg-[#f5f3ef] px-4 py-6 text-neutral-950 sm:px-6 lg:py-10">
      <LivePageRefresh intervalMs={3000} />
      <div className="mx-auto max-w-[760px]">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-2xl bg-black shadow-[0_12px_30px_rgba(0,0,0,.18)]">
              <img src={LOGO_URL} alt="Alentó Pizza" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#a5191f]">Alentó Pizza</p>
              <h1 className="text-xl font-black tracking-[-0.03em]">Sigue tu pedido</h1>
            </div>
          </div>
          <span className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-bold text-neutral-600 shadow-sm">
            {code}
          </span>
        </header>

        <section className="overflow-hidden rounded-[26px] border border-neutral-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,.07)]">
          <div className="bg-[#111] px-5 py-6 text-white sm:px-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Estado actual</p>
            <h2 className="mt-2 text-[26px] font-black leading-tight tracking-[-0.035em] sm:text-[30px]">{activeLabel}</h2>
            <p className="mt-2 max-w-[560px] text-sm leading-6 text-white/64">{activeCopy}</p>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="relative mt-5">
              <div
                className="absolute top-[11px] h-[2px] bg-white/15"
                style={{
                  left: `${100 / (stages.length * 2)}%`,
                  right: `${100 / (stages.length * 2)}%`,
                }}
              />
              <div
                className="absolute top-[11px] h-[2px] bg-white transition-all"
                style={{
                  left: `${100 / (stages.length * 2)}%`,
                  width: `${(current / Math.max(1, stages.length - 1)) * (100 - 100 / stages.length)}%`,
                }}
              />
              <div
                className="relative grid gap-1"
                style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
              >
                {stages.map((stage, index) => {
                  const completed = index < current;
                  const active = index === current;
                  return (
                    <div key={stage.label} className="text-center">
                      <div
                        className={
                          "mx-auto flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-black " +
                          (completed
                            ? "border-white bg-white text-black"
                            : active
                              ? "border-white bg-white/15 text-white ring-4 ring-white/10"
                              : "border-white/25 bg-[#111] text-white/35")
                        }
                      >
                        {completed ? "✓" : index + 1}
                      </div>
                      <span
                        className={
                          "mt-2 block text-[8px] font-semibold leading-3 sm:text-[9px] " +
                          (active ? "text-white" : completed ? "text-white/65" : "text-white/30")
                        }
                      >
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-b border-neutral-100 p-5 sm:grid-cols-3 sm:p-7">
            <div className="rounded-2xl bg-[#f7f6f3] p-4">
              <span className="block text-[9px] font-bold uppercase tracking-[0.09em] text-neutral-400">Pedido</span>
              <strong className="mt-1.5 block text-lg">{code}</strong>
            </div>
            <div className="rounded-2xl bg-[#f7f6f3] p-4">
              <span className="block text-[9px] font-bold uppercase tracking-[0.09em] text-neutral-400">Modalidad</span>
              <strong className="mt-1.5 block text-sm">{fulfillmentLabel(order.fulfillmentType)}</strong>
            </div>
            <div className="rounded-2xl bg-[#f7f6f3] p-4">
              <span className="block text-[9px] font-bold uppercase tracking-[0.09em] text-neutral-400">Total</span>
              <strong className="mt-1.5 block text-lg">{money(Number(order.total))}</strong>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#a5191f]">Tu compra</p>
                <h3 className="mt-1 text-base font-black">Detalle del pedido</h3>
              </div>
              <span className="text-[11px] text-neutral-400">{dateTime(order.createdAt)}</span>
            </div>

            <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-100">
              {order.items.map((item, index) => (
                <div key={`${item.productName}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <span className="text-sm font-semibold text-neutral-800">{item.productName}</span>
                  <span className="rounded-lg bg-neutral-100 px-2 py-1 text-[11px] font-black text-neutral-600">×{item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-neutral-100 bg-[#fbfaf8] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-neutral-400">Cliente</p>
              <p className="mt-1.5 text-sm font-bold">{order.customer?.name ?? "Cliente Alentó"}</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Esta página se actualiza automáticamente con el estado real de tu pedido.
              </p>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Link
                href="/menu"
                className="flex h-12 items-center justify-center rounded-full bg-[#111] px-5 text-[11px] font-bold text-white shadow-sm transition hover:bg-black"
              >
                Volver al menú
              </Link>
              <Link
                href={ownOrder ? "/cuenta" : "/login"}
                className="flex h-12 items-center justify-center rounded-full border border-neutral-200 bg-white px-5 text-[11px] font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
              >
                {ownOrder ? "Ir a mi cuenta" : "Iniciar sesión"}
              </Link>
            </div>
          </div>
        </section>

        <footer className="px-2 py-5 text-center text-[11px] text-neutral-400">
          Alentó Pizza · Sabor Que Te Hace Volver.
        </footer>
      </div>
    </main>
  );
}
