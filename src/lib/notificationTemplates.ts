import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const NOTIFICATION_TEMPLATES_KEY = "notification_templates";

export type NotificationTemplateConfig = {
  id: string;
  title: string;
  event: string;
  events?: string[];
  eventByFulfillment?: Partial<Record<"DELIVERY" | "PICKUP" | "STORE", string>>;
  audience: "CUSTOMER" | "DRIVER";
  fulfillmentTypes: Array<"DELIVERY" | "PICKUP" | "STORE">;
  templateName: string;
  language: string;
  category: string;
  headerImageUrl: string;
  requiresImage?: boolean;
  active: boolean;
  variables: Array<{ key: string; label: string; source: string }>;
  button?: {
    type: "tracking" | "driver_tracking" | "static";
    label: string;
    value?: string;
  } | null;
  delayMinutes?: number;
};

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplateConfig[] = [
  {
    id: "order_created",
    title: "Pedido recibido",
    event: "order.created",
    audience: "CUSTOMER",
    fulfillmentTypes: ["DELIVERY", "PICKUP", "STORE"],
    templateName: "nuevo_pedido_v2",
    language: "es",
    category: "MARKETING",
    headerImageUrl: "",
    active: false,
    variables: [
      { key: "1", label: "Nombre del cliente", source: "customerName" },
      { key: "2", label: "Número de orden", source: "orderCode" },
    ],
    button: { type: "tracking", label: "Ver pedido" },
  },
  {
    id: "order_ready_pickup_store",
    title: "Pedido listo",
    event: "order.status.READY",
    audience: "CUSTOMER",
    fulfillmentTypes: ["PICKUP", "STORE"],
    templateName: "pedido_listo_local_v2",
    language: "es",
    category: "MARKETING",
    headerImageUrl: "",
    active: false,
    variables: [{ key: "1", label: "Número de orden", source: "orderCode" }],
    button: null,
  },
  {
    id: "order_driver_assigned",
    title: "Orden asignada al repartidor",
    event: "order.driver_assigned",
    audience: "DRIVER",
    fulfillmentTypes: ["DELIVERY"],
    templateName: "orden_asignada",
    language: "es",
    category: "MARKETING",
    headerImageUrl: "",
    active: false,
    variables: [
      { key: "1", label: "Nombre del repartidor", source: "driverName" },
      { key: "2", label: "Número de orden", source: "orderCode" },
    ],
    button: { type: "driver_tracking", label: "Ver domicilio" },
  },
  {
    id: "order_out_for_delivery",
    title: "Pedido en camino",
    event: "order.status.OUT_FOR_DELIVERY",
    audience: "CUSTOMER",
    fulfillmentTypes: ["DELIVERY"],
    templateName: "orden_en_camino",
    language: "es",
    category: "MARKETING",
    headerImageUrl: "",
    requiresImage: false,
    active: false,
    variables: [{ key: "1", label: "Número de orden", source: "orderCode" }],
    button: { type: "tracking", label: "Ver seguimiento" },
  },
  {
    id: "order_arrived",
    title: "Pedido ha llegado",
    event: "order.status.ARRIVED",
    audience: "CUSTOMER",
    fulfillmentTypes: ["DELIVERY"],
    templateName: "orden_ha_llegado_v2",
    language: "es",
    category: "MARKETING",
    headerImageUrl: "",
    requiresImage: false,
    active: false,
    variables: [{ key: "1", label: "Número de orden", source: "orderCode" }],
    button: null,
  },
  {
    id: "order_finalized",
    title: "Pedido finalizado",
    event: "order.status.COMPLETED",
    audience: "CUSTOMER",
    fulfillmentTypes: ["DELIVERY", "PICKUP", "STORE"],
    templateName: "orden_finalizada_v2",
    language: "es",
    category: "MARKETING",
    headerImageUrl: "",
    active: false,
    variables: [{ key: "1", label: "Número de orden", source: "orderCode" }],
    button: null,
  },
  {
    id: "google_review",
    title: "Reseña de Google",
    event: "order.review",
    audience: "CUSTOMER",
    fulfillmentTypes: ["DELIVERY", "PICKUP", "STORE"],
    templateName: "resea_google_v2",
    language: "es",
    category: "MARKETING",
    headerImageUrl: "",
    active: false,
    variables: [],
    button: null,
    delayMinutes: 60,
  },
];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function managedImagePath(value: unknown) {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";

  const marker = "/api/notification-images/";
  const index = raw.indexOf(marker);
  if (index < 0) return "";

  return raw.slice(index);
}

