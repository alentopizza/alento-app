import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCustomerSession, getStaffSession } from "@/lib/auth";
import PublicBrandHeader from "@/components/PublicBrandHeader";
import LivePageRefresh from "@/components/LivePageRefresh";

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
          addresses: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            take: 1,
          },
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

  return (
    <>
      <LivePageRefresh
        intervalMs={8000}
        scopes={["orders", "customers", "account"]}
      />
      <PublicBrandHeader />

      <main className="min-h-screen bg-[#080808] px-4 pb-28 pt-4 text-white sm:px-6 sm:pb-28 sm:pt-6">
        <div className="mx-auto max-w-[760px] space-y-4">
          <header className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(226,26,34,.16),transparent_34%),linear-gradient(145deg,#171717,#090909_72%)] p-5 shadow-[0_20px_60px_rgba(0,0,0,.34)] sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff454b]">
              Mi cuenta
            </p>
            <h1 className="mt-2 text-[28px] font-black tracking-[-0.035em] text-white">
              {customer.name}
            </h1>
            <p className="mt-1 text-[12px] font-medium text-white/48">
              {customer.countryCode} {customer.phone}
            </p>
          </header>

          <section className="rounded-[24px] border border-white/10 bg-white p-5 text-neutral-950 shadow-[0_16px_40px_rgba(0,0,0,.20)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#e21a22]">
                  Entrega
                </p>
                <h2 className="mt-1 text-[18px] font-black tracking-[-0.02em]">
                  Dirección de entrega
                </h2>
              </div>

              {customer.addresses[0] && (
                <span className="rounded-full bg-[#111] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-white">
                  Guardada
                </span>
              )}
            </div>

            <div className="mt-4">
              {customer.addresses[0] ? (
                <div className="rounded-[18px] border border-neutral-200 bg-[#fafafa] px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111] text-white">
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                        <circle cx="12" cy="10" r="2.4" />
                      </svg>
                    </div>

                    <div className="min-w-0">
                      <b className="block text-[12px] text-neutral-900">
                        {customer.addresses[0].formattedAddress ||
                          customer.addresses[0].address}
                      </b>
                      {(customer.addresses[0].neighborhood ||
                        customer.addresses[0].city) && (
                        <p className="mt-1 text-[10px] text-neutral-500">
                          {[
                            customer.addresses[0].neighborhood,
                            customer.addresses[0].city,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[18px] border border-dashed border-[#e21a22]/25 bg-[#e21a22]/[0.04] px-4 py-4">
                  <b className="text-[12px] text-neutral-900">
                    Sin dirección registrada
                  </b>
                  <p className="mt-1 text-[10px] leading-4 text-neutral-500">
                    Podrás agregarla y validarla con Google Maps cuando hagas
                    un pedido a domicilio.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-white p-5 text-neutral-950 shadow-[0_16px_40px_rgba(0,0,0,.20)]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#e21a22]">
                  Historial
                </p>
                <h2 className="mt-1 text-[18px] font-black tracking-[-0.02em]">
                  Pedidos recientes
                </h2>
              </div>

              {customer.orders.length > 0 && (
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-bold text-neutral-500">
                  {customer.orders.length}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-2.5">
              {customer.orders.length ? (
                customer.orders.map((order) => (
                  <div
                    key={order.id}
                    className={
                      "rounded-[18px] border px-4 py-3.5 " +
                      (order.status === "CANCELED"
                        ? "border-[#e21a22]/20 bg-[#e21a22]/[0.045]"
                        : "border-neutral-200 bg-[#fafafa]")
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <b className="text-[12px] font-black text-neutral-900">
                            Pedido #{order.sequenceNumber ?? order.id}
                          </b>

                          {order.status === "CANCELED" && (
                            <span className="rounded-full bg-[#e21a22] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.07em] text-white">
                              Cancelado
                            </span>
                          )}
                        </div>

                        <p
                          className={
                            "mt-1.5 text-[10px] leading-4 " +
                            (order.status === "CANCELED"
                              ? "text-[#e21a22]/70"
                              : "text-neutral-500")
                          }
                        >
                          {order.items
                            .map(
                              (item) =>
                                `${item.quantity}× ${item.productName}`,
                            )
                            .join(" · ")}
                        </p>
                      </div>

                      <b
                        className={
                          "shrink-0 text-[12px] font-black " +
                          (order.status === "CANCELED"
                            ? "text-neutral-400 line-through"
                            : "text-neutral-950")
                        }
                      >
                        {money(order.total)}
                      </b>
                    </div>

                    {order.status === "CANCELED" && (
                      <p className="mt-2 border-t border-[#e21a22]/10 pt-2 text-[9px] font-semibold text-[#e21a22]/65">
                        Pedido conservado en tu historial.
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-neutral-200 px-4 py-5 text-center">
                  <p className="text-[11px] text-neutral-400">
                    Todavía no tienes pedidos registrados.
                  </p>
                </div>
              )}
            </div>
          </section>

          <form action="/api/auth/customer/logout" method="post">
            <button className="h-12 w-full rounded-full border border-white/12 bg-[#111] px-4 text-[11px] font-bold text-white/72 transition hover:border-[#e21a22]/50 hover:text-white">
              Cerrar sesión
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
