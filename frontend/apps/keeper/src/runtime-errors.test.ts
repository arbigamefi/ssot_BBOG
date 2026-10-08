import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createMemoryBetIndexStore, type BetIndexStore } from "@ssot/bet-index";
import { HttpRequestError, SocketClosedError } from "viem";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance
} from "vitest";

import { logger } from "./logger.js";
import { createKeeperRuntime, type KeeperRuntime } from "./runtime.js";
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

const KEY = "rpc-api-key-that-must-not-be-logged";
const hub = "0x0000000000000000000000000000000000000001" as const;
const config: KeeperConfig = {
  chainId: 8453,
  gameHub: hub,
  sportsHub: hub,
  vrfHub: hub,
  httpRpcUrl: `https://base-mainnet.infura.io/v3/${KEY}`,
  wsRpcUrl: `wss://base-mainnet.g.alchemy.com/v2/${KEY}`,
  privateKey: `0x${"11".repeat(32)}`,
  role: "primary",
  backupDelayMs: 0,
  pollIntervalMs: 300_000,
  rpcMinIntervalMs: 0,
  scanChunkBlocks: 10n,
  scanMaxChunksPerPass: 2,
  scanIndexEventsEnabled: true,
  startupScanEnabled: false,
  startBlock: 100n,
  betIndexWriteEnabled: true,
  betIndexDatabaseUrl: "postgres://unused.invalid",
  betIndexSsl: false,
  vaultProviderLedgerPools: [],
  vaultProviderLedgerScanIntervalMs: 0,
  sportsTicketIndexEnabled: true,
  sportsTerminalizerEnabled: true,
  sportsTerminalizerMarketIds: [],
  sportsTerminalizerScanChunkBlocks: 10n,
  sportsTerminalizerMaxTicketsPerMarket: 2,

  sportsTicketScanChunkBlocks: 10n,
  sportsTicketScanMaxBlocks: 50_000n,
  sportsTicketScanStartBlock: 100n
};

type Watcher = { eventName: string; onError: (error: unknown) => void };

