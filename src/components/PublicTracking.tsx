"use client";

import { useEffect, useMemo, useState } from "react";
import type { TrackingSettings } from "@/lib/trackingSettings";

const CONSENT_KEY = "alento_tracking_consent_v1";

type PublicTrackingSettings = TrackingSettings & {
  hasExternalTracking: boolean;
};

type AnalyticsDetail = {
  eventId: string;
  eventType: string;
  productId?: number | null;
  productName?: string | null;
  value?: number | null;
  quantity?: number | null;
  itemCount?: number | null;
  orderId?: number | null;
  path?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
};

type TrackingWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  ttq?: {
    track?: (event: string, payload?: Record<string, unknown>) => void;
  };
  clarity?: (...args: unknown[]) => void;
  __alentoAnalyticsQueue?: AnalyticsDetail[];
  __alentoTrackingReady?: boolean;
};

function appendScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function appendInlineScript(id: string, content: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.text = content;
  document.head.appendChild(script);
}

function initGoogle(settings: PublicTrackingSettings) {
  const target = window as TrackingWindow;
  const dataLayer = (target.dataLayer ??= []);
  const gtag =
    (target.gtag ??= (...args: unknown[]) => {
      dataLayer.push(args);
    });

  const primary =
    settings.googleAnalyticsId || settings.googleAdsId;

  if (primary) {
    appendScript(
      "alento-google-gtag",
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primary)}`,
    );
    gtag("js", new Date());

    if (settings.googleAnalyticsId) {
      gtag("config", settings.googleAnalyticsId, {
        send_page_view: false,
      });
    }

    if (settings.googleAdsId) {
      gtag("config", settings.googleAdsId);
    }
  }

  if (settings.googleTagManagerId) {
    dataLayer.push({
      "gtm.start": Date.now(),
      event: "gtm.js",
    });
    appendScript(
      "alento-google-tag-manager",
      `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(settings.googleTagManagerId)}`,
    );
  }
}

function initMeta(pixelId: string) {
  if (!pixelId) return;
  appendInlineScript(
    "alento-meta-pixel",
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');`,
  );
}

function initTikTok(pixelId: string) {
  if (!pixelId) return;
  appendInlineScript(
    "alento-tiktok-pixel",
    `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var r='https://analytics.tiktok.com/i18n/pixel/events.js',o=n&&n.partner;ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var a=document.createElement('script');a.type='text/javascript';a.async=!0;a.src=r+'?sdkid='+e+'&lib='+t;var s=document.getElementsByTagName('script')[0];s.parentNode.insertBefore(a,s)};ttq.load('${pixelId}');}(window,document,'ttq');`,
  );
}

function initClarity(projectId: string) {
  if (!projectId) return;
  appendInlineScript(
    "alento-clarity",
    `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,'clarity','script','${projectId}');`,
  );
}

function itemPayload(detail: AnalyticsDetail) {
  return {
    item_id: detail.productId ? String(detail.productId) : undefined,
    item_name: detail.productName || undefined,
    quantity: detail.quantity || 1,
    price: detail.value ?? undefined,
  };
}

