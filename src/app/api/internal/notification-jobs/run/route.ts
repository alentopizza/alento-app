import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchReviewNotification } from "@/lib/notifier";
import {
  logInfo,
  reportOperationalIncident,
  requestIdFromHeaders,
} from "@/lib/observability";

export async function POST(request: NextRequest) {
  const requestId = requestIdFromHeaders(request.headers);
  const secret = process.env.NOTIFIER_SHARED_SECRET?.trim();
  if (!secret || request.headers.get("x-alento-notifier-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const jobs = await prisma.notificationJob.findMany({
    where: {
      status: "PENDING",
      runAt: { lte: now },
      attempts: { lt: 5 },
      OR: [
        { lockedAt: null },
        { lockedAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
      ],
    },
    orderBy: { runAt: "asc" },
    take: 10,
    include: {
      order: {
        select: {
          id: true,
          sequenceNumber: true,
          fulfillmentType: true,
          total: true,
          customerId: true,
          customer: {
            select: {
              name: true,
              countryCode: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  const results: Array<{ id: number; ok: boolean; reason?: string }> = [];

  for (const job of jobs) {
    const claimed = await prisma.notificationJob.updateMany({
      where: {
        id: job.id,
        status: "PENDING",
        OR: [
          { lockedAt: null },
          { lockedAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
        ],
      },
      data: { lockedAt: new Date() },
    });

    if (claimed.count !== 1) continue;

    try {
      if (job.kind !== "GOOGLE_REVIEW") {
        throw new Error(`Tipo de trabajo no soportado: ${job.kind}`);
      }

      const order = job.order;
      if (!order.customerId || !order.customer?.phone) {
        throw new Error("El pedido no tiene cliente con teléfono.");
      }

      const notification = await dispatchReviewNotification({
        orderId: order.id,
        customerId: order.customerId,
        customerName: order.customer.name,
        phone: `${order.customer.countryCode || "+57"}${order.customer.phone}`,
        orderCode: `POS-${String(order.sequenceNumber ?? order.id).padStart(4, "0")}`,
        total: Number(order.total),
        fulfillmentType: order.fulfillmentType,
      });

      if (!notification.ok) throw new Error(notification.reason);

      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: "SENT",
          attempts: { increment: 1 },
          sentAt: new Date(),
          lockedAt: null,
          lastError: null,
        },
      });
      logInfo(
        "NOTIFICATION_JOB_SENT",
        `Trabajo de notificación #${job.id} enviado correctamente.`,
        {
          requestId,
          source: "api/internal/notification-jobs/run",
          entityType: "NOTIFICATION_JOB",
          entityId: job.id,
          metadata: {
            kind: job.kind,
            orderId: job.orderId,
            attempt: job.attempts + 1,
          },
        },
      );
      results.push({ id: job.id, ok: true });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Error desconocido";
      const attempts = job.attempts + 1;
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          attempts,
          status: attempts >= 5 ? "FAILED" : "PENDING",
          runAt: attempts >= 5 ? job.runAt : new Date(Date.now() + 5 * 60_000),
          lockedAt: null,
          lastError: reason.slice(0, 1000),
        },
      });

      await reportOperationalIncident({
        level: attempts >= 5 ? "ERROR" : "WARNING",
        category: "JOBS",
        code:
          attempts >= 5
            ? "NOTIFICATION_JOB_EXHAUSTED"
            : "NOTIFICATION_JOB_RETRY",
        message: reason,
        requestId,
        source: "api/internal/notification-jobs/run",
        entityType: "NOTIFICATION_JOB",
        entityId: job.id,
        fingerprintKey: job.kind,
        metadata: {
          kind: job.kind,
          orderId: job.orderId,
          attempt: attempts,
          maxAttempts: 5,
        },
      });

      results.push({ id: job.id, ok: false, reason });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
