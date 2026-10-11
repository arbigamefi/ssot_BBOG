import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAddress, type Address, type Hex } from "viem";
import {
  createMemoryBetIndexStore,
  GOVERNANCE_TIMELOCK_CURSOR_SOURCE,
  type BetIndexStore
} from "@ssot/bet-index";
import { createKeeperRuntime, type KeeperRuntime } from "./runtime.js";
import type { KeeperConfig, KeeperLogger } from "./types.js";

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

const hub = "0x00000000000000000000000000000000000000a6" as Address;
const registry = "0x0000000000000000000000000000000000000066" as Address;
const bank = "0x00000000000000000000000000000000000000b1" as Address;
const timelock = "0x00000000000000000000000000000000000000ee" as Address;
const deployer = "0x00000000000000000000000000000000000000d0" as Address;
const target = "0x0000000000000000000000000000000000000077" as Address;
const operation = `0x${"0a".repeat(32)}` as Hex;
const salt = `0x${"5a".repeat(32)}` as Hex;
const ZERO = `0x${"00".repeat(32)}` as Hex;
const tx = (block: bigint) => `0x${block.toString(16).padStart(64, "0")}` as Hex;

const config: KeeperConfig = {
  chainId: 8453,
  gameHub: hub,
  vrfHub: hub,
  poolRegistry: registry,
  releaseBanks: [bank],
  httpRpcUrl: "http://unused.invalid",
  privateKey: `0x${"11".repeat(32)}`,
  role: "primary",
  backupDelayMs: 0,
  pollIntervalMs: 0,
  rpcMinIntervalMs: 0,
  scanChunkBlocks: 10n,
  scanMaxChunksPerPass: 5,
  scanIndexEventsEnabled: true,
  startupScanEnabled: false,
  startBlock: 100n,
  casinoRecoveryStartBlock: 100n,
  betIndexWriteEnabled: true,
  betIndexDatabaseUrl: "postgres://unused.invalid",
  betIndexSsl: false,
  vaultProviderLedgerPools: [],
  vaultProviderLedgerScanIntervalMs: 0,
  voidGasLimit: 11_000_000n
};

type LogQuery = {
  address?: Address | Address[];
  events?: Array<{ name: string }>;
  fromBlock: bigint;
  toBlock: bigint;
};

function fakeChain() {
  const chain = {
    head: 200n,
    finalized: 150n,
    governance: new Map<string, Address>([
      [registry, timelock],
      [hub, timelock],
      [bank, timelock]
    ]),
    logs: [
      {
        eventName: "CallScheduled",
        args: {
          id: operation,
          index: 0n,
          target,
          value: 0n,
          data: "0x12345678",
          predecessor: ZERO,
          delay: 259_200n
        },
        blockNumber: 120n,
        logIndex: 0,
        transactionHash: tx(120n)
      },
      {
        eventName: "CallSalt",
        args: { id: operation, salt },
        blockNumber: 120n,
        logIndex: 1,
        transactionHash: tx(120n)
      }
    ] as Array<{ blockNumber: bigint } & Record<string, unknown>>
  };
  mock.client = {
    getBlockNumber: vi.fn(async () => chain.head),
    getBlock: vi.fn(async (query?: { blockTag?: string; blockNumber?: bigint }) =>
      query?.blockTag === "finalized"
        ? { number: chain.finalized, timestamp: chain.finalized * 2n }
        : {
            number: query?.blockNumber ?? chain.head,
            timestamp: (query?.blockNumber ?? chain.head) * 2n
          }
    ),
    getLogs: vi.fn(async (query: LogQuery) =>
      String(query.address).toLowerCase() === timelock
        ? chain.logs.filter(
            (log) => log.blockNumber >= query.fromBlock && log.blockNumber <= query.toBlock
          )
        : []
    ),
    getContractEvents: vi.fn(async () => []),
    readContract: vi.fn(
      async ({ address, functionName }: { address: Address; functionName: string }) => {
        if (functionName === "governance") return chain.governance.get(address.toLowerCase());
        throw new Error(`unexpected read ${functionName}`);
      }
    )
  };
  return chain;
}

