/**
 * Next.js instrumentation file.
 * Called once when the server starts. Server + edge Sentry init happens here.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import * as Sentry from "@sentry/nextjs";

import { getSentryEnvironment, getSentryRelease } from "./src/observability/sentry-config";
import { scrubSentryEvent } from "./src/observability/sentry-scrub";

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      environment: getSentryEnvironment(),
      release: getSentryRelease(),
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      beforeSend: scrubSentryEvent
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      environment: getSentryEnvironment(),
      release: getSentryRelease(),
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      beforeSend: scrubSentryEvent
    });
  }
}

// Capture errors from nested React server components
export const onRequestError = Sentry.captureRequestError;
