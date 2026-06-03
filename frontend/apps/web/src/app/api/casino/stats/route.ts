import { NextResponse } from "next/server";

import { parseRequestChainId } from "../../../../server/chain";
import {
  UnsupportedCasinoAnalyticsAssetError,
  queryCasinoStats
} from "../../../../server/betting/casino-analytics";
import {
  mergeHeaders,
  noStoreHeaders,
  publicReadRateLimit,
  rateLimitedJson
} from "../../../../server/http/public-read-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ error: { code, message } }, { status });
}

function parseOptionalAddress(value: string | null) {
  if (!value) return undefined;
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) return null;
  return value as `0x${string}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chainId = parseRequestChainId(url.searchParams.get("chainId"));
  const asset = parseOptionalAddress(url.searchParams.get("asset"));
  if (asset === null) {
    return jsonError("Invalid asset. Expected a 0x address.", 400, "INVALID_ASSET");
  }
  const quota = publicReadRateLimit({
    envName: "CASINO_STATS_RATE_LIMIT_PER_MINUTE",
    fallback: 120,
    keyPrefix: "casino:stats",
    request
  });
  if (!quota.allowed) {
    return rateLimitedJson("Too many casino-stats requests. Please retry shortly.", quota.headers);
  }

  const rawWindow = url.searchParams.get("window");
  const windowDays = rawWindow ? Number(rawWindow) : undefined;
  let response;
  try {
    response = await queryCasinoStats({ asset, chainId, windowDays });
  } catch (error) {
    if (error instanceof UnsupportedCasinoAnalyticsAssetError) {
      return jsonError("Unsupported analytics asset for this chain.", 400, "UNSUPPORTED_ASSET");
    }
    throw error;
  }
  return NextResponse.json(response, {
    headers: mergeHeaders(noStoreHeaders(), quota.headers)
  });
}
