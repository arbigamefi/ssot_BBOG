import { NextResponse } from "next/server";

import { parseRequestChainId } from "../../../../server/chain";
import { queryOpsGovernance } from "../../../../server/governance/timelock-queue";
import {
  mergeHeaders,
  noStoreHeaders,
  publicReadRateLimit,
  rateLimitedJson
} from "../../../../server/http/public-read-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Every governance timelock operation, void windows and disabled games, for the Ops page. */
export async function GET(request: Request) {
  const quota = publicReadRateLimit({
    envName: "OPS_GOVERNANCE_RATE_LIMIT_PER_MINUTE",
    fallback: 30,
    keyPrefix: "ops:governance",
    request
  });
  if (!quota.allowed) {
    return rateLimitedJson(
      "Too many ops-governance requests. Please retry shortly.",
      quota.headers
    );
  }
  const chainId = parseRequestChainId(new URL(request.url).searchParams.get("chainId"));
  const response = await queryOpsGovernance({ chainId });
  return NextResponse.json(response, {
    headers: mergeHeaders(noStoreHeaders(), quota.headers)
  });
}
