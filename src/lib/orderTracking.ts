import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_SEPARATOR = ".";

function trackingSecret() {
  const secret = process.env.ORDER_TRACKING_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("ORDER_TRACKING_SECRET debe tener al menos 32 caracteres.");
  }
  return secret;
}

function signature(orderId: number) {
  return createHmac("sha256", trackingSecret())
    .update(String(orderId))
    .digest("base64url");
}

export function createOrderTrackingToken(orderId: number) {
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new Error("ID de pedido inválido.");
  }
  return `${orderId}${TOKEN_SEPARATOR}${signature(orderId)}`;
}

export function readOrderTrackingToken(token: string) {
  const [rawId, rawSignature, ...rest] = token.split(TOKEN_SEPARATOR);
  if (!rawId || !rawSignature || rest.length > 0) return null;

  const orderId = Number(rawId);
  if (!Number.isInteger(orderId) || orderId <= 0) return null;

  const expected = signature(orderId);
  const left = Buffer.from(rawSignature);
  const right = Buffer.from(expected);

  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  return orderId;
}
