import { NextResponse } from "next/server";

import {
  clampAffiliateBetsLimit,
  normalizeAffiliateAddress,
  queryAffiliateBets
} from "../../../../../server/betting/recent-bets";
import {
  mergeHeaders,
  noStoreHeaders,
  publicReadRateLimit,
  rateLimitedJson
} from "../../../../../server/http/public-read-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ error: { code, message } }, { status });
}

function parseChainId(value: string | null) {
  const parsed = Number(value ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 84532;
}

function emptyAffiliateBetsResponse({
  affiliate,
  chainId
}: {
  affiliate: string;
  chainId: number;
}) {
  return {
    schemaVersion: 1 as const,
    affiliate,
    cached: false,
    chainId,
    fromBlock: 0,
    generatedAt: Date.now(),
    rows: [],
    source: "rpc-window" as const,
    stats: {
      affiliate,
      betCount: 0,
      payout: "0",
      payoutGross: "0",
      settledCount: 0,
      turnover: "0"
    },
    toBlock: 0
  };
}

export async function GET(request: Request, context: { params: Promise<{ address: string }> }) {
  const url = new URL(request.url);
  const chainId = parseChainId(url.searchParams.get("chainId"));
  const quota = publicReadRateLimit({
    envName: "BETS_AFFILIATE_RATE_LIMIT_PER_MINUTE",
    fallback: 120,
    keyPrefix: "bets:affiliate",
    request
  });
  if (!quota.allowed) {
    return rateLimitedJson(
      "Too many affiliate-bets requests. Please retry shortly.",
      quota.headers
    );
  }

  try {
    const params = await context.params;
    const affiliate = normalizeAffiliateAddress(params.address);
    const limit = clampAffiliateBetsLimit(Number(url.searchParams.get("limit") ?? ""));
    const response = await queryAffiliateBets({ affiliate, chainId, limit });

    return NextResponse.json(response, {
      headers: mergeHeaders(noStoreHeaders(), quota.headers)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query affiliate bets.";
    if (message.includes("affiliate")) {
      return jsonError(message, 400, "AFFILIATE_BETS_FAILED");
    }

    const params = await context.params;
    return NextResponse.json(emptyAffiliateBetsResponse({ affiliate: params.address, chainId }), {
      headers: mergeHeaders(noStoreHeaders(), quota.headers)
    });
  }
}
