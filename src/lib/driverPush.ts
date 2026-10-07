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


export async function migrateLegacyCustomerPushSubscriptions() {
  const legacy = await prisma.customerPushSubscription.findMany({
    select: {
      id: true,
      customerId: true,
      endpoint: true,
      p256dh: true,
      auth: true,
      userAgent: true,
      lastSuccessAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!legacy.length) return 0;

  for (const subscription of legacy) {
    await prisma.driverPushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        customerId: subscription.customerId,
        customerOptIn: true,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent: subscription.userAgent,
        lastSuccessAt: subscription.lastSuccessAt,
      },
      create: {
        id: subscription.id,
        userId: null,
        customerId: subscription.customerId,
        staffOptIn: false,
        customerOptIn: true,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent: subscription.userAgent,
        lastSuccessAt: subscription.lastSuccessAt,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      },
    });
  }

  await prisma.customerPushSubscription.deleteMany({
    where: { id: { in: legacy.map((item) => item.id) } },
  });

  // Una fila sin usuario interno nunca debe pertenecer a la audiencia Staff.
  // Limpia flags heredados de la migración inicial, cuyo default histórico era true.
  await prisma.driverPushSubscription.updateMany({
    where: {
      userId: null,
      staffOptIn: true,
    },
    data: {
      staffOptIn: false,
    },
  });

  return legacy.length;
}

export async function upsertPushSubscription(input: {
  owner: PushOwner;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
  clearStaffOwner?: boolean;
}) {
  const updateOwnerData =
    input.owner.kind === "staff"
      ? {
          userId: input.owner.userId,
          staffOptIn: true,
        }
      : {
          customerId: input.owner.customerId ?? null,
          customerOptIn: true,
          ...(input.clearStaffOwner
            ? {
                userId: null,
                staffOptIn: false,
              }
            : {}),
        };

  const createOwnerData =
    input.owner.kind === "staff"
      ? {
          userId: input.owner.userId,
          customerId: null,
          staffOptIn: true,
          customerOptIn: false,
        }
      : {
          userId: null,
          customerId: input.owner.customerId ?? null,
          staffOptIn: false,
          customerOptIn: true,
        };

  return prisma.driverPushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: {
      ...updateOwnerData,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent?.slice(0, 500) || null,
    },
    create: {
      ...createOwnerData,
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
  const subscription = await prisma.driverPushSubscription.findUnique({
    where: { endpoint: input.endpoint },
    select: {
      id: true,
      userId: true,
      customerId: true,
      staffOptIn: true,
      customerOptIn: true,
    },
  });

  if (!subscription) return;

  if (input.owner?.kind === "staff") {
    const customerStillEnabled = subscription.customerOptIn;
    if (customerStillEnabled) {
      await prisma.driverPushSubscription.update({
        where: { id: subscription.id },
        data: {
          staffOptIn: false,
          userId: null,
        },
      });
    } else {
      await prisma.driverPushSubscription.delete({
        where: { id: subscription.id },
      });
    }
    return;
  }

  const staffStillEnabled = subscription.staffOptIn && subscription.userId != null;
  if (staffStillEnabled) {
    await prisma.driverPushSubscription.update({
      where: { id: subscription.id },
      data: {
        customerOptIn: false,
        customerId: null,
      },
    });
  } else {
    await prisma.driverPushSubscription.delete({
      where: { id: subscription.id },
    });
  }
}

async function sendPushToSubscriptions(
  subscriptions: Array<{
    id: string;
    userId: number | null;
    customerId: number | null;
    staffOptIn: boolean;
    customerOptIn: boolean;
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
    where: {
      userId: { in: uniqueUserIds },
      staffOptIn: true,
    },
    select: {
      id: true,
      userId: true,
      customerId: true,
      staffOptIn: true,
      customerOptIn: true,
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
  await migrateLegacyCustomerPushSubscriptions();

  const subscriptions = await prisma.driverPushSubscription.findMany({
    where: {
      customerOptIn: true,
    },
    select: {
      id: true,
      userId: true,
      customerId: true,
      staffOptIn: true,
      customerOptIn: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  return sendPushToSubscriptions(subscriptions, input);
}


export async function sendCustomerPushToCustomer(
  customerId: number,
  input: PushMessageInput,
): Promise<DriverPushResult> {
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return {
      ok: false,
      targeted: 0,
      sent: 0,
      failed: 0,
      skipped: 1,
      reason: "Cliente inválido.",
    };
  }

  await migrateLegacyCustomerPushSubscriptions();

  const subscriptions = await prisma.driverPushSubscription.findMany({
    where: {
      customerId,
      customerOptIn: true,
    },
    select: {
      id: true,
      userId: true,
      customerId: true,
      staffOptIn: true,
      customerOptIn: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  return sendPushToSubscriptions(subscriptions, input);
}
