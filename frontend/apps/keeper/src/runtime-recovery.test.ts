import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { GAME_HUB_KEEPER_ABI } from "./abi.js";
import { createMemoryBetIndexStore, type BetIndexStore } from "@ssot/bet-index";
import { CASINO_TRANSACTION_GAS, createKeeperRuntime, type KeeperRuntime } from "./runtime.js";
import type { KeeperConfig } from "./types.js";

const mock = vi.hoisted(() => ({
  client: {} as Record<string, unknown>,
  store: undefined as BetIndexStore | undefined
}));
vi.mock("viem", async (importOriginal) => ({
  ...(await importOriginal<typeof import("viem")>()),
  createPublicClient: vi.fn(() => mock.client),
  createWalletClient: vi.fn(() => mock.client)
}));
vi.mock("@ssot/bet-index", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ssot/bet-index")>()),
  createPostgresBetIndexStore: vi.fn(() => mock.store)
}));

const hub = "0x0000000000000000000000000000000000000001" as const;
const INDEX_EVENTS = [
  "BetPlaced",
  "BetRandomReady",
  "BetFinalized",
  "BetRefunded",
  "HouseEdgeAllocated"
];
type LogQuery = { events: Array<{ name: string }>; fromBlock: bigint };
const eventNames = (query: LogQuery) => query.events.map((event) => event.name);
const logQueries = () =>
  vi
    .mocked(mock.client.getLogs as ReturnType<typeof vi.fn>)
    .mock.calls.map(([query]) => query as LogQuery);
const hash = `0x${"aa".repeat(32)}` as const;
const base: KeeperConfig = {
  chainId: 8453,
  gameHub: hub,
  sportsHub: hub,
  vrfHub: hub,
  httpRpcUrl: "http://unused.invalid",
  privateKey: `0x${"11".repeat(32)}`,
  role: "primary",
  backupDelayMs: 0,
  pollIntervalMs: 300_000,
  rpcMinIntervalMs: 0,
  scanChunkBlocks: 10n,
  scanMaxChunksPerPass: 2,
  scanIndexEventsEnabled: true,
  startupScanEnabled: true,
  startBlock: 100n,
  betIndexWriteEnabled: true,
  betIndexDatabaseUrl: "postgres://unused.invalid",
  betIndexSsl: false,
  bankProviderLedgerPools: [],
  bankProviderLedgerScanIntervalMs: 0,
  sportsTicketIndexEnabled: false,
  sportsTerminalizerEnabled: false,
  sportsTerminalizerMarketIds: [],
  sportsTerminalizerScanChunkBlocks: 10n,
  sportsTerminalizerMaxTicketsPerMarket: 2,

  sportsTicketScanChunkBlocks: 10n,
  sportsTicketScanMaxBlocks: 50_000n,
  sportsTicketScanStartBlock: 100n
};

