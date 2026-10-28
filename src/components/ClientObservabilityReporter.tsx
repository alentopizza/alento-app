"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/clientObservability";

export default function ClientObservabilityReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (!event.error && !event.message) return;
      const error = event.error instanceof Error ? event.error : null;

      reportClientError({
        name: error?.name || "Error",
        message: error?.message || event.message || "Error de navegador",
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      reportClientError({
        name: reason instanceof Error ? reason.name : "UnhandledRejection",
        message:
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Promesa rechazada sin manejo.",
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