/** What Node's WebSocket fires when the server answers the upgrade with HTTP 429. */
async function rejectedHandshakeEvent() {
  const server = createServer();
  server.on("upgrade", (_request, socket) =>
    socket.end("HTTP/1.1 429 Too Many Requests\r\ncontent-length: 0\r\n\r\n")
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await new Promise<Event>((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/v2/${KEY}`);
      socket.addEventListener("error", resolve, { once: true });
    });
  } finally {
    server.close();
  }
}

describe("runtime error reporting", () => {
  let runtime: KeeperRuntime | undefined;
  let watchers: Watcher[];
  let lines: string[];
  let consoleSpies: MockInstance[];
  let handshakeEvent: Event;

  beforeAll(async () => {
    handshakeEvent = await rejectedHandshakeEvent();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    watchers = [];
    lines = [];
    mock.store = createMemoryBetIndexStore();
    mock.client = {
      getBlockNumber: vi.fn(async () => 100n),
      transport: {
        getRpcClient: vi.fn(async () => ({ close: vi.fn(), socket: new EventTarget() }))
      },
      watchContractEvent: vi.fn((watcher: Watcher) => {
        watchers.push(watcher);
        return () => undefined;
      })
    };
    consoleSpies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        lines.push(String(args[0]));
      })
    ];
  });

  afterEach(async () => {
    await runtime?.stop();
    runtime = undefined;
    consoleSpies.forEach((spy) => spy.mockRestore());
    vi.useRealTimers();
  });

  const entries = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);

  const startWatching = async () => {
    runtime = createKeeperRuntime({ config, logger });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    lines = [];
  };

  it("names the failed websocket watcher and its error instead of an empty message", async () => {
    await startWatching();

    for (const watcher of watchers) watcher.onError(handshakeEvent);

    // Before: {"level":"error","message":"","ts":"…","eventName":"BetPlaced"}
    expect(entries()).toContainEqual({
      level: "error",
      message: "casino.keeper.gamehub_index_watch_error",
      ts: expect.any(String),
      eventName: "BetPlaced",
      transport: "websocket",
      error: "ErrorEvent: error event without a message"
    });
    expect(entries().map((entry) => [entry.message, entry.eventName ?? null])).toEqual([
      ["casino.keeper.gamehub_watch_error", null],
      ["casino.keeper.gamehub_index_watch_error", "BetPlaced"],
      ["casino.keeper.gamehub_index_watch_error", "BetFinalized"],
      ["casino.keeper.gamehub_index_watch_error", "BetRefunded"],
      ["casino.keeper.sports_ticket_index_watch_error", "TicketPlaced"],
      ["casino.keeper.sports_ticket_index_watch_error", "TicketSettled"],
      ["casino.keeper.sports_ticket_index_watch_error", "TicketRefunded"],
      ["casino.keeper.sports_ticket_index_watch_error", "TicketVoided"],
      ["sports.terminalizer.watch_error", "ResultProposed"],
      ["sports.terminalizer.watch_error", "ResultFinalized"],
      ["sports.terminalizer.watch_error", "MarketVoided"],
      ["sports.terminalizer.watch_error", "ResultChallengeResolved"],
      ["casino.keeper.vrfhub_watch_error", "ResultReceived"],
      ["casino.keeper.vrfhub_watch_error", "CallbackAttempt"]
    ]);
    for (const entry of entries()) {
      expect(entry).toMatchObject({
        transport: "websocket",
        error: "ErrorEvent: error event without a message"
      });
    }
  });

  it("keeps the websocket URL and its API key out of a closed-socket line", async () => {
    await startWatching();
    const closed = new SocketClosedError({ url: config.wsRpcUrl });
    expect(closed.message).toContain(KEY);

    for (const watcher of watchers) watcher.onError(closed);

    expect(lines).toHaveLength(watchers.length);
    for (const line of lines) expect(line).not.toContain(KEY);
    expect(entries()[0]).toMatchObject({
      message: "casino.keeper.gamehub_watch_error",
      error: "SocketClosedError: The socket has been closed."
    });
  });

  it("keeps the RPC URL out of a scan failure and the public health snapshot", async () => {
    mock.client.getBlockNumber = vi.fn(async () => {
      throw new HttpRequestError({
        body: { method: "eth_blockNumber" },
        details: "Too Many Requests",
        status: 429,
        url: config.httpRpcUrl
      });
    });
    runtime = createKeeperRuntime({ config: { ...config, startupScanEnabled: true }, logger });

    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);

    const description =
      "HttpRequestError [status=429]: HTTP request failed. Details: Too Many Requests";
    expect(runtime.health.snapshot()).toMatchObject({ status: "degraded", lastError: description });
    expect(entries()).toContainEqual(
      expect.objectContaining({ message: "casino.keeper.scan_failed", error: description })
    );
    expect(lines.join("\n")).not.toContain(KEY);
  });

  it.each([
    ["simulate", "settled"],
    ["simulate", "raced"],
    ["read", "settled"],
    ["read", "raced"]
  ] as const)("retains bet A's %s failure while unrelated bet B is %s", async (failure, result) => {
    const failedBetId = 15n;
    const healthyBetId = 16n;
    const txHash = `0x${"ab".repeat(32)}` as const;
    const reason = "bet A remains unavailable";
    let aRecovered = false;
    let bSettled = result === "raced";
    const readContract = vi.fn(
      async ({ functionName, args }: { functionName: string; args: readonly [bigint] }) => {
        const betId = args[0];
        if (functionName === "getRequest") return { bank: hub, hub, betId, state: 2 };
        if (betId === failedBetId && failure === "read" && !aRecovered) throw new Error(reason);
        return {
          bank: hub,
          betId,
          requestId: betId,
          state: betId === failedBetId ? (aRecovered ? 4 : 3) : bSettled ? 4 : 3,
          refundDeadline: 0n
        };
      }
    );
    const simulateContract = vi.fn(async ({ args }: { args: readonly [bigint] }) => {
      if (args[0] === failedBetId && !aRecovered) throw new Error(reason);
    });
    mock.client.readContract = readContract;
    mock.client.simulateContract = simulateContract;
    mock.client.writeContract = vi.fn(async () => {
      bSettled = true;
      return txHash;
    });
    mock.client.waitForTransactionReceipt = vi.fn(async () => ({
      status: "success"
    }));
    runtime = createKeeperRuntime({
      config: {
        ...config,
        wsRpcUrl: undefined,
        betIndexWriteEnabled: false,
        sportsTicketIndexEnabled: false,
        sportsTerminalizerEnabled: false
      },
      logger
    });
    await runtime.start();
    runtime.enqueue({
      source: "scan",
      betId: failedBetId,
      receivedAt: Date.now()
    });
    await vi.advanceTimersByTimeAsync(500);
    // A fails again after its first retry; this is still unresolved work, not a recovered blip.
    await vi.advanceTimersByTimeAsync(2_000);
    const attempts = failure === "read" ? readContract : simulateContract;
    expect(
      attempts.mock.calls.filter(
        ([call]) =>
          call.args[0] === failedBetId &&
          (!("functionName" in call) || call.functionName !== "getRequest")
      )
    ).toHaveLength(2);
    const beforeB = runtime.health.snapshot();
    expect(beforeB.status).toBe("degraded");
    expect(runtime.queue.has(failedBetId)).toBe(true);
    runtime.enqueue({
      source: "scan",
      betId: healthyBetId,
      receivedAt: Date.now()
    });
    await vi.advanceTimersByTimeAsync(500);
    const afterB = runtime.health.snapshot();
    console.info(
      "finalize-isolation-observation",
      JSON.stringify({
        failure,
        result,
        beforeB,
        afterB,
        aQueued: runtime.queue.has(failedBetId),
        bQueued: runtime.queue.has(healthyBetId)
      })
    );
    expect(runtime.queue.has(failedBetId)).toBe(true);
    expect(runtime.queue.has(healthyBetId)).toBe(false);
    expect(afterB).toMatchObject({
      status: "degraded",
      queueDepth: 1,
      degradedBy: ["finalize"],
      lastError: expect.stringContaining(reason),
      lastFinalizeFailure: { betId: "15", retryable: true }
    });
    // The same bet's verified terminal state clears the failure without a sticky alert.
    aRecovered = true;
    runtime.enqueue({
      source: "scan",
      betId: failedBetId,
      receivedAt: Date.now()
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(runtime.health.snapshot()).toMatchObject({
      status: "running",
      queueDepth: 0,
      lastError: undefined,
      degradedBy: undefined,
      lastFinalizeFailure: undefined
    });
  });

  it("clears a transient read failure when the same bet is safely deferred", async () => {
    let recovered = false;
    mock.client.readContract = vi.fn(
      async ({ functionName, args }: { functionName: string; args: readonly [bigint] }) => {
        if (functionName === "getRequest") return { bank: hub, hub, betId: args[0], state: 1 };
        if (!recovered) throw new Error("temporary read failure");
        return {
          bank: hub,
          betId: args[0],
          requestId: args[0],
          state: 2,
          refundDeadline: 1000n
        };
      }
    );
    mock.client.getBlock = vi.fn(async () => ({ timestamp: 0n }));
    mock.client.writeContract = vi.fn();
    runtime = createKeeperRuntime({
      config: {
        ...config,
        wsRpcUrl: undefined,
        betIndexWriteEnabled: false,
        sportsTicketIndexEnabled: false,
        sportsTerminalizerEnabled: false
      },
      logger
    });
    await runtime.start();
    runtime.enqueue({ source: "scan", betId: 15n, receivedAt: Date.now() });
    await vi.advanceTimersByTimeAsync(500);
    expect(runtime.health.snapshot().status).toBe("degraded");
    recovered = true;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(runtime.queue.has(15n)).toBe(true);
    expect(runtime.health.snapshot()).toMatchObject({
      status: "running",
      queueDepth: 1,
      degradedBy: undefined,
      lastError: undefined,
      lastFinalizeFailure: undefined
    });
    expect(mock.client.writeContract).not.toHaveBeenCalled();
  });
});
