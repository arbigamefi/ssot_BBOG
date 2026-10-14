import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreatePostgresBetIndexStore = vi.hoisted(() => vi.fn());

vi.mock("@ssot/bet-index", () => ({
  createPostgresBetIndexStore: mockCreatePostgresBetIndexStore
}));

import {
  clearRecentBetsCache,
  clampAffiliateBetsLimit,
  clampRecentBetsLimit,
  clampPlayerBetsLimit,
  foldRecentBetLogs,
  normalizeAffiliateAddress,
  normalizeGameId,
  normalizePlayerAddress,
  queryAffiliateBets,
  queryBetReceipt,
  queryRecentBets,
  queryPlayerBets
} from "./recent-bets";
import { getAddress } from "viem";
import { loadEmbeddedRelease } from "@ssot/ssot/release";

vi.mock("@ssot/ssot/release", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ssot/ssot/release")>();
  const { default: fixture } =
    await import("../../../../../packages/ssot/src/fixtures/release-v16.fixture.json");
  return {
    ...actual,
    loadEmbeddedRelease: (chainId: number) => ({
      ok: true,
      release: { ...fixture, chainId }
    })
  };
});

const GAME_ID = `0x${"11".repeat(32)}` as const;
const PLAYER = "0x2222222222222222222222222222222222222222" as const;
const AFFILIATE = "0x5555555555555555555555555555555555555555" as const;
const GAME_HUB = "0x3333333333333333333333333333333333333333" as const;
const ASSET = "0x4444444444444444444444444444444444444444" as const;
const ASSET_TWO = "0x9999999999999999999999999999999999999999" as const;

function releaseBlock() {
  const release = loadEmbeddedRelease(84532);
  if (!release.ok) throw new Error(release.error);
  return BigInt(release.release.meta?.blockNumber ?? 0);
}

// With two-second blocks the four-second confirmation leaves out the newest two blocks.
function latestBlockAfterEmbeddedRelease(windowBlocks: bigint) {
  return releaseBlock() + 2n + windowBlocks;
}

/** A chain whose latest block is `head` and whose block `n` has timestamp `timestampOf(n)`. */
function chainAt(head: bigint, timestampOf = (n: bigint) => n * 2n) {
  return {
    getBlock: vi.fn(async (args?: { blockNumber?: bigint }) => {
      const number = args?.blockNumber ?? head;
      return { number, timestamp: timestampOf(number) };
    })
  };
}

const ENV_KEYS = [
  "BET_INDEX_READ_ENABLED",
  "AFFILIATE_BETS_LOG_CHUNK_BLOCKS",
  "AFFILIATE_BETS_WINDOW_BLOCKS",
  "PLAYER_BETS_LOG_CHUNK_BLOCKS",
  "PLAYER_BETS_WINDOW_BLOCKS",
  "BET_RECEIPT_LOG_CHUNK_BLOCKS",
  "BET_RECEIPT_MAX_BLOCKS",
  "BET_RECEIPT_RPC_FALLBACK_ENABLED",
  "BET_INDEX_RPC_FALLBACK_ENABLED",
  "RECENT_BETS_LOG_CHUNK_BLOCKS",
  "RECENT_BETS_WINDOW_BLOCKS"
];

