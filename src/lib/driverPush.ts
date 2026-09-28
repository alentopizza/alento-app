import type { UserRole } from "@prisma/client";
import webPush from "web-push";
import { prisma } from "@/lib/prisma";

export type DriverPushResult = {
  ok: boolean;
  targeted: number;
  sent: number;
  failed: number;
  skipped: number;
  reason?: string;
};

type PushMessageInput = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  icon?: string;
  orderId?: number;
  kind?: string;
  requireInteraction?: boolean;
  campaignId?: string;
  imageUrl?: string | null;
};

type PushOwner =
  | { kind: "staff"; userId: number }
  | { kind: "customer"; customerId?: number | null };

function vapidConfig() {
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim();
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();

  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

export function pushPublicKey() {
  return vapidConfig()?.publicKey ?? null;
}

// Alias de compatibilidad para llamadas existentes.
export function driverPushPublicKey() {
  return pushPublicKey();
}

export function staffPushPublicKey() {
  return pushPublicKey();
}

function pushStatusCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  if (!("statusCode" in error)) return null;
  const value = Number((error as { statusCode?: unknown }).statusCode);
  return Number.isFinite(value) ? value : null;
}

export async function upsertPushSubscription(input: {
  owner: PushOwner;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  const ownerData =
    input.owner.kind === "staff"
      ? { userId: input.owner.userId, customerId: null }
      : { userId: null, customerId: input.owner.customerId ?? null };

  return prisma.driverPushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: {
      ...ownerData,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent?.slice(0, 500) || null,
    },
    create: {
      ...ownerData,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent?.slice(0, 500) || null,
    },
    select: {
      id: true,
      userId: true,
      customerId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function removePushSubscription(input: {
  endpoint: string;
  owner?: PushOwner;
}) {
  const ownerWhere =
    input.owner?.kind === "staff"
      ? { userId: input.owner.userId }
      : input.owner?.kind === "customer" && input.owner.customerId
        ? { customerId: input.owner.customerId }
        : {};

  await prisma.driverPushSubscription.deleteMany({
    where: {
      endpoint: input.endpoint,
      ...ownerWhere,
    },
  });
}

async function sendPushToSubscriptions(
  subscriptions: Array<{
    id: string;
    userId: number | null;
    customerId: number | null;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>,
  input: PushMessageInput,
): Promise<DriverPushResult> {
  const config = vapidConfig();
  if (!config) {
    return {
      ok: false,
      targeted: 0,
      sent: 0,
      failed: 0,
      skipped: 1,
      reason: "Web Push no está configurado.",
    };
  }

  if (!subscriptions.length) {
    return {
      ok: false,
      targeted: 0,
      sent: 0,
      failed: 0,
      skipped: 1,
      reason: "No hay dispositivos suscritos.",
    };
  }

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        const payload = JSON.stringify({
          title: input.title,
          body: input.body,
          url: input.url,
          tag: input.tag || "alento-push",
          icon:
            input.icon ||
            "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png",
          image: input.imageUrl || undefined,
          orderId: input.orderId,
          kind: input.kind,
          campaignId: input.campaignId,
          recipientKey: input.campaignId ? `web:${subscription.id}` : undefined,
          requireInteraction: input.requireInteraction ?? false,
        });

        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
          { TTL: 180, urgency: "high" },
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
          console.warn("Web push failed", {
            subscriptionId: subscription.id,
            userId: subscription.userId,
            customerId: subscription.customerId,
            statusCode,
            error: error instanceof Error ? error.message : "Unknown push error",
          });
        }
      }
    }),
  );

  return {
    ok: sent > 0,
    targeted: subscriptions.length,
    sent,
    failed,
    skipped: 0,
    ...(sent > 0
      ? {}
      : { reason: "No fue posible entregar la notificación push." }),
  };
}

async function sendPushToUserIds(
  userIds: number[],
  input: PushMessageInput,
): Promise<DriverPushResult> {
  const uniqueUserIds = [...new Set(userIds)].filter(
    (userId) => Number.isInteger(userId) && userId > 0,
  );

  if (!uniqueUserIds.length) {
    return {
      ok: false,
      targeted: 0,
      sent: 0,
      failed: 0,
      skipped: 1,
      reason: "No hay usuarios destinatarios.",
    };
  }

  const subscriptions = await prisma.driverPushSubscription.findMany({
    where: { userId: { in: uniqueUserIds } },
    select: {
      id: true,
      userId: true,
      customerId: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  return sendPushToSubscriptions(subscriptions, input);
}

export async function sendDriverPush(input: {
  driverId: number;
  title: string;
  body: string;
  url: string;
  tag?: string;
}): Promise<DriverPushResult> {
  return sendPushToUserIds([input.driverId], input);
}

export async function sendStaffPushToRoles(input: {
  roles: UserRole[];
  title: string;
  body: string;
  url: string;
  tag?: string;
  orderId?: number;
  kind?: string;
  requireInteraction?: boolean;
  campaignId?: string;
  imageUrl?: string | null;
}): Promise<DriverPushResult> {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, roles: true },
  });

  const roleSet = new Set<UserRole>(input.roles);
  const userIds = users
    .filter((user) => user.roles.some((role) => roleSet.has(role)))
    .map((user) => user.id);

  return sendPushToUserIds(userIds, input);
}

export async function sendCustomerPush(
  input: PushMessageInput,
): Promise<DriverPushResult> {
  const subscriptions = await prisma.driverPushSubscription.findMany({
    where: {
      userId: null,
    },
    select: {
      id: true,
      userId: true,
      customerId: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  return sendPushToSubscriptions(subscriptions, input);
}
