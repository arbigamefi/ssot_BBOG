import { NextResponse } from "next/server";

import { readKeeperHealthSnapshot } from "../../../server/ops/keeper-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const snapshot = await readKeeperHealthSnapshot();
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" }
  });
}