function forwardEvent(
  settings: PublicTrackingSettings,
  detail: AnalyticsDetail,
) {
  const target = window as TrackingWindow;
  const eventName = `alento_${detail.eventType.toLowerCase()}`;

  target.dataLayer?.push({
    event: eventName,
    alento: detail,
  });

  const base = {
    currency: "COP",
    value: detail.value ?? undefined,
  };

  if (target.gtag) {
    if (detail.eventType === "MENU_VIEW") {
      target.gtag("event", "page_view", {
        page_path: detail.path || "/menu",
      });
    } else if (detail.eventType === "PRODUCT_VIEW") {
      target.gtag("event", "view_item", {
        ...base,
        items: [itemPayload(detail)],
      });
    } else if (detail.eventType === "ADD_TO_CART") {
      target.gtag("event", "add_to_cart", {
        ...base,
        items: [itemPayload(detail)],
      });
    } else if (detail.eventType === "CART_VIEW") {
      target.gtag("event", "view_cart", base);
    } else if (detail.eventType === "CHECKOUT_STARTED") {
      target.gtag("event", "begin_checkout", base);
    } else if (detail.eventType === "ORDER_CREATED") {
      target.gtag("event", "purchase", {
        transaction_id: String(detail.orderId || detail.eventId),
        ...base,
      });

      if (
        settings.googleAdsId &&
        settings.googleAdsPurchaseLabel
      ) {
        target.gtag("event", "conversion", {
          send_to:
            settings.googleAdsId +
            "/" +
            settings.googleAdsPurchaseLabel,
          transaction_id: String(detail.orderId || detail.eventId),
          ...base,
        });
      }
    }
  }

  if (target.fbq) {
    if (detail.eventType === "MENU_VIEW") {
      target.fbq("track", "PageView");
    } else if (detail.eventType === "PRODUCT_VIEW") {
      target.fbq("track", "ViewContent", {
        content_ids: detail.productId
          ? [String(detail.productId)]
          : undefined,
        content_name: detail.productName || undefined,
        content_type: "product",
        ...base,
      });
    } else if (detail.eventType === "ADD_TO_CART") {
      target.fbq("track", "AddToCart", {
        content_ids: detail.productId
          ? [String(detail.productId)]
          : undefined,
        content_name: detail.productName || undefined,
        content_type: "product",
        ...base,
      });
    } else if (detail.eventType === "CHECKOUT_STARTED") {
      target.fbq("track", "InitiateCheckout", base);
    } else if (detail.eventType === "ORDER_CREATED") {
      target.fbq("track", "Purchase", base);
    }
  }

  if (target.ttq?.track) {
    const content = detail.productId
      ? [
          {
            content_id: String(detail.productId),
            content_name: detail.productName || undefined,
            quantity: detail.quantity || 1,
            price: detail.value ?? undefined,
          },
        ]
      : undefined;

    if (detail.eventType === "PRODUCT_VIEW") {
      target.ttq.track("ViewContent", { ...base, contents: content });
    } else if (detail.eventType === "ADD_TO_CART") {
      target.ttq.track("AddToCart", { ...base, contents: content });
    } else if (detail.eventType === "CHECKOUT_STARTED") {
      target.ttq.track("InitiateCheckout", base);
    } else if (detail.eventType === "ORDER_CREATED") {
      target.ttq.track("CompletePayment", base);
    }
  }

  target.clarity?.("event", eventName);
}

export default function PublicTracking() {
  const [settings, setSettings] =
    useState<PublicTrackingSettings | null>(null);
  const [consent, setConsent] = useState<
    "granted" | "denied" | null
  >(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CONSENT_KEY);
      if (saved === "granted" || saved === "denied") {
        setConsent(saved);
      }
    } catch {}

    fetch("/api/metrics/public-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.settings) {
          setSettings(data.settings as PublicTrackingSettings);
        }
      })
      .catch(() => {});
  }, []);

  const allowed = useMemo(() => {
    if (!settings?.enabled || !settings.hasExternalTracking) return false;
    return !settings.requireConsent || consent === "granted";
  }, [consent, settings]);

  useEffect(() => {
    if (!settings || !allowed) return;

    initGoogle(settings);
    initMeta(settings.metaPixelId);
    initTikTok(settings.tiktokPixelId);
    initClarity(settings.clarityId);

    const seen = new Set<string>();

    const forward = (detail: AnalyticsDetail) => {
      if (!detail?.eventId || seen.has(detail.eventId)) return;
      seen.add(detail.eventId);
      forwardEvent(settings, detail);
    };

    const target = window as TrackingWindow;
    (target.__alentoAnalyticsQueue ?? []).forEach(forward);
    target.__alentoAnalyticsQueue = [];
    target.__alentoTrackingReady = true;

    const listener = (event: Event) => {
      forward(
        (event as CustomEvent<AnalyticsDetail>).detail,
      );
    };

    window.addEventListener(
      "alento-analytics-event",
      listener as EventListener,
    );

    return () => {
      target.__alentoTrackingReady = false;
      window.removeEventListener(
        "alento-analytics-event",
        listener as EventListener,
      );
    };
  }, [allowed, settings]);

  function choose(next: "granted" | "denied") {
    setConsent(next);
    try {
      window.localStorage.setItem(CONSENT_KEY, next);
    } catch {}
  }

  if (
    !settings?.enabled ||
    !settings.hasExternalTracking ||
    !settings.requireConsent ||
    consent
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-[92px] left-1/2 z-[220] w-[min(92vw,430px)] -translate-x-1/2 rounded-[20px] border border-white/12 bg-[#101011]/97 p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,.48)] backdrop-blur-xl md:bottom-5">
      <p className="text-[12px] font-bold">Medición para mejorar tu experiencia</p>
      <p className="mt-1 text-[10px] leading-4 text-white/48">
        Usamos analítica y herramientas publicitarias para entender qué productos interesan y medir campañas. Puedes continuar solo con la medición esencial de Alentó.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => choose("granted")}
          className="h-10 flex-1 rounded-full bg-[#e21a22] text-[10px] font-bold text-white"
        >
          Aceptar medición
        </button>
        <button
          type="button"
          onClick={() => choose("denied")}
          className="h-10 flex-1 rounded-full border border-white/10 bg-white/[0.05] text-[10px] font-semibold text-white/65"
        >
          Solo esencial
        </button>
      </div>
    </div>
  );
}
