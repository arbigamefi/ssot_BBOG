import { NextResponse } from "next/server";

import { parseRequestChainId } from "../../../../server/chain";
import {
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chainId = parseRequestChainId(url.searchParams.get("chainId"));
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

  const response = await queryCasinoTimeseries({
    chainId,
    days,
    ...(gameId ? { gameId } : {})
  });
  return NextResponse.json(response, {
    headers: mergeHeaders(noStoreHeaders(), quota.headers)
  });
}
