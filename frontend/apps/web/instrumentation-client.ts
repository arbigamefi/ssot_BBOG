/**
 * Next.js client instrumentation file.
 * Runs once in the browser before the app hydrates.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
let captureRouterTransitionStart: ((...args: unknown[]) => void) | undefined;

declare global {
  interface Window {
    __ssotCaptureException?: (error: unknown) => void;
  }
}

if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,

      // Performance monitoring — sample 10% of transactions in production
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

      // Session replay — disabled by default, enable per-need
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: process.env.NODE_ENV === "production" ? 1.0 : 0,

      // Filter out noisy errors
      ignoreErrors: [
        // Browser extensions
        "ResizeObserver loop",
        // Network flakes
        "Failed to fetch",
        "NetworkError",
        "Load failed",
        // User-initiated abort
        "AbortError"
      ]
    });
    window.__ssotCaptureException = Sentry.captureException;
    captureRouterTransitionStart = Sentry.captureRouterTransitionStart as (
      ...args: unknown[]
    ) => void;
  });
}

// Instrument Next.js router transitions for Sentry performance monitoring
export function onRouterTransitionStart(...args: unknown[]) {
  captureRouterTransitionStart?.(...args);
}
