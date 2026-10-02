import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { encodeAbiParameters, encodeEventTopics, decodeEventLog } from "viem";
import { GAME_HUB_KEEPER_ABI } from "./abi.js";
import { createKeeperRuntime, type KeeperRuntime } from "./runtime.js";
import type { KeeperConfig } from "./types.js";

const mock = vi.hoisted(() => ({ client: {} as Record<string, any>, realWs: false }));
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn((options) =>
      mock.realWs && options.transport({}).config.type === "webSocket"
        ? actual.createPublicClient(options)
        : mock.client
    ),
    createWalletClient: vi.fn(() => mock.client)
  };
});

const hub = "0x0000000000000000000000000000000000000001" as const;
const hash = `0x${"aa".repeat(32)}` as const;
const config: KeeperConfig = {
  chainId: 8453,
  gameHub: hub,
  vrfHub: hub,
  httpRpcUrl: "http://unused.invalid",
  wsRpcUrl: "ws://unused.invalid",
  privateKey: `0x${"11".repeat(32)}`,
  role: "primary",
  backupDelayMs: 0,
  pollIntervalMs: 300_000,
  rpcMinIntervalMs: 0,
  scanChunkBlocks: 10n,
  scanMaxChunksPerPass: 2,
  scanIndexEventsEnabled: false,
  startupScanEnabled: false,
  startBlock: 100n,
  betIndexWriteEnabled: false,
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
type Watcher = {
  eventName: string;
  poll?: boolean;
  onLogs: (logs: unknown[]) => void;
  onError: (error: unknown) => void;
};

describe("WebSocket settlement and recovery", () => {
  let runtime: KeeperRuntime | undefined;
  let watchers: Watcher[];
  let removers: ReturnType<typeof vi.fn>[];
  let close: ReturnType<typeof vi.fn>;
  let states: Map<bigint, number>;
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const ready = (eventName: string, betId = 1n) =>
    [...watchers]
      .reverse()
      .find((watcher) => watcher.eventName === eventName)!
      .onLogs([
        {
          args:
            eventName === "BetRandomReady"
              ? decodeEventLog({
                  abi: GAME_HUB_KEEPER_ABI,
                  topics: encodeEventTopics({
                    abi: GAME_HUB_KEEPER_ABI,
                    eventName,
                    args: { positionId: betId, requestId: betId }
                  }) as [`0x${string}`, ...`0x${string}`[]],
                  data: encodeAbiParameters([{ type: "bytes32" }], [hash])
                }).args
              : { hub, betId, requestId: betId },
          blockNumber: 101n,
          transactionHash: hash
        }
      ]);
  const start = async () => {
    runtime = createKeeperRuntime({ config, logger });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mock.realWs = false;
    watchers = [];
    removers = [];
    close = vi.fn();
    states = new Map([
      [1n, 3],
      [2n, 3]
    ]);
    mock.client = {
      transport: { getRpcClient: vi.fn(async () => ({ close, socket: new EventTarget() })) },
      watchContractEvent: vi.fn((watcher: Watcher) => {
        watchers.push(watcher);
        const remove = vi.fn();
        removers.push(remove);
        return remove;
      }),
      getBlockNumber: vi.fn(async () => 110n),
      getBlock: vi.fn(async () => ({ number: 110n, timestamp: 1000n })),
      getLogs: vi.fn(async () => []),
      readContract: vi.fn(async ({ args }: { args: bigint[] }) => ({
        betId: args[0],
        requestId: args[0],
        state: states.get(args[0]!),
        refundDeadline: 4600n
      })),
      simulateContract: vi.fn(async () => ({})),
      writeContract: vi.fn(async ({ args }: { args: bigint[] }) => {
        states.set(args[0]!, 4);
        return hash;
      }),
      waitForTransactionReceipt: vi.fn(async () => ({ status: "success" }))
    };
  });
  afterEach(async () => {
    await runtime?.stop();
    runtime = undefined;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it.each(["BetRandomReady", "Fulfilled"])(
    "%s settles without waiting for either timer",
    async (eventName) => {
      await start();
      expect(watchers.every((watcher) => watcher.poll === false)).toBe(true);
      ready(eventName);
      await vi.advanceTimersByTimeAsync(0);
      expect(mock.client.writeContract).toHaveBeenCalledTimes(1);
      expect(mock.client.getLogs).not.toHaveBeenCalled();
      expect(runtime!.health.snapshot().lastFinalizeSuccess?.betId).toBe("1");
    }
  );

  it("ready event wakes an already deferred PendingVRF bet", async () => {
    states.set(1n, 2);
    await start();
    runtime!.enqueue({ source: "manual", betId: 1n, receivedAt: Date.now() });
    await vi.advanceTimersByTimeAsync(500);
    expect(mock.client.writeContract).not.toHaveBeenCalled();
    states.set(1n, 3);
    ready("BetRandomReady");
    await vi.advanceTimersByTimeAsync(0);
    expect(mock.client.writeContract).toHaveBeenCalledTimes(1);
  });

  it("preserves a callback arriving while its stale PendingVRF read is busy", async () => {
    let releaseRead!: (bet: unknown) => void;
    mock.client.readContract.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseRead = resolve;
        })
    );
    await start();
    runtime!.enqueue({ source: "manual", betId: 1n, receivedAt: Date.now() });
    await vi.advanceTimersByTimeAsync(500);
    ready("BetRandomReady");
    releaseRead({ betId: 1n, requestId: 1n, state: 2, refundDeadline: 4600n });
    await vi.advanceTimersByTimeAsync(0);
    expect(mock.client.writeContract).toHaveBeenCalledTimes(1);
  });

  it("serializes writes and deduplicates both ready events while another receipt is busy", async () => {
    let releaseReceipt!: (receipt: unknown) => void;
    mock.client.waitForTransactionReceipt.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseReceipt = resolve;
        })
    );
    await start();
    ready("BetRandomReady", 1n);
    await vi.advanceTimersByTimeAsync(0);
    ready("BetRandomReady", 2n);
    ready("Fulfilled", 2n);
    await vi.advanceTimersByTimeAsync(0);
    expect(mock.client.writeContract).toHaveBeenCalledTimes(1);
    releaseReceipt({ status: "success" });
    await vi.advanceTimersByTimeAsync(0);
    expect(mock.client.writeContract).toHaveBeenCalledTimes(2);
    expect(runtime!.queue.size).toBe(0);
  });

  it("retries initial handshake failures and later restores subscriptions", async () => {
    mock.client.transport.getRpcClient.mockRejectedValueOnce(new Error("handshake refused"));
    await start();
    expect(watchers).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1999);
    expect(watchers).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(watchers).toHaveLength(3);
    ready("BetRandomReady");
    await vi.advanceTimersByTimeAsync(0);
    expect(mock.client.writeContract).toHaveBeenCalledTimes(1);
  });

  it("coalesces watcher failures, closes old watchers, and cancels retry on shutdown", async () => {
    await start();
    for (const watcher of watchers) watcher.onError(new Error("socket closed"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(close).toHaveBeenCalledTimes(1);
    expect(removers.slice(0, 3).every((remove) => remove.mock.calls.length === 1)).toBe(true);
    expect(mock.client.watchContractEvent).toHaveBeenCalledTimes(6);
    watchers[3]!.onError(new Error("socket closed again"));
    await runtime!.stop();
    runtime = undefined;
    await vi.advanceTimersByTimeAsync(3000);
    expect(mock.client.watchContractEvent).toHaveBeenCalledTimes(6);
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("stops during an unfinished handshake and closes a late connection without subscribing", async () => {
    let connected!: (client: unknown) => void;
    mock.client.transport.getRpcClient.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          connected = resolve;
        })
    );
    await start();
    await runtime!.stop();
    runtime = undefined;
    connected({ close, socket: new EventTarget() });
    await vi.advanceTimersByTimeAsync(0);
    expect(close).toHaveBeenCalledTimes(1);
    expect(mock.client.watchContractEvent).not.toHaveBeenCalled();
  });

  it("HTTP recovery still progresses during a sustained WS outage", async () => {
    mock.client.transport.getRpcClient.mockRejectedValue(new Error("offline"));
    mock.client.getLogs.mockResolvedValue([
      {
        eventName: "BetRandomReady",
        args: { positionId: 1n, requestId: 1n },
        blockNumber: 101n,
        transactionHash: hash,
        logIndex: 0
      }
    ]);
    await start();
    await vi.advanceTimersByTimeAsync(300_500);
    expect(mock.client.getLogs).toHaveBeenCalled();
    expect(runtime!.health.snapshot().lastScannedBlock).toBe("110");
    expect(mock.client.writeContract).toHaveBeenCalledTimes(1);
  });

  it("resubscribes after a real normal socket close and consumes an ABI-encoded ready log", async () => {
    vi.useRealTimers();
    mock.realWs = true;
    // Reuse the WS server implementation already installed with viem's isows transport.
    const requireViem = createRequire(createRequire(import.meta.url).resolve("viem"));
    const { WebSocketServer } = createRequire(requireViem.resolve("isows"))("ws");
    const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const connections: Array<{ socket: any; subscriptions: Map<string, string> }> = [];
    server.on("connection", (socket: any) => {
      const subscriptions = new Map<string, string>();
      connections.push({ socket, subscriptions });
      socket.on("message", (message: Buffer) => {
        const request = JSON.parse(message.toString());
        if (request.method === "eth_subscribe") {
          const id = `0x${(subscriptions.size + 1).toString(16)}`;
          subscriptions.set(request.params[1].topics[0], id);
          socket.send(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: id }));
        } else if (request.method === "eth_unsubscribe") {
          socket.send(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: true }));
        }
      });
    });
    const until = async (predicate: () => boolean) => {
      const deadline = Date.now() + 6_000;
      while (!predicate()) {
        if (Date.now() >= deadline) throw new Error("Local WebSocket test timed out");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    };
    try {
      runtime = createKeeperRuntime({
        config: { ...config, wsRpcUrl: `ws://127.0.0.1:${server.address().port}` },
        logger
      });
      await runtime.start();
      await until(() => connections[0]?.subscriptions.size === 3);
      connections[0]!.socket.close(1000);
      await until(() => connections[1]?.subscriptions.size === 3);
      const topics = encodeEventTopics({
        abi: GAME_HUB_KEEPER_ABI,
        eventName: "BetRandomReady",
        args: { positionId: 1n, requestId: 1n }
      });
      connections[1]!.socket.send(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_subscription",
          params: {
            subscription: connections[1]!.subscriptions.get(topics[0]!),
            result: {
              address: hub,
              topics,
              data: encodeAbiParameters([{ type: "bytes32" }], [hash]),
              blockNumber: "0x65",
              blockHash: hash,
              transactionHash: hash,
              transactionIndex: "0x0",
              logIndex: "0x0",
              removed: false
            }
          }
        })
      );
      await until(() => mock.client.writeContract.mock.calls.length === 1);
      expect(mock.client.getLogs).not.toHaveBeenCalled();
      expect(runtime.health.snapshot().lastEnqueued?.source).toBe("gameHub");
      expect(connections).toHaveLength(2);
    } finally {
      await runtime?.stop();
      runtime = undefined;
      for (const connection of connections) connection.socket.terminate();
      await new Promise<void>((resolve) => server.close(resolve));
    }
  }, 10_000);
});
