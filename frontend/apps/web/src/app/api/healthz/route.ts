import { NextResponse } from "next/server";

import { getHealthzSnapshot } from "../../../server/healthz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const snapshot = await getHealthzSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      "cache-control": "no-store"
    }
  });
}
