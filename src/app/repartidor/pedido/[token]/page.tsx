import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readDriverOrderToken } from "@/lib/driverTracking";
import DriverOrderActions from "@/components/DriverOrderActions";
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
        },
      },
    },
  });

  if (!order) notFound();

  const phone = order.customer?.phone
    ? `${order.customer.countryCode || "+57"}${order.customer.phone}`
    : null;

  return (
    <main className="min-h-screen bg-[#080808] px-4 py-5 text-white">
      <LivePageRefresh intervalMs={2500} />
      <div className="mx-auto max-w-[640px] space-y-4">
        <section className="rounded-[24px] border border-white/10 bg-white p-5 text-neutral-950 shadow-[0_18px_50px_rgba(0,0,0,.22)]">
          <p className="text-[9px] font-black uppercase tracking-[.12em] text-[#e21a22]">Destino</p>
          <h2 className="mt-2 text-lg font-black">{order.customer?.name ?? "Cliente"}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-neutral-800">{order.address?.address ?? "Dirección no disponible"}</p>
          {order.address?.neighborhood && <p className="text-xs text-neutral-500">{order.address.neighborhood}</p>}
          {order.address?.notes && (
            <p className="mt-2 rounded-xl border border-[#e21a22]/15 bg-[#e21a22]/[0.05] px-3 py-2 text-xs font-semibold text-neutral-700">
              {order.address.notes}
            </p>
          )}
          {phone && (
            <a href={`tel:${phone}`} className="mt-4 flex h-11 items-center justify-center rounded-xl bg-[#111] text-sm font-black text-white transition hover:bg-black">
              Llamar al cliente · {phone}
            </a>
          )}
        </section>

        <section className="rounded-[22px] border border-white/10 bg-white p-4 text-neutral-950 shadow-[0_12px_30px_rgba(0,0,0,.18)]">
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
          }))}
        />
      </div>
    </main>
  );
}
