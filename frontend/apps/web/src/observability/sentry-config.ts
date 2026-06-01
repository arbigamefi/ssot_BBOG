export function getSentryEnvironment() {
  return process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV;
}

export function getSentryRelease() {
  return process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.NEXT_PUBLIC_BUILD_SHA || undefined;
}
