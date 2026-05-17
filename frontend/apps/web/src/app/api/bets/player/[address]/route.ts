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

export async function GET(request: Request, context: { params: Promise<{ address: string }> }) {
  try {
    const url = new URL(request.url);
    const params = await context.params;
    const chainId = parseChainId(url.searchParams.get("chainId"));
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
    return jsonError(message, message.includes("player") ? 400 : 500, "PLAYER_BETS_FAILED");
  }
}
