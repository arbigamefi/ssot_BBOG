import { NextResponse } from "next/server";

import { parseRequestChainId } from "../../../../server/chain";
import {
  mergeHeaders,
  publicReadRateLimit,
  rateLimitedJson
} from "../../../../server/http/public-read-limit";
import { queryLandingAssetOverview } from "../../../../server/landing/asset-overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicMetricHeaders() {
  return {
    "cache-control": "public, max-age=0, s-maxage=15, stale-while-revalidate=30"
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chainId = parseRequestChainId(url.searchParams.get("chainId"));
  const quota = publicReadRateLimit({
    envName: "LANDING_ASSET_OVERVIEW_RATE_LIMIT_PER_MINUTE",
    fallback: 120,
    keyPrefix: "landing:asset-overview",
    request
  });
  if (!quota.allowed) {
    return rateLimitedJson(
      "Too many landing asset overview requests. Please retry shortly.",
      quota.headers
    );
  }

  const headers = mergeHeaders(publicMetricHeaders(), quota.headers);
  return NextResponse.json(await queryLandingAssetOverview(chainId), { headers });
}
