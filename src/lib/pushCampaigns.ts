import type { UserRole } from "@prisma/client";

export type PushAudience =
  | "ALL_STAFF"
  | "DRIVERS"
  | "KITCHEN"
  | "ADMIN"
  | "POS";

export type PushChannel = "WEB";

export type PushActionType =
  | "APP"
  | "SECTION"
  | "WEB"
  | "NONE";

export function rolesForPushAudience(
  audience: PushAudience,
): UserRole[] {
  if (audience === "DRIVERS") return ["DRIVER", "DISPATCH"];
  if (audience === "KITCHEN") return ["KITCHEN"];
  if (audience === "ADMIN") return ["ADMIN"];
  if (audience === "POS") return ["POS", "CASHIER"];

  return [
    "ADMIN",
    "POS",
    "KITCHEN",
    "CASHIER",
    "DRIVER",
    "DISPATCH",
  ];
}

export function defaultPushPath(audience: PushAudience) {
  if (audience === "DRIVERS") return "/repartidor";
  if (audience === "KITCHEN") return "/cocina";
  if (audience === "ADMIN") return "/interno";
  if (audience === "POS") return "/interno";
  return "/interno";
}

export function normalizePushAction(input: {
  audience: PushAudience;
  actionType: PushActionType;
  actionValue?: string | null;
}) {
  if (input.actionType === "NONE") return "";

  if (input.actionType === "APP") {
    return defaultPushPath(input.audience);
  }

  const raw = input.actionValue?.trim() ?? "";

  if (input.actionType === "SECTION") {
    if (!raw.startsWith("/") || raw.startsWith("//")) {
      throw new Error("Selecciona una sección válida de Alentó.");
    }
    return raw.slice(0, 500);
  }

  if (input.actionType === "WEB") {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error("La dirección web no es válida.");
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("La dirección web debe usar http o https.");
    }

    return parsed.toString().slice(0, 1000);
  }

  return defaultPushPath(input.audience);
}

export function isPushAudience(
  value: unknown,
): value is PushAudience {
  return [
    "ALL_STAFF",
    "DRIVERS",
    "KITCHEN",
    "ADMIN",
    "POS",
  ].includes(String(value));
}

export function isPushChannel(
  value: unknown,
): value is PushChannel {
  return value === "WEB";
}

export function isPushActionType(
  value: unknown,
): value is PushActionType {
  return ["APP", "SECTION", "WEB", "NONE"].includes(String(value));
}
