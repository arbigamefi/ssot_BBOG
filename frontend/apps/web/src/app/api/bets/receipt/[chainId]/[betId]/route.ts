import { NextResponse } from "next/server";

import { parseStrictRequestChainId } from "../../../../../../server/chain";
import {
  normalizeBetId,
  normalizeOptionalGameHubAddress,
  queryBetReceipt
} from "../../../../../../server/betting/recent-bets";
import {
  mergeHeaders,
  noStoreHeaders,
  publicReadRateLimit,
  rateLimitedJson
} from "../../../../../../server/http/public-read-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ betId: string; chainId: string }> }
) {
  const quota = publicReadRateLimit({
    envName: "BETS_RECEIPT_RATE_LIMIT_PER_MINUTE",
    fallback: 120,
    keyPrefix: "bets:receipt",
    request
  });
  if (!quota.allowed) {
    return rateLimitedJson("Too many receipt requests. Please retry shortly.", quota.headers);
  }

  try {
    const { betId: rawBetId, chainId: rawChainId } = await params;
    const chainId = parseStrictRequestChainId(rawChainId);
    if (!chainId) return jsonError("Unsupported receipt chain.", 400, "UNSUPPORTED_CHAIN");

    const betId = normalizeBetId(rawBetId);
    const hubs = new URL(request.url).searchParams.getAll("hub");
    if (hubs.length > 1) return jsonError("hub must be a single address.");
    // Bet ids restart in every GameHub deployment; without a hub this reads the active release.
    const gameHub = normalizeOptionalGameHubAddress(hubs[0]);
    const response = await queryBetReceipt({ betId, chainId, gameHub });

    return NextResponse.json(response, {
      headers: mergeHeaders(noStoreHeaders(), quota.headers)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query receipt.";
    return jsonError(message, 400, "BET_RECEIPT_FAILED");
  }
}
