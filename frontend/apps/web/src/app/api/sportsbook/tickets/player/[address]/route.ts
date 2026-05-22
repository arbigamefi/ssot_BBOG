import { NextResponse } from "next/server";

import {
  clampPlayerBetsLimit,
  normalizePlayerAddress
} from "../../../../../../server/betting/recent-bets";
import {
  mergeHeaders,
  noStoreHeaders,
  publicReadRateLimit,
  rateLimitedJson
} from "../../../../../../server/http/public-read-limit";
import { queryPlayerSportsTickets } from "../../../../../../server/sportsbook/player-tickets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ error: { code, message } }, { status });
}

function parseChainId(value: string | null) {
  const parsed = Number(value ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 84532;
}

function emptyPlayerSportsTicketsResponse({
  chainId,
  player
}: {
  chainId: number;
  player: string;
}) {
  return {
    schemaVersion: 1 as const,
    cached: false,
    chainId,
    fromBlock: 0,
    generatedAt: Date.now(),
    player,
    rows: [],
    source: "rpc-window" as const,
    toBlock: 0
  };
}

export async function GET(request: Request, context: { params: Promise<{ address: string }> }) {
  const url = new URL(request.url);
  const chainId = parseChainId(url.searchParams.get("chainId"));
  const params = await context.params;
  const quota = publicReadRateLimit({
    envName: "SPORTSBOOK_PLAYER_TICKETS_RATE_LIMIT_PER_MINUTE",
    fallback: 120,
    keyPrefix: "sportsbook:tickets:player",
    request
  });
  if (!quota.allowed) {
    return rateLimitedJson("Too many player-ticket requests. Please retry shortly.", quota.headers);
  }

  try {
    const limit = clampPlayerBetsLimit(Number(url.searchParams.get("limit") ?? ""));
    const player = normalizePlayerAddress(params.address);
    const response = await queryPlayerSportsTickets({ chainId, limit, player });

    return NextResponse.json(response, {
      headers: mergeHeaders(noStoreHeaders(), quota.headers)
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to query player sports tickets.";
    if (message.includes("player")) {
      return jsonError(message, 400, "PLAYER_SPORTS_TICKETS_FAILED");
    }

    return NextResponse.json(
      emptyPlayerSportsTicketsResponse({ chainId, player: params.address }),
      {
        headers: mergeHeaders(noStoreHeaders(), quota.headers)
      }
    );
  }
}
