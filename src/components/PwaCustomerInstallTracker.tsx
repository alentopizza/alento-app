"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const DEVICE_KEY_STORAGE = "alento-pwa-device-key";
const LAST_SYNC_STORAGE = "alento-pwa-last-sync-at";
const INSTALLED_SIGNAL_STORAGE = "alento-pwa-installed-signal";
const SYNC_INTERVAL_MS = 15 * 60 * 1000;

function standaloneMode() {
  const iosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

function platformName() {
  const userAgent = navigator.userAgent || "";
  const iPadDesktopMode =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  if (/iPhone|iPad|iPod/i.test(userAgent) || iPadDesktopMode) return "iPhone / iPad";
  if (/Android/i.test(userAgent)) return "Android";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "Mac";
  return "Otro";
}

function deviceKey() {
  const saved = window.localStorage.getItem(DEVICE_KEY_STORAGE);
  if (saved) return saved;

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "device-" + Date.now() + "-" + Math.random().toString(36).slice(2);

  window.localStorage.setItem(DEVICE_KEY_STORAGE, generated);
  return generated;
}

export default function PwaCustomerInstallTracker() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function track(force = false) {
      const hasInstalledSignal =
        window.localStorage.getItem(INSTALLED_SIGNAL_STORAGE) === "1";
      if (!force && !standaloneMode() && !hasInstalledSignal) return;

      try {
        const lastSync = Number(
          window.localStorage.getItem(LAST_SYNC_STORAGE) || 0,
        );
        if (!force && Date.now() - lastSync < SYNC_INTERVAL_MS) return;

        const response = await fetch("/api/customer-app/install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceKey: deviceKey(),
            platform: platformName(),
          }),
        });

        if (!cancelled && response.ok) {
          window.localStorage.setItem(
            LAST_SYNC_STORAGE,
            String(Date.now()),
          );
        }
      } catch {
        // La detección de PWA nunca debe interrumpir la experiencia del cliente.
      }
    }

    void track();

    const handleInstalled = () => {
      try {
        window.localStorage.setItem(INSTALLED_SIGNAL_STORAGE, "1");
      } catch {}
      void track(true);
    };

    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      cancelled = true;
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [pathname]);

  return null;
}
