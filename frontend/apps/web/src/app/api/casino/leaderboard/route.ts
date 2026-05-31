import { NextResponse } from "next/server";

import { parseRequestChainId } from "../../../../server/chain";
import {
  type CasinoLeaderboardSort,
  clampCasinoLeaderboardLimit,
  queryCasinoLeaderboard
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
    envName: "CASINO_LEADERBOARD_RATE_LIMIT_PER_MINUTE",
    fallback: 120,
    keyPrefix: "casino:leaderboard",
    request
  });
  if (!quota.allowed) {
    return rateLimitedJson(
      "Too many casino-leaderboard requests. Please retry shortly.",
      quota.headers
    );
  }

  const by = url.searchParams.get("by") ?? "turnover";
  if (by !== "turnover" && by !== "topWin") {
    return jsonError(
      "Unsupported leaderboard sort. Use by=turnover or by=topWin.",
      400,
      "UNSUPPORTED_SORT"
    );
  }

  const limit = clampCasinoLeaderboardLimit(Number(url.searchParams.get("limit") ?? ""));

  // Optional per-game scope. Validate the bytes32 shape before it reaches SQL.
  const rawGameId = url.searchParams.get("gameId");
  let gameId: `0x${string}` | undefined;
  if (rawGameId) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(rawGameId)) {
      return jsonError("Invalid gameId. Expected a 0x bytes32 value.", 400, "INVALID_GAME_ID");
    }
    gameId = rawGameId as `0x${string}`;
  }

  // Optional time window (in days). The service clamps unknown values to
  // all-time, so we forward the raw number and let it validate.
  const rawWindow = url.searchParams.get("window");
  const windowDays = rawWindow ? Number(rawWindow) : undefined;

  // Optional connected wallet to resolve a "your rank" position for. Validate
  // the address shape before it reaches SQL.
  const rawPlayer = url.searchParams.get("player");
  let player: `0x${string}` | undefined;
  if (rawPlayer) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(rawPlayer)) {
      return jsonError("Invalid player. Expected a 0x address.", 400, "INVALID_PLAYER");
    }
    player = rawPlayer as `0x${string}`;
  }

  const response = await queryCasinoLeaderboard({
    by: by as CasinoLeaderboardSort,
    chainId,
    limit,
    gameId,
    windowDays,
    player
  });
  return NextResponse.json(response, {
    headers: mergeHeaders(noStoreHeaders(), quota.headers)
  });
}
