"use client";

export type LiveDataScope =
  | "orders"
  | "customers"
  | "club"
  | "account";

type LiveDataChange = {
  scopes: LiveDataScope[];
  at: number;
};

const EVENT_NAME = "alento:live-data-change";
const STORAGE_KEY = "alento_live_data_change";

function matchesScopes(
  change: LiveDataChange,
  scopes?: readonly LiveDataScope[],
) {
  if (!scopes?.length) return true;
  return change.scopes.some((scope) => scopes.includes(scope));
}

function parseChange(value: string | null): LiveDataChange | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<LiveDataChange>;
    if (!Array.isArray(parsed.scopes) || typeof parsed.at !== "number") {
      return null;
    }

    return {
      scopes: parsed.scopes.filter((scope): scope is LiveDataScope =>
        ["orders", "customers", "club", "account"].includes(String(scope)),
      ),
      at: parsed.at,
    };
  } catch {
    return null;
  }
}

/**
 * Avisa a las superficies abiertas de Alentó que información compartida cambió.
 *
 * - CustomEvent actualiza componentes montados en la misma pestaña.
 * - localStorage dispara el evento "storage" en otras pestañas/ventanas.
 * - El polling periódico sigue siendo el respaldo por si un cambio viene de
 *   otro proceso que todavía no emite esta señal.
 */
export function emitLiveDataChange(scopes: LiveDataScope[]) {
  if (typeof window === "undefined") return;

  const change: LiveDataChange = {
    scopes: [...new Set(scopes)],
    at: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent<LiveDataChange>(EVENT_NAME, { detail: change }),
  );

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(change));
  } catch {
    // La sincronización local no debe bloquear una acción operativa.
  }
}

export function subscribeLiveDataChange(
  scopes: readonly LiveDataScope[] | undefined,
  callback: (change: LiveDataChange) => void,
) {
  if (typeof window === "undefined") return () => undefined;

  const onCustom = (event: Event) => {
    const change = (event as CustomEvent<LiveDataChange>).detail;
    if (change && matchesScopes(change, scopes)) callback(change);
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    const change = parseChange(event.newValue);
    if (change && matchesScopes(change, scopes)) callback(change);
  };

  window.addEventListener(EVENT_NAME, onCustom);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(EVENT_NAME, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
