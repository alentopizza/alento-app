const { PrismaClient } = require("@prisma/client");

function safeTarget(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      port: url.port || "5432",
      database: url.pathname.replace(/^\//, "") || "(default)",
      schema: url.searchParams.get("schema") || "public",
    };
  } catch {
    return {
      host: "(unknown)",
      port: "(unknown)",
      database: "(unknown)",
      schema: "(unknown)",
    };
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const prisma = new PrismaClient();

  try {
    const target = safeTarget(databaseUrl);

    const [
      customers,
      users,
      products,
      orders,
      payments,
      appSettings,
      coupons,
      cashSessions,
      clubTransactions,
      workShifts,
      latestOrder,
      migrations,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.user.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.payment.count(),
      prisma.appSetting.count(),
      prisma.coupon.count(),
      prisma.cashRegisterSession.count(),
      prisma.clubPointTransaction.count(),
      prisma.workShift.count(),
      prisma.order.findFirst({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          sequenceNumber: true,
          source: true,
          status: true,
          total: true,
          createdAt: true,
        },
      }),
      prisma.$queryRawUnsafe(
        'SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC NULLS LAST LIMIT 5',
      ),
    ]);

    const summary = {
      target,
      counts: {
        customers,
        users,
        products,
        orders,
        payments,
        appSettings,
        coupons,
        cashSessions,
        clubTransactions,
        workShifts,
      },
      latestOrder: latestOrder
        ? {
            id: latestOrder.id,
            sequenceNumber: latestOrder.sequenceNumber,
            source: latestOrder.source,
            status: latestOrder.status,
            total: Number(latestOrder.total),
            createdAt: latestOrder.createdAt.toISOString(),
          }
        : null,
      recentMigrations: migrations.map((item) => ({
        migrationName: item.migration_name,
        finishedAt:
          item.finished_at instanceof Date
            ? item.finished_at.toISOString()
            : item.finished_at,
      })),
    };

    console.log("Database restore verification: OK");
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Database restore verification: FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
