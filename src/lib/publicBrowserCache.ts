"use client";

type CacheEnvelope<T> = {
  savedAt: number;
  value: T;
};

const PREFIX = "alento-public-cache:v1:";

export function readPublicCache<T>(key: string, maxAgeMs = 2 * 60 * 60 * 1000): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== "number" || !("value" in parsed)) return null;
    if (Date.now() - parsed.savedAt > maxAgeMs) {
      window.localStorage.removeItem(PREFIX + key);
      return null;
    }

    return parsed.value;
  } catch {
    return null;
  }
}

export function writePublicCache<T>(key: string, value: T) {
  try {
    const envelope: CacheEnvelope<T> = {
      savedAt: Date.now(),
      value,
    };
    window.localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // El caché acelera la experiencia, pero nunca debe bloquear la app.
  }
}
