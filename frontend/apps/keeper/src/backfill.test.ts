import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadBackfillConfig, resolveBackfillRange } from "./backfill.js";

function writeRelease() {
  const dir = mkdtempSync(join(tmpdir(), "keeper-backfill-"));
  const releasePath = join(dir, "chain-84532.json");
  writeFileSync(
    releasePath,
    JSON.stringify({
      chainId: 84532,
      contracts: {
        gameHub: "0x1111111111111111111111111111111111111111",
        vrfHub: "0x2222222222222222222222222222222222222222"
      },
      meta: { blockNumber: 123 }
    })
  );
  return releasePath;
}

describe("loadBackfillConfig", () => {
  it("requires KEEPER_RPC_HTTP instead of generic frontend or deploy RPC fallbacks", () => {
    expect(() =>
      loadBackfillConfig({
        BET_INDEX_DRY_RUN: "true",
        KEEPER_RELEASE_PATH: writeRelease(),
        RPC_URL: "https://generic.example",
        NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: "https://browser.example"
      } as NodeJS.ProcessEnv)
    ).toThrow(/KEEPER_RPC_HTTP is required/);
  });

  it("uses KEEPER_RPC_HTTP from the selected keeper deploy env", () => {
    expect(
      loadBackfillConfig({
        BET_INDEX_DRY_RUN: "true",
        KEEPER_RELEASE_PATH: writeRelease(),
        KEEPER_RPC_HTTP: "https://keeper.example"
      } as NodeJS.ProcessEnv).httpRpcUrl
    ).toBe("https://keeper.example");
  });
});

describe("resolveBackfillRange", () => {
  it("uses confirmed latest block when no explicit toBlock is provided", () => {
    expect(
      resolveBackfillRange({
        confirmations: 2n,
        fromBlock: 100n,
        latestBlock: 150n
      })
    ).toEqual({ fromBlock: 100n, toBlock: 148n });
  });

  it("caps explicit toBlock at the confirmed latest block", () => {
    expect(
      resolveBackfillRange({
        confirmations: 3n,
        fromBlock: 100n,
        latestBlock: 150n,
        toBlock: 200n
      })
    ).toEqual({ fromBlock: 100n, toBlock: 147n });
  });

  it("rejects an empty block range", () => {
    expect(() =>
      resolveBackfillRange({
        confirmations: 0n,
        fromBlock: 200n,
        latestBlock: 150n
      })
    ).toThrow(/before BET_INDEX_FROM_BLOCK/);
  });
});
