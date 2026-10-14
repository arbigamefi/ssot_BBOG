import { describe, expect, it, vi } from "vitest";
import { createMemoryBetIndexStore } from "@ssot/bet-index";
import type { PublicClient } from "viem";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadBackfillConfig, resolveBackfillRange, runBetIndexBackfill } from "./backfill.js";

function writeRelease(pools?: unknown[]) {
  const dir = mkdtempSync(join(tmpdir(), "keeper-backfill-"));
  const releasePath = join(dir, "chain-84532.json");
  writeFileSync(
    releasePath,
    JSON.stringify({
      chainId: 84532,
      contracts: {
        governanceTimelock: "0x00000000000000000000000000000000000000ee",
        gameHub: "0x1111111111111111111111111111111111111111",
        vrfHub: "0x2222222222222222222222222222222222222222",
        poolRegistry: "0x0000000000000000000000000000000000000066"
      },
      pools,
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

  it("backfills the LP ledger of every release pool, before activation too", () => {
    const pool = {
      poolId: 7,
      asset: "0x0000000000000000000000000000000000000003",
      bank: "0x0000000000000000000000000000000000000004",
      vault: "0x0000000000000000000000000000000000000008"
    };
    expect(
      loadBackfillConfig({
        BET_INDEX_DRY_RUN: "true",
        KEEPER_RELEASE_PATH: writeRelease([pool]),
        KEEPER_RPC_HTTP: "https://keeper.example"
      } as NodeJS.ProcessEnv).vaultProviderLedgerPools
    ).toEqual([{ ...pool, decimals: 6 }]);
  });
});

describe("resolveBackfillRange", () => {
  it("stops at the finalized block when no explicit toBlock is provided", () => {
    expect(resolveBackfillRange({ fromBlock: 100n, finalizedBlock: 148n })).toEqual({
      fromBlock: 100n,
      toBlock: 148n
    });
  });

  it("caps an explicit toBlock at the finalized block and keeps a lower one", () => {
    expect(resolveBackfillRange({ fromBlock: 100n, finalizedBlock: 147n, toBlock: 200n })).toEqual({
      fromBlock: 100n,
      toBlock: 147n
    });
    expect(resolveBackfillRange({ fromBlock: 100n, finalizedBlock: 147n, toBlock: 120n })).toEqual({
      fromBlock: 100n,
      toBlock: 120n
    });
  });

  it("rejects an empty block range", () => {
    expect(() =>
      resolveBackfillRange({
        fromBlock: 200n,
        finalizedBlock: 150n
      })
    ).toThrow(/before BET_INDEX_FROM_BLOCK/);
  });
});

describe("backfill range", () => {
  it("defaults to 2,000-block log ranges and replays up to the finalized block, not the latest", async () => {
    const config = loadBackfillConfig({
      BET_INDEX_DRY_RUN: "true",
      KEEPER_RELEASE_PATH: writeRelease(),
      KEEPER_RPC_HTTP: "http://unused.invalid"
    });
    expect(config.scanChunkBlocks).toBe(2_000n);
    const client = {
      getBlockNumber: vi.fn(async () => 9_000n),
      getBlock: vi.fn(async ({ blockTag }: { blockTag?: string }) => ({
        number: blockTag === "finalized" ? 4_200n : 9_000n,
        timestamp: 1000n
      })),
      getLogs: vi.fn(async () => [])
    } as unknown as PublicClient;
    const store = createMemoryBetIndexStore();
    const result = await runBetIndexBackfill({ client, config, store });
    expect(result).toMatchObject({ fromBlock: "123", toBlock: "4200" });
    expect(await store.getCursor(config.chainId, "gamehub-events", config.gameHub)).toBe(4_200n);
    expect(client.getBlockNumber).not.toHaveBeenCalled();
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
        BET_INDEX_TO_BLOCK: "123"
      });
      const amounts = {
        payoutGross: 200_000n,
        payoutNet: 196_000n,
        feeOnPayout: 4_000n,
        protocolFeeAccrual: 2_000n
      };
      const client = {
        getBlock: vi.fn(async () => ({ number: 123n, timestamp: 1000n })),
        getLogs: vi.fn(async ({ events }: { events: Array<{ name: string }> }) =>
          events.some((event) => event.name === "BetFinalized")
            ? [
                {
                  eventName: "BetFinalized",
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
        expect(
          await store.getBet({ chainId: config.chainId, gameHub: config.gameHub, betId: 9 })
        ).toBeNull();
      } else {
        await run;
        expect(await store.getCursor(config.chainId, "gamehub-events", config.gameHub)).toBe(123n);
        expect(
          await store.getBet({ chainId: config.chainId, gameHub: config.gameHub, betId: 9 })
        ).toMatchObject({
          payout: "196000",
          refundAmount: "100000"
        });
      }
    }
  );
});
