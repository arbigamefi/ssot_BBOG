import { NextResponse } from "next/server";

import {
  clampRecentBetsLimit,
  normalizeGameId,
  queryRecentBets
} from "../../../../server/betting/recent-bets";
import {
  mergeHeaders,
  noStoreHeaders,
  publicReadRateLimit,
  rateLimitedJson
} from "../../../../server/http/public-read-limit";
import { parseRequestChainId } from "../../../../server/chain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ error: { code, message } }, { status });
}

function emptyRecentBetsResponse(chainId: number) {
  return {
    schemaVersion: 1 as const,
    cached: false,
    chainId,
    fromBlock: 0,
    generatedAt: Date.now(),
    rows: [],
    source: "rpc-window" as const,
    toBlock: 0
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chainId = parseRequestChainId(url.searchParams.get("chainId"));
  const quota = publicReadRateLimit({
    envName: "BETS_RECENT_RATE_LIMIT_PER_MINUTE",
    fallback: 120,
    keyPrefix: "bets:recent",
    request
  });
  if (!quota.allowed) {
    return rateLimitedJson("Too many recent-bets requests. Please retry shortly.", quota.headers);
  }

  try {
    const limit = clampRecentBetsLimit(Number(url.searchParams.get("limit") ?? ""));
    const gameId = normalizeGameId(url.searchParams.get("gameId") ?? undefined);
    const response = await queryRecentBets({ chainId, gameId, limit });

    return NextResponse.json(response, {
      headers: mergeHeaders(noStoreHeaders(), quota.headers)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query recent bets.";
    if (message.includes("gameId")) {
      return jsonError(message, 400, "RECENT_BETS_FAILED");
    }

    return NextResponse.json(emptyRecentBetsResponse(chainId), {
      headers: mergeHeaders(noStoreHeaders(), quota.headers)
    });
  }
}
