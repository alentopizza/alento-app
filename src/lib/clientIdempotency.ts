export function createIdempotencyKey() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    const values = globalThis.crypto.getRandomValues(new Uint32Array(4));
    return [
      Date.now().toString(36),
      ...Array.from(values, (value) => value.toString(36)),
    ].join("-");
  }

  throw new Error(
    "Este navegador no puede generar una clave segura para confirmar la operación.",
  );
}
