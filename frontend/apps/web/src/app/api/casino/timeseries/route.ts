import { NextResponse } from "next/server";

import { parseRequestChainId } from "../../../../server/chain";
import {
  UnsupportedCasinoAnalyticsAssetError,
  clampCasinoTimeseriesDays,
  queryCasinoTimeseries
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
    envName: "CASINO_TIMESERIES_RATE_LIMIT_PER_MINUTE",
    fallback: 120,
    keyPrefix: "casino:timeseries",
    request
  });
  if (!quota.allowed) {
    return rateLimitedJson(
      "Too many casino-timeseries requests. Please retry shortly.",
      quota.headers
    );
  }

  const days = clampCasinoTimeseriesDays(Number(url.searchParams.get("days") ?? ""));
  const rawGameId = url.searchParams.get("gameId");
  let gameId: `0x${string}` | undefined;
  if (rawGameId) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(rawGameId)) {
      return jsonError("Invalid gameId. Expected a 0x bytes32 value.", 400, "INVALID_GAME_ID");
    }
    gameId = rawGameId as `0x${string}`;
  }

  let response;
  try {
    response = await queryCasinoTimeseries({
      asset,
      chainId,
      days,
      ...(gameId ? { gameId } : {})
    });
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
