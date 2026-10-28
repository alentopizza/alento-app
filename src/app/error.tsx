"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/clientObservability";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      name: error.name,
      message: error.message || "Error de render en la aplicación.",
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#f5f3ef] px-5 text-[#171717]">
      <div className="w-full max-w-lg rounded-[28px] border border-black/10 bg-white p-7 text-center shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-600">
          Alentó Pizza
        </p>
        <h1 className="mt-3 text-2xl font-black tracking-[-0.03em]">
          Algo no cargó correctamente
        </h1>
        <p className="mt-3 text-sm leading-6 text-black/55">
          El inconveniente quedó registrado automáticamente. Puedes intentar
          cargar esta pantalla nuevamente.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 h-11 rounded-xl bg-black px-6 text-sm font-black text-white"
        >
          Intentar nuevamente
        </button>
      </div>
    </main>
  );
}
