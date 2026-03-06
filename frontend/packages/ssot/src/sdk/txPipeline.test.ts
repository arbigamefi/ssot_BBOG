import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseError, type Hex, type Address } from "viem";
import { createTxPipeline, isTransientError, type JournalSink, type TxJournalEntry } from "./txPipeline";

// ——— Mock viem parseEventLogs ———
vi.mock("viem", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    parseEventLogs: vi.fn(() => [{ args: { betId: 42n } }]),
  };
});

// ——— Helpers ———
const TX_HASH = "0xabc123" as Hex;
const RECEIPT = { blockNumber: 100n, status: "success" as const, logs: [] };
const REVERTED_RECEIPT = { blockNumber: 101n, status: "reverted" as const, logs: [] };
const ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;

function mockPublicClient(overrides?: Partial<Record<string, unknown>>) {
  return {
    simulateContract: vi.fn().mockResolvedValue({ request: { mock: true } }),
    waitForTransactionReceipt: vi.fn().mockResolvedValue(RECEIPT),
    ...overrides,
  } as any;
}

function mockWalletClient(overrides?: Partial<Record<string, unknown>>) {
  return {
    writeContract: vi.fn().mockResolvedValue(TX_HASH),
    ...overrides,
  } as any;
}

const BASE_PARAMS = {
  chainId: 84532,
  releaseDigest: "0xdeadbeef",
  action: "TEST",
  address: "0x0000000000000000000000000000000000000001" as Address,
  abi: [] as any,
  functionName: "testFn",
  args: [] as readonly unknown[],
};

/** Create a BaseError that looks like an HttpRequestError */
function makeHttpRequestError(): BaseError {
  return new BaseError("HTTP request failed", { name: "HttpRequestError" });
}

/** Create a BaseError that looks like an RpcRequestError with a given code */
function makeRpcRequestError(code: number): BaseError {
  const err = new BaseError("RPC request failed", { name: "RpcRequestError" });
  (err as any).code = code;
  return err;
}

