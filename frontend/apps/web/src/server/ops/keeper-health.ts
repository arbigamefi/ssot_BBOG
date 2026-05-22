import { readFile } from "node:fs/promises";
import path from "node:path";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type KeeperHealthSnapshot = {
  schemaVersion: 1;
  status: string;
  role: string;
  chainId: number;
  gameHub: string;
  vrfHub: string;
  keeper: string;
  startedAt: string;
  updatedAt: string;
  queueDepth: number;
  [key: string]: unknown;
};

function repoRoot() {
  return path.resolve(process.cwd(), "../../..");
}

function defaultHealthPath() {
  return path.resolve(process.cwd(), "../../.runtime/casino-keeper-health.json");
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

async function readReleaseFallback(chainId: number) {
  const release = await readJsonFile(
    path.resolve(process.cwd(), `../../packages/ssot/src/release/embedded/chain-${chainId}.json`)
  );
  return release && typeof release === "object" ? (release as any) : undefined;
}

export async function readKeeperHealthSnapshot({
  chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532")
}: {
  chainId?: number;
} = {}): Promise<KeeperHealthSnapshot> {
  for (const candidate of healthPathCandidates()) {
    const snapshot = await readJsonFile(candidate);
    if (snapshot) {
      return snapshot as KeeperHealthSnapshot;
    }
  }

  const release = await readReleaseFallback(chainId);
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    status: "stopped",
    role: "primary",
    chainId: Number(release?.chainId ?? chainId),
    gameHub: release?.contracts?.gameHub ?? ZERO_ADDRESS,
    vrfHub: release?.contracts?.vrfHub ?? ZERO_ADDRESS,
    keeper: ZERO_ADDRESS,
    startedAt: now,
    updatedAt: now,
    queueDepth: 0
  };
}
