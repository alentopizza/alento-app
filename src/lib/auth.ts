import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";

export const STAFF_COOKIE = "alento_staff_session";
export const CUSTOMER_COOKIE = "alento_customer_session";

type StaffSession = {
  kind: "staff";
  userId: number;
  email: string;
  name: string;
  roles: UserRole[];
  exp: number;
};

type CustomerSession = {
  kind: "customer";
  customerId: number;
  accountId: number;
  phoneE164: string;
  exp: number;
};

export type AuthSession = StaffSession | CustomerSession;

function secret() {
  const value = process.env.AUTH_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SESSION_SECRET debe existir y tener al menos 32 caracteres.");
  }
  return value;
}

function sign(payload: object) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token?: string | null): AuthSession | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = createHmac("sha256", secret()).update(encoded).digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AuthSession;
    if (!payload.exp || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string) {
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashOtp(code: string) {
  return createHmac("sha256", secret()).update(`otp:${code}`).digest("hex");
}

export function verifyOtp(code: string, hash: string) {
  const actual = Buffer.from(hashOtp(code), "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhoneE164(countryCode: string, phone: string) {
  const country = countryCode.replace(/\D/g, "");
  let local = phone.replace(/\D/g, "");
  if (local.startsWith(country)) local = local.slice(country.length);
  if (!country || !local) return "";
  return `+${country}${local}`;
}

export async function setStaffSession(user: {
  id: number;
  email: string;
  name: string;
  roles: UserRole[];
}) {
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const token = sign({
    kind: "staff",
    userId: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles,
    exp,
  } satisfies StaffSession);

  const store = await cookies();
  store.set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}

export async function clearStaffSession() {
  const store = await cookies();
  store.set(STAFF_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export async function getStaffSession() {
  const store = await cookies();
  const session = verifySessionToken(store.get(STAFF_COOKIE)?.value);
  return session?.kind === "staff" ? session : null;
}

export async function requireStaffSession(roles?: UserRole[]) {
  const session = await getStaffSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (roles?.length && !roles.some((role) => session.roles.includes(role))) throw new Error("FORBIDDEN");
  return session;
}

export async function setCustomerSession(account: {
  id: number;
  customerId: number;
  phoneE164: string;
}) {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const token = sign({
    kind: "customer",
    customerId: account.customerId,
    accountId: account.id,
    phoneE164: account.phoneE164,
    exp,
  } satisfies CustomerSession);

  const store = await cookies();
  store.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function clearCustomerSession() {
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export async function getCustomerSession() {
  const store = await cookies();
  const session = verifySessionToken(store.get(CUSTOMER_COOKIE)?.value);
  return session?.kind === "customer" ? session : null;
}