describe("governance timelock indexing", () => {
  let runtime: KeeperRuntime | undefined;
  let chain: ReturnType<typeof fakeChain>;
  let logger: KeeperLogger;
  const timelockQueries = () =>
    vi
      .mocked(mock.client.getLogs as (query: LogQuery) => unknown)
      .mock.calls.map(([query]) => query)
      .filter((query) => String(query.address).toLowerCase() === timelock);
  const start = async () => {
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    runtime = createKeeperRuntime({ config, logger });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
  };
  const operations = () =>
    mock.store!.getGovernanceTimelockOperations({ chainId: 8453, timelock, now: 0 });

  beforeEach(() => {
    vi.useFakeTimers();
    mock.store = createMemoryBetIndexStore();
    chain = fakeChain();
  });
  afterEach(async () => {
    await runtime?.stop();
    runtime = undefined;
    vi.useRealTimers();
  });

  it("indexes PoolRegistry.governance() through finalized blocks from the release origin, in bounded passes", async () => {
    await start();
    expect(timelockQueries().map((query) => [query.fromBlock, query.toBlock])).toEqual([
      [100n, 109n],
      [110n, 119n],
      [120n, 129n],
      [130n, 139n],
      [140n, 149n]
    ]);
    expect(timelockQueries()[0]?.events?.map((event) => event.name)).toEqual([
      "CallScheduled",
      "CallSalt",
      "CallExecuted",
      "Cancelled",
      "MinDelayChange"
    ]);
    expect(await operations()).toMatchObject([
      {
        operationId: operation,
        index: 0,
        target,
        salt,
        scheduledBlock: 120,
        scheduledAt: 240_000,
        readyAt: String(240 + 259_200),
        state: "waiting"
      }
    ]);
    expect(await mock.store!.getCursor(8453, GOVERNANCE_TIMELOCK_CURSOR_SOURCE, timelock)).toBe(
      149n
    );
    expect(runtime!.health.snapshot()).toMatchObject({
      governance: {
        timelock: getAddress(timelock),
        scannedThrough: "149",
        finalizedBlock: "150",
        caughtUp: false
      }
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(timelockQueries().at(-1)).toMatchObject({ fromBlock: 150n, toBlock: 150n });
    expect(runtime!.health.snapshot().governance).toMatchObject({
      scannedThrough: "150",
      caughtUp: true
    });
    expect(runtime!.health.snapshot().degradedBy ?? []).not.toContain("governance");
  });

  it("refuses to index when a release Bank reports another governance", async () => {
    chain.governance.set(bank, deployer);
    await start();
    expect(timelockQueries()).toEqual([]);
    expect(runtime!.health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: expect.arrayContaining(["governance"]),
      lastError: expect.stringContaining(`Bank ${getAddress(bank)} reports ${getAddress(deployer)}`)
    });
    expect(logger.error).toHaveBeenCalledWith(
      "casino.keeper.governance_scan_failed",
      expect.objectContaining({ error: expect.stringContaining("GovernanceMismatchError") })
    );
    // Once the Bank is handed to the timelock, the next pass indexes.
    chain.governance.set(bank, timelock);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(timelockQueries()).toHaveLength(5);
    expect(runtime!.health.snapshot().degradedBy ?? []).not.toContain("governance");
  });

  it("scans nothing past a lagging finalized read and resumes from its cursor after a restart", async () => {
    chain.finalized = 140n;
    await start();
    expect(await mock.store!.getCursor(8453, GOVERNANCE_TIMELOCK_CURSOR_SOURCE, timelock)).toBe(
      140n
    );
    const queries = timelockQueries().length;
    chain.finalized = 131n;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(timelockQueries()).toHaveLength(queries);
    expect(runtime!.health.snapshot()).toMatchObject({
      governance: { scannedThrough: "140", finalizedBlock: "131", finalizedBehindBy: "9" }
    });
    expect(runtime!.health.snapshot().degradedBy ?? []).not.toContain("governance");
    await runtime!.stop();
    chain.finalized = 145n;
    await start();
    expect(timelockQueries().slice(queries)).toEqual([
      expect.objectContaining({ fromBlock: 141n, toBlock: 145n })
    ]);
    expect(await operations()).toHaveLength(1);
  });

  it("degrades governance when its finalized head has not advanced for the stall limit", async () => {
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    runtime = createKeeperRuntime({ config: { ...config, finalizedStallMs: 120_000 }, logger });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.health.snapshot().degradedBy ?? []).not.toContain("governance");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(runtime.health.snapshot()).toMatchObject({
      degradedBy: expect.arrayContaining(["governance"]),
      governance: { finalizedStalledSince: expect.any(String) }
    });
    chain.finalized = 151n;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runtime.health.snapshot().degradedBy ?? []).not.toContain("governance");
    expect(runtime.health.snapshot().governance?.finalizedStalledSince).toBeUndefined();
  });

  it("holds a block-time read that reaches a node without the block for five consecutive minutes", async () => {
    const getBlock = mock.client.getBlock as (query?: {
      blockTag?: string;
      blockNumber?: bigint;
    }) => Promise<unknown>;
    let missing = true;
    mock.client.getBlock = vi.fn(async (query?: { blockTag?: string; blockNumber?: bigint }) => {
      if (missing && query?.blockNumber === 120n) throw new Error("header not found");
      return getBlock(query);
    });
    await start();
    expect(runtime!.health.snapshot().degradedBy ?? []).not.toContain("governance");
    expect(logger.warn).toHaveBeenCalledWith(
      "casino.keeper.governance_scan_transient",
      expect.objectContaining({ error: "Error: header not found" })
    );
    expect(await operations()).toEqual([]);
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(runtime!.health.snapshot().degradedBy ?? []).not.toContain("governance");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runtime!.health.snapshot()).toMatchObject({
      degradedBy: expect.arrayContaining(["governance"]),
      lastError: "Error: header not found"
    });
    missing = false;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runtime!.health.snapshot().degradedBy ?? []).not.toContain("governance");
    expect(await operations()).toHaveLength(1);
  });
});
