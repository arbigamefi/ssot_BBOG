import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { describe, it, expect } from "vitest";
import { encodeFunctionData, type Hex } from "viem";

import { encodeStakeSpec } from "./stakeSpec";
import { getReleaseAbis } from "../abis/release/resolver";

const STRICT_VECTORS = process.env.STRICT_VECTORS === "1";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
// packages/ssot/src
const SRC_ROOT = path.resolve(THIS_DIR, "..");
const FIXTURES_ROOT = path.resolve(SRC_ROOT, "fixtures", "release-bundles");
const EMBEDDED_ROOT = path.resolve(SRC_ROOT, "release", "embedded");

function normalizeHex(x: string): string {
  const s = String(x).trim();
  return s.startsWith("0x") ? "0x" + s.slice(2).toLowerCase() : "0x" + s.toLowerCase();
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function listGoldenVectorFiles(): Promise<string[]> {
  const files: string[] = [];
  if (!(await pathExists(FIXTURES_ROOT))) return files;

  const chains = await fs.readdir(FIXTURES_ROOT);
  for (const c of chains) {
    if (!c.startsWith("chain-")) continue;
    const chainDir = path.join(FIXTURES_ROOT, c);
    const releases = await fs.readdir(chainDir);
    for (const r of releases) {
      const relDir = path.join(chainDir, r);
      for (const name of ["golden-vectors-latest-v14.json", "golden-vectors-latest-v13.json"]) {
        const gv = path.join(relDir, name);
        if (await pathExists(gv)) files.push(gv);
      }
    }
  }
  return files;
}

async function readReleaseLock(dir: string): Promise<any | null> {
  for (const name of ["release-latest-v14.json", "release-latest-v13.json"]) {
    const lockPath = path.join(dir, name);
    if (await pathExists(lockPath)) return JSON.parse(await fs.readFile(lockPath, "utf8"));
  }
  return null;
}

async function loadEmbedded(chainId: number): Promise<any | null> {
  const p = path.join(EMBEDDED_ROOT, `chain-${chainId}.json`);
  if (!(await pathExists(p))) return null;
  return JSON.parse(await fs.readFile(p, "utf8"));
}

function getPlaceBetInputTypes(abi: any[]): string[] {
  const item = abi.find((entry) => entry?.type === "function" && entry?.name === "placeBet");
  return Array.isArray(item?.inputs) ? item.inputs.map((input: any) => String(input.type)) : [];
}

describe("golden vectors (exact-hex)", () => {
  it("stakeSpec + placeBet calldata matches contract-generated vectors", async () => {
    const files = await listGoldenVectorFiles();
    if (files.length === 0) {
      if (STRICT_VECTORS) {
        throw new Error(
          "No versioned golden-vectors-latest-v*.json found under src/fixtures/release-bundles. Run `pnpm ssot:sync ...` and commit outputs."
        );
      }
      // Dev convenience: allow running tests before syncing a release bundle.
      return;
    }

    for (const file of files) {
      const dir = path.dirname(file);
      const raw = JSON.parse(await fs.readFile(file, "utf8")) as any;
      const vectors = Array.isArray(raw.vectors) ? raw.vectors : [];
      expect(vectors.length).toBeGreaterThan(0);

      const chainId = Number(raw.chainId);
      const embedded = await loadEmbedded(chainId);

      // Cross-check: fixture should be coherent with embedded release if present.
      // Only check the fixture whose block matches the embedded release — older
      // fixtures from previous syncs are retained for audit and their digests
      // will naturally differ from the current embedded release.
      let isCurrentRelease = false;
      if (embedded) {
        const lock = await readReleaseLock(dir);
        if (lock) {
          isCurrentRelease =
            typeof lock.blockNumber === "number" && lock.blockNumber === embedded.meta?.blockNumber;
          if (isCurrentRelease && typeof lock.digest === "string") {
            expect(String(embedded.releaseDigest)).toBe(String(lock.digest));
          }
        }
      }

      const gameHubAbi = getReleaseAbis(chainId).GameHubAbi;
      expect(getPlaceBetInputTypes(gameHubAbi as any[])).toEqual([
        "bytes32",
        "uint64",
        "bytes",
        "tuple",
        "address",
        "uint16"
      ]);

      for (const v of vectors) {
        // Basic coherence checks
        expect(Number(chainId)).toBe(Number(raw.chainId));
        if (isCurrentRelease && embedded?.contracts?.gameHub) {
          expect(normalizeHex(v.gameHub)).toBe(normalizeHex(embedded.contracts.gameHub));
        }

        const stakeSpec = v.stakeSpec;
        const encodedStakeSpec = encodeStakeSpec({
          amountPerRoll: BigInt(stakeSpec.amountPerRoll),
          betCount: Number(stakeSpec.betCount),
          stopGain: BigInt(stakeSpec.stopGain),
          stopLoss: BigInt(stakeSpec.stopLoss)
        });

        expect(normalizeHex(encodedStakeSpec)).toBe(normalizeHex(v.stakeSpecEncoded));

        // Current ABI exports only support exact calldata checks for the current
        // v1.3 embedded release.
        if (!isCurrentRelease) continue;

        const placeBetArgs = [
          normalizeHex(v.gameId) as Hex,
          Number(v.poolId),
          normalizeHex(v.params) as Hex,
          {
            amountPerRoll: BigInt(stakeSpec.amountPerRoll),
            betCount: Number(stakeSpec.betCount),
            stopGain: BigInt(stakeSpec.stopGain),
            stopLoss: BigInt(stakeSpec.stopLoss)
          },
          normalizeHex(v.affiliate) as Hex,
          Number(v.maxHouseEdgeBps)
        ];

        const calldata = encodeFunctionData({
          abi: gameHubAbi,
          functionName: "placeBet",
          args: placeBetArgs
        });

        expect(normalizeHex(calldata).slice(0, 10)).toBe(normalizeHex(v.selector));
        expect(normalizeHex(calldata)).toBe(normalizeHex(v.placeBetCalldata));
      }
    }
  });
});
