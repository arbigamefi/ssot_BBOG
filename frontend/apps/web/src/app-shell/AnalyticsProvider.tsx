"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface AnalyticsContextValue {
  trackEvent: (name: string, props?: Record<string, string | number>) => void;
}

const AnalyticsContext = React.createContext<AnalyticsContextValue>({
  trackEvent: () => {}
});

export function useAnalytics() {
  return React.useContext(AnalyticsContext);
}

const ANALYTICS_ID =
  typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_ANALYTICS_ID ?? "") : "";

const ANALYTICS_HOST =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_ANALYTICS_HOST ?? "https://plausible.io")
    : "https://plausible.io";

function sendEvent(name: string, props?: Record<string, string | number>) {
  if (!ANALYTICS_ID) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[analytics]", name, props ?? "");
    }
    return;
  }

  try {
    const url = `${ANALYTICS_HOST}/api/event`;
    const body = JSON.stringify({
      d: ANALYTICS_ID,
      n: name,
      p: props ? JSON.stringify(props) : undefined,
      r: document.referrer || null,
      u: window.location.href
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body);
    } else {
      fetch(url, { body, keepalive: true, method: "POST" }).catch(() => {});
    }
  } catch {
    // Analytics must never break product flows.
  }
}

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    sendEvent("pageview");
  }, [pathname, searchParams]);

  return null;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const trackEvent = React.useCallback((name: string, props?: Record<string, string | number>) => {
    sendEvent(name, props);
  }, []);

  const value = React.useMemo(() => ({ trackEvent }), [trackEvent]);

  return (
    <AnalyticsContext.Provider value={value}>
      <React.Suspense fallback={null}>
        <PageViewTracker />
      </React.Suspense>
      {children}
    </AnalyticsContext.Provider>
  );
}
