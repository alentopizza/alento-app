import {
  logInfo,
  reportOperationalIncident,
} from "@/lib/observability";

type RequestErrorInfo = {
  path?: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type RequestErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
};

function headerValue(
  headers: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = headers?.[key] ?? headers?.[key.toLowerCase()];
  return Array.isArray(value) ? value[0] || null : value || null;
}

export async function register() {
  logInfo("SERVICE_RUNTIME_READY", "Runtime de Alentó App inicializado.", {
    source: "instrumentation",
    metadata: {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "unknown",
    },
  });
}

export async function onRequestError(
  error: unknown,
  request: RequestErrorInfo,
  context: RequestErrorContext,
) {
  const requestId = headerValue(request.headers, "x-request-id");
  const message =
    error instanceof Error
      ? error.message
      : "Error no controlado durante una solicitud.";

  await reportOperationalIncident({
    level: "ERROR",
    category: "BACKEND",
    code: "NEXT_REQUEST_ERROR",
    message,
    requestId,
    source: `server:${context.routePath || request.path || "unknown"}`,
    fingerprintKey: [
      context.routeType || "",
      error instanceof Error ? error.name : "UnknownError",
    ].join(":"),
    metadata: {
      method: request.method || null,
      path: request.path || null,
      routerKind: context.routerKind || null,
      routeType: context.routeType || null,
      renderSource: context.renderSource || null,
    },
  });
}
