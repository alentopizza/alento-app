"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AccessDeniedPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/auth/staff/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (cancelled || !result?.authenticated) return;

        const roles = Array.isArray(result.user?.roles)
          ? result.user.roles
          : [];

        if (roles.includes("DRIVER") || roles.includes("DISPATCH")) {
          router.replace("/repartidor");
          router.refresh();
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout() {
    await fetch("/api/auth/staff/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f3f1] p-6">
      <div className="w-full max-w-[520px] rounded-[28px] border border-neutral-200 bg-white p-7 text-center shadow-xl">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl text-red-600">!</span>
        <h1 className="mt-4 text-[24px] font-semibold text-neutral-950">Acceso no habilitado</h1>
        <p className="mt-2 text-[12px] leading-5 text-neutral-500">Tu sesión es válida, pero tu rol no tiene permiso para abrir esta sección.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={() => router.back()} className="rounded-xl border border-neutral-200 px-4 py-3 text-[12px] font-semibold">Volver</button>
          <button onClick={logout} className="rounded-xl bg-black px-4 py-3 text-[12px] font-semibold text-white">Cerrar sesión</button>
        </div>
      </div>
    </main>
  );
}
