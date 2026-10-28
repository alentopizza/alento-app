import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import {
  sendCustomerPush,
  sendStaffPushToRoles,
  staffPushPublicKey,
} from "@/lib/driverPush";
import {
  isPushActionType,
  isPushAudience,
  normalizePushAction,
  rolesForPushAudience,
  type PushActionType,
  type PushAudience,
} from "@/lib/pushCampaigns";
import {
  reportOperationalIncident,
  requestIdFromHeaders,
} from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function absoluteImageUrl(request: NextRequest, value: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/")) return null;
  return new URL(value, request.nextUrl.origin).toString();
}

function authError(error: unknown) {
  const forbidden =
    error instanceof Error && error.message === "FORBIDDEN";

  return NextResponse.json(
    { error: forbidden ? "Sin permisos." : "No autorizado." },
    { status: forbidden ? 403 : 401 },
  );
}

export async function GET() {
  try {
    await requireStaffSession(["ADMIN"]);
  } catch (error) {
    return authError(error);
  }

  const [campaignRows, subscriptions, customerSubscriptions] = await Promise.all([
    prisma.pushCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        opens: {
          where: { channel: "WEB" },
          select: { id: true },
        },
      },
    }),
    prisma.driverPushSubscription.findMany({
      where: {
        staffOptIn: true,
        user: { active: true },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        userAgent: true,
        lastSuccessAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            roles: true,
          },
        },
      },
    }),
    prisma.driverPushSubscription.findMany({
      where: { customerOptIn: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        userAgent: true,
        lastSuccessAt: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    }),
  ]);

  const campaigns = campaignRows.map(({ opens, ...campaign }) => ({
    ...campaign,
    channels: ["WEB"],
    openedCount: opens.length,
  }));

  return NextResponse.json({
    campaigns,
    delivery: {
      webConfigured: Boolean(staffPushPublicKey()),
      webDevices: subscriptions.length + customerSubscriptions.length,
      staffWebDevices: subscriptions.length,
      customerWebDevices: customerSubscriptions.length,
      devices: subscriptions,
      customerDevices: customerSubscriptions,
    },
  });
}

export async function POST(request: NextRequest) {
  const requestId = requestIdFromHeaders(request.headers);
  let session;
  try {
    session = await requireStaffSession(["ADMIN"]);
  } catch (error) {
    return authError(error);
  }

  const body = await request.json().catch(() => ({}));
  const title = text(body?.title, 20);
  const subtitle = text(body?.subtitle, 30) || null;
  const message = text(body?.body, 240);
  const imageUrl = text(body?.imageUrl, 1000) || null;
  const audience = String(body?.audience || "") as PushAudience;
  const actionType = String(body?.actionType || "") as PushActionType;

  if (!title) {
    return NextResponse.json(
      { error: "Escribe un título para la notificación." },
      { status: 400 },
    );
  }

  if (!message) {
    return NextResponse.json(
      { error: "Escribe el mensaje a enviar." },
      { status: 400 },
    );
  }

  if (!isPushAudience(audience)) {
    return NextResponse.json(
      { error: "Selecciona una audiencia válida." },
      { status: 400 },
    );
  }

  if (!isPushActionType(actionType)) {
    return NextResponse.json(
      { error: "Selecciona qué debe abrir la notificación." },
      { status: 400 },
    );
  }

  let actionValue: string;
  try {
    actionValue = normalizePushAction({
      audience,
      actionType,
      actionValue: text(body?.actionValue, 1000),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "El destino de la notificación no es válido.",
      },
      { status: 400 },
    );
  }

  const roles = rolesForPushAudience(audience);
  const campaign = await prisma.pushCampaign.create({
    data: {
      title,
      subtitle,
      body: message,
      imageUrl,
      audience,
      channels: ["WEB"],
      actionType,
      actionValue: actionValue || null,
      status: "SENDING",
      createdById: session.userId,
      createdByName: session.name,
    },
  });

  const absoluteImage = absoluteImageUrl(request, imageUrl);
  let webTargetCount = 0;
  let webDeliveredCount = 0;
  let failedCount = 0;

  try {
    const result = audience === "CUSTOMERS"
      ? await sendCustomerPush({
      title,
      body: subtitle ? `${subtitle} · ${message}` : message,
      url: actionValue,
      tag: `alento-campaign-${campaign.id}`,
      kind: "CUSTOM_CAMPAIGN",
      campaignId: campaign.id,
      imageUrl: absoluteImage,
      requireInteraction: true,
    })
      : await sendStaffPushToRoles({
          roles,
          title,
          body: subtitle ? `${subtitle} · ${message}` : message,
          url: actionValue,
          tag: `alento-campaign-${campaign.id}`,
          kind: "CUSTOM_CAMPAIGN",
          campaignId: campaign.id,
          imageUrl: absoluteImage,
          requireInteraction: true,
        });

    webTargetCount = result.targeted;
    webDeliveredCount = result.sent;
    failedCount += result.failed;
  } catch (error) {
    failedCount += 1;
    await reportOperationalIncident({
      level: "WARNING",
      category: "PUSH",
      code: "PUSH_CAMPAIGN_DELIVERY_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "Falló el envío de la campaña Push.",
      requestId,
      source: "api/push-campaigns",
      entityType: "PUSH_CAMPAIGN",
      entityId: campaign.id,
      fingerprintKey: campaign.id,
      metadata: {
        audience,
      },
    });
  }

  const updated = await prisma.pushCampaign.update({
    where: { id: campaign.id },
    data: {
      webTargetCount,
      webDeliveredCount,
      failedCount,
      status: webDeliveredCount > 0 ? "SENT" : "FAILED",
      sentAt: new Date(),
    },
  });

  if (failedCount > 0) {
    await reportOperationalIncident({
      level: webDeliveredCount > 0 ? "WARNING" : "ERROR",
      category: "PUSH",
      code:
        webDeliveredCount > 0
          ? "PUSH_CAMPAIGN_PARTIAL_FAILURE"
          : "PUSH_CAMPAIGN_FAILED",
      message:
        webDeliveredCount > 0
          ? `La campaña Push tuvo ${failedCount} entrega(s) fallida(s).`
          : "La campaña Push no logró ninguna entrega.",
      requestId,
      source: "api/push-campaigns",
      entityType: "PUSH_CAMPAIGN",
      entityId: campaign.id,
      fingerprintKey: campaign.id,
      metadata: {
        audience,
        targeted: webTargetCount,
        delivered: webDeliveredCount,
        failed: failedCount,
      },
    });
  }

  return NextResponse.json(
    {
      campaign: updated,
      delivery: {
        targeted: webTargetCount,
        delivered: webDeliveredCount,
        failed: failedCount,
        webDelivered: webDeliveredCount,
      },
    },
    { status: 201 },
  );
}
