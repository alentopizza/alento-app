import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

type CustomerSummary = {
  id: number;
  name: string;
  countryCode: string;
  phone: string | null;
  email: string | null;
  points: number;
  earnedPoints: number;
  redeemedPoints: number;
  movements: number;
  purchases: number;
  lastMovementAt: Date | null;
};

export async function GET() {
  try {
    await requireStaffSession(["ADMIN"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  try {
    const transactions = await prisma.clubPointTransaction.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            countryCode: true,
            phone: true,
            email: true,
          },
        },
        order: {
          select: {
            status: true,
          },
        },
      },
    });

    const customers = new Map<number, CustomerSummary>();

    for (const transaction of transactions) {
      if (transaction.order?.status === "CANCELED") continue;

      const points = Number(transaction.points);
      const current = customers.get(transaction.customerId) ?? {
        id: transaction.customer.id,
        name: transaction.customer.name,
        countryCode: transaction.customer.countryCode,
        phone: transaction.customer.phone,
        email: transaction.customer.email,
        points: 0,
        earnedPoints: 0,
        redeemedPoints: 0,
        movements: 0,
        purchases: 0,
        lastMovementAt: null,
      };

      current.points += points;
      current.earnedPoints += Math.max(0, points);
      current.redeemedPoints += Math.abs(Math.min(0, points));
      current.movements += 1;
      if (points > 0 && transaction.reason === "PURCHASE") current.purchases += 1;
      if (!current.lastMovementAt || transaction.createdAt > current.lastMovementAt) {
        current.lastMovementAt = transaction.createdAt;
      }

      customers.set(transaction.customerId, current);
    }

    const installations = await prisma.customerAppInstallation.findMany({
      select: {
        customerId: true,
        platform: true,
        firstDetectedAt: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: "desc" },
    });

    const appByCustomer = new Map<
      number,
      {
        devices: number;
        platforms: Set<string>;
        firstDetectedAt: Date;
        lastSeenAt: Date;
      }
    >();

    for (const installation of installations) {
      const current = appByCustomer.get(installation.customerId);
      if (!current) {
        appByCustomer.set(installation.customerId, {
          devices: 1,
          platforms: new Set([installation.platform]),
          firstDetectedAt: installation.firstDetectedAt,
          lastSeenAt: installation.lastSeenAt,
        });
        continue;
      }

      current.devices += 1;
      current.platforms.add(installation.platform);
      if (installation.firstDetectedAt < current.firstDetectedAt) {
        current.firstDetectedAt = installation.firstDetectedAt;
      }
      if (installation.lastSeenAt > current.lastSeenAt) {
        current.lastSeenAt = installation.lastSeenAt;
      }
    }

    const ranking = [...customers.values()]
      .filter((customer) => customer.points > 0)
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.earnedPoints - a.earnedPoints ||
          a.name.localeCompare(b.name, "es"),
      )
      .map((customer, index) => {
        const app = appByCustomer.get(customer.id);

        return {
          ...customer,
          rank: index + 1,
          lastMovementAt: customer.lastMovementAt?.toISOString() ?? null,
          appInstalled: Boolean(app),
          appDevices: app?.devices ?? 0,
          appPlatforms: app ? [...app.platforms] : [],
          appFirstDetectedAt: app?.firstDetectedAt.toISOString() ?? null,
          appLastSeenAt: app?.lastSeenAt.toISOString() ?? null,
        };
      });

    return NextResponse.json({
      customers: ranking,
      summary: {
        customersWithPoints: ranking.length,
        pointsInCirculation: ranking.reduce(
          (sum, customer) => sum + customer.points,
          0,
        ),
        totalEarnedPoints: [...customers.values()].reduce(
          (sum, customer) => sum + customer.earnedPoints,
          0,
        ),
        totalRedeemedPoints: [...customers.values()].reduce(
          (sum, customer) => sum + customer.redeemedPoints,
          0,
        ),
        customersWithApp: ranking.filter((customer) => customer.appInstalled).length,
        appDevices: ranking.reduce(
          (sum, customer) => sum + customer.appDevices,
          0,
        ),
      },
    });
  } catch (error) {
    console.error("Club points ranking error", error);
    return NextResponse.json(
      { error: "No fue posible cargar el ranking de Club Alentó." },
      { status: 500 },
    );
  }
}
