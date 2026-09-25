import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

export async function GET() {
  try {
    await requireStaffSession(["ADMIN", "POS", "CASHIER"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json({ error: forbidden ? "Sin permisos." : "No autorizado." }, { status: forbidden ? 403 : 401 });
  }

  const users = await prisma.user.findMany({
    where: {
      active: true,
      roles: { hasSome: ["DRIVER", "DISPATCH"] },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      whatsappCountryCode: true,
      whatsappPhone: true,
    },
  });

  const driverRows = await Promise.all(
    users.map(async (user) => {
      const [earnings, payouts] = await Promise.all([
        prisma.order.aggregate({
          where: {
            driverId: user.id,
            fulfillmentType: "DELIVERY",
            driverEarningCreditedAt: { not: null },
          },
          _sum: { driverEarningAmount: true },
        }),
        prisma.cashExpense.aggregate({
          where: { driverId: user.id },
          _sum: { amount: true },
        }),
      ]);

      const earnedTotal = Number(
        earnings._sum.driverEarningAmount ?? 0,
      );
      const paidTotal = Number(payouts._sum.amount ?? 0);

      return {
        id: user.id,
        name: user.name,
        whatsappCountryCode: user.whatsappCountryCode,
        whatsappPhone: user.whatsappPhone,
        ready: Boolean(user.whatsappPhone),
        earnedTotal,
        paidTotal,
        walletBalance: Math.max(0, earnedTotal - paidTotal),
      };
    }),
  );

  return NextResponse.json({ drivers: driverRows });
}
