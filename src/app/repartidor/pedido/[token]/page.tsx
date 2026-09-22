import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readDriverOrderToken } from "@/lib/driverTracking";
import DriverOrderActions from "@/components/DriverOrderActions";
import LivePageRefresh from "@/components/LivePageRefresh";
import { statusLabel } from "@/lib/orderWorkflow";

export const dynamic = "force-dynamic";

const LOGO_URL = "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

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
      sequenceNumber: true,
      status: true,
      total: true,
      notes: true,
      deliveryZoneName: true,
      address: { select: { address: true, neighborhood: true, notes: true } },
      customer: { select: { name: true, countryCode: true, phone: true } },
      driver: { select: { name: true } },
      payments: {
        where: { status: { not: "CANCELED" } },
        orderBy: { id: "desc" },
        take: 1,
        select: { method: true, status: true },
      },
      items: {
        orderBy: { id: "asc" },
        select: { id: true, productName: true, quantity: true },
      },
    },
  });

  if (!order) notFound();

  const code = `POS-${String(order.sequenceNumber ?? order.id).padStart(4, "0")}`;
  const phone = order.customer?.phone
    ? `${order.customer.countryCode || "+57"}${order.customer.phone}`
    : null;

  return (
    <main className="min-h-screen bg-[#f4f2ee] px-4 py-5 text-neutral-950">
      <LivePageRefresh intervalMs={2500} />
      <div className="mx-auto max-w-[640px] space-y-4">
        <header className="flex items-center justify-between rounded-[24px] bg-[#0c0c0d] px-5 py-4 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Alentó Pizza" className="h-12 w-12 rounded-2xl object-cover" />
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[.16em] text-white/45">Entrega asignada</p>
              <h1 className="mt-0.5 text-xl font-black">{code}</h1>
              <p className="mt-0.5 text-[11px] text-white/55">{order.driver?.name ?? "Repartidor Alentó"}</p>
            </div>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold">
            {statusLabel(order.status as Parameters<typeof statusLabel>[0])}
          </span>
        </header>

        <section className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,.06)]">
          <p className="text-[9px] font-black uppercase tracking-[.12em] text-[var(--brand-red)]">Destino</p>
          <h2 className="mt-2 text-lg font-black">{order.customer?.name ?? "Cliente"}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-neutral-800">{order.address?.address ?? "Dirección no disponible"}</p>
          {order.address?.neighborhood && <p className="text-xs text-neutral-500">{order.address.neighborhood}</p>}
          {order.address?.notes && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{order.address.notes}</p>}
          {phone && (
            <a href={`tel:${phone}`} className="mt-4 flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-sm font-black text-neutral-800">
              Llamar al cliente · {phone}
            </a>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-neutral-200 bg-white p-4">
            <span className="text-[9px] font-bold uppercase tracking-[.1em] text-neutral-400">Total pedido</span>
            <b className="mt-1 block text-xl">{money(Number(order.total))}</b>
          </div>
          <div className="rounded-[22px] border border-neutral-200 bg-white p-4">
            <span className="text-[9px] font-bold uppercase tracking-[.1em] text-neutral-400">Pago</span>
            <b className="mt-1 block text-sm">{order.payments[0]?.method ?? "Sin información"}</b>
            <span className="text-[10px] text-neutral-400">{order.payments[0]?.status ?? ""}</span>
          </div>
        </section>

        {order.notes && (
          <section className="rounded-[22px] border border-neutral-200 bg-white p-4">
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
            quantity: item.quantity,
          }))}
        />
      </div>
    </main>
  );
}
