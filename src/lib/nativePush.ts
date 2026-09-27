import type { UserRole } from "@prisma/client";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "@/lib/prisma";

export type NativePushClientConfig = {
  configured: boolean;
  apiKey: string;
  appId: string;
  projectId: string;
  senderId: string;
};

export type NativePushResult = {
  ok: boolean;
  targeted: number;
  sent: number;
  failed: number;
  skipped: number;
  reason?: string;
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function nativePushClientConfig(): NativePushClientConfig {
  const apiKey = env("FIREBASE_ANDROID_API_KEY");
  const appId = env("FIREBASE_ANDROID_APP_ID");
  const projectId = env("FIREBASE_PROJECT_ID");
  const senderId = env("FIREBASE_MESSAGING_SENDER_ID");

  return {
    configured: Boolean(apiKey && appId && projectId && senderId),
    apiKey,
    appId,
    projectId,
    senderId,
  };
}

function firebaseAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const raw = env("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON no está configurado.");
  }

  let parsed: {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON no contiene JSON válido.");
  }

  const projectId = parsed.project_id?.trim();
  const clientEmail = parsed.client_email?.trim();
  const privateKey = parsed.private_key?.replace(/\\n/g, "\n").trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "La cuenta de servicio Firebase está incompleta.",
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });
}

function invalidFcmToken(errorCode?: string) {
  return (
    errorCode === "messaging/registration-token-not-registered" ||
    errorCode === "messaging/invalid-registration-token"
  );
}

export async function upsertNativePushDevice(input: {
  userId: number;
  deviceKey: string;
  fcmToken: string;
  appVersion?: string | null;
}) {
  const deviceKey = input.deviceKey.trim().slice(0, 160);
  const fcmToken = input.fcmToken.trim();
  const appVersion = input.appVersion?.trim().slice(0, 40) || null;

  if (!deviceKey || !fcmToken) {
    throw new Error("Dispositivo Android incompleto.");
  }

  // Un token FCM solo debe pertenecer al dispositivo que lo reporta.
  await prisma.nativePushDevice.deleteMany({
    where: {
      fcmToken,
      NOT: { deviceKey },
    },
  });

  return prisma.nativePushDevice.upsert({
    where: { deviceKey },
    update: {
      userId: input.userId,
      fcmToken,
      appVersion,
      platform: "ANDROID",
      active: true,
      lastSeenAt: new Date(),
    },
    create: {
      userId: input.userId,
      deviceKey,
      fcmToken,
      appVersion,
      platform: "ANDROID",
      active: true,
      lastSeenAt: new Date(),
    },
  });
}

export async function sendNativePushToUserIds(input: {
  userIds: number[];
  title: string;
  subtitle?: string | null;
  body: string;
  path: string;
  campaignId?: string;
  imageUrl?: string | null;
}): Promise<NativePushResult> {
  if (!nativePushClientConfig().configured) {
    return {
      ok: false,
      targeted: 0,
      sent: 0,
      failed: 0,
      skipped: 1,
      reason: "Firebase Android no está configurado.",
    };
  }

  const userIds = [...new Set(input.userIds)].filter(
    (userId) => Number.isInteger(userId) && userId > 0,
  );

  if (!userIds.length) {
    return {
      ok: false,
      targeted: 0,
      sent: 0,
      failed: 0,
      skipped: 1,
      reason: "No hay usuarios Android para esta notificación.",
    };
  }

  const devices = await prisma.nativePushDevice.findMany({
    where: {
      active: true,
      userId: { in: userIds },
    },
    select: {
      id: true,
      fcmToken: true,
    },
  });

  if (!devices.length) {
    return {
      ok: false,
      targeted: 0,
      sent: 0,
      failed: 0,
      skipped: 1,
      reason: "No hay APK 004 registradas para esta audiencia.",
    };
  }

  const messaging = getMessaging(firebaseAdminApp());
  let sent = 0;
  let failed = 0;

  for (let offset = 0; offset < devices.length; offset += 500) {
    const batch = devices.slice(offset, offset + 500);

    const response = await messaging.sendEachForMulticast({
      tokens: batch.map((device) => device.fcmToken),
      data: {
        title: input.title.slice(0, 80),
        subtitle: input.subtitle?.slice(0, 120) || "",
        body: input.body.slice(0, 500),
        path: input.path || "/repartidor",
        campaignId: input.campaignId || "",
        imageUrl: input.imageUrl || "",
      },
      android: {
        priority: "high",
        ttl: 3 * 60 * 60 * 1000,
      },
    });

    sent += response.successCount;
    failed += response.failureCount;

    await Promise.all(
      response.responses.map(async (result, index) => {
        const device = batch[index];

        if (result.success) {
          await prisma.nativePushDevice.update({
            where: { id: device.id },
            data: {
              lastSuccessAt: new Date(),
              lastSeenAt: new Date(),
              active: true,
            },
          });
          return;
        }

        const code = result.error?.code;
        if (invalidFcmToken(code)) {
          await prisma.nativePushDevice
            .update({
              where: { id: device.id },
              data: { active: false },
            })
            .catch(() => undefined);
        }
      }),
    );
  }

  return {
    ok: sent > 0,
    targeted: devices.length,
    sent,
    failed,
    skipped: 0,
    ...(sent > 0
      ? {}
      : { reason: "Firebase no aceptó ninguna notificación." }),
  };
}

export async function sendNativePushToRoles(input: {
  roles: UserRole[];
  title: string;
  subtitle?: string | null;
  body: string;
  path: string;
  campaignId?: string;
  imageUrl?: string | null;
}): Promise<NativePushResult> {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      roles: true,
    },
  });

  const roleSet = new Set<UserRole>(input.roles);
  const userIds = users
    .filter((user) => user.roles.some((role) => roleSet.has(role)))
    .map((user) => user.id);

  return sendNativePushToUserIds({
    userIds,
    title: input.title,
    subtitle: input.subtitle,
    body: input.body,
    path: input.path,
    campaignId: input.campaignId,
    imageUrl: input.imageUrl,
  });
}
