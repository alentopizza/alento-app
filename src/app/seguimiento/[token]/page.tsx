import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readOrderTrackingToken } from "@/lib/orderTracking";
import LivePageRefresh from "@/components/LivePageRefresh";
import CustomerDeliveryLiveMap from "@/components/CustomerDeliveryLiveMap";
import { presentCustomerOrderItemConfiguration } from "@/lib/orderPresentation";
import { isInKitchenWindow, kitchenWindowStartsAt } from "@/lib/orderScheduling";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  WAITING_SCHEDULED: "En espera de preparación",
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
  WAITING_SCHEDULED: "Tu pedido está programado. Lo comenzaremos a preparar cuando se acerque la hora que elegiste.",
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(value);
}

function orderItemDetails(configuration: unknown) {
  return presentCustomerOrderItemConfiguration(configuration).map(
    (detail) => `${detail.label}: ${detail.value}`,
  );
}

function trackingStages(
  fulfillmentType: string,
  status: string,
  waitingForSchedule = false,
) {
  const delivery = [
    { label: "Preparando", statuses: ["DRAFT", "CONFIRMED", "PREPARING"] },
    { label: "Horneando", statuses: ["PREPARED"] },
    { label: "Listo", statuses: ["READY"] },
    { label: "En camino", statuses: ["OUT_FOR_DELIVERY"] },
    { label: "Llegó", statuses: ["ARRIVED"] },
  ];

  const pickup = [
    { label: "Preparando", statuses: ["DRAFT", "CONFIRMED", "PREPARING"] },
    { label: "Horneando", statuses: ["PREPARED"] },
    { label: "Listo para recoger", statuses: ["READY"] },
  ];

  const stages = fulfillmentType === "DELIVERY" ? delivery : pickup;
  const visibleStages = waitingForSchedule
    ? [
        { label: "En espera", statuses: ["WAITING_SCHEDULED"] },
        ...stages,
      ]
    : stages;
  let current = visibleStages.findIndex((stage) => stage.statuses.includes(status));
  if (current < 0) current = status === "CANCELED" ? 0 : visibleStages.length - 1;

  return { stages: visibleStages, current };
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
      status: true,
      scheduledFor: true,
      fulfillmentType: true,
      subtotal: true,
      deliveryFee: true,
      discount: true,
      total: true,
      createdAt: true,
      updatedAt: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          productName: true,
          variantName: true,
          unitPrice: true,
          quantity: true,
          lineTotal: true,
          configuration: true,
          notes: true,
        },
      },
    },
  });

  if (!order) notFound();

  const code = `${order.source}-${String(order.sequenceNumber ?? order.id).padStart(4, "0")}`;

  if (
    order.fulfillmentType === "DELIVERY" &&
    ["DELIVERED", "COMPLETED"].includes(order.status)
  ) {
    redirect(`/menu?pedidoEntregado=${encodeURIComponent(code)}`);
  }

  if (
    order.fulfillmentType !== "DELIVERY" &&
    order.status === "COMPLETED"
  ) {
    redirect(`/menu?pedidoFinalizado=${encodeURIComponent(code)}`);
  }

  const waitingForSchedule =
    Boolean(order.scheduledFor) &&
    !isInKitchenWindow(order.scheduledFor) &&
    !["CANCELED", "COMPLETED", "DELIVERED"].includes(order.status);
  const trackingStatus = waitingForSchedule ? "WAITING_SCHEDULED" : order.status;
  const preparationStartsAt = order.scheduledFor
    ? kitchenWindowStartsAt(order.scheduledFor)
    : null;
  const { stages, current } = trackingStages(
    order.fulfillmentType,
    trackingStatus,
    waitingForSchedule,
  );
  const activeLabel = STATUS_LABEL[trackingStatus] ?? trackingStatus;
  const activeCopy = waitingForSchedule
    ? "Lo prepararemos cuando se acerque la hora que elegiste."
    : STATUS_COPY[trackingStatus] ?? "Estamos actualizando tu pedido.";
  const deliveryMapVisible =
    order.fulfillmentType === "DELIVERY" &&
    ["OUT_FOR_DELIVERY", "ARRIVED"].includes(order.status);
  const showPromoBanner = !deliveryMapVisible;

  return (
    <main className="min-h-screen bg-[#080808] px-4 pb-8 pt-3 text-white sm:px-6 sm:pb-10 sm:pt-4 lg:pt-5">
      <LivePageRefresh intervalMs={3000} />
      <div className="mx-auto max-w-[760px]">
        <section className="overflow-hidden rounded-[26px] border border-white/10 bg-[#0e0e0e] shadow-[0_24px_70px_rgba(0,0,0,.34)]">
          <div className="relative border-b border-[#e21a22]/25 bg-[radial-gradient(circle_at_top_right,rgba(226,26,34,.14),transparent_34%),linear-gradient(145deg,#151515,#090909_72%)] px-5 pb-6 pt-5 text-white sm:px-7 sm:pb-7 sm:pt-6">
            <Link
              href="/menu"
              aria-label="Cerrar seguimiento y volver al menú"
              title="Cerrar"
              className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/45 text-[22px] font-medium leading-none text-white/75 shadow-[0_8px_22px_rgba(0,0,0,.28)] backdrop-blur-md transition hover:bg-black/60 hover:text-white active:scale-95 sm:right-5 sm:top-5"
            >
              ×
            </Link>

            <div className="pr-14">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ff454b]">
                  Estado actual
                </p>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white/72">
                  Pedido {code}
                </span>
              </div>
              <h2 className="mt-2 text-[26px] font-black leading-tight tracking-[-0.035em] sm:text-[30px]">
                {activeLabel}
              </h2>
              <p className="mt-2 max-w-[560px] text-sm leading-6 text-white/64">
                {activeCopy}
              </p>
            </div>

            <div className="relative mt-6">
              <div
                className="absolute top-[11px] grid"
                style={{
                  left: `${100 / (stages.length * 2)}%`,
                  right: `${100 / (stages.length * 2)}%`,
                  gridTemplateColumns: `repeat(${Math.max(1, stages.length - 1)}, minmax(0, 1fr))`,
                }}
              >
                {stages.slice(0, -1).map((_, index) => {
                  const completed = index < current;
                  const activeSegment =
                    index === current && current < stages.length - 1;

                  return (
                    <div
                      key={index}
                      className="relative h-[2px] overflow-hidden bg-white/10"
                    >
                      {completed && (
                        <div className="absolute inset-0 bg-[#e21a22]" />
                      )}

                      {activeSegment && (
                        <>
                          <div className="absolute inset-0 bg-[#e21a22]/18" />
                          <div className="alento-progress-runner absolute inset-y-0 left-0 w-full origin-left bg-[linear-gradient(90deg,rgba(226,26,34,.22),#ff3439_55%,#ff7a7e)] shadow-[0_0_10px_rgba(255,52,57,.55)]" />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                className="relative grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))`,
                }}
              >
                {stages.map((stage, index) => {
                  const completed = index < current;
                  const active = index === current;

                  return (
                    <div key={stage.label} className="min-w-0 text-center">
                      <div
                        className={
                          "relative mx-auto flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-black transition " +
                          (completed
                            ? "border-[#e21a22] bg-[#e21a22] text-white"
                            : active
                              ? "border-[#ff454b] bg-[#ff454b]/20 text-[#ff454b] ring-4 ring-[#e21a22]/10"
                              : "border-white/20 bg-[#111] text-white/30")
                        }
                      >
                        {active && current < stages.length - 1 && (
                          <span className="alento-progress-pulse absolute inset-[-5px] rounded-full border border-[#ff454b]/30" />
                        )}
                        <span className="relative z-10">
                          {completed ? "✓" : index + 1}
                        </span>
                      </div>

                      <span
                        className={
                          "mt-2 block text-[8px] font-semibold leading-3 sm:text-[9px] " +
                          (active
                            ? "text-white"
                            : completed
                              ? "text-white/60"
                              : "text-white/25")
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

          <div className="bg-[#0e0e0e] p-4 sm:p-6">
            {waitingForSchedule && order.scheduledFor && (
              <div className="mb-4 flex items-center gap-3 rounded-[16px] border border-amber-400/20 bg-amber-300/[0.07] px-4 py-3">
                <span className="text-lg text-amber-300" aria-hidden="true">◷</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-300">
                    Pedido programado
                  </p>
                  <p className="mt-0.5 text-[12px] font-semibold text-white">
                    Lo prepararemos para las {new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" }).format(new Date(order.scheduledFor))}
                  </p>
                </div>
              </div>
            )}
            {deliveryMapVisible && (
              <CustomerDeliveryLiveMap token={token} orderCode={code} />
            )}

            {showPromoBanner && (
              <Link
                href="/menu?utm_source=seguimiento&utm_medium=app&utm_campaign=promociones_activas"
                className="group relative mb-4 block overflow-hidden rounded-[22px] border border-[#e21a22]/70 bg-[#100808] shadow-[0_18px_46px_rgba(226,26,34,.14)] transition hover:-translate-y-0.5 hover:border-[#ff454b] hover:shadow-[0_22px_56px_rgba(226,26,34,.20)] active:scale-[.995]"
                aria-label="Descubre promociones activas en el menú de Alentó Pizza"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_28%,rgba(226,26,34,.30),transparent_28%),linear-gradient(105deg,#150707_0%,#120909_52%,#080808_100%)]" />

                <div className="absolute inset-y-0 right-0 w-[44%] overflow-hidden sm:w-[40%]">
                  <img
                    src="https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/Vyme6Gd1y8prrWS7X3wu.png"
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full scale-[1.42] object-cover object-[80%_60%] opacity-75 saturate-125 transition duration-500 group-hover:scale-[1.48]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,#100808_0%,rgba(16,8,8,.74)_20%,rgba(16,8,8,.12)_70%,rgba(16,8,8,.04)_100%)]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/15" />
                </div>

                <div className="relative z-10 min-h-[104px] px-4 py-3 pr-[36%] sm:min-h-[112px] sm:px-5 sm:py-3.5 sm:pr-[36%]">
                  <h3 className="max-w-[310px] text-[17px] font-black leading-[1.02] tracking-[-0.035em] text-white sm:text-[20px]">
                    Descubre
                    <span className="block text-[#ff3439]">
                      promociones activas
                    </span>
                  </h3>

                  <p className="mt-1 max-w-[270px] text-[8.5px] leading-[12px] text-white/52 sm:text-[9px] sm:leading-[13px]">
                    Explora combos, promociones y beneficios de la app.
                  </p>

                  <span className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-full bg-[#e21a22] px-3 text-[8.5px] font-black text-white shadow-[0_8px_18px_rgba(226,26,34,.24)] transition group-hover:bg-[#f01f28] sm:h-8 sm:px-3.5 sm:text-[9px]">
                    Ir al menú
                    <span className="text-[13px] leading-none" aria-hidden="true">
                      →
                    </span>
                  </span>
                </div>

                <div className="pointer-events-none absolute right-[10%] top-[31%] z-10 flex h-9 w-9 -rotate-6 items-center justify-center rounded-[12px] border border-[#ff454b]/65 bg-black/58 text-[17px] font-black text-[#ff454b] shadow-[0_0_22px_rgba(226,26,34,.30)] backdrop-blur-sm sm:h-10 sm:w-10 sm:text-[18px]">
                  %
                </div>
              </Link>
            )}

            <section className="overflow-hidden rounded-[22px] border border-white/10 bg-white text-neutral-950 shadow-[0_18px_46px_rgba(0,0,0,.26)]">
              <div className="border-b border-neutral-200 px-4 py-4 sm:px-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#e21a22]">
                      Tu compra
                    </p>
                    <h3 className="mt-1 text-base font-black">Detalle del pedido</h3>
                  </div>
                  <span className="text-right text-[10px] text-neutral-400 sm:text-[11px]">
                    {dateTime(order.createdAt)}
                  </span>
                </div>

              </div>

              <div className="divide-y divide-neutral-200">
                {order.items.map((item, index) => {
                  const details = orderItemDetails(item.configuration);
                  const unitPrice = Number(item.unitPrice);
                  const lineTotal = Number(item.lineTotal);

                  return (
                    <article
                      key={`${item.productName}-${index}`}
                      className="px-4 py-4 sm:px-5"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-xl bg-[#e21a22] px-2 text-[10px] font-black text-white shadow-[0_6px_14px_rgba(226,26,34,.18)]">
                          {item.quantity}×
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <h4 className="text-[13px] font-black leading-5 text-neutral-900 sm:text-sm">
                                {item.productName}
                              </h4>
                              {item.variantName && (
                                <p className="mt-0.5 text-[10px] font-semibold text-neutral-500">
                                  {item.variantName}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 text-right">
                              <b className="block text-[13px] text-neutral-900 sm:text-sm">
                                {money(lineTotal)}
                              </b>
                              {item.quantity > 1 && (
                                <span className="mt-0.5 block text-[9px] text-neutral-400">
                                  {money(unitPrice)} c/u
                                </span>
                              )}
                            </div>
                          </div>

                          {details.length > 0 && (
                            <div className="mt-2 space-y-0.5">
                              {details.map((detail) => (
                                <p
                                  key={detail}
                                  className="text-[10px] leading-4 text-neutral-500"
                                >
                                  {detail}
                                </p>
                              ))}
                            </div>
                          )}

                          {item.notes && (
                            <p className="mt-2 rounded-lg border border-[#e21a22]/15 bg-[#e21a22]/[0.06] px-2.5 py-1.5 text-[9px] leading-4 text-neutral-700">
                              Nota: {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="border-t border-neutral-900 bg-[#111] px-4 py-4 text-white sm:px-5">
                <div className="flex items-center justify-between gap-4 text-[11px]">
                  <span className="text-white/48">Subtotal</span>
                  <b className="text-white">{money(Number(order.subtotal))}</b>
                </div>

                <div className="mt-2 flex items-center justify-between gap-4 text-[11px]">
                  <span className="text-white/48">Domicilio</span>
                  <b className="text-[#ff454b]">{money(Number(order.deliveryFee))}</b>
                </div>

                {Number(order.discount) > 0 && (
                  <div className="mt-2 flex items-center justify-between gap-4 text-[11px]">
                    <span className="text-[#ff7a7e]">Descuento</span>
                    <b className="text-[#ff7a7e]">
                      − {money(Number(order.discount))}
                    </b>
                  </div>
                )}

                <div className="mt-3 flex items-end justify-between gap-4 border-t border-white/10 pt-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.08em] text-white/55">
                    Total
                  </span>
                  <strong className="text-xl font-black tracking-[-0.03em] text-white">
                    {money(Number(order.total))}
                  </strong>
                </div>
              </div>
            </section>

          </div>
        </section>
      </div>

    </main>
  );
}
