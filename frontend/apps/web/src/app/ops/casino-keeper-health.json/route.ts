import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function repoRoot() {
  return path.resolve(process.cwd(), "../../..");
}

function defaultHealthPath() {
  return path.join(process.cwd(), "public/ops/casino-keeper-health.json");
}

function healthPathCandidates() {
  const configured = process.env.KEEPER_HEALTH_PATH?.trim();
  if (!configured) return [defaultHealthPath()];
  if (path.isAbsolute(configured)) return [configured];
  return [path.resolve(repoRoot(), configured), path.resolve(process.cwd(), configured)];
}

async function readJsonFile(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

async function readReleaseFallback() {
  const release = await readJsonFile(
    path.resolve(process.cwd(), "../../packages/ssot/src/release/embedded/chain-84532.json")
  );
  return release && typeof release === "object" ? (release as any) : undefined;
}

export async function GET() {
  for (const candidate of healthPathCandidates()) {
    const snapshot = await readJsonFile(candidate);
    if (snapshot) {
      return NextResponse.json(snapshot, {
        headers: { "Cache-Control": "no-store" }
      });
    }
  }

  const release = await readReleaseFallback();
  const now = new Date().toISOString();
  return NextResponse.json(
    {
      schemaVersion: 1,
      status: "stopped",
      role: "primary",
      chainId: Number(release?.chainId ?? 84532),
      gameHub: release?.contracts?.gameHub ?? ZERO_ADDRESS,
      vrfHub: release?.contracts?.vrfHub ?? ZERO_ADDRESS,
      keeper: ZERO_ADDRESS,
      startedAt: now,
      updatedAt: now,
      queueDepth: 0
    },
    {
      headers: { "Cache-Control": "no-store" }
    }
  );
}
