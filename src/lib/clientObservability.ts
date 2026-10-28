"use client";

type ClientErrorInput = {
  name?: string;
  message: string;
  digest?: string | null;
  path?: string;
};

const reported = new Set<string>();

function currentPath() {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

function eventKey(input: ClientErrorInput) {
  return [
    input.name || "Error",
    input.message.slice(0, 300),
    input.digest || "",
    input.path || currentPath(),
  ].join("|");
}

export function reportClientError(input: ClientErrorInput) {
  if (typeof window === "undefined") return;

  const key = eventKey(input);
  if (reported.has(key)) return;
  reported.add(key);

  const payload = {
    name: input.name || "Error",
    message: input.message.slice(0, 600),
    digest: input.digest?.slice(0, 160) || null,
    path: input.path || currentPath(),
    clientEventId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `client-${Date.now()}`,
  };

  void fetch("/api/observability/client-error", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // La observabilidad nunca debe romper la experiencia principal.
  });
}
