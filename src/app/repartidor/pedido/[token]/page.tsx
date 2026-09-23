import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readDriverOrderToken } from "@/lib/driverTracking";
import DriverOrderActions from "@/components/DriverOrderActions";
import DriverOrderStatus from "@/components/DriverOrderStatus";
import DriverDestinationActions from "@/components/DriverDestinationActions";
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
      address: {
        select: {
          address: true,
          formattedAddress: true,
          neighborhood: true,
          notes: true,
          latitude: true,
          longitude: true,
        },
      },
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

        <section className="overflow-hidden rounded-[22px] border border-white/10 bg-white text-neutral-950 shadow-[0_18px_46px_rgba(0,0,0,.26)]">
          <div className="relative border-b border-neutral-200 px-4 py-4 sm:px-5">
            <div className="pr-14">
              <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#e21a22]">
                Destino
              </p>
              <h2 className="mt-1 text-base font-black">
                {order.customer?.name ?? "Cliente"}
              </h2>
            </div>

            <DriverDestinationActions
              token={token}
              phone={phone}
              customerName={order.customer?.name ?? "Cliente"}
            />

            <div className="mt-3 rounded-xl bg-[#111] px-3 py-3 text-white">
              <span className="block text-[8px] font-bold uppercase tracking-[0.08em] text-white/42">
                Dirección de entrega
              </span>
              <strong className="mt-1 block text-[12px] leading-5 text-white">
                {order.address?.address ?? "Dirección no disponible"}
              </strong>
              {order.address?.neighborhood && (
                <span className="mt-0.5 block text-[9px] text-white/45">
                  {order.address.neighborhood}
                </span>
              )}
            </div>

            {order.address?.notes && (
              <p className="mt-2 rounded-lg border border-[#e21a22]/15 bg-[#e21a22]/[0.06] px-2.5 py-2 text-[10px] font-semibold leading-4 text-neutral-700">
                {order.address.notes}
              </p>
            )}
          </div>

          <div className="border-t border-neutral-900 bg-[#111] px-4 py-4 text-white sm:px-5">
            <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#ff454b]">
              Cobro del pedido
            </p>

            <div className="mt-3 flex items-center justify-between gap-4 text-[11px]">
              <span className="text-white/48">Subtotal</span>
              <b className="text-white">{money(Number(order.subtotal))}</b>
            </div>

            <div className="mt-2 flex items-center justify-between gap-4 text-[11px]">
              <span className="text-white/48">Domicilio</span>
              <b className="text-[#ff454b]">
                {money(Number(order.deliveryFee))}
              </b>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4 border-t border-white/10 pt-3 text-[11px]">
              <span className="text-white/48">Medio de pago</span>
              <div className="flex items-center gap-2">
                <b className="text-white">
                  {order.payments[0]?.method ?? "Sin información"}
                </b>
                {order.payments[0]?.status && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[.06em] text-white/55">
                    {order.payments[0].status}
                  </span>
                )}
              </div>
            </div>

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