export function normalizeNotificationTemplates(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return DEFAULT_NOTIFICATION_TEMPLATES;
  const saved = new Map<string, Record<string, unknown>>();
  for (const item of value) {
    if (!isObject(item)) continue;
    const id = String(item.id ?? "").trim();
    if (id) saved.set(id, item);
  }

  return DEFAULT_NOTIFICATION_TEMPLATES.map((fallback) => {
    let current = saved.get(fallback.id);

    // Migración transparente: antes "Pedido finalizado" estaba duplicado
    // por modalidad. Conservamos la imagen/estado existente si ya se configuró.
    if (!current && fallback.id === "order_finalized") {
      const delivery = saved.get("order_finalized_delivery");
      const pickupStore = saved.get("order_finalized_pickup_store");
      const preferred = [delivery, pickupStore].find((item) => managedImagePath(item?.headerImageUrl));
      current = preferred ?? delivery ?? pickupStore;
    }

    if (!current) return fallback;
    const headerImageUrl = managedImagePath(current.headerImageUrl);
    const requiresImage = fallback.requiresImage !== false;
    return {
      ...fallback,
      templateName: typeof current.templateName === "string" ? current.templateName.trim() || fallback.templateName : fallback.templateName,
      language: typeof current.language === "string" ? current.language.trim() || fallback.language : fallback.language,
      category: typeof current.category === "string" ? current.category.trim() || fallback.category : fallback.category,
      headerImageUrl,
      requiresImage,
      active: (!requiresImage || Boolean(headerImageUrl)) && typeof current.active === "boolean"
        ? current.active
        : false,
      delayMinutes: typeof current.delayMinutes === "number" && Number.isFinite(current.delayMinutes)
        ? Math.max(0, Math.round(current.delayMinutes))
        : fallback.delayMinutes,
      button: isObject(current.button)
        ? {
            ...fallback.button,
            type: (current.button.type === "tracking" || current.button.type === "driver_tracking" || current.button.type === "static")
              ? current.button.type
              : fallback.button?.type ?? "static",
            label: typeof current.button.label === "string" ? current.button.label : fallback.button?.label ?? "",
            value: typeof current.button.value === "string" ? current.button.value : fallback.button?.value,
          }
        : current.button === null ? null : fallback.button,
    } satisfies NotificationTemplateConfig;
  });
}

export async function getNotificationTemplates() {
  const row = await prisma.appSetting.findUnique({ where: { key: NOTIFICATION_TEMPLATES_KEY } });
  return normalizeNotificationTemplates(row?.value);
}

export async function saveNotificationTemplates(templates: NotificationTemplateConfig[]) {
  const value = JSON.parse(JSON.stringify(templates)) as Prisma.InputJsonValue;
  await prisma.appSetting.upsert({
    where: { key: NOTIFICATION_TEMPLATES_KEY },
    create: { key: NOTIFICATION_TEMPLATES_KEY, value },
    update: { value },
  });
  return templates;
}

export function findTemplateForEvent(
  templates: NotificationTemplateConfig[],
  event: string,
  fulfillmentType: string,
) {
  const fulfillment = fulfillmentType as "DELIVERY" | "PICKUP" | "STORE";

  return templates.find((template) => {
    if (!template.active || !template.fulfillmentTypes.includes(fulfillment)) return false;

    const mappedEvent = template.eventByFulfillment?.[fulfillment];
    if (mappedEvent) return mappedEvent === event;

    return template.event === event || template.events?.includes(event);
  }) ?? null;
}
