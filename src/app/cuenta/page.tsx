import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCustomerSession, getStaffSession } from "@/lib/auth";
import PublicBrandHeader from "@/components/PublicBrandHeader";
import LivePageRefresh from "@/components/LivePageRefresh";
import CustomerAccountHeader from "@/components/CustomerAccountHeader";
import CustomerPushControl from "@/components/CustomerPushControl";
import {
  bogotaDateTime,
  fulfillmentLabel,
  presentOrderItemConfiguration,
} from "@/lib/orderPresentation";

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
          <CustomerAccountHeader
            name={customer.name}
            phone={`${customer.countryCode} ${customer.phone ?? ""}`.trim()}
          />

          <CustomerPushControl />

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

            <div className="mt-4 space-y-3">
              {customer.orders.length ? (
                customer.orders.map((order) => (
                  <article
                    key={order.id}
                    className={
                      "overflow-hidden rounded-[20px] border " +
                      (order.status === "CANCELED"
                        ? "border-[#e21a22]/25 bg-[#fffafa]"
                        : "border-neutral-200 bg-white")
                    }
                  >
                    <div className="border-b border-neutral-200 px-4 py-3.5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <b className="text-[12px] font-black text-neutral-900">
                              Pedido #{order.sequenceNumber ?? order.id}
                            </b>

                            <span className="rounded-full bg-[#111] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-white">
                              {fulfillmentLabel(order.fulfillmentType)}
                            </span>

                            {order.status === "CANCELED" && (
                              <span className="rounded-full bg-[#e21a22] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.07em] text-white">
                                Cancelado
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-[9px] text-neutral-400">
                            {bogotaDateTime(order.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-neutral-200">
                      {order.items.map((item) => {
                        const details =
                          presentOrderItemConfiguration(item.configuration);

                        return (
                          <div key={item.id} className="px-4 py-3.5">
                            <div className="flex items-start gap-3">
                              <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-xl bg-[#e21a22] px-2 text-[10px] font-black text-white shadow-[0_6px_14px_rgba(226,26,34,.16)]">
                                {item.quantity}×
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <b className="block text-[12px] font-black leading-5 text-neutral-900">
                                      {item.productName}
                                    </b>
                                    {item.variantName && (
                                      <span className="mt-0.5 block text-[9px] font-semibold text-neutral-500">
                                        {item.variantName}
                                      </span>
                                    )}
                                  </div>

                                  <b
                                    className={
                                      "shrink-0 text-[12px] font-black " +
                                      (order.status === "CANCELED"
                                        ? "text-neutral-400 line-through"
                                        : "text-neutral-950")
                                    }
                                  >
                                    {money(item.lineTotal)}
                                  </b>
                                </div>

                                {details.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {details.map((detail, index) => (
                                      <p
                                        key={`${detail.label}-${detail.value}-${index}`}
                                        className="text-[9px] leading-4 text-neutral-500"
                                      >
                                        <span className="font-bold text-neutral-600">
                                          {detail.label}:
                                        </span>{" "}
                                        {detail.value}
                                      </p>
                                    ))}
                                  </div>
                                )}

                                {item.notes && (
                                  <p className="mt-2 rounded-lg border border-[#e21a22]/15 bg-[#e21a22]/[0.05] px-2.5 py-1.5 text-[9px] leading-4 text-neutral-700">
                                    Nota: {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-neutral-900 bg-[#111] px-4 py-3.5 text-white">
                      <div className="flex items-center justify-between gap-4 text-[10px]">
                        <span className="text-white/48">Subtotal</span>
                        <b>{money(order.subtotal)}</b>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-4 text-[10px]">
                        <span className="text-white/48">Domicilio</span>
                        <b className="text-[#ff454b]">
                          {money(order.deliveryFee)}
                        </b>
                      </div>

                      {Number(order.discount) > 0 && (
                        <div className="mt-2 flex items-center justify-between gap-4 text-[10px]">
                          <span className="text-[#ff7a7e]">Descuento</span>
                          <b className="text-[#ff7a7e]">
                            − {money(order.discount)}
                          </b>
                        </div>
                      )}

                      <div className="mt-3 flex items-end justify-between gap-4 border-t border-white/10 pt-3">
                        <span className="text-[9px] font-black uppercase tracking-[0.08em] text-white/55">
                          Total
                        </span>
                        <strong
                          className={
                            "text-[18px] font-black tracking-[-0.03em] " +
                            (order.status === "CANCELED"
                              ? "text-white/40 line-through"
                              : "text-white")
                          }
                        >
                          {money(order.total)}
                        </strong>
                      </div>
                    </div>

                    {order.status === "CANCELED" && (
                      <div className="border-t border-[#e21a22]/10 bg-[#e21a22]/[0.04] px-4 py-2.5">
                        <p className="text-[9px] font-semibold text-[#e21a22]/70">
                          Pedido conservado en tu historial. No genera puntos ni suma como compra.
                        </p>
                      </div>
                    )}
                  </article>
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

        </div>
      </main>
    </>
  );
}
