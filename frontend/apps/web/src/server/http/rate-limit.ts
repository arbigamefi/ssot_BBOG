type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; remaining: 0; resetAt: number; retryAfterSeconds: number };

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "local"
  );
}

export function readPositiveIntegerEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function checkRateLimit(config: RateLimitConfig, now = Date.now()): RateLimitResult {
  const current = buckets.get(config.key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + config.windowMs;
    buckets.set(config.key, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(config.limit - 1, 0), resetAt };
  }

  if (current.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  current.count += 1;
  return {
    allowed: true,
    remaining: Math.max(config.limit - current.count, 0),
    resetAt: current.resetAt
  };
}

export function rateLimitHeaders(result: RateLimitResult, limit: number) {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
  if (!result.allowed) headers.set("Retry-After", String(result.retryAfterSeconds));
  return headers;
}

export function __resetRateLimitBucketsForTests() {
  buckets.clear();
}