describe("recent bets server aggregation", () => {
  const envSnapshot = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      envSnapshot.set(key, process.env[key]);
    }
    clearRecentBetsCache();
  });

  afterEach(() => {
    for (const [key, value] of envSnapshot.entries()) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    envSnapshot.clear();
    mockCreatePostgresBetIndexStore.mockReset();
    clearRecentBetsCache();
    vi.restoreAllMocks();
  });

  it("normalizes and validates game ids", () => {
    expect(normalizeGameId(GAME_ID.toUpperCase())).toBe(GAME_ID);
    expect(() => normalizeGameId("0x1234")).toThrow("gameId");
  });

  it("clamps product-facing limits", () => {
    expect(clampRecentBetsLimit(undefined)).toBe(20);
    expect(clampRecentBetsLimit(0)).toBe(20);
    expect(clampRecentBetsLimit(3.8)).toBe(3);
    expect(clampRecentBetsLimit(500)).toBe(50);
    expect(clampPlayerBetsLimit(undefined)).toBe(100);
    expect(clampPlayerBetsLimit(500)).toBe(500);
    expect(clampPlayerBetsLimit(999)).toBe(500);
    expect(clampAffiliateBetsLimit(undefined)).toBe(100);
    expect(clampAffiliateBetsLimit(999)).toBe(500);
  });

  it("normalizes and validates player addresses", () => {
    expect(normalizePlayerAddress(PLAYER)).toBe(PLAYER);
    expect(() => normalizePlayerAddress("0x1234")).toThrow("player");
    expect(normalizeAffiliateAddress(AFFILIATE)).toBe(AFFILIATE);
    expect(() => normalizeAffiliateAddress("0x1234")).toThrow("affiliate");
  });

  it("folds GameHub logs into terminal recent bet rows", () => {
    const rows = foldRecentBetLogs({
      chainId: 84532,
      gameHub: GAME_HUB,
      logs: [
        {
          args: {
            positionId: 7n,
            payoutGross: 20n,
            payoutNet: 19n
          },
          blockNumber: 12n,
          eventName: "BetFinalized",
          logIndex: 3,
          transactionHash: "0xccc"
        },
        {
          args: {
            asset: "0x4444444444444444444444444444444444444444",
            gameId: GAME_ID,
            player: PLAYER,
            referrerL1: AFFILIATE,
            positionId: 7n,
            requestId: 99n,
            stake: 10n
          },
          blockNumber: 10n,
          eventName: "BetPlaced",
          logIndex: 1,
          transactionHash: "0xaaa"
        },
        {
          args: {
            positionId: 7n,
            randomHash: `0x${"55".repeat(32)}`,
            requestId: 99n
          },
          blockNumber: 11n,
          eventName: "BetRandomReady",
          logIndex: 2,
          transactionHash: "0xbbb"
        }
      ]
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      betId: "7",
      chainId: 84532,
      gameId: GAME_ID,
      lastEventName: "BetFinalized",
      lastTxHash: "0xccc",
      payout: "19",
      payoutGross: "20",
      player: PLAYER,
      referrerL1: AFFILIATE,
      randomHash: `0x${"55".repeat(32)}`,
      requestId: "99",
      state: "finalized",
      stake: "10",
      updatedBlock: 12
    });
  });

  it("reads a receipt from its placement second to its terminal second, with chain timestamps", async () => {
    process.env.BET_INDEX_READ_ENABLED = "0";
    process.env.BET_INDEX_RPC_FALLBACK_ENABLED = "false";
    process.env.BET_RECEIPT_RPC_FALLBACK_ENABLED = "true";

    const placedBlock = releaseBlock() + 1n;
    const readyBlock = releaseBlock() + 2n;
    const finalizedBlock = releaseBlock() + 3n;
    const byEvent: Record<string, unknown[]> = {
      BetPlaced: [
        {
          args: {
            asset: ASSET,
            gameId: GAME_ID,
            player: PLAYER,
            positionId: 8n,
            requestId: 99n,
            stake: 10n
          },
          blockNumber: placedBlock,
          logIndex: 1,
          transactionHash: "0xaaa"
        }
      ],
      BetRandomReady: [
        {
          args: { positionId: 8n, randomHash: `0x${"55".repeat(32)}`, requestId: 99n },
          blockNumber: readyBlock,
          logIndex: 2,
          transactionHash: "0xbbb"
        }
      ],
      BetFinalized: [
        {
          args: { positionId: 8n, payoutGross: 20n, payoutNet: 19n },
          blockNumber: finalizedBlock,
          logIndex: 3,
          transactionHash: "0xccc"
        }
      ]
    };
    const getLogs = vi.fn(
      async ({ event }: { event: { name: string } }) => byEvent[event.name] ?? []
    );
    const readContract = vi.fn(async () => ({
      placedAt: placedBlock * 2n,
      resolvedAt: finalizedBlock * 2n
    }));

    const response = await queryBetReceipt({
      betId: "8",
      chainId: 84532,
      client: { ...chainAt(releaseBlock() + 1_000n), getLogs, readContract } as any,
      now: () => 1234
    });

    expect(response).toMatchObject({
      betId: "8",
      chainId: 84532,
      generatedAt: 1234,
      source: "rpc-window"
    });
    expect(response.row).toMatchObject({
      betId: "8",
      lastEventName: "BetFinalized",
      lastTxHash: "0xccc",
      payout: "19",
      placedAt: Number(placedBlock * 2n) * 1000,
      player: PLAYER,
      state: "finalized",
      updatedAt: Number(finalizedBlock * 2n) * 1000
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getBet", args: [8n] })
    );
    // BetPlaced, BetRandomReady and the three terminal events, BetVoided included, over the bet's own blocks.
    expect(
      getLogs.mock.calls.map(([params]: any[]) => [
        params.event.name,
        params.fromBlock,
        params.toBlock
      ])
    ).toEqual(
      ["BetPlaced", "BetRandomReady", "BetFinalized", "BetRefunded", "BetVoided"].map((name) => [
        name,
        placedBlock,
        finalizedBlock
      ])
    );
  });

  it("finds an hour-old receipt at five blocks a second with a bounded number of reads", async () => {
    process.env.BET_INDEX_READ_ENABLED = "0";
    process.env.BET_INDEX_RPC_FALLBACK_ENABLED = "false";
    process.env.BET_RECEIPT_RPC_FALLBACK_ENABLED = "true";

    // Five blocks share each second; the bet was placed an hour before the head and settled ten seconds later.
    const head = releaseBlock() + 100_000n;
    const placedBlock = head - 18_000n - (head % 5n);
    const second = (n: bigint) => n / 5n;
    const client = {
      ...chainAt(head, second),
      readContract: vi.fn(async () => ({
        placedAt: second(placedBlock),
        resolvedAt: second(placedBlock) + 10n
      })),
      getLogs: vi.fn(async ({ event }: { event: { name: string } }) =>
        event.name === "BetPlaced"
          ? [
              {
                args: { asset: ASSET, gameId: GAME_ID, player: PLAYER, positionId: 8n, stake: 10n },
                blockNumber: placedBlock + 2n,
                logIndex: 1,
                transactionHash: "0xaaa"
              }
            ]
          : []
      )
    };

    const response = await queryBetReceipt({
      betId: "8",
      chainId: 84532,
      client: client as any,
      now: () => 1234
    });

    expect(response.row).toMatchObject({ betId: "8", player: PLAYER });
    expect(
      client.getLogs.mock.calls.map(([params]: any[]) => [params.fromBlock, params.toBlock])
    ).toEqual(Array(5).fill([placedBlock, placedBlock + 54n]));
    expect(client.getBlock.mock.calls.length).toBeLessThanOrEqual(80);
  });

  it("returns no receipt for a bet the GameHub has not placed", async () => {
    process.env.BET_INDEX_READ_ENABLED = "0";
    process.env.BET_INDEX_RPC_FALLBACK_ENABLED = "false";
    process.env.BET_RECEIPT_RPC_FALLBACK_ENABLED = "true";
    const getLogs = vi.fn();
    const response = await queryBetReceipt({
      betId: "8",
      chainId: 84532,
      client: {
        ...chainAt(releaseBlock() + 100n),
        getLogs,
        readContract: vi.fn(async () => ({ placedAt: 0n, resolvedAt: 0n }))
      } as any,
      now: () => 1234
    });
    expect(response.row).toBeNull();
    expect(getLogs).not.toHaveBeenCalled();
  });

  it("folds a voided bet from receipt logs with its stake returned", async () => {
    process.env.BET_INDEX_READ_ENABLED = "0";
    process.env.BET_INDEX_RPC_FALLBACK_ENABLED = "false";
    process.env.BET_RECEIPT_RPC_FALLBACK_ENABLED = "true";

    const release = releaseBlock();
    const log = (args: Record<string, unknown>, block: bigint, logIndex: number, hash: string) => ({
      args,
      blockNumber: release + block,
      logIndex,
      transactionHash: hash
    });
    const byEvent: Record<string, unknown[]> = {
      BetPlaced: [
        log(
          { asset: ASSET, gameId: GAME_ID, player: PLAYER, positionId: 8n, stake: 10n },
          1n,
          1,
          "0xaaa"
        )
      ],
      // A void of a PendingVRF bet records the random in the same transaction.
      BetRandomReady: [log({ positionId: 8n, requestId: 99n }, 3n, 2, "0xeee")],
      BetVoided: [
        log(
          {
            positionId: 8n,
            caller: AFFILIATE,
            stake: 10n,
            settlementErrorPrefix: `0x${"0".repeat(64)}`
          },
          3n,
          3,
          "0xeee"
        )
      ]
    };
    const getLogs = vi.fn(
      async ({ event }: { event: { name: string } }) => byEvent[event.name] ?? []
    );

    const response = await queryBetReceipt({
      betId: "8",
      chainId: 84532,
      client: {
        ...chainAt(release + 100n),
        getLogs,
        readContract: vi.fn(async () => ({
          placedAt: (release + 1n) * 2n,
          resolvedAt: (release + 3n) * 2n
        }))
      } as any,
      now: () => 1234
    });

    expect(getLogs.mock.calls.map(([params]) => params.event.name)).toContain("BetVoided");
    expect(response.row).toMatchObject({
      betId: "8",
      state: "voided",
      stake: "10",
      refundAmount: "10",
      terminalTxHash: "0xeee",
      voidedTxHash: "0xeee",
      lastEventName: "BetVoided"
    });
  });

  it("degrades receipt queries when the durable receipt index is unreachable", async () => {
    process.env.BET_INDEX_DATABASE_URL = "postgres://user:pass@127.0.0.1:1/db";
    process.env.BET_INDEX_READ_ENABLED = "1";
    process.env.BET_RECEIPT_RPC_FALLBACK_ENABLED = "false";
    clearRecentBetsCache();

    const getBet = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    mockCreatePostgresBetIndexStore.mockReturnValue({
      getBet
    });

    const response = await queryBetReceipt({
      betId: "9",
      chainId: 84532,
      now: () => 1234
    });

    const release = loadEmbeddedRelease(84532);
    if (!release.ok) throw new Error(release.error);
    expect(getBet).toHaveBeenCalledWith({
      betId: "9",
      chainId: 84532,
      gameHub: getAddress(release.release.contracts.gameHub)
    });
    expect(response).toMatchObject({
      betId: "9",
      chainId: 84532,
      generatedAt: 1234,
      row: null,
      source: "postgres"
    });
  });

  it("chunks recent fallback log scans for free-tier RPC providers", async () => {
    process.env.BET_INDEX_READ_ENABLED = "0";
    process.env.RECENT_BETS_WINDOW_BLOCKS = "25";
    process.env.RECENT_BETS_LOG_CHUNK_BLOCKS = "10";

    const getLogs = vi.fn().mockResolvedValue([]);
    const response = await queryRecentBets({
      chainId: 84532,
      client: {
        ...chainAt(latestBlockAfterEmbeddedRelease(25n)),
        getLogs
      } as any,
      limit: 10,
      now: () => 1234
    });

    expect(response.source).toBe("rpc-window");
    expect(response.rows).toHaveLength(0);
    // Three chunks for each of the five lifecycle events, BetVoided included.
    expect(getLogs).toHaveBeenCalledTimes(15);
    for (const call of getLogs.mock.calls) {
      const params = call[0] as { fromBlock: bigint; toBlock: bigint };
      expect(params.toBlock - params.fromBlock + 1n).toBeLessThanOrEqual(10n);
    }
  });

  it("returns an empty best-effort recent feed when RPC fallback is unavailable", async () => {
    process.env.BET_INDEX_READ_ENABLED = "0";

    const response = await queryRecentBets({
      chainId: 84532,
      client: {
        ...chainAt(latestBlockAfterEmbeddedRelease(25n)),
        getLogs: vi.fn().mockRejectedValue(new Error("rate limited"))
      } as any,
      limit: 10,
      now: () => 1234
    });

    expect(response).toMatchObject({
      chainId: 84532,
      fromBlock: 0,
      rows: [],
      source: "rpc-window",
      toBlock: 0
    });
  });

  it("queries player placed logs and folds matching terminal events", async () => {
    process.env.BET_INDEX_READ_ENABLED = "0";
    process.env.PLAYER_BETS_WINDOW_BLOCKS = "9";
    process.env.PLAYER_BETS_LOG_CHUNK_BLOCKS = "10";

    const getLogs = vi
      .fn()
      .mockResolvedValueOnce([
        {
          args: {
            asset: "0x4444444444444444444444444444444444444444",
            gameId: GAME_ID,
            player: PLAYER,
            positionId: 8n,
            stake: 10n
          },
          blockNumber: 20n,
          logIndex: 1,
          transactionHash: "0xaaa"
        }
      ])
      .mockResolvedValueOnce([
        {
          args: {
            positionId: 8n,
            randomHash: `0x${"55".repeat(32)}`,
            requestId: 99n
          },
          blockNumber: 21n,
          logIndex: 2,
          transactionHash: "0xbbb"
        },
        {
          args: { positionId: 9n, requestId: 100n },
          blockNumber: 21n,
          logIndex: 3,
          transactionHash: "0xddd"
        }
      ])
      .mockResolvedValueOnce([
        {
          args: {
            positionId: 8n,
            payoutGross: 20n,
            payoutNet: 19n
          },
          blockNumber: 22n,
          logIndex: 4,
          transactionHash: "0xccc"
        }
      ])
      .mockResolvedValue([]);

    const response = await queryPlayerBets({
      chainId: 84532,
      client: {
        ...chainAt(latestBlockAfterEmbeddedRelease(9n)),
        getLogs
      } as any,
      limit: 10,
      now: () => 1234,
      player: PLAYER
    });

    expect(response.player).toBe(PLAYER);
    expect(response.rows).toHaveLength(1);
    expect(response.rows[0]).toMatchObject({
      betId: "8",
      lastEventName: "BetFinalized",
      payout: "19",
      player: PLAYER,
      state: "finalized"
    });
  });

  it("queries affiliate rows and computes indexed turnover stats", async () => {
    process.env.BET_INDEX_READ_ENABLED = "0";
    process.env.AFFILIATE_BETS_WINDOW_BLOCKS = "9";
    process.env.AFFILIATE_BETS_LOG_CHUNK_BLOCKS = "10";

    const getLogs = vi
      .fn()
      .mockResolvedValueOnce([
        {
          args: {
            asset: ASSET,
            gameId: GAME_ID,
            player: PLAYER,
            referrerL1: AFFILIATE,
            positionId: 8n,
            stake: 10n
          },
          blockNumber: 20n,
          logIndex: 1,
          transactionHash: "0xaaa"
        },
        {
          args: {
            asset: ASSET_TWO,
            gameId: GAME_ID,
            player: PLAYER,
            referrerL1: AFFILIATE,
            positionId: 10n,
            stake: 99n
          },
          blockNumber: 20n,
          logIndex: 3,
          transactionHash: "0xeee"
        },
        {
          args: {
            gameId: GAME_ID,
            player: "0x6666666666666666666666666666666666666666",
            referrerL1: "0x7777777777777777777777777777777777777777",
            referrerL2: AFFILIATE,
            asset: ASSET,
            positionId: 9n,
            stake: 33n
          },
          blockNumber: 20n,
          logIndex: 4,
          transactionHash: "0xddd"
        }
      ])
      .mockResolvedValueOnce([
        {
          args: {
            positionId: 8n,
            randomHash: `0x${"55".repeat(32)}`,
            requestId: 99n
          },
          blockNumber: 21n,
          logIndex: 3,
          transactionHash: "0xbbb"
        }
      ])
      .mockResolvedValueOnce([
        {
          args: {
            positionId: 8n,
            payoutGross: 20n,
            payoutNet: 19n,
            feeOnPayout: 1n,
            protocolFeeAccrual: 0n
          },
          blockNumber: 22n,
          logIndex: 4,
          transactionHash: "0xccc"
        }
      ])
      .mockResolvedValueOnce([]);

    const response = await queryAffiliateBets({
      affiliate: AFFILIATE,
      asset: ASSET,
      chainId: 84532,
      client: {
        ...chainAt(latestBlockAfterEmbeddedRelease(9n)),
        getLogs,
        readContract: vi.fn().mockResolvedValue({
          state: 4,
          payoutGross: 20n,
          payoutNet: 19n,
          feeOnPayout: 1n,
          protocolFeeAccrual: 0n,
          refundAmount: 0n
        })
      } as any,
      limit: 10,
      now: () => 1234
    });

    expect(response.affiliate).toBe(AFFILIATE);
    expect(response.rows).toHaveLength(1);
    expect(response.rows[0]).toMatchObject({
      betId: "8",
      payout: "19",
      referrerL1: AFFILIATE,
      stake: "10",
      state: "finalized"
    });
    expect(response.stats).toMatchObject({
      affiliate: AFFILIATE,
      betCount: 1,
      payout: "19",
      payoutGross: "20",
      settledCount: 1,
      turnover: "10"
    });
  });
});
