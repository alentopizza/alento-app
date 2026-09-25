import webPush from "web-push";
import { prisma } from "@/lib/prisma";

export type DriverPushResult = {
  ok: boolean;
  sent: number;
  failed: number;
  skipped: number;
  reason?: string;
};

function vapidConfig() {
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim();
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();

  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

export function driverPushPublicKey() {
  return vapidConfig()?.publicKey ?? null;
}

function pushStatusCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  if (!("statusCode" in error)) return null;
  const value = Number((error as { statusCode?: unknown }).statusCode);
  return Number.isFinite(value) ? value : null;
}

export async function sendDriverPush(input: {
  driverId: number;
  title: string;
  body: string;
  url: string;
  tag?: string;
}): Promise<DriverPushResult> {
  const config = vapidConfig();
  if (!config) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      skipped: 1,
      reason: "Web Push no está configurado.",
    };
  }

  webPush.setVapidDetails(
    config.subject,
    config.publicKey,
    config.privateKey,
  );

  const subscriptions = await prisma.driverPushSubscription.findMany({
    where: { userId: input.driverId },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  if (!subscriptions.length) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      skipped: 1,
      reason: "El repartidor no tiene dispositivos suscritos.",
    };
  }

  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url,
    tag: input.tag || "alento-driver",
    icon:
      "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png",
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
          {
            TTL: 180,
            urgency: "high",
          },
        );

        sent += 1;
        await prisma.driverPushSubscription.update({
          where: { id: subscription.id },
          data: { lastSuccessAt: new Date() },
        });
      } catch (error) {
        failed += 1;
        const statusCode = pushStatusCode(error);

        if (statusCode === 404 || statusCode === 410) {
          await prisma.driverPushSubscription
            .delete({ where: { id: subscription.id } })
            .catch(() => undefined);
        } else {
          console.warn("Driver push failed", {
            driverId: input.driverId,
            subscriptionId: subscription.id,
            statusCode,
            error:
              error instanceof Error ? error.message : "Unknown push error",
          });
        }
      }
    }),
  );

  return {
    ok: sent > 0,
    sent,
    failed,
    skipped: 0,
    ...(sent > 0
      ? {}
      : { reason: "No fue posible entregar la notificación push." }),
  };
}
