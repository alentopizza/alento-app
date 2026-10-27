import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearRateLimit,
  consumeRateLimit,
  requestClientIp,
  securityKeyHash,
} from "@/lib/rateLimit";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe("rate limit helpers", () => {
  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET =
      "test-auth-session-secret-00000000000000000000000000000000";
  });

  it("prioriza la IP de Cloudflare, luego x-real-ip y luego x-forwarded-for", () => {
    expect(
      requestClientIp({
        headers: new Headers({
          "cf-connecting-ip": "1.1.1.1",
          "x-real-ip": "2.2.2.2",
          "x-forwarded-for": "3.3.3.3, 4.4.4.4",
        }),
      } as never),
    ).toBe("1.1.1.1");

    expect(
      requestClientIp({
        headers: new Headers({
          "x-real-ip": "2.2.2.2",
          "x-forwarded-for": "3.3.3.3, 4.4.4.4",
        }),
      } as never),
    ).toBe("2.2.2.2");

    expect(
      requestClientIp({
        headers: new Headers({
          "x-forwarded-for": "3.3.3.3, 4.4.4.4",
        }),
      } as never),
    ).toBe("3.3.3.3");
  });

  it("no almacena la clave sensible en texto plano", () => {
    const first = securityKeyHash("+573001234567");
    const second = securityKeyHash("+573001234567");

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(first).not.toContain("3001234567");
  });
});

describe.skipIf(!hasDatabase)("persistent rate limiter", () => {
  const scope = "test-rate-limit";
  const key = "test-client";

  beforeEach(async () => {
    process.env.AUTH_SESSION_SECRET =
      "test-auth-session-secret-00000000000000000000000000000000";
    await clearRateLimit(scope, key);
  });

  afterEach(async () => {
    await clearRateLimit(scope, key);
  });

  it("permite hasta el límite y bloquea el siguiente intento", async () => {
    const first = await consumeRateLimit({
      scope,
      key,
      limit: 2,
      windowMs: 60_000,
      blockMs: 60_000,
    });
    const second = await consumeRateLimit({
      scope,
      key,
      limit: 2,
      windowMs: 60_000,
      blockMs: 60_000,
    });
    const third = await consumeRateLimit({
      scope,
      key,
      limit: 2,
      windowMs: 60_000,
      blockMs: 60_000,
    });

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("clearRateLimit elimina el bloqueo persistido", async () => {
    await consumeRateLimit({
      scope,
      key,
      limit: 1,
      windowMs: 60_000,
      blockMs: 60_000,
    });
    const blocked = await consumeRateLimit({
      scope,
      key,
      limit: 1,
      windowMs: 60_000,
      blockMs: 60_000,
    });
    expect(blocked.allowed).toBe(false);

    await clearRateLimit(scope, key);

    const allowedAgain = await consumeRateLimit({
      scope,
      key,
      limit: 1,
      windowMs: 60_000,
      blockMs: 60_000,
    });
    expect(allowedAgain.allowed).toBe(true);
  });
});
