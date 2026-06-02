import { NextResponse } from "next/server";

import { parseRequestChainId } from "../../../server/chain";
import { readKeeperHealthSnapshot } from "../../../server/ops/keeper-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const chainId = parseRequestChainId(new URL(request.url).searchParams.get("chainId"));
  const snapshot = await readKeeperHealthSnapshot({ chainId });
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" }
  });
}
