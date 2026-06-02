import { NextResponse } from "next/server";

import {
  mergeHeaders,
  noStoreHeaders,
  publicReadRateLimit,
  rateLimitedJson
} from "../../../server/http/public-read-limit";
import { parseRequestChainId } from "../../../server/chain";
import { getHealthzSnapshot } from "../../../server/healthz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const quota = publicReadRateLimit({
    envName: "HEALTHZ_RATE_LIMIT_PER_MINUTE",
    fallback: 120,
    keyPrefix: "healthz",
    request
  });
  if (!quota.allowed) {
    return rateLimitedJson("Too many health check requests. Please retry shortly.", quota.headers);
  }

  const chainId = parseRequestChainId(new URL(request.url).searchParams.get("chainId"));
  const snapshot = await getHealthzSnapshot({ chainId });
  return NextResponse.json(snapshot, {
    headers: mergeHeaders(noStoreHeaders(), quota.headers)
  });
}
