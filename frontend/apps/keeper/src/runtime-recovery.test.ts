import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BaseError,
  ContractFunctionRevertedError,
  encodeAbiParameters,
  encodeErrorResult,
  encodeEventTopics
} from "viem";
import { BANK_KEEPER_ABI, GAME_HUB_KEEPER_ABI } from "./abi.js";
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
type LogQuery = { events: Array<{ name: string }>; fromBlock: bigint; toBlock: bigint };
const eventNames = (query: LogQuery) => query.events.map((event) => event.name);
const logQueries = () =>
  vi
    .mocked(mock.client.getLogs as ReturnType<typeof vi.fn>)
    .mock.calls.map(([query]) => query as LogQuery);
const hash = `0x${"aa".repeat(32)}` as const;
const base: KeeperConfig = {
  chainId: 8453,
  gameHub: hub,
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
  vaultProviderLedgerPools: [],
  vaultProviderLedgerScanIntervalMs: 0
};

describe("runtime recovery composition", () => {
  let runtime: KeeperRuntime | undefined;
  let canonicalState: number;
  beforeEach(() => {
    vi.useFakeTimers();
    canonicalState = 2;
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
            args: { positionId: 1n, requestId: 1n },
            blockNumber: 105n,
            transactionHash: hash,
            logIndex: 0
          }));
      }),
      readContract: vi.fn(async () => ({
        betId: 1n,
        requestId: 1n,
        refundDeadline: 3600n,
        state: 4
      })),
      writeContract: vi.fn(),
      simulateContract: vi.fn()
    };
  });
  afterEach(async () => {
    await runtime?.stop();
    runtime = undefined;
    vi.useRealTimers();
  });
  const make = (config: KeeperConfig = base) => {
    const read = mock.client.readContract as (q: {
      functionName: string;
      address: string;
      args?: bigint[];
    }) => Promise<unknown>;
    mock.client.readContract = vi.fn(async (q) => {
      if (q.functionName === "getRequest")
        return { bank: hub, hub, betId: q.args[0], state: canonicalState };
      const pool = config.vaultProviderLedgerPools.find(
        (p) => p.bank === q.address || p.vault === q.address
      );
      if (pool) {
        if (q.functionName === "getSSOT")
          return {
            bankCash: 0n,
            vaultCash: 100n,
            L: 100n,
            P: 0n,
            R: 0n,
            K: 0n,
            G: 100n,
            PF: 0n,
            XP: 0n,
            PP: 0n,
            accountingValid: true,
            riskInPaused: false
          };
        if (q.functionName === "vault") return pool.vault;
        if (q.functionName === "bank") return pool.bank;
        if (q.functionName === "asset") return pool.asset;
        if (q.functionName === "lpAccounting") return [0n, 0n, 0];
      }
      const value = await read(q);
      return q.functionName === "getBet" ? { bank: hub, ...(value as object) } : value;
    });
    return createKeeperRuntime({
      config,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });
  };

  function finalizedLedgerFixture() {
    const bank = "0x0000000000000000000000000000000000000003" as const;
    const asset = "0x0000000000000000000000000000000000000004" as const;
    const state = {
      head: 100n,
      finalized: 76n,
      deposit: undefined as bigint | undefined,
      finalityFailure: ""
    };
    mock.client.getBlockNumber = vi.fn(async () => state.head);
    mock.client.getBlock = vi.fn(async (query?: { blockTag?: string; blockNumber?: bigint }) => {
      if (query?.blockTag === "finalized") {
        if (state.finalityFailure === "unavailable") throw new Error("finalized RPC unavailable");
        if (state.finalityFailure === "unnumbered") return { number: null, timestamp: 1601n };
      }
      return {
        number:
          query?.blockNumber ?? (query?.blockTag === "finalized" ? state.finalized : state.head),
        timestamp: 1601n
      };
    });
    mock.client.getContractEvents = vi.fn(async () => []);
    mock.client.readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "openHolds") return 0n;
      if (functionName === "MAX_OPEN_HOLDS") return 128n;
      if (functionName === "minBetAmount") return 10_000n;
      throw new Error(`Unexpected read ${functionName}`);
    });
    mock.client.getLogs = vi.fn(async (query: LogQuery) =>
      eventNames(query).includes("DepositAdded") &&
      state.deposit != null &&
      query.fromBlock <= state.deposit &&
      query.toBlock >= state.deposit
        ? [
            {
              address: bank,
              eventName: "DepositAdded",
              args: {
                payer: hub,
                owner: hub,
                assets: 100n,
                depositId: 1099511627776n,
                withdrawAfter: 2000n
              },
              blockNumber: state.deposit,
              transactionHash: hash,
              logIndex: 0
            }
          ]
        : []
    );
    const config = {
      ...base,
      startBlock: 1n,
      casinoRecoveryStartBlock: 1n,
      scanMaxChunksPerPass: 1,
      pollIntervalMs: 0,
      vaultProviderLedgerScanIntervalMs: 1000,
      vaultProviderLedgerPools: [{ bank, vault: bank, asset, poolId: 1, decimals: 6 }]
    };
    const ranges = () => logQueries().filter((q) => eventNames(q).includes("DepositAdded"));
    const query = { chainId: 8453, owner: hub, vault: bank, limit: 10 };
    return { state, config, ranges, query };
  }

  it("preserves existing Vault rows and the cursor after incomplete RPC identity, then retries the same range", async () => {
    const f = finalizedLedgerFixture();
    f.state.deposit = 5n;
    const pool = f.config.vaultProviderLedgerPools[0]!;
    await mock.store!.writeVaultProviderLedgerRows([
      {
        id: "existing",
        chainId: 8453,
        poolId: "1",
        owner: hub,
        bank: pool.bank,
        vault: pool.vault,
        asset: pool.asset,
        action: "deposit",
        depositId: "1099511627776",
        assets: "100",
        blockNumber: 5,
        logIndex: 0,
        txHash: hash,
        updatedAt: 0
      }
    ]);
    const original = mock.client.getLogs as (
      q: LogQuery
    ) => Promise<Array<Record<string, unknown>>>;
    let broken = true;
    mock.client.getLogs = vi.fn(async (q: LogQuery) => {
      const logs = await original(q);
      return broken && eventNames(q).includes("DepositAdded")
        ? logs.map((log) => ({ ...log, transactionHash: null }))
        : logs;
    });
    runtime = make(f.config);
    const recordError = vi.spyOn(runtime.health, "recordError");
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(await mock.store!.getVaultProviderLedger(f.query)).toHaveLength(1);
    expect(await mock.store!.getCursor(8453, "vault-provider-ledger-finalized", hub)).toBeNull();
    expect(runtime.health.snapshot().degradedBy).toContain("ledger");
    expect(recordError).toHaveBeenCalledWith(
      "Error: Vault ledger log is missing its mined identity",
      expect.any(Number),
      "ledger"
    );
    broken = false;
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.ranges().map((q) => q.fromBlock)).toEqual([1n, 1n]);
    expect(await mock.store!.getCursor(8453, "vault-provider-ledger-finalized", hub)).toBe(10n);
    expect(await mock.store!.getVaultProviderLedger(f.query)).toHaveLength(1);
    expect(runtime.health.snapshot().degradedBy).not.toContain("ledger");
  });

  it("indexes a replacement behind the old moving overlap once it is finalized", async () => {
    const f = finalizedLedgerFixture();
    runtime = make(f.config);
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 9; ++i) await vi.advanceTimersByTimeAsync(1000);
    expect(await mock.store!.getCursor(8453, "vault-provider-ledger-finalized", hub)).toBe(76n);
    f.state.head = 101n;
    f.state.finalized = 77n;
    await vi.advanceTimersByTimeAsync(1000);
    // A 16-block reorg replaces block 85 after the old scanner's [77, 86] overlap page.
    f.state.deposit = 85n;
    expect(await mock.store!.getVaultProviderLedger(f.query)).toEqual([]);
    for (let i = 0; i < 25; ++i) {
      f.state.head += 9n;
      f.state.finalized = f.state.head - 24n;
      const count = f.ranges().length;
      await vi.advanceTimersByTimeAsync(1000);
      expect(f.ranges().length - count).toBeLessThanOrEqual(1);
      expect(f.ranges().at(-1)!.toBlock).toBeLessThanOrEqual(f.state.finalized);
    }
    for (let i = 0; i < 100; ++i) await vi.advanceTimersByTimeAsync(1000);
    expect(await mock.store!.getCursor(8453, "vault-provider-ledger-finalized", hub)).toBe(302n);
    expect(await mock.store!.getVaultProviderLedger(f.query)).toMatchObject([
      { action: "deposit", assets: "100", depositId: "1099511627776", blockNumber: 85 }
    ]);
  });

  it("resumes only its own finalized ledger cursor and does not repeat completed pages", async () => {
    const f = finalizedLedgerFixture();
    // The unrelated GameHub cursor is ahead of finalized ledger discovery.
    await mock.store!.setCursor({
      chainId: 8453,
      source: "gamehub-events",
      cursorKey: hub,
      blockNumber: 100n
    });
    f.state.deposit = 5n;
    runtime = make(f.config);
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.ranges()).toMatchObject([{ fromBlock: 1n, toBlock: 10n }]);
    expect(await mock.store!.getVaultProviderLedger(f.query)).toHaveLength(1);
    await runtime.stop();
    vi.mocked(mock.client.getLogs as ReturnType<typeof vi.fn>).mockClear();
    runtime = make(f.config);
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.ranges()).toMatchObject([{ fromBlock: 11n, toBlock: 20n }]);
    expect(await mock.store!.getVaultProviderLedger(f.query)).toHaveLength(1);
  });

  it.each(["unavailable", "unnumbered", "regressed"])(
    "reports %s ledger finality without advancing the cursor",
    async (failure) => {
      const f = finalizedLedgerFixture();
      runtime = make(f.config);
      await runtime.start();
      await vi.advanceTimersByTimeAsync(0);
      const cursor = await mock.store!.getCursor(8453, "vault-provider-ledger-finalized", hub);
      const count = f.ranges().length;
      if (failure === "regressed") f.state.finalized = 75n;
      else f.state.finalityFailure = failure;
      await vi.advanceTimersByTimeAsync(1000);
      expect(await mock.store!.getCursor(8453, "vault-provider-ledger-finalized", hub)).toBe(
        cursor
      );
      expect(f.ranges()).toHaveLength(count);
      expect(runtime.health.snapshot().degradedBy).toContain("ledger");
      expect(runtime.health.snapshot().lastError).toMatch(/finalized/);
      f.state.finalityFailure = "";
      f.state.finalized = 76n;
      await vi.advanceTimersByTimeAsync(1000);
      expect(runtime.health.snapshot().degradedBy ?? []).not.toContain("ledger");
      expect(await mock.store!.getCursor(8453, "vault-provider-ledger-finalized", hub)).toBe(20n);
    }
  );

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
      expect(logQueries().map((query) => query.fromBlock)).toEqual([
        101n,
        101n,
        101n,
        101n,
        111n,
        111n
      ]);
      for (const query of logQueries().filter((q) => !eventNames(q).includes("ResultReceived"))) {
        expect(eventNames(query)).toEqual(
          fullScan ? INDEX_EVENTS : ["BetPlaced", "BetRandomReady"]
        );
      }
      expect(write).toHaveBeenCalled();
    }
  );

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
          args: { positionId: BigInt(i + 1), requestId: BigInt(i + 1) }
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

  it("preserves casino recovery without a database", async () => {
    runtime = make({ ...base, betIndexWriteEnabled: false, betIndexDatabaseUrl: undefined });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.queue.has(1n)).toBe(true);
    expect(runtime.health.snapshot().lastScannedBlock).toBe("120");
    expect(logQueries().map(eventNames)).toEqual([
      ["BetPlaced", "BetRandomReady"],
      ["ResultReceived", "CallbackAttempt"],
      ["BetPlaced", "BetRandomReady"],
      ["ResultReceived", "CallbackAttempt"]
    ]);
  });

  it("meters one Hub query and one canonical VRF query per range", async () => {
    runtime = make();
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.queue.has(1n)).toBe(true);
    expect(await mock.store!.getCursor(8453, "gamehub-events", hub)).toBe(120n);
    expect(logQueries().map((query) => query.fromBlock)).toEqual([101n, 101n, 111n, 111n]);
    // The heartbeat publishes RPC usage: getLogs is metered and throttled like every tracked method.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(runtime.health.snapshot().rpc?.total).toMatchObject({ getLogs: 4 });
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
    mock.client.readContract = vi.fn(async () => ({
      betId: 1n,
      requestId: 1n,
      refundDeadline: 3600n,
      state
    }));
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
      let state = eventName === "BetRefunded" ? 2 : 3;
      canonicalState = eventName === "BetRefunded" ? 1 : 2;
      const amounts = {
        payoutGross: 200n,
        payoutNet: 196n,
        feeOnPayout: 4n,
        protocolFeeAccrual: 2n
      };
      mock.client.readContract = vi.fn(async ({ functionName }: { functionName: string }) =>
        functionName === "getBetTerminal"
          ? { state: 4, ...amounts, refundAmount: 0n }
          : functionName === "getBetReferralPayees"
            ? [hub, hub]
            : {
                betId: 1n,
                requestId: 1n,
                state,
                asset: hub,
                player: hub,
                gameId: hash,
                placedAt: 900n,
                refundDeadline: 1000n,
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
            ...Array.from({ length: 7 }, () => ({ type: "uint256" as const }))
          ],
          [100n, 200, 2n, 1n, 1n, 0n, 0n, 0n, 0n]
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
        lastEventName: eventName,
        referrerL1: hub,
        referrerL2: hub
      });
      if (eventName === "BetFinalized") expect(row?.houseEdge?.edge).toBe("2");
      expect(runtime.queue.size).toBe(0);
    }
  );

  it("retries the full finalized ledger range before advancing its cursor", async () => {
    const bank = "0x0000000000000000000000000000000000000003" as const;
    const secondBank = "0x0000000000000000000000000000000000000005" as const;
    const asset = "0x0000000000000000000000000000000000000004" as const;
    let failSecondBank = true;
    mock.client.getBlock = vi.fn(async () => ({ number: 120n, timestamp: 1_601n }));
    mock.client.getContractEvents = vi.fn(async () => []);
    mock.client.readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "openHolds") return 0n;
      if (functionName === "MAX_OPEN_HOLDS") return 128n;
      if (functionName === "minBetAmount") return 10_000n;
      throw new Error(`Unexpected read ${functionName}`);
    });
    mock.client.getLogs = vi.fn(async (query: LogQuery) =>
      eventNames(query).includes("DepositAdded") && query.fromBlock === 100n
        ? [
            {
              address: bank,
              eventName: "DepositAdded",
              args: {
                payer: hub,
                owner: hub,
                assets: 100n,
                depositId: 1099511627776n,
                withdrawAfter: 2000n
              },
              blockNumber: 105n,
              transactionHash: hash,
              logIndex: 0
            }
          ]
        : []
    );
    const replace = mock.store!.replaceVaultProviderLedgerRange;
    vi.spyOn(mock.store!, "replaceVaultProviderLedgerRange").mockImplementation(async (request) => {
      if (request.vault === secondBank && failSecondBank) {
        failSecondBank = false;
        throw new Error("range write failed");
      }
      return replace(request);
    });
    runtime = make({
      ...base,
      casinoRecoveryStartBlock: 100n,
      vaultProviderLedgerScanIntervalMs: 60_000,
      vaultProviderLedgerPools: [
        { bank, vault: bank, asset, poolId: 1, decimals: 6 },
        { bank: secondBank, vault: secondBank, asset, poolId: 2, decimals: 6 }
      ]
    });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(await mock.store!.getCursor(8453, "vault-provider-ledger-finalized", hub)).toBeNull();
    const query = { chainId: 8453, owner: hub, vault: bank, limit: 10 };
    expect(await mock.store!.getVaultProviderLedger(query)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await mock.store!.getVaultProviderLedger(query)).toHaveLength(1);
    expect(await mock.store!.getCursor(8453, "vault-provider-ledger-finalized", hub)).toBe(119n);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await mock.store!.getCursor(8453, "vault-provider-ledger-finalized", hub)).toBe(120n);
    expect(
      logQueries()
        .filter((q) => eventNames(q).includes("DepositAdded"))
        .map((q) => q.fromBlock)
    ).toEqual([100n, 100n, 110n, 120n]);
  });

  it("rehydrates a still-pending bet after its lifecycle checkpoint and restart", async () => {
    canonicalState = 1;
    mock.client.readContract = vi.fn(async ({ functionName }: { functionName: string }) =>
      functionName === "refundTimeoutSeconds"
        ? 86_400n
        : { betId: 1n, requestId: 1n, placedAt: 999n, refundDeadline: 1099n, state: 2 }
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

  it.each([
    ["simulation", "asset refusal", false],
    ["simulation", "wrong token refusal", true],
    ["simulation", "unknown revert", true],
    ["simulation", "RPC unavailable", true],
    ["simulation", "SafeERC20FailedOperation text", true],
    ["send", "asset refusal", true],
    ["send", "insufficient funds for gas", true],
    ["receipt", "RPC unavailable", true],
    ["receipt", "reverted", true]
  ] as const)("classifies payable %s / %s narrowly", async (stage, failure, actionable) => {
    const bank = "0x0000000000000000000000000000000000000003" as const;
    const asset = "0x0000000000000000000000000000000000000004" as const;
    let debt = 5n;
    let recovered = false;
    const fail = () => {
      if (failure === "asset refusal" || failure === "wrong token refusal") {
        throw new BaseError("simulation or send failed", {
          cause: new ContractFunctionRevertedError({
            abi: BANK_KEEPER_ABI,
            functionName: "claimPlayerPayable",
            data: encodeErrorResult({
              abi: BANK_KEEPER_ABI,
              errorName: "SafeERC20FailedOperation",
              args: [failure === "asset refusal" ? asset : hub]
            })
          })
        });
      }
      if (failure === "unknown revert") {
        throw new ContractFunctionRevertedError({
          abi: BANK_KEEPER_ABI,
          functionName: "claimPlayerPayable",
          data: encodeErrorResult({ abi: BANK_KEEPER_ABI, errorName: "EnforcedPause" })
        });
      }
      throw new Error(failure);
    };
    mock.client.getBlock = vi.fn(async () => ({ number: 120n, timestamp: 1_000n }));
    mock.client.getLogs = vi.fn(async () => []);
    mock.client.getContractEvents = vi.fn(async ({ eventName }: { eventName: string }) =>
      eventName === "PlayerPayableCreated" ? [{ args: { player: hub }, blockNumber: 105n }] : []
    );
    mock.client.readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "openHolds") return 0n;
      if (functionName === "MAX_OPEN_HOLDS") return 128n;
      if (functionName === "minBetAmount") return 10_000n;
      if (functionName === "playerPayable") return debt;
      throw new Error(`Unexpected ${functionName}`);
    });
    mock.client.simulateContract = vi.fn(async () => {
      if (stage === "simulation" && !recovered) fail();
    });
    mock.client.writeContract = vi.fn(async () => {
      if (stage === "send" && !recovered) fail();
      return hash;
    });
    mock.client.waitForTransactionReceipt = vi.fn(async () => {
      if (stage === "receipt" && !recovered) {
        if (failure === "reverted") return { status: "reverted", blockNumber: 120n };
        fail();
      }
      debt = 0n;
      return { status: "success", blockNumber: 120n };
    });
    runtime = make({
      ...base,
      casinoRecoveryStartBlock: 100n,
      scanChunkBlocks: 100n,
      vaultProviderLedgerPools: [{ bank, vault: bank, asset, poolId: 1, decimals: 6 }]
    });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    const first = runtime.health.snapshot();
    expect(first.status).toBe(actionable ? "degraded" : "running");
    expect(Boolean(first.payables?.[0]?.claimError)).toBe(actionable);
    expect(debt).toBe(5n);
    if (stage === "simulation") expect(mock.client.writeContract).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runtime.health.snapshot().status).toBe(first.status);
    expect(runtime.health.snapshot().payables?.[0]?.error).toBe(first.payables?.[0]?.error);
    expect(mock.client.simulateContract).toHaveBeenCalledTimes(1);
    recovered = true;
    await vi.advanceTimersByTimeAsync(240_000);
    expect(runtime.health.snapshot().status).toBe("running");
    expect(runtime.health.snapshot().payables?.[0]?.claimError).toBeUndefined();
    expect(debt).toBe(0n);
  });

  it("does not advance lifecycle recovery over a failed index write and exposes incomplete recovery", async () => {
    canonicalState = 1;
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
    canonicalState = 1;
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
        : { betId: 1n, requestId: 1n, placedAt: 999n, refundDeadline: 1099n, state: 2 }
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
    mock.client.readContract = vi.fn(async () => ({
      betId: 1n,
      requestId: 1n,
      refundDeadline: 3600n,
      state
    }));
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
