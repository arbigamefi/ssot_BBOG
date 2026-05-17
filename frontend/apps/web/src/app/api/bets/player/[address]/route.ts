import { NextResponse } from "next/server";

import {
  clampPlayerBetsLimit,
  normalizePlayerAddress,
  queryPlayerBets
} from "../../../../../server/betting/recent-bets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ error: { code, message } }, { status });
}

function parseChainId(value: string | null) {
  const parsed = Number(value ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 84532;
}

function emptyPlayerBetsResponse({ chainId, player }: { chainId: number; player: string }) {
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

  try {
    const params = await context.params;
    const limit = clampPlayerBetsLimit(Number(url.searchParams.get("limit") ?? ""));
    const player = normalizePlayerAddress(params.address);
    const response = await queryPlayerBets({ chainId, limit, player });

    return NextResponse.json(response, {
      headers: {
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query player bets.";
    if (message.includes("player")) {
      return jsonError(message, 400, "PLAYER_BETS_FAILED");
    }

    const params = await context.params;
    return NextResponse.json(emptyPlayerBetsResponse({ chainId, player: params.address }), {
      headers: {
        "cache-control": "no-store"
      }
    });
  }
}
