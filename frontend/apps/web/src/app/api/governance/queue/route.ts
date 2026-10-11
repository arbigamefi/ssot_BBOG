import { NextResponse } from "next/server";

import { parseRequestChainId } from "../../../../server/chain";
import { queryGovernanceQueue } from "../../../../server/governance/timelock-queue";
import {
  mergeHeaders,
  noStoreHeaders,
  publicReadRateLimit,
  rateLimitedJson
} from "../../../../server/http/public-read-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Waiting and ready governance timelock operations of the release chain, for LPs. */
export async function GET(request: Request) {
  const quota = publicReadRateLimit({
    envName: "GOVERNANCE_QUEUE_RATE_LIMIT_PER_MINUTE",
    fallback: 60,
    keyPrefix: "governance:queue",
    request
  });
  if (!quota.allowed) {
    return rateLimitedJson(
      "Too many governance-queue requests. Please retry shortly.",
      quota.headers
    );
  }
  const chainId = parseRequestChainId(new URL(request.url).searchParams.get("chainId"));
  const response = await queryGovernanceQueue({ chainId });
  return NextResponse.json(response, {
    headers: mergeHeaders(noStoreHeaders(), quota.headers)
  });
}
