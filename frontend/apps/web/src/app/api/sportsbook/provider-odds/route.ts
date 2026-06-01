import {
  getSportsbookProviderOdds,
  SportsbookProviderOddsError
} from "../../../../server/sportsbook/provider-odds";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
  readPositiveIntegerEnv
} from "../../../../server/http/rate-limit";

export const dynamic = "force-dynamic";

const SOFT_PROVIDER_FAILURE_CODES = new Set([
  "ODDS_PROVIDER_CONFIG_MISSING",
  "PROVIDER_BAD_RESPONSE",
  "PROVIDER_EVENT_INCOMPLETE",
  "PROVIDER_H2H_MISSING",
  "PROVIDER_OUTCOME_MISSING",
  "PROVIDER_REQUEST_FAILED"
]);

function noStore() {
  return {
    "Cache-Control": "no-store"
  };
}

function mergeHeaders(...headersList: Array<HeadersInit | undefined>) {
  const headers = new Headers();
  for (const headerLike of headersList) {
    if (!headerLike) continue;
    new Headers(headerLike).forEach((value, key) => headers.set(key, value));
  }
  return headers;
}

function rateLimit(request: Request) {
  const limit = readPositiveIntegerEnv("SPORTSBOOK_PROVIDER_ODDS_RATE_LIMIT_PER_MINUTE", 60);
  const result = checkRateLimit({
    key: `sportsbook:provider-odds:${getClientIp(request)}`,
    limit,
    windowMs: 60_000
  });
  return { limit, result };
}

export async function GET(request: Request) {
  try {
    const quota = rateLimit(request);
    const quotaHeaders = rateLimitHeaders(quota.result, quota.limit);
    if (!quota.result.allowed) {
      return Response.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many sportsbook provider odds requests. Please retry shortly."
          }
        },
        { status: 429, headers: mergeHeaders(noStore(), quotaHeaders) }
      );
    }

    const url = new URL(request.url);
    const odds = await getSportsbookProviderOdds({ searchParams: url.searchParams });
    return Response.json(odds, {
      headers: mergeHeaders(noStore(), quotaHeaders)
    });
  } catch (error) {
    if (error instanceof SportsbookProviderOddsError) {
      if (SOFT_PROVIDER_FAILURE_CODES.has(error.code)) {
        return Response.json(
          {
            schemaVersion: "sportsbook.provider-odds-unavailable.v1",
            unavailable: {
              code: error.code,
              message: error.message
            }
          },
          { headers: noStore() }
        );
      }
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status }
      );
    }
    return Response.json(
      {
        error: {
          code: "PROVIDER_ODDS_FAILED",
          message: error instanceof Error ? error.message : "Provider odds request failed."
        }
      },
      { status: 500 }
    );
  }
}