describe("createTxPipeline", () => {
  let journal: TxJournalEntry[];
  let journalSink: JournalSink;

  beforeEach(() => {
    journal = [];
    journalSink = (entry) => journal.push(entry);
    vi.clearAllMocks();
  });

  // ——— simulateAndWrite ———
  describe("simulateAndWrite", () => {
    it("simulates then writes and returns ok result", async () => {
      const pub = mockPublicClient();
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({ journal: journalSink });

      const result = await pipeline.simulateAndWrite({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
      });

      expect(result.ok).toBe(true);
      expect(result.txHash).toBe(TX_HASH);
      expect(pub.simulateContract).toHaveBeenCalledOnce();
      expect(wal.writeContract).toHaveBeenCalledOnce();
      expect(pub.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: TX_HASH });
    });

    it("records journal entries: submitted → mined", async () => {
      const pub = mockPublicClient();
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({ journal: journalSink });

      await pipeline.simulateAndWrite({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
      });

      expect(journal).toHaveLength(2);
      expect(journal[0]!.status).toBe("submitted");
      expect(journal[0]!.ok).toBe(true);
      expect(journal[1]!.status).toBe("mined");
      expect(journal[1]!.blockNumber).toBe(100);
    });

    it("returns error result when simulate rejects", async () => {
      const pub = mockPublicClient({
        simulateContract: vi.fn().mockRejectedValue(new Error("simulate fail")),
      });
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({ journal: journalSink });

      const result = await pipeline.simulateAndWrite({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("UNKNOWN");
    });

    it("records failed journal entry on error", async () => {
      const pub = mockPublicClient({
        simulateContract: vi.fn().mockRejectedValue(new Error("boom")),
      });
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({ journal: journalSink });

      await pipeline.simulateAndWrite({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
      });

      expect(journal).toHaveLength(1);
      expect(journal[0]!.status).toBe("failed");
      expect(journal[0]!.ok).toBe(false);
    });

    it("passes value to simulateContract", async () => {
      const pub = mockPublicClient();
      const wal = mockWalletClient();
      const pipeline = createTxPipeline();

      await pipeline.simulateAndWrite({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
        value: 100n,
      });

      expect(pub.simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ value: 100n })
      );
    });
  });

  // ——— writeNoSimulate ———
  describe("writeNoSimulate", () => {
    it("writes without simulating and returns ok result", async () => {
      const pub = mockPublicClient();
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({ journal: journalSink });

      const result = await pipeline.writeNoSimulate({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
      });

      expect(result.ok).toBe(true);
      expect(result.txHash).toBe(TX_HASH);
      expect(pub.simulateContract).not.toHaveBeenCalled();
      expect(wal.writeContract).toHaveBeenCalledOnce();
    });

    it("records journal entries: submitted → mined", async () => {
      const pub = mockPublicClient();
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({ journal: journalSink });

      await pipeline.writeNoSimulate({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
      });

      expect(journal).toHaveLength(2);
      expect(journal[0]!.status).toBe("submitted");
      expect(journal[1]!.status).toBe("mined");
    });

    it("returns error result when writeContract rejects", async () => {
      const pub = mockPublicClient();
      const wal = mockWalletClient({
        writeContract: vi.fn().mockRejectedValue(new Error("user rejected")),
      });
      const pipeline = createTxPipeline({ journal: journalSink });

      const result = await pipeline.writeNoSimulate({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ——— On-chain revert detection ———
  describe("on-chain revert detection", () => {
    it("simulateAndWrite returns ok:false with TX_REVERTED when receipt.status is reverted", async () => {
      const pub = mockPublicClient({
        waitForTransactionReceipt: vi.fn().mockResolvedValue(REVERTED_RECEIPT),
      });
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({ journal: journalSink, config: { minIntervalMs: 0 } });

      const result = await pipeline.simulateAndWrite({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
      });

      expect(result.ok).toBe(false);
      expect(result.txHash).toBe(TX_HASH);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("TX_REVERTED");
      expect(result.error!.severity).toBe("error");
    });

    it("simulateAndWrite journals submitted → failed on revert", async () => {
      const pub = mockPublicClient({
        waitForTransactionReceipt: vi.fn().mockResolvedValue(REVERTED_RECEIPT),
      });
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({ journal: journalSink, config: { minIntervalMs: 0 } });

      await pipeline.simulateAndWrite({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
      });

      expect(journal).toHaveLength(2);
      expect(journal[0]!.status).toBe("submitted");
      expect(journal[0]!.ok).toBe(true);
      expect(journal[1]!.status).toBe("failed");
      expect(journal[1]!.ok).toBe(false);
      expect(journal[1]!.errorCode).toBe("TX_REVERTED");
      expect(journal[1]!.blockNumber).toBe(101);
    });

    it("writeNoSimulate returns ok:false with TX_REVERTED when receipt.status is reverted", async () => {
      const pub = mockPublicClient({
        waitForTransactionReceipt: vi.fn().mockResolvedValue(REVERTED_RECEIPT),
      });
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({ journal: journalSink, config: { minIntervalMs: 0 } });

      const result = await pipeline.writeNoSimulate({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
      });

      expect(result.ok).toBe(false);
      expect(result.txHash).toBe(TX_HASH);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("TX_REVERTED");
    });

    it("writeNoSimulate journals submitted → failed on revert", async () => {
      const pub = mockPublicClient({
        waitForTransactionReceipt: vi.fn().mockResolvedValue(REVERTED_RECEIPT),
      });
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({ journal: journalSink, config: { minIntervalMs: 0 } });

      await pipeline.writeNoSimulate({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
      });

      expect(journal).toHaveLength(2);
      expect(journal[0]!.status).toBe("submitted");
      expect(journal[0]!.ok).toBe(true);
      expect(journal[1]!.status).toBe("failed");
      expect(journal[1]!.ok).toBe(false);
      expect(journal[1]!.errorCode).toBe("TX_REVERTED");
      expect(journal[1]!.blockNumber).toBe(101);
    });
  });

  // ——— extractEventArgs ———
  describe("extractEventArgs", () => {
    it("extracts event args from receipt logs", () => {
      const pipeline = createTxPipeline();
      const args = pipeline.extractEventArgs({
        abi: [] as any,
        receiptLogs: [],
        eventName: "BetPlaced",
      });

      // Our mock returns [{ args: { betId: 42n } }]
      expect(args).toEqual([{ betId: 42n }]);
    });
  });

  // ——— No journal ———
  describe("without journal", () => {
    it("does not throw when journal is not provided", async () => {
      const pub = mockPublicClient();
      const wal = mockWalletClient();
      const pipeline = createTxPipeline();

      const result = await pipeline.simulateAndWrite({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
      });

      expect(result.ok).toBe(true);
    });
  });

  // ——— Timeout behavior ———
  describe("timeout behavior", () => {
    it("simulateAndWrite returns TX_TIMEOUT when receipt exceeds timeout", async () => {
      const pub = mockPublicClient({
        // waitForTransactionReceipt never resolves (hangs forever)
        waitForTransactionReceipt: vi.fn().mockReturnValue(new Promise(() => {})),
      });
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({
        journal: journalSink,
        config: { receiptTimeoutMs: 50, minIntervalMs: 0 },
      });

      const result = await pipeline.simulateAndWrite({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("TX_TIMEOUT");
      expect(result.error!.retryable).toBe(true);

      // Journal: submitted → timeout
      expect(journal).toHaveLength(2);
      expect(journal[0]!.status).toBe("submitted");
      expect(journal[1]!.status).toBe("timeout");
      expect(journal[1]!.ok).toBe(false);
    });

    it("writeNoSimulate returns TX_TIMEOUT when receipt exceeds timeout", async () => {
      const pub = mockPublicClient({
        waitForTransactionReceipt: vi.fn().mockReturnValue(new Promise(() => {})),
      });
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({
        journal: journalSink,
        config: { receiptTimeoutMs: 50, minIntervalMs: 0 },
      });

      const result = await pipeline.writeNoSimulate({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
      });

      expect(result.ok).toBe(false);
      expect(result.error!.code).toBe("TX_TIMEOUT");

      // Journal: submitted → timeout
      expect(journal).toHaveLength(2);
      expect(journal[0]!.status).toBe("submitted");
      expect(journal[1]!.status).toBe("timeout");
    });
  });

  // ——— Retry behavior ———
  describe("retry behavior", () => {
    it("retries transient simulate error then succeeds", async () => {
      const simMock = vi.fn()
        .mockRejectedValueOnce(makeHttpRequestError())
        .mockResolvedValueOnce({ request: { mock: true } });
      const pub = mockPublicClient({ simulateContract: simMock });
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({
        journal: journalSink,
        config: { maxRetries: 1, retryDelayMs: 10, minIntervalMs: 0 },
      });

      const result = await pipeline.simulateAndWrite({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
      });

      expect(result.ok).toBe(true);
      expect(simMock).toHaveBeenCalledTimes(2);
    });

    it("does NOT retry non-transient error", async () => {
      const simMock = vi.fn().mockRejectedValue(new Error("revert: InsufficientBalance"));
      const pub = mockPublicClient({ simulateContract: simMock });
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({
        journal: journalSink,
        config: { maxRetries: 1, retryDelayMs: 10, minIntervalMs: 0 },
      });

      const result = await pipeline.simulateAndWrite({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
      });

      expect(result.ok).toBe(false);
      expect(simMock).toHaveBeenCalledTimes(1);
    });

    it("fails after exhausting retries on transient error", async () => {
      const simMock = vi.fn().mockRejectedValue(makeHttpRequestError());
      const pub = mockPublicClient({ simulateContract: simMock });
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({
        journal: journalSink,
        config: { maxRetries: 1, retryDelayMs: 10, minIntervalMs: 0 },
      });

      const result = await pipeline.simulateAndWrite({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
      });

      expect(result.ok).toBe(false);
      // initial attempt + 1 retry = 2 calls
      expect(simMock).toHaveBeenCalledTimes(2);
    });
  });

  // ——— Config override ———
  describe("config override", () => {
    it("custom maxRetries merges with defaults", async () => {
      const simMock = vi.fn().mockRejectedValue(makeHttpRequestError());
      const pub = mockPublicClient({ simulateContract: simMock });
      const wal = mockWalletClient();
      const pipeline = createTxPipeline({
        journal: journalSink,
        config: { maxRetries: 3, retryDelayMs: 10, minIntervalMs: 0 },
      });

      const result = await pipeline.simulateAndWrite({
        ...BASE_PARAMS,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
      });

      expect(result.ok).toBe(false);
      // initial attempt + 3 retries = 4 calls
      expect(simMock).toHaveBeenCalledTimes(4);
    });
  });
});

// ——— isTransientError (standalone, no pipeline needed) ———
describe("isTransientError", () => {
  it("returns true for HttpRequestError", () => {
    expect(isTransientError(makeHttpRequestError())).toBe(true);
  });

  it("returns true for RpcRequestError with code -32005 (rate limit)", () => {
    expect(isTransientError(makeRpcRequestError(-32005))).toBe(true);
  });

  it("returns true for RpcRequestError with code -32603 (internal error)", () => {
    expect(isTransientError(makeRpcRequestError(-32603))).toBe(true);
  });

  it("returns false for RpcRequestError with other code", () => {
    expect(isTransientError(makeRpcRequestError(-32000))).toBe(false);
  });

  it("returns false for plain Error", () => {
    expect(isTransientError(new Error("network fail"))).toBe(false);
  });
});
