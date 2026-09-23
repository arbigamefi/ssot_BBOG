import { describe, expect, it, vi } from "vitest";
import { createMemoryBetIndexStore } from "@ssot/bet-index";
import type { PublicClient } from "viem";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadBackfillConfig, resolveBackfillRange, runBetIndexBackfill } from "./backfill.js";

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

describe("terminal refund backfill", () => {
  it.each([false, true])(
    "only checkpoints an authoritative refund (RPC failure=%s)",
    async (fails) => {
      const config = loadBackfillConfig({
        BET_INDEX_DRY_RUN: "true",
        KEEPER_RELEASE_PATH: writeRelease(),
        KEEPER_RPC_HTTP: "http://unused.invalid",
        BET_INDEX_FROM_BLOCK: "123",
        BET_INDEX_TO_BLOCK: "123",
        BET_INDEX_CONFIRMATIONS: "0"
      });
      const amounts = {
        payoutGross: 200_000n,
        payoutNet: 196_000n,
        feeOnPayout: 4_000n,
        protocolFeeAccrual: 2_000n
      };
      const client = {
        getBlockNumber: vi.fn(async () => 123n),
        getBlock: vi.fn(async () => ({ timestamp: 1000n })),
        getContractEvents: vi.fn(async ({ eventName }) =>
          eventName === "BetFinalized"
            ? [
                {
                  args: { positionId: 9n, ...amounts },
                  blockNumber: 123n,
                  logIndex: 1,
                  transactionHash: `0x${"ab".repeat(32)}`
                }
              ]
            : []
        ),
        readContract: fails
          ? vi.fn().mockRejectedValue(new Error("terminal RPC unavailable"))
          : vi.fn().mockResolvedValue({ state: 4, ...amounts, refundAmount: 100_000n })
      } as unknown as PublicClient;
      const store = createMemoryBetIndexStore();
      const run = runBetIndexBackfill({ client, config, store });
      if (fails) {
        await expect(run).rejects.toThrow("terminal RPC unavailable");
        expect(await store.getCursor(config.chainId, "gamehub-events", config.gameHub)).toBeNull();
        expect(await store.getBet({ chainId: config.chainId, betId: 9 })).toBeNull();
      } else {
        await run;
        expect(await store.getCursor(config.chainId, "gamehub-events", config.gameHub)).toBe(123n);
        expect(await store.getBet({ chainId: config.chainId, betId: 9 })).toMatchObject({
          payout: "196000",
          refundAmount: "100000"
        });
      }
    }
  );
});
