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
  "BET_RECEIPT_READY_SEARCH_BLOCKS",
  "BET_INDEX_DATABASE_URL",
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

  it("reads a receipt from its placement and terminal seconds, with chain timestamps", async () => {
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
      resolvedAt: finalizedBlock * 2n,
      state: 4
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
    expect(response.incomplete).toBeUndefined();
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
    // The placement second's blocks for BetPlaced; the terminal second's for the result and the three terminal
    // events, BetVoided included. The result is there, so nothing else is searched.
    const window = (block: bigint) => [
      block > releaseBlock() + 9n ? block - 9n : releaseBlock(),
      block
    ];
    expect(
      getLogs.mock.calls.map(([params]: any[]) => [
        params.event.name,
        params.fromBlock,
        params.toBlock
      ])
    ).toEqual([
      ["BetPlaced", ...window(placedBlock)],
      ...["BetRandomReady", "BetFinalized", "BetRefunded", "BetVoided"].map((name) => [
        name,
        ...window(finalizedBlock)
      ])
    ]);
  });

  describe("receipts of long-lived bets", () => {
    // Five blocks a second from block 0 (timestamp n / 5). The placement is the fourth block of its second.
    const PLACED = 100_003n;
    const second = (n: bigint) => n / 5n;
    type Log = { eventName: string; blockNumber: bigint; args: Record<string, unknown> };
    const log = (
      eventName: string,
      blockNumber: bigint,
      args: Record<string, unknown> = {}
    ): Log => ({
      eventName,
      blockNumber,
      args: { positionId: 8n, ...args }
    });
    const placedLogAt = (blockNumber: bigint) =>
      log("BetPlaced", blockNumber, {
        asset: ASSET,
        gameId: GAME_ID,
        player: PLAYER,
        requestId: 99n,
        stake: 10n
      });
    const placedLog = placedLogAt(PLACED);
    /**
     * Answers only inside the queried range, as an RPC does, and refuses a range Base's public RPC would; each log
     * query takes `latencyMs`.
     */
    function strictChain(
      logs: Log[],
      bet: Record<string, bigint | number>,
      head: bigint,
      latencyMs = 0
    ) {
      const getLogs = vi.fn(
        async ({
          event,
          fromBlock,
          toBlock
        }: {
          event: { name: string };
          fromBlock: bigint;
          toBlock: bigint;
        }) => {
          if (latencyMs) await new Promise((resolve) => setTimeout(resolve, latencyMs));
          if (toBlock - fromBlock + 1n > 201n) throw new Error("HTTP 413");
          return logs
            .filter(
              (entry) =>
                entry.eventName === event.name &&
                entry.blockNumber >= fromBlock &&
                entry.blockNumber <= toBlock
            )
            .map((entry) => ({
              args: entry.args,
              blockNumber: entry.blockNumber,
              logIndex: 1,
              transactionHash: `0x${entry.blockNumber.toString(16).padStart(64, "0")}`
            }));
        }
      );
      return {
        ...chainAt(head, second),
        getLogs,
        readContract: vi.fn(async () => bet),
        // Terminal-transaction enrichment unavailable: the logs alone must carry the state.
        getTransactionReceipt: vi.fn(async () => {
          throw new Error("receipt unavailable");
        })
      };
    }
    const HOUR = 18_000n;
    const DAY = 24n * HOUR;

    it.each([
      [
        "a refund an hour later",
        [log("BetRefunded", PLACED + HOUR + 1n, { refundAmount: 10n })],
        5,
        "refunded"
      ],
      [
        "a void 24 hours later that records the result in the same transaction",
        [
          log("BetRandomReady", PLACED + DAY, { randomHash: `0x${"55".repeat(32)}` }),
          log("BetVoided", PLACED + DAY, { stake: 10n })
        ],
        6,
        "voided"
      ],
      [
        "a void 7 days after a result delivered 30 seconds after the placement",
        [
          log("BetRandomReady", PLACED + 150n, { randomHash: `0x${"55".repeat(32)}` }),
          log("BetVoided", PLACED + 7n * DAY, { stake: 10n })
        ],
        6,
        "voided"
      ],
      [
        "a settlement two hours after its result",
        [
          log("BetRandomReady", PLACED + 300n, { randomHash: `0x${"55".repeat(32)}` }),
          log("BetFinalized", PLACED + 2n * HOUR - 3n, { payoutGross: 20n, payoutNet: 19n })
        ],
        4,
        "finalized"
      ]
    ] as const)("finds %s", async (_name, events, chainState, state) => {
      process.env.BET_INDEX_READ_ENABLED = "0";
      process.env.BET_INDEX_RPC_FALLBACK_ENABLED = "false";
      process.env.BET_RECEIPT_RPC_FALLBACK_ENABLED = "true";
      const terminal = events.at(-1)!.blockNumber;
      const client = strictChain(
        [placedLog, ...events],
        { placedAt: second(PLACED), resolvedAt: second(terminal), state: chainState },
        terminal + 1_000n
      );

      const response = await queryBetReceipt({
        betId: "8",
        chainId: 84532,
        client: client as any,
        now: () => 1234
      });

      expect(response.incomplete).toBeUndefined();
      expect(response.row).toMatchObject({
        state,
        lastEventName: events.at(-1)!.eventName,
        placedAt: Number(second(PLACED)) * 1000,
        updatedAt: Number(second(terminal)) * 1000
      });
      if (events.length > 1) expect(response.row?.randomHash).toBe(`0x${"55".repeat(32)}`);
      // A few reads to locate each second; the result search stops at its first chunk with a hit.
      expect(client.getBlock.mock.calls.length).toBeLessThanOrEqual(50);
      expect(client.getLogs.mock.calls.length).toBeLessThanOrEqual(7);
    });

    it("finds a receipt in a durable index that lacks its row", async () => {
      process.env.BET_INDEX_DATABASE_URL = "postgres://user:pass@127.0.0.1:1/db";
      process.env.BET_INDEX_READ_ENABLED = "1";
      process.env.BET_RECEIPT_RPC_FALLBACK_ENABLED = "true";
      clearRecentBetsCache();
      const getBet = vi.fn(async () => null);
      mockCreatePostgresBetIndexStore.mockReturnValue({ getBet });
      const terminal = PLACED + HOUR + 1n;
      const client = strictChain(
        [placedLog, log("BetRefunded", terminal, { refundAmount: 10n })],
        { placedAt: second(PLACED), resolvedAt: second(terminal), state: 5 },
        terminal + 1_000n
      );

      const response = await queryBetReceipt({
        betId: "8",
        chainId: 84532,
        client: client as any,
        now: () => 1234
      });

      expect(getBet).toHaveBeenCalled();
      expect(response).toMatchObject({
        source: "rpc-window",
        row: { state: "refunded", refundAmount: "10" }
      });
    });

    it("marks a receipt whose terminal log is missing as incomplete, with the stored state", async () => {
      process.env.BET_INDEX_READ_ENABLED = "0";
      process.env.BET_INDEX_RPC_FALLBACK_ENABLED = "false";
      process.env.BET_RECEIPT_RPC_FALLBACK_ENABLED = "true";
      const terminal = PLACED + HOUR + 1n;
      const client = strictChain(
        [placedLog],
        { placedAt: second(PLACED), resolvedAt: second(terminal), state: 5 },
        terminal + 1_000n
      );

      const response = await queryBetReceipt({
        betId: "8",
        chainId: 84532,
        client: client as any,
        now: () => 1234
      });

      expect(response.incomplete).toBe(true);
      expect(response.row).toMatchObject({ state: "refunded", lastEventName: "BetPlaced" });
      expect(response.row?.refundAmount).toBeUndefined();
      expect(client.getTransactionReceipt).not.toHaveBeenCalled();
    });

    describe("with a result three blocks after the placement", () => {
      // Three confirmations take 0.6 s at five blocks a second: placed in the first block of its second, the result
      // shares that second. A result in the next second's first block is the control.
      const EARLY = 100_000n;
      const RANDOM_HASH = `0x${"55".repeat(32)}`;
      const readyLog = (blockNumber: bigint) =>
        log("BetRandomReady", blockNumber, { randomHash: RANDOM_HASH });
      const settled = log("BetFinalized", EARLY + 2n * HOUR, { payoutGross: 20n, payoutNet: 19n });
      const voided = log("BetVoided", EARLY + DAY, { stake: 10n });
      async function receiptFrom(client: ReturnType<typeof strictChain>) {
        process.env.BET_INDEX_READ_ENABLED = "0";
        process.env.BET_INDEX_RPC_FALLBACK_ENABLED = "false";
        process.env.BET_RECEIPT_RPC_FALLBACK_ENABLED = "true";
        return queryBetReceipt({
          betId: "8",
          chainId: 84532,
          client: client as any,
          now: () => 1234
        });
      }

      it.each([
        [
          "in the placement's second",
          "waiting for its settlement",
          3n,
          3,
          undefined,
          "randomReady"
        ],
        ["in the placement's second", "settled two hours later", 3n, 4, settled, "finalized"],
        ["in the placement's second", "voided 24 hours later", 3n, 6, voided, "voided"],
        ["in the next second", "waiting for its settlement", 5n, 3, undefined, "randomReady"],
        ["in the next second", "settled two hours later", 5n, 4, settled, "finalized"],
        ["in the next second", "voided 24 hours later", 5n, 6, voided, "voided"]
      ] as const)(
        "finds a result %s for a bet %s",
        async (_where, _name, offset, chainState, terminalLog, state) => {
          const events = [
            placedLogAt(EARLY),
            readyLog(EARLY + offset),
            ...(terminalLog ? [terminalLog] : [])
          ];
          const client = strictChain(
            events,
            {
              placedAt: second(EARLY),
              resolvedAt: terminalLog ? second(terminalLog.blockNumber) : 0,
              state: chainState
            },
            events.at(-1)!.blockNumber + 1_000n
          );

          const response = await receiptFrom(client);

          expect(response.incomplete).toBeUndefined();
          expect(response.row).toMatchObject({ state, randomHash: RANDOM_HASH });
          // BetPlaced, the terminal second's four queries when there is one, and the result's first chunk, which
          // starts at the placement block.
          expect(client.getLogs.mock.calls.length).toBe(terminalLog ? 6 : 2);
          // Terminal-transaction enrichment is tried and unavailable: the logs carry the result.
          if (terminalLog) expect(client.getTransactionReceipt).toHaveBeenCalled();
        }
      );

      it("answers within the receipt timeout at 150 ms a log query", async () => {
        const events = [placedLogAt(EARLY), readyLog(EARLY + 3n), settled];
        const client = strictChain(
          events,
          { placedAt: second(EARLY), resolvedAt: second(settled.blockNumber), state: 4 },
          settled.blockNumber + 1_000n,
          150
        );

        // Six queries; a search that missed the result would make 55 and outlast the 8 s timeout.
        const response = await receiptFrom(client);

        expect(response.row).toMatchObject({ state: "finalized", randomHash: RANDOM_HASH });
        expect(client.getLogs.mock.calls.length).toBe(6);
      }, 12_000);
    });
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
