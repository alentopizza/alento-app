import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/auth";

function money(value: unknown) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

export default async function CustomerAccountPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/login");

  const account = await prisma.customerAccount.findUnique({
    where: { id: session.accountId },
    include: {
      customer: {
        include: {
          addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
          orders: {
            where: { status: { not: "CANCELED" } },
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { items: true },
          },
        },
      },
    },
  });

  if (!account?.active) redirect("/login");
  const customer = account.customer;
  const total = customer.orders.reduce((sum, order) => sum + Number(order.total), 0);

  return (
    <main className="min-h-screen bg-[#f7f4ef] p-4 sm:p-6">
      <div className="mx-auto max-w-[760px] space-y-4">
        <header className="rounded-[28px] bg-[linear-gradient(135deg,#09090a,#281516)] p-6 text-white shadow-xl">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">Mi cuenta</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.025em]">{customer.name}</h1>
          <p className="mt-1 text-[12px] text-white/55">{customer.countryCode} {customer.phone}</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4"><span className="text-[9px] font-semibold uppercase text-neutral-400">Pedidos</span><b className="mt-2 block text-[22px] font-semibold">{customer.orders.length}</b></div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4"><span className="text-[9px] font-semibold uppercase text-neutral-400">Comprado</span><b className="mt-2 block text-[18px] font-semibold">{money(total)}</b></div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4"><span className="text-[9px] font-semibold uppercase text-neutral-400">Direcciones</span><b className="mt-2 block text-[22px] font-semibold">{customer.addresses.length}</b></div>
        </section>

        <section className="rounded-[24px] border border-neutral-200 bg-white p-5">
          <h2 className="text-[18px] font-semibold">Mis direcciones</h2>
          <div className="mt-3 space-y-2">
            {customer.addresses.length ? customer.addresses.map((address) => (
              <div key={address.id} className="rounded-xl bg-[#faf9f7] px-4 py-3"><b className="text-[12px] font-semibold">{address.label || (address.isDefault ? "Principal" : "Dirección")}</b><p className="mt-1 text-[11px] text-neutral-500">{address.address}{address.neighborhood ? ` · ${address.neighborhood}` : ""}</p></div>
            )) : <p className="text-[12px] text-neutral-400">No tienes direcciones registradas.</p>}
          </div>
        </section>

        <section className="rounded-[24px] border border-neutral-200 bg-white p-5">
          <h2 className="text-[18px] font-semibold">Pedidos recientes</h2>
          <div className="mt-3 space-y-2">
            {customer.orders.length ? customer.orders.map((order) => (
              <div key={order.id} className="rounded-xl border border-neutral-100 bg-[#faf9f7] px-4 py-3">
                <div className="flex items-center justify-between gap-3"><b className="text-[12px] font-semibold">Pedido #{order.sequenceNumber ?? order.id}</b><b className="text-[12px] font-semibold">{money(order.total)}</b></div>
                <p className="mt-1 text-[10px] text-neutral-500">{order.items.map((item) => `${item.quantity}× ${item.productName}`).join(" · ")}</p>
              </div>
            )) : <p className="text-[12px] text-neutral-400">Todavía no tienes pedidos registrados.</p>}
          </div>
        </section>

        <form action="/api/auth/customer/logout" method="post">
          <button className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[12px] font-semibold text-neutral-600">Cerrar sesión</button>
        </form>
      </div>
    </main>
  );
}
