import webPush from "web-push";
import { prisma } from "@/lib/prisma";

type PushMessageInput = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  kind?: string;
  requireInteraction?: boolean;
  campaignId?: string;
  imageUrl?: string | null;
};

function vapidConfig() {
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim();
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

export function customerPushPublicKey() {
  return vapidConfig()?.publicKey ?? null;
}

function pushStatusCode(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return null;
  const value = Number((error as { statusCode?: unknown }).statusCode);
  return Number.isFinite(value) ? value : null;
}

export async function upsertCustomerPushSubscription(input: {
  customerId?: number | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  return prisma.customerPushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: {
      customerId: input.customerId ?? null,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent?.slice(0, 500) || null,
    },
    create: {
      customerId: input.customerId ?? null,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent?.slice(0, 500) || null,
    },
    select: { id: true, customerId: true, createdAt: true, updatedAt: true },
  });
}

export async function removeCustomerPushSubscription(endpoint: string) {
  await prisma.customerPushSubscription.deleteMany({ where: { endpoint } });
}

export async function sendCustomerPush(input: PushMessageInput) {
  const config = vapidConfig();
  if (!config) return { ok: false, targeted: 0, sent: 0, failed: 0, skipped: 1, reason: "Web Push no está configurado." };

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const subscriptions = await prisma.customerPushSubscription.findMany({
    select: { id: true, customerId: true, endpoint: true, p256dh: true, auth: true },
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      const payload = JSON.stringify({
        title: input.title,
        body: input.body,
        url: input.url,
        tag: input.tag || "alento-clientes",
        icon: "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png",
        image: input.imageUrl || undefined,
        kind: input.kind,
        campaignId: input.campaignId,
        recipientKey: input.campaignId ? `web-customer:${subscription.id}` : undefined,
        requireInteraction: input.requireInteraction ?? false,
      });

      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        { TTL: 180, urgency: "high" },
      );
      sent += 1;
      await prisma.customerPushSubscription.update({
        where: { id: subscription.id },
        data: { lastSuccessAt: new Date() },
      });
    } catch (error) {
      failed += 1;
      const statusCode = pushStatusCode(error);
      if (statusCode === 404 || statusCode === 410) {
        await prisma.customerPushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
      } else {
        console.warn("Customer push failed", {
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          statusCode,
          error: error instanceof Error ? error.message : "Unknown push error",
        });
      }
    }
  }));

  return {
    ok: sent > 0,
    targeted: subscriptions.length,
    sent,
    failed,
    skipped: subscriptions.length ? 0 : 1,
    ...(sent > 0 ? {} : { reason: subscriptions.length ? "No fue posible entregar la notificación push." : "No hay clientes suscritos." }),
  };
}
