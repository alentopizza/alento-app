import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCustomerSession, getStaffSession } from "@/lib/auth";
import PublicBrandHeader from "@/components/PublicBrandHeader";

function money(value: unknown) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function staffHome(roles: string[]) {
  if (roles.includes("ADMIN") || roles.includes("POS") || roles.includes("CASHIER")) return "/interno";
  if (roles.includes("KITCHEN")) return "/cocina";
  return "/sin-acceso";
}

export default async function CustomerAccountPage() {
  const staffSession = await getStaffSession();
  if (staffSession) redirect(staffHome(staffSession.roles));

  const session = await getCustomerSession();
  if (!session) redirect("/login");

  const account = await prisma.customerAccount.findUnique({
    where: { id: session.accountId },
    include: {
      customer: {
        include: {
          addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
          clubPoints: { orderBy: { createdAt: "desc" } },
          orders: {
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
  const validOrders = customer.orders.filter((order) => order.status !== "CANCELED");
  const total = validOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const clubPoints = customer.clubPoints.reduce((sum, movement) => sum + movement.points, 0);

  return (
    <>
      <PublicBrandHeader />
      <main className="min-h-screen bg-[#f7f4ef] px-4 pb-28 pt-4 sm:p-6 sm:pb-28">
      <div className="mx-auto max-w-[760px] space-y-4">
        <header className="rounded-[28px] bg-[linear-gradient(135deg,#09090a,#281516)] p-6 text-white shadow-xl">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">Mi cuenta</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.025em]">{customer.name}</h1>
          <p className="mt-1 text-[12px] text-white/55">{customer.countryCode} {customer.phone}</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4"><span className="text-[9px] font-semibold uppercase text-neutral-400">Pedidos</span><b className="mt-2 block text-[22px] font-semibold">{validOrders.length}</b></div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4"><span className="text-[9px] font-semibold uppercase text-neutral-400">Comprado</span><b className="mt-2 block text-[18px] font-semibold">{money(total)}</b></div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4"><span className="text-[9px] font-semibold uppercase text-neutral-400">Direcciones</span><b className="mt-2 block text-[22px] font-semibold">{customer.addresses.length}</b></div>
          <div className="rounded-2xl border border-red-100 bg-[#fff7f7] p-4"><span className="text-[9px] font-semibold uppercase text-red-400">Club Alentó</span><b className="mt-2 block text-[22px] font-semibold text-[#e21a22]">{clubPoints.toLocaleString("es-CO")} pts</b></div>
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
              <div
                key={order.id}
                className={
                  "rounded-xl border px-4 py-3 " +
                  (order.status === "CANCELED"
                    ? "border-red-100 bg-red-50/55"
                    : "border-neutral-100 bg-[#faf9f7]")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-[12px] font-semibold">
                        Pedido #{order.sequenceNumber ?? order.id}
                      </b>
                      {order.status === "CANCELED" && (
                        <span className="rounded-full border border-red-200 bg-white px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-red-600">
                          Cancelado
                        </span>
                      )}
                    </div>
                    <p
                      className={
                        "mt-1 text-[10px] " +
                        (order.status === "CANCELED"
                          ? "text-red-400/80"
                          : "text-neutral-500")
                      }
                    >
                      {order.items.map((item) => `${item.quantity}× ${item.productName}`).join(" · ")}
                    </p>
                  </div>
                  <b
                    className={
                      "shrink-0 text-[12px] font-semibold " +
                      (order.status === "CANCELED"
                        ? "text-neutral-400 line-through"
                        : "")
                    }
                  >
                    {money(order.total)}
                  </b>
                </div>
                {order.status === "CANCELED" && (
                  <p className="mt-2 text-[9px] font-semibold text-red-500/80">
                    Este pedido no cuenta como compra ni genera puntos del Club Alentó.
                  </p>
                )}
              </div>
            )) : <p className="text-[12px] text-neutral-400">Todavía no tienes pedidos registrados.</p>}
          </div>
        </section>

        <form action="/api/auth/customer/logout" method="post">
          <button className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[12px] font-semibold text-neutral-600">Cerrar sesión</button>
        </form>
      </div>

    </main>
    </>
  );
}
