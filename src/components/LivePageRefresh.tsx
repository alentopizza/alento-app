"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  subscribeLiveDataChange,
  type LiveDataScope,
} from "@/lib/liveDataEvents";

export default function LivePageRefresh({
  intervalMs = 3000,
  scopes,
}: {
  intervalMs?: number;
  scopes?: readonly LiveDataScope[];
}) {
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
    const unsubscribe = subscribeLiveDataChange(scopes, () => refresh());
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, router, scopes]);

  return null;
}
