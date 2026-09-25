import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type DriverLocationTokenPayload = {
  kind: "driver-location";
  userId: number;
  exp: number;
};

function secret() {
  const value = process.env.AUTH_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SESSION_SECRET debe existir y tener al menos 32 caracteres.",
    );
  }
  return value;
}

function signature(encoded: string) {
  return createHmac("sha256", secret())
    .update(encoded)
    .digest("base64url");
}

export function createDriverLocationToken(userId: number) {
  const payload: DriverLocationTokenPayload = {
    kind: "driver-location",
    userId,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifyDriverLocationToken(token?: string | null) {
  if (!token) return null;

  const [encoded, providedSignature] = token.split(".");
  if (!encoded || !providedSignature) return null;

  const expected = Buffer.from(signature(encoded), "base64url");
  const received = Buffer.from(providedSignature, "base64url");

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as DriverLocationTokenPayload;

    if (
      payload.kind !== "driver-location" ||
      !Number.isInteger(payload.userId) ||
      payload.userId <= 0 ||
      !payload.exp ||
      payload.exp <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
