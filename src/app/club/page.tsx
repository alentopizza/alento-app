import Link from "next/link";
import PublicBrandHeader from "@/components/PublicBrandHeader";
import { getCustomerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CLUB_ALENTO_SETTING_KEY,
  DEFAULT_CLUB_ALENTO_SETTINGS,
  normalizeClubAlentoSettings,
} from "@/lib/clubAlento";

function money(value: unknown) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function GuestClub({
  pointsPerThousand,
}: {
  pointsPerThousand: number;
}) {
  return (
    <>
      <PublicBrandHeader />
      <main className="min-h-screen bg-[#090909] px-4 pb-28 pt-5 text-white sm:px-6 md:pb-28 md:pt-[74px]">
      <div className="mx-auto max-w-[860px] space-y-4">
        <header className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(226,26,34,.28),transparent_35%),linear-gradient(135deg,#180708,#090909_62%)] p-6 shadow-2xl sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#e21a22]">
                Club Alentó
              </p>
              <h1 className="mt-3 max-w-[560px] text-[34px] font-black leading-[.98] tracking-[-0.05em] sm:text-[48px]">
                Cada compra te acerca a tu próxima recompensa.
              </h1>
              <p className="mt-4 max-w-[560px] text-[13px] leading-6 text-white/52">
                Inicia sesión y acumula puntos con cada compra. Luego podrás canjearlos por
                productos, bordes e ingredientes extra.
              </p>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#e21a22] text-2xl shadow-[0_12px_30px_rgba(226,26,34,.32)]">
              ★
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3">
              <p className="text-[11px] leading-5 text-white/48">
                Actualmente recibes{" "}
                <b className="text-white">{pointsPerThousand} puntos</b> por cada
                <b className="text-white"> $1.000</b> en compras completadas.
              </p>
            </div>

            <Link
              href="/login"
              className="flex h-12 items-center justify-center rounded-full bg-[#e21a22] px-6 text-[12px] font-bold text-white shadow-[0_10px_24px_rgba(226,26,34,.26)] transition hover:bg-[#ef1c25]"
            >
              Iniciar sesión
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            ["🍕", "Productos", "Canjea puntos por productos seleccionados."],
            ["🧀", "Bordes", "Usa tus puntos para mejorar tu pizza."],
            ["＋", "Extras", "Agrega ingredientes extra con tus puntos."],
          ].map(([icon, title, description]) => (
            <div
              key={title}
              className="rounded-[20px] border border-white/10 bg-[#131313] p-3 text-center sm:p-5"
            >
              <span className="text-2xl">{icon}</span>
              <b className="mt-2 block text-[11px] sm:text-[13px]">{title}</b>
              <p className="mt-1 hidden text-[10px] leading-4 text-white/32 sm:block">
                {description}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-[26px] border border-white/10 bg-[#111] p-5 sm:p-6">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#e21a22]">
            ¿Cómo funciona?
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["01", "Compra", "Haz tus pedidos usando tu cuenta de Alentó."],
              ["02", "Acumula", "Suma " + pointsPerThousand + " puntos por cada $1.000 gastados."],
              ["03", "Canjea", "Usa tus puntos en recompensas del Club Alentó."],
            ].map(([step, title, description]) => (
              <div
                key={step}
                className="rounded-[18px] border border-white/[0.07] bg-white/[0.025] p-4"
              >
                <span className="text-[10px] font-black text-[#e21a22]">{step}</span>
                <b className="mt-2 block text-[14px]">{title}</b>
                <p className="mt-1 text-[10px] leading-5 text-white/35">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[26px] border border-red-500/15 bg-[linear-gradient(135deg,rgba(226,26,34,.13),rgba(255,255,255,.02))] p-5 text-center sm:p-6">
          <h2 className="text-[20px] font-semibold tracking-[-0.03em]">
            Empieza a sumar desde tu próxima compra
          </h2>
          <p className="mx-auto mt-2 max-w-[480px] text-[11px] leading-5 text-white/40">
            Ingresa con tu celular para identificar tus compras y mantener tus puntos asociados a tu cuenta.
          </p>

          <div className="mt-4 flex justify-center gap-2">
            <Link
              href="/login"
              className="rounded-full bg-[#e21a22] px-5 py-3 text-[11px] font-bold text-white"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/menu"
              className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-[11px] font-bold text-white/65"
            >
              Ver menú
            </Link>
          </div>
        </section>
      </div>
    </main>
    </>
  );
}

export default async function ClubPage() {
  const session = await getCustomerSession();

  const settingsRow = await prisma.appSetting.findUnique({
    where: { key: CLUB_ALENTO_SETTING_KEY },
  });

  const settings = settingsRow
    ? normalizeClubAlentoSettings(settingsRow.value)
    : DEFAULT_CLUB_ALENTO_SETTINGS;

  if (!session) {
    return <GuestClub pointsPerThousand={settings.pointsPerThousand} />;
  }

  const account = await prisma.customerAccount.findUnique({
    where: { id: session.accountId },
    include: {
      customer: {
        include: {
          clubPoints: {
            orderBy: { createdAt: "desc" },
            take: 20,
            include: {
              order: {
                select: {
                  id: true,
                  sequenceNumber: true,
                  total: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!account?.active) {
    return <GuestClub pointsPerThousand={settings.pointsPerThousand} />;
  }

  const customer = account.customer;
  const balance = await prisma.clubPointTransaction.aggregate({
    where: { customerId: customer.id },
    _sum: { points: true },
  });
  const points = balance._sum.points ?? 0;

  return (
    <>
      <PublicBrandHeader />
      <main className="min-h-screen bg-[#090909] px-4 pb-28 pt-5 text-white sm:px-6 md:pb-28 md:pt-[74px]">
      <div className="mx-auto max-w-[860px] space-y-4">
        <header className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,#180708,#090909_60%)] p-6 shadow-2xl sm:p-8">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#e21a22]">Club Alentó</p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-[42px] font-black leading-none tracking-[-0.055em] sm:text-[56px]">
                {points.toLocaleString("es-CO")}
              </h1>
              <p className="mt-2 text-[13px] font-semibold text-white/55">puntos disponibles</p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e21a22] text-2xl shadow-[0_12px_30px_rgba(226,26,34,.32)]">
              ★
            </div>
          </div>

        </header>

        <section className="rounded-[26px] border border-white/10 bg-[#111] p-5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#e21a22]">Próximamente</p>
            <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">Canjea tus puntos</h2>
            <p className="mt-2 text-[12px] leading-5 text-white/38">
              Aquí podrás cambiar puntos por productos, bordes e ingredientes extra.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["🍕", "Productos"],
              ["🧀", "Bordes"],
              ["＋", "Extras"],
            ].map(([icon, label]) => (
              <div key={label} className="rounded-[16px] border border-white/8 bg-white/[0.035] p-3 text-center">
                <span className="text-xl">{icon}</span>
                <b className="mt-2 block text-[10px] text-white/55">{label}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[26px] border border-white/10 bg-[#111] p-5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/28">Actividad</p>
            <h2 className="mt-1 text-[20px] font-semibold">Tus últimos puntos</h2>
          </div>

          <div className="mt-4 space-y-2">
            {customer.clubPoints.length ? (
              customer.clubPoints.map((movement) => (
                <div key={movement.id} className="flex items-center justify-between gap-3 rounded-[16px] border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                  <div className="min-w-0">
                    <b className="block text-[12px]">
                      Pedido #{movement.order?.sequenceNumber ?? movement.order?.id ?? "—"}
                    </b>
                    <span className="mt-1 block text-[10px] text-white/30">
                      {movement.amountBase != null ? money(movement.amountBase) : "Movimiento Club"}
                    </span>
                  </div>
                  <b className={`text-[13px] ${movement.points >= 0 ? "text-emerald-400" : "text-[#ff3439]"}`}>
                    {movement.points >= 0 ? "+" : ""}{movement.points.toLocaleString("es-CO")} pts
                  </b>
                </div>
              ))
            ) : (
              <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.025] px-4 py-6 text-center text-[11px] text-white/35">
                Completa una compra para empezar a sumar puntos.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
    </>
  );
}
