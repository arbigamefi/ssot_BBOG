import { NextResponse } from "next/server";

import {
  clampRecentBetsLimit,
  normalizeGameId,
  queryRecentBets
} from "../../../../server/betting/recent-bets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ error: { code, message } }, { status });
}

function parseChainId(value: string | null) {
  const parsed = Number(value ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 84532;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const chainId = parseChainId(url.searchParams.get("chainId"));
    const limit = clampRecentBetsLimit(Number(url.searchParams.get("limit") ?? ""));
    const gameId = normalizeGameId(url.searchParams.get("gameId") ?? undefined);
    const response = await queryRecentBets({ chainId, gameId, limit });

    return NextResponse.json(response, {
      headers: {
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query recent bets.";
    return jsonError(message, message.includes("gameId") ? 400 : 500, "RECENT_BETS_FAILED");
  }
}