describe("runtime recovery composition", () => {
  let runtime: KeeperRuntime | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    mock.store = createMemoryBetIndexStore();
    mock.client = {
      getBlockNumber: vi.fn(async () => 120n),
      getBlock: vi.fn(async () => ({ timestamp: 1000n })),
      getLogs: vi.fn(async (query: LogQuery) => {
        if (query.fromBlock !== 101n) return [];
        return eventNames(query)
          .filter((eventName) => ["BetRandomReady", "BetPlaced"].includes(eventName))
          .map((eventName) => ({
            eventName,
            args: { betId: 1n, requestId: 1n },
            blockNumber: 105n,
            transactionHash: hash,
            logIndex: 0
          }));
      }),
      readContract: vi.fn(async () => ({ betId: 1n, requestId: 1n, state: 4 })),
      writeContract: vi.fn(),
      simulateContract: vi.fn()
    };
  });
  afterEach(async () => {
    await runtime?.stop();
    runtime = undefined;
    vi.useRealTimers();
  });
  const make = (config: KeeperConfig = base) =>
    createKeeperRuntime({ config, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } });

  it("retries missing terminal refunds without checkpointing an incomplete range", async () => {
    const amounts = {
      payoutGross: 200_000n,
      payoutNet: 196_000n,
      feeOnPayout: 4_000n,
      protocolFeeAccrual: 2_000n
    };
    vi.mocked(mock.client.getLogs as ReturnType<typeof vi.fn>).mockImplementation(
      async (query: LogQuery) =>
        eventNames(query).includes("BetFinalized") && query.fromBlock === 101n
          ? [
              {
                eventName: "BetFinalized",
                args: { positionId: 9n, ...amounts },
                blockNumber: 105n,
                transactionHash: hash,
                logIndex: 1
              }
            ]
          : []
    );
    const terminalRead = vi
      .fn()
      .mockRejectedValueOnce(new Error("terminal RPC unavailable"))
      .mockResolvedValue({ state: 4, ...amounts, refundAmount: 100_000n });
    mock.client.readContract = terminalRead;
    runtime = make();
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(await mock.store!.getCursor(8453, "gamehub-events", hub)).toBeNull();
    expect(await mock.store!.getBet({ chainId: 8453, gameHub: hub, betId: 9 })).toBeNull();
    expect(runtime.health.snapshot().status).toBe("degraded");
    await vi.advanceTimersByTimeAsync(300_000);
    expect(await mock.store!.getCursor(8453, "gamehub-events", hub)).toBe(120n);
    expect(await mock.store!.getBet({ chainId: 8453, gameHub: hub, betId: 9 })).toMatchObject({
      payout: "196000",
      refundAmount: "100000",
      state: "finalized"
    });
    expect(mock.client.writeContract).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "retries a failed index range without advancing the cursor (full scan=%s)",
    async (fullScan) => {
      const write = vi
        .spyOn(mock.store!, "writeGameHubEvents")
        .mockRejectedValueOnce(new Error("deadlock detected"));
      runtime = make({ ...base, scanIndexEventsEnabled: fullScan });
      await runtime.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(await mock.store!.getCursor(8453, "gamehub-events", hub)).toBeNull();
      // Index failure must not prevent the already discovered casino bet being queued.
      expect(runtime.queue.has(1n)).toBe(true);
      expect(runtime.health.snapshot().status).toBe("degraded");
      await vi.advanceTimersByTimeAsync(300_000);
      expect(await mock.store!.getCursor(8453, "gamehub-events", hub)).toBe(120n);
      // One query per range: the failed range once per pass, then the next range.
      expect(logQueries().map((query) => query.fromBlock)).toEqual([101n, 101n, 111n]);
      for (const query of logQueries()) {
        expect(eventNames(query)).toEqual(
          fullScan ? INDEX_EVENTS : ["BetPlaced", "BetRandomReady"]
        );
      }
      expect(write).toHaveBeenCalled();
    }
  );

  it("rejects sports without durable storage before any transaction or timer starts", () => {
    expect(() =>
      make({ ...base, sportsTerminalizerEnabled: true, betIndexWriteEnabled: false })
    ).toThrow(/BET_INDEX_WRITE_ENABLED=true/);
    expect(mock.client.writeContract).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects an undeployed zero SportsHub only when sports is enabled", () => {
    const zero = "0x0000000000000000000000000000000000000000" as const;
    expect(() => make({ ...base, sportsHub: zero, sportsTerminalizerEnabled: true })).toThrow(
      /sportsHub/
    );
    expect(() => make({ ...base, sportsHub: zero })).not.toThrow();
    expect(mock.client.writeContract).not.toHaveBeenCalled();
  });

  it("rehydrates a casino bet after a checkpoint-before-drain restart", async () => {
    runtime = make();
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(await mock.store!.getCursor(8453, "gamehub-events", hub)).toBe(120n);
    expect(runtime.queue.has(1n)).toBe(true);
    await runtime.stop();
    vi.mocked(mock.client.getLogs as ReturnType<typeof vi.fn>).mockClear();
    runtime = make();
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.queue.has(1n)).toBe(true);
    expect(mock.client.getLogs).not.toHaveBeenCalled();
  });

  it.each([300_000, 0])(
    "rotates a bounded casino recovery page past a poisoned prefix (poll=%s)",
    async (pollIntervalMs) => {
      vi.mocked(mock.client.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValue(100n);
      vi.mocked(mock.client.readContract as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("bad bet RPC response")
      );
      await mock.store!.writeGameHubEvents(
        Array.from({ length: 52 }, (_, i) => ({
          chainId: 8453,
          gameHub: hub,
          eventName: "BetRandomReady" as const,
          blockNumber: 100n,
          logIndex: i,
          txHash: `0x${String(i + 1).padStart(64, "0")}` as const,
          args: { betId: BigInt(i + 1), requestId: BigInt(i + 1) }
        }))
      );
      runtime = make({ ...base, startupScanEnabled: false, pollIntervalMs });
      await runtime.start();
      expect(runtime.queue.size).toBe(50);
      expect(runtime.queue.has(51n)).toBe(false);
      await vi.advanceTimersByTimeAsync(300_000);
      expect(runtime.queue.has(51n)).toBe(true);
      expect(runtime.queue.has(52n)).toBe(true);
    }
  );

  it("rejects a sports database initialization failure before starting workers", async () => {
    vi.spyOn(mock.store!, "initializeSchema").mockRejectedValueOnce(
      new Error("database unavailable")
    );
    runtime = make({ ...base, sportsTerminalizerEnabled: true });
    await expect(runtime.start()).rejects.toThrow("database unavailable");
    expect(mock.client.writeContract).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects an open manual recovery market before any watcher, timer or transaction", async () => {
    vi.mocked(mock.client.readContract as ReturnType<typeof vi.fn>).mockResolvedValue({
      marketId: 7n,
      state: 2
    });
    mock.client.watchContractEvent = vi.fn();
    runtime = make({
      ...base,
      sportsTerminalizerEnabled: true,
      sportsTerminalizerMarketIds: [7n],
      wsRpcUrl: "ws://unused.invalid"
    });
    await expect(runtime.start()).rejects.toThrow(/still accepts tickets/);
    expect(mock.client.writeContract).not.toHaveBeenCalled();
    expect(mock.client.watchContractEvent).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves casino recovery with sports disabled and no database", async () => {
    runtime = make({ ...base, betIndexWriteEnabled: false, betIndexDatabaseUrl: undefined });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.queue.has(1n)).toBe(true);
    expect(runtime.health.snapshot().lastScannedBlock).toBe("120");
    expect(logQueries().map(eventNames)).toEqual([
      ["BetPlaced", "BetRandomReady"],
      ["BetPlaced", "BetRandomReady"]
    ]);
  });

  it("indexes and finalizes from one metered query per range", async () => {
    runtime = make();
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.queue.has(1n)).toBe(true);
    expect(await mock.store!.getCursor(8453, "gamehub-events", hub)).toBe(120n);
    expect(logQueries().map((query) => query.fromBlock)).toEqual([101n, 111n]);
    // The heartbeat publishes RPC usage: getLogs is metered and throttled like every tracked method.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(runtime.health.snapshot().rpc?.total).toMatchObject({ getLogs: 2 });
  });

  it("recovers indexed bets about every five minutes however short the poll", async () => {
    const recovery = vi.spyOn(mock.store!, "getUnresolvedBetIds");
    runtime = make({ ...base, pollIntervalMs: 60_000 });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0); // startup recovery, then the startup scan
    const afterStart = recovery.mock.calls.length;
    expect(afterStart).toBe(1);
    await vi.advanceTimersByTimeAsync(180_000); // scans 2-4
    expect(recovery.mock.calls.length).toBe(1);
    await vi.advanceTimersByTimeAsync(60_000); // scan 5
    expect(recovery.mock.calls.length).toBe(2);
    await vi.advanceTimersByTimeAsync(300_000); // scans 6-10
    expect(recovery.mock.calls.length).toBe(3);
  });

  it("still recovers after every scan at a five-minute poll", async () => {
    const recovery = vi.spyOn(mock.store!, "getUnresolvedBetIds");
    runtime = make();
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(recovery.mock.calls.length).toBe(2); // startup recovery and the startup scan
    await vi.advanceTimersByTimeAsync(300_000);
    expect(recovery.mock.calls.length).toBe(3);
  });

  it("uses the qualified execution envelope plus intrinsic headroom for both simulation and send", async () => {
    let state = 3;
    mock.client.readContract = vi.fn(async () => ({ betId: 1n, requestId: 1n, state }));
    mock.client.writeContract = vi.fn(async () => {
      state = 4;
      return hash;
    });
    mock.client.waitForTransactionReceipt = vi.fn(async () => ({ status: "success" }));
    runtime = make({ ...base, betIndexWriteEnabled: false, startupScanEnabled: false });
    await runtime.start();
    runtime.enqueue({ source: "manual", betId: 1n, receivedAt: Date.now() });
    await vi.advanceTimersByTimeAsync(500);
    expect(CASINO_TRANSACTION_GAS).toBe(3_050_000n);
    for (const method of ["simulateContract", "writeContract"]) {
      expect(mock.client[method]).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "finalize", gas: CASINO_TRANSACTION_GAS })
      );
    }
    expect(runtime.queue.size).toBe(0);
  });

  it.each(["BetFinalized", "BetRefunded"] as const)(
    "materializes the actual %s event from the complete Hub ABI",
    async (eventName) => {
      let state = 3;
      const amounts = {
        payoutGross: 200n,
        payoutNet: 196n,
        feeOnPayout: 4n,
        protocolFeeAccrual: 2n
      };
      mock.client.readContract = vi.fn(async ({ functionName }: { functionName: string }) =>
        functionName === "getBetTerminal"
          ? { state: 4, ...amounts, refundAmount: 0n }
          : {
              betId: 1n,
              requestId: 1n,
              state,
              asset: hub,
              player: hub,
              gameId: hash,
              pricingAffiliate: hub,
              placedAt: 900n,
              randomHash: hash,
              stake: 100n
            }
      );
      mock.client.writeContract = vi.fn(async () => {
        state = eventName === "BetFinalized" ? 4 : 5;
        return hash;
      });
      mock.client.waitForTransactionReceipt = vi.fn(async () => ({ status: "success" }));
      const terminalLog = {
        address: hub,
        logIndex: 1,
        topics: encodeEventTopics({
          abi: GAME_HUB_KEEPER_ABI,
          eventName,
          args: { positionId: 1n }
        }),
        data:
          eventName === "BetFinalized"
            ? encodeAbiParameters(
                Array.from({ length: 4 }, () => ({ type: "uint256" as const })),
                [200n, 196n, 4n, 2n]
              )
            : encodeAbiParameters([{ type: "uint256" }], [100n])
      };
      const allocationLog = {
        address: hub,
        logIndex: 0,
        topics: encodeEventTopics({
          abi: GAME_HUB_KEEPER_ABI,
          eventName: "HouseEdgeAllocated",
          args: { positionId: 1n }
        }),
        data: encodeAbiParameters(
          [
            { type: "uint256" },
            { type: "uint16" },
            ...Array.from({ length: 8 }, () => ({ type: "uint256" as const }))
          ],
          [100n, 200, 2n, 1n, 1n, 0n, 0n, 0n, 0n, 0n]
        )
      };
      mock.client.getTransactionReceipt = vi.fn(async () => ({
        blockNumber: 120n,
        transactionHash: hash,
        logs: eventName === "BetFinalized" ? [allocationLog, terminalLog] : [terminalLog]
      }));
      runtime = make({ ...base, startupScanEnabled: false });
      await runtime.start();
      runtime.enqueue({ source: "manual", betId: 1n, receivedAt: Date.now() });
      await vi.advanceTimersByTimeAsync(500);
      const row = await mock.store!.getBet({ chainId: base.chainId, gameHub: hub, betId: 1n });
      expect(row).toMatchObject({
        state: eventName === "BetFinalized" ? "finalized" : "refunded",
        payout: eventName === "BetFinalized" ? "196" : "100",
        refundAmount: eventName === "BetFinalized" ? "0" : "100",
        lastEventName: eventName
      });
      if (eventName === "BetFinalized") expect(row?.houseEdge?.edge).toBe("2");
      expect(runtime.queue.size).toBe(0);
    }
  );

  it("replaces canonical ledger ranges, including empty reorg pages, before advancing their cursor", async () => {
    const bank = "0x0000000000000000000000000000000000000003" as const;
    const secondBank = "0x0000000000000000000000000000000000000005" as const;
    const asset = "0x0000000000000000000000000000000000000004" as const;
    let orphanPresent = true;
    let failSecondBank = true;
    mock.client.getBlock = vi.fn(async () => ({ number: 120n, timestamp: 1_601n }));
    mock.client.getContractEvents = vi.fn(async () => []);
    mock.client.readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "currentEpoch") return 1n;
      if (functionName === "redeemBatch") return { priced: false, shares: 0n, cutoff: 0n };
      throw new Error(`Unexpected read ${functionName}`);
    });
    mock.client.getLogs = vi.fn(async (query: LogQuery) =>
      eventNames(query).includes("Deposit") && query.fromBlock === 100n && orphanPresent
        ? [
            {
              address: bank,
              eventName: "Deposit",
              args: { sender: hub, owner: hub, assets: 100n, shares: 100n },
              blockNumber: 105n,
              transactionHash: hash,
              logIndex: 0
            }
          ]
        : []
    );
    const replace = mock.store!.replaceBankProviderLedgerRange;
    vi.spyOn(mock.store!, "replaceBankProviderLedgerRange").mockImplementation(async (request) => {
      if (request.bank === secondBank && failSecondBank) {
        failSecondBank = false;
        throw new Error("range write failed");
      }
      return replace(request);
    });
    runtime = make({
      ...base,
      casinoRecoveryStartBlock: 100n,
      bankProviderLedgerScanIntervalMs: 60_000,
      bankProviderLedgerPools: [
        { bank, asset, poolId: 1, decimals: 6 },
        { bank: secondBank, asset, poolId: 2, decimals: 6 }
      ]
    });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(await mock.store!.getCursor(8453, "bank-provider-ledger", hub)).toBeNull();
    const query = { chainId: 8453, owner: hub, bank, limit: 10 };
    expect(await mock.store!.getBankProviderLedger(query)).toHaveLength(1);
    orphanPresent = false;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await mock.store!.getBankProviderLedger(query)).toEqual([]);
    expect(await mock.store!.getCursor(8453, "bank-provider-ledger", hub)).toBe(119n);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await mock.store!.getCursor(8453, "bank-provider-ledger", hub)).toBe(120n);
    expect(
      logQueries()
        .filter((q) => eventNames(q).includes("Deposit"))
        .map((q) => q.fromBlock)
    ).toEqual([100n, 100n, 110n, 120n]);
  });

  it("activates a due queue despite unavailable historical discovery", async () => {
    const bank = "0x0000000000000000000000000000000000000003" as const;
    const asset = "0x0000000000000000000000000000000000000004" as const;
    let epoch = 1n;
    mock.client.getBlock = vi.fn(async () => ({ number: 120n, timestamp: 1_601n }));
    mock.client.readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case "currentEpoch":
          return epoch;
        case "redeemBatch":
          return {
            cutoff: epoch === 1n ? 1_000n : 0n,
            priced: false,
            shares: epoch === 1n ? 10n : 0n
          };
        case "openHolds":
          return 3n;
        case "riskInPaused":
          return false;
        default:
          throw new Error(`Unexpected read ${functionName}`);
      }
    });
    mock.client.writeContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName !== "activateBatch") throw new Error(`Unexpected write ${functionName}`);
      epoch++;
      return hash;
    });
    mock.client.waitForTransactionReceipt = vi.fn(async () => ({ status: "success" }));
    runtime = make({
      ...base,
      startupScanEnabled: false,
      betIndexWriteEnabled: false,
      bankProviderLedgerPools: [{ bank, asset, poolId: 1, decimals: 6 }]
    });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    for (const method of ["simulateContract", "writeContract"])
      expect(mock.client[method]).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "activateBatch", address: bank })
      );
    expect(mock.client.waitForTransactionReceipt).toHaveBeenCalled();
    expect(runtime.health.snapshot()).toMatchObject({
      redemptions: [{ bank }],
      degradedBy: ["pocket-recovery"],
      pocketDiscovery: [{ bank, caughtUp: false, error: expect.stringContaining("release origin") }]
    });
  });

  it("refunds while paused and activates a later queue while an older pocket remains stuck", async () => {
    const bank = "0x0000000000000000000000000000000000000003" as const;
    const asset = "0x0000000000000000000000000000000000000004" as const;
    let betState = 2;
    let epoch = 2n;
    let paused = true;
    mock.client.getBlock = vi.fn(async () => ({ number: 120n, timestamp: 1_601n }));
    mock.client.getLogs = vi.fn(async (query: LogQuery) =>
      query.fromBlock === 100n
        ? [
            {
              eventName: "BetPlaced",
              args: { positionId: 9n, requestId: 9n },
              blockNumber: 100n,
              transactionHash: hash,
              logIndex: 0
            }
          ]
        : []
    );
    mock.client.getContractEvents = vi.fn(
      async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) =>
        fromBlock <= 100n && toBlock >= 100n
          ? [{ args: { batchId: 1n }, blockNumber: 100n, blockHash: hash, logIndex: 1 }]
          : []
    );
    mock.client.readContract = vi.fn(
      async ({ functionName, args }: { functionName: string; args?: bigint[] }) => {
        switch (functionName) {
          case "getBet":
            return { betId: 9n, requestId: 9n, placedAt: 900n, state: betState };
          case "refundTimeoutSeconds":
            return 100n;
          case "currentEpoch":
            return epoch;
          case "redeemBatch":
            return args?.[0] === 1n
              ? { cutoff: 900n, priced: true, shares: 10n, activatedAt: 1000n }
              : {
                  cutoff: epoch === 2n ? 1500n : 0n,
                  priced: false,
                  shares: epoch === 2n ? 10n : 0n
                };
          case "recoveryEpoch":
            return { snapshotSupply: 100n, remainingHolds: 1n, remainingReserve: 100n };
          case "openHolds":
            return betState === 2 ? 8n : 7n;
          case "riskInPaused":
            return paused;
          default:
            throw new Error(`Unexpected ${functionName}`);
        }
      }
    );
    mock.client.writeContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "refund") betState = 5;
      else if (functionName === "activateBatch") epoch++;
      else throw new Error(`Unexpected write ${functionName}`);
      return hash;
    });
    mock.client.waitForTransactionReceipt = vi.fn(async () => ({ status: "success" }));
    await mock.store!.setCursor({
      chainId: 8453,
      cursorKey: hub,
      source: "gamehub-events",
      blockNumber: 120n
    });
    runtime = make({
      ...base,
      casinoRecoveryStartBlock: 100n,
      scanMaxChunksPerPass: 3,
      bankProviderLedgerPools: [{ bank, asset, poolId: 1, decimals: 6 }]
    });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.queue.has(9n)).toBe(true);
    expect(runtime.health.snapshot()).toMatchObject({
      degradedBy: ["pocket"],
      pockets: [{ epochId: "1", ageSeconds: 601 }]
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(mock.client.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "refund", args: [9n], gas: CASINO_TRANSACTION_GAS })
    );
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mock.client.writeContract).not.toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "activateBatch" })
    );
    paused = false;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mock.client.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "activateBatch", address: bank })
    );
    expect(runtime.health.snapshot().degradedBy).toEqual(["pocket"]);
    expect(runtime.health.snapshot().redemptions).toEqual([{ bank }]);
    expect(
      vi
        .mocked(mock.client.writeContract as ReturnType<typeof vi.fn>)
        .mock.calls.map(([q]) => q.functionName)
    ).toEqual(["refund", "activateBatch"]);
  });

  it("rehydrates a still-pending bet after its lifecycle checkpoint and restart", async () => {
    mock.client.readContract = vi.fn(async ({ functionName }: { functionName: string }) =>
      functionName === "refundTimeoutSeconds"
        ? 86_400n
        : { betId: 1n, requestId: 1n, placedAt: 999n, state: 2 }
    );
    mock.client.getBlock = vi.fn(async () => ({ number: 120n, timestamp: 1_000n }));
    await mock.store!.writeGameHubEvents([
      {
        chainId: 8453,
        gameHub: hub,
        eventName: "BetPlaced",
        blockNumber: 100n,
        logIndex: 0,
        txHash: hash,
        args: { positionId: 1n }
      }
    ]);
    await mock.store!.setCursor({
      chainId: 8453,
      cursorKey: hub,
      source: "casino-open-bets-v1:100",
      blockNumber: 120n
    });
    const config = { ...base, casinoRecoveryStartBlock: 100n, startupScanEnabled: false };
    runtime = make(config);
    await runtime.start();
    await vi.advanceTimersByTimeAsync(500);
    expect(runtime.queue.has(1n)).toBe(true);
    await runtime.stop();
    runtime = make(config);
    await runtime.start();
    await vi.advanceTimersByTimeAsync(500);
    expect(runtime.queue.has(1n)).toBe(true);
    expect(mock.client.writeContract).not.toHaveBeenCalled();
  });

  it("does not advance lifecycle recovery over a failed index write and exposes incomplete recovery", async () => {
    mock.client.getLogs = vi.fn(async () => [
      {
        eventName: "BetPlaced",
        args: { positionId: 1n },
        blockNumber: 100n,
        transactionHash: hash,
        logIndex: 0
      }
    ]);
    vi.spyOn(mock.store!, "writeGameHubEvents").mockRejectedValue(new Error("DB unavailable"));
    runtime = make({ ...base, casinoRecoveryStartBlock: 100n, startupScanEnabled: false });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(await mock.store!.getCursor(8453, "casino-open-bets-v1:100", hub)).toBeNull();
    expect(runtime.health.snapshot().degradedBy).toContain("recovery");
  });

  it("retains failed in-memory work beyond eight retries even without a database", async () => {
    mock.client.readContract = vi.fn(async () => {
      throw new Error("RPC unavailable");
    });
    runtime = make({ ...base, startupScanEnabled: false, betIndexWriteEnabled: false });
    await runtime.start();
    runtime.enqueue({ source: "manual", betId: 7n, receivedAt: Date.now() });
    await vi.advanceTimersByTimeAsync(350_000);
    expect(runtime.queue.has(7n)).toBe(true);
    expect(runtime.health.snapshot().degradedBy).toContain("finalize");
  });

  it("replays PendingVRF history after a restart without a database", async () => {
    mock.client.getLogs = vi.fn(async (query: LogQuery) =>
      query.fromBlock === 100n
        ? [
            {
              eventName: "BetPlaced",
              args: { positionId: 1n },
              blockNumber: 100n,
              transactionHash: hash,
              logIndex: 0
            }
          ]
        : []
    );
    mock.client.getBlock = vi.fn(async () => ({ number: 120n, timestamp: 1_000n }));
    mock.client.readContract = vi.fn(async ({ functionName }: { functionName: string }) =>
      functionName === "refundTimeoutSeconds"
        ? 86_400n
        : { betId: 1n, requestId: 1n, placedAt: 999n, state: 2 }
    );
    const config = {
      ...base,
      betIndexWriteEnabled: false,
      startupScanEnabled: false,
      casinoRecoveryStartBlock: 100n,
      scanMaxChunksPerPass: 3
    };
    runtime = make(config);
    await runtime.start();
    await vi.advanceTimersByTimeAsync(500);
    expect(runtime.queue.has(1n)).toBe(true);
    await runtime.stop();
    runtime = make(config);
    await runtime.start();
    await vi.advanceTimersByTimeAsync(500);
    expect(runtime.queue.has(1n)).toBe(true);
    expect(logQueries().filter((query) => query.fromBlock === 100n)).toHaveLength(2);
    expect(mock.client.writeContract).not.toHaveBeenCalled();
  });

  it("joins delayed lifecycle scanning before closing the store and writing stopped health", async () => {
    let release!: (logs: unknown[]) => void;
    mock.client.getLogs = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          })
      )
      .mockResolvedValue([]);
    const close = vi.fn(async () => undefined);
    mock.store!.close = close;
    runtime = make({ ...base, startupScanEnabled: false, casinoRecoveryStartBlock: 100n });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    let stopped = false;
    const stopping = runtime.stop().then(() => {
      stopped = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).toBe(false);
    expect(close).not.toHaveBeenCalled();
    release([]);
    await stopping;
    expect(close).toHaveBeenCalledOnce();
    expect(runtime.health.snapshot().status).toBe("stopped");
  });

  it("joins an in-flight terminal transaction before closing the store", async () => {
    let receipt!: (value: { status: "success" }) => void;
    let state = 3;
    mock.client.readContract = vi.fn(async () => ({ betId: 1n, requestId: 1n, state }));
    mock.client.writeContract = vi.fn(async () => hash);
    mock.client.waitForTransactionReceipt = vi.fn(
      () =>
        new Promise((resolve) => {
          receipt = resolve;
        })
    );
    const close = vi.fn(async () => undefined);
    mock.store!.close = close;
    runtime = make({ ...base, startupScanEnabled: false });
    await runtime.start();
    runtime.enqueue({ source: "manual", betId: 1n, receivedAt: Date.now() });
    await vi.advanceTimersByTimeAsync(500);
    const stopping = runtime.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(close).not.toHaveBeenCalled();
    state = 4;
    receipt({ status: "success" });
    await stopping;
    expect(close).toHaveBeenCalledOnce();
    expect(runtime.health.snapshot()).toMatchObject({
      status: "stopped",
      lastFinalizeSuccess: { betId: "1" }
    });
  });
});
