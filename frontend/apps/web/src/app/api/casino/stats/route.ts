import { NextResponse } from "next/server";

import { parseRequestChainId } from "../../../../server/chain";
import { queryCasinoStats } from "../../../../server/betting/casino-analytics";
import {
  mergeHeaders,
  noStoreHeaders,
  publicReadRateLimit,
  rateLimitedJson
} from "../../../../server/http/public-read-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chainId = parseRequestChainId(url.searchParams.get("chainId"));
  const quota = publicReadRateLimit({
    envName: "CASINO_STATS_RATE_LIMIT_PER_MINUTE",
    fallback: 120,
    keyPrefix: "casino:stats",
    request
  });
  if (!quota.allowed) {
    return rateLimitedJson("Too many casino-stats requests. Please retry shortly.", quota.headers);
  }

  const response = await queryCasinoStats({ chainId });
  return NextResponse.json(response, {
    headers: mergeHeaders(noStoreHeaders(), quota.headers)
  });
}
