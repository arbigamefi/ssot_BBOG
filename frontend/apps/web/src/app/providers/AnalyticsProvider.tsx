"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Minimal privacy-respecting analytics provider.
 *
 * Tracks page views automatically via `usePathname` + `useSearchParams`.
 * Provides `trackEvent()` via context for custom event tracking.
 *
 * Backend integration is opt-in: set NEXT_PUBLIC_ANALYTICS_ID to enable.
 * When no ID is set, events are logged to console in development only.
 *
 * Supports Plausible-compatible script endpoint via NEXT_PUBLIC_ANALYTICS_HOST.
 * Default: https://plausible.io
 */

interface AnalyticsContextValue {
  trackEvent: (name: string, props?: Record<string, string | number>) => void;
}

const AnalyticsContext = React.createContext<AnalyticsContextValue>({
  trackEvent: () => {},
});

export function useAnalytics() {
  return React.useContext(AnalyticsContext);
}

const ANALYTICS_ID = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_ANALYTICS_ID ?? "")
  : "";

const ANALYTICS_HOST = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_ANALYTICS_HOST ?? "https://plausible.io")
  : "https://plausible.io";

function sendEvent(name: string, props?: Record<string, string | number>) {
  if (!ANALYTICS_ID) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[analytics]", name, props ?? "");
    }
    return;
  }

  // Plausible-compatible event API
  try {
    const url = `${ANALYTICS_HOST}/api/event`;
    const body = JSON.stringify({
      n: name,
      u: window.location.href,
      d: ANALYTICS_ID,
      r: document.referrer || null,
      p: props ? JSON.stringify(props) : undefined,
    });
    // Use sendBeacon for reliability (fires even on page unload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body);
    } else {
      fetch(url, { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Silently fail — analytics should never break the app
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
  const trackEvent = React.useCallback(
    (name: string, props?: Record<string, string | number>) => {
      sendEvent(name, props);
    },
    [],
  );

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
