import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readDriverOrderToken } from "@/lib/driverTracking";
import DriverOrderActions from "@/components/DriverOrderActions";
import DriverOrderStatus from "@/components/DriverOrderStatus";
import LivePageRefresh from "@/components/LivePageRefresh";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";

export const dynamic = "force-dynamic";

const money = (value: number) => new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
}).format(value);

export default async function DriverOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = readDriverOrderToken(token);
  if (!parsed) notFound();

  const order = await prisma.order.findFirst({
    where: {
      id: parsed.orderId,
      driverId: parsed.driverId,
      fulfillmentType: "DELIVERY",
    },
    select: {
      id: true,
      status: true,
      subtotal: true,
      deliveryFee: true,
      total: true,
      notes: true,
      deliveryZoneName: true,
      address: { select: { address: true, neighborhood: true, notes: true } },
      customer: { select: { name: true, countryCode: true, phone: true } },
      payments: {
        where: { status: { not: "CANCELED" } },
        orderBy: { id: "desc" },
        take: 1,
        select: { method: true, status: true },
      },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productName: true,
          variantName: true,
          quantity: true,
          lineTotal: true,
          configuration: true,
          notes: true,
          driverVerifiedAt: true,
          driverVerifiedDriverId: true,
        },
      },
    },
  });

  if (!order) notFound();

  const phone = order.customer?.phone
    ? `${order.customer.countryCode || "+57"}${order.customer.phone}`
    : null;

  return (
    <main className="min-h-screen bg-[#080808] px-4 pb-32 pt-5 text-white">
      <LivePageRefresh intervalMs={2500} />
      <div className="mx-auto max-w-[640px] space-y-4">
        <DriverOrderStatus status={order.status} />

        <section className="overflow-hidden rounded-[24px] border border-white/10 bg-white text-neutral-950 shadow-[0_18px_50px_rgba(0,0,0,.22)]">
          <div className="relative p-5">
            <div className="flex items-start justify-between gap-4 pr-12">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[.12em] text-[#e21a22]">
                  Destino
                </p>
                <h2 className="mt-2 text-lg font-black">
                  {order.customer?.name ?? "Cliente"}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-neutral-800">
                  {order.address?.address ?? "Dirección no disponible"}
                </p>
                {order.address?.neighborhood && (
                  <p className="text-xs text-neutral-500">
                    {order.address.neighborhood}
                  </p>
                )}
              </div>
            </div>

            {phone && (
              <a
                href={`tel:${phone}`}
                aria-label={`Llamar a ${order.customer?.name ?? "cliente"}`}
                title={`Llamar · ${phone}`}
                className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#111] text-white shadow-[0_8px_18px_rgba(0,0,0,.18)] transition hover:bg-black active:scale-[.97]"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-[18px] w-[18px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 5.15 12.8 19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.07 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.7a16 16 0 0 0 6.3 6.3l1.24-1.24a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z" />
                </svg>
              </a>
            )}

            {order.address?.notes && (
              <p className="mt-3 rounded-xl border border-[#e21a22]/15 bg-[#e21a22]/[0.05] px-3 py-2 text-xs font-semibold text-neutral-700">
                {order.address.notes}
              </p>
            )}
          </div>

          <div className="border-t border-neutral-200 px-5 py-4">
            <span className="text-[9px] font-black uppercase tracking-[.1em] text-[#e21a22]">
              Cobro del pedido
            </span>

            <div className="mt-3 space-y-2 text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-neutral-500">Subtotal</span>
                <b>{money(Number(order.subtotal))}</b>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-neutral-500">Domicilio</span>
                <b className="text-[#e21a22]">
                  {money(Number(order.deliveryFee))}
                </b>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-2">
                <span className="text-neutral-500">Medio de pago</span>
                <div className="flex items-center gap-2">
                  <b>{order.payments[0]?.method ?? "Sin información"}</b>
                  {order.payments[0]?.status && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-[.06em] text-neutral-500">
                      {order.payments[0].status}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-end justify-between gap-3 border-t border-neutral-200 pt-2">
                <span className="text-[9px] font-black uppercase tracking-[.08em] text-neutral-500">
                  Total
                </span>
                <b className="text-xl">{money(Number(order.total))}</b>
              </div>
            </div>
          </div>
        </section>

        {order.notes && (
          <section className="rounded-[22px] border border-white/10 bg-white p-4 text-neutral-950">
            <span className="text-[9px] font-bold uppercase tracking-[.1em] text-neutral-400">Nota del pedido</span>
            <p className="mt-2 text-sm font-semibold leading-6">{order.notes}</p>
          </section>
        )}

        <DriverOrderActions
          token={token}
          initialStatus={order.status}
          items={order.items.map((item) => ({
            id: item.id,
            productName: item.productName,
            variantName: item.variantName,
            quantity: item.quantity,
            lineTotal: Number(item.lineTotal),
            details: presentOrderItemConfiguration(item.configuration),
            notes: item.notes,
            verified:
              item.driverVerifiedAt != null &&
              item.driverVerifiedDriverId === parsed.driverId,
          }))}
        />
      </div>
    </main>
  );
}
