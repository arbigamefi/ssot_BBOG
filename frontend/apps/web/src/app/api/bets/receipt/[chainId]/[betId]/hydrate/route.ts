import { NextResponse } from "next/server";

import { parseStrictRequestChainId } from "../../../../../../../server/chain";
import {
  materializeBetReceipt,
  normalizeBetId
} from "../../../../../../../server/betting/recent-bets";
import {
  mergeHeaders,
  noStoreHeaders,
  publicReadRateLimit,
  rateLimitedJson
} from "../../../../../../../server/http/public-read-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

function jsonError(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ error: { code, message } }, { status, headers: noStoreHeaders() });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ betId: string; chainId: string }> }
) {
  const quota = publicReadRateLimit({
    envName: "BETS_RECEIPT_HYDRATE_RATE_LIMIT_PER_MINUTE",
    fallback: 60,
    keyPrefix: "bets:receipt:hydrate",
    request
  });
  if (!quota.allowed) {
    return rateLimitedJson(
      "Too many receipt hydrate requests. Please retry shortly.",
      quota.headers
    );
  }

  try {
    const { betId: rawBetId, chainId: rawChainId } = await params;
    const chainId = parseStrictRequestChainId(rawChainId);
    if (!chainId) return jsonError("Unsupported receipt chain.", 400, "UNSUPPORTED_CHAIN");

    const betId = normalizeBetId(rawBetId);
    const body = (await request.json().catch(() => ({}))) as {
      terminalTxHash?: unknown;
    };
    const terminalTxHash = String(body.terminalTxHash ?? "");
    if (!TX_HASH_PATTERN.test(terminalTxHash)) {
      return jsonError("terminalTxHash must be a 32-byte transaction hash.");
    }

    const response = await materializeBetReceipt({
      betId,
      chainId,
      terminalTxHash: terminalTxHash as `0x${string}`
    });
    const status = response.row && response.source === "postgres" ? 200 : 202;
    return NextResponse.json(response, {
      headers: mergeHeaders(noStoreHeaders(), quota.headers),
      status
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to hydrate receipt.";
    return jsonError(message, 400, "BET_RECEIPT_HYDRATE_FAILED");
  }
}
