"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LivePageRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let running = false;

    const refresh = () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      router.refresh();
      window.setTimeout(() => {
        running = false;
      }, 700);
    };

    const timer = window.setInterval(refresh, intervalMs);
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, router]);

  return null;
}
