import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_SEPARATOR = ".";

function trackingSecret() {
  const secret = process.env.ORDER_TRACKING_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("ORDER_TRACKING_SECRET debe tener al menos 32 caracteres.");
  }
  return secret;
}

function signature(orderId: number, driverId: number) {
  return createHmac("sha256", trackingSecret())
    .update(`driver:${orderId}:${driverId}`)
    .digest("base64url");
}

export function createDriverOrderToken(orderId: number, driverId: number) {
  if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(driverId) || driverId <= 0) {
    throw new Error("Datos de reparto inválidos.");
  }
  return `${orderId}${TOKEN_SEPARATOR}${driverId}${TOKEN_SEPARATOR}${signature(orderId, driverId)}`;
}

export function readDriverOrderToken(token: string) {
  const [rawOrderId, rawDriverId, rawSignature, ...rest] = token.split(TOKEN_SEPARATOR);
  if (!rawOrderId || !rawDriverId || !rawSignature || rest.length > 0) return null;

  const orderId = Number(rawOrderId);
  const driverId = Number(rawDriverId);
  if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(driverId) || driverId <= 0) return null;

  const expected = signature(orderId, driverId);
  const left = Buffer.from(rawSignature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  return { orderId, driverId };
}
