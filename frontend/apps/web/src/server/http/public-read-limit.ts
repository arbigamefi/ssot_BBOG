import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
  readPositiveIntegerEnv
} from "./rate-limit";

export function noStoreHeaders() {
  return {
    "cache-control": "no-store"
  };
}

export function mergeHeaders(...headersList: Array<HeadersInit | undefined>) {
  const headers = new Headers();
  for (const headerLike of headersList) {
    if (!headerLike) continue;
    new Headers(headerLike).forEach((value, key) => headers.set(key, value));
  }
  return headers;
}

export function publicReadRateLimit({
  envName,
  fallback,
  keyPrefix,
  request
}: {
  envName: string;
  fallback: number;
  keyPrefix: string;
  request: Request;
}) {
  const limit = readPositiveIntegerEnv(envName, fallback);
  const result = checkRateLimit({
    key: `${keyPrefix}:${getClientIp(request)}`,
    limit,
    windowMs: 60_000
  });
  return {
    allowed: result.allowed,
    headers: rateLimitHeaders(result, limit)
  };
}

export function rateLimitedJson(
  message = "Too many requests. Please retry shortly.",
  headers?: HeadersInit
) {
  return Response.json(
    {
      error: {
        code: "RATE_LIMITED",
        message
      }
    },
    {
      status: 429,
      headers: mergeHeaders(noStoreHeaders(), headers)
    }
  );
}
