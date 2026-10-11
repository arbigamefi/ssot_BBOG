import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BaseError,
  CallExecutionError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeAbiParameters,
  encodeErrorResult,
  encodeEventTopics,
  HttpRequestError,
  InvalidInputRpcError,
  RpcRequestError,
  type Address,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createMemoryBetIndexStore, type BetIndexStore } from "@ssot/bet-index";
import { GAME_HUB_KEEPER_ABI } from "./abi.js";
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
const bank = "0x00000000000000000000000000000000000000b1" as Address;
const asset = "0x00000000000000000000000000000000000000c1" as Address;
const player = "0x00000000000000000000000000000000000000d1" as Address;
const zero = "0x0000000000000000000000000000000000000000" as Address;
const gameId = `0x${"11".repeat(32)}` as Hex;
const errorPrefix = `0x${"fb8f41b2"}${"00".repeat(28)}` as Hex;
const privateKey = `0x${"11".repeat(32)}` as const;
const keeper = privateKeyToAccount(privateKey).address;
const T0 = 1_800_000_000n;
const DAY = 86_400n;
const WEEK = 604_800n;
const STAKE = 1_000_000n;

const config: KeeperConfig = {
  chainId: 8453,
  gameHub: hub,
  vrfHub: hub,
  httpRpcUrl: "http://unused.invalid",
  privateKey,
  role: "primary",
  backupDelayMs: 0,
  pollIntervalMs: 0,
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
  voidGasLimit: 11_000_000n
};

function revert(functionName: string, errorName: string, args: readonly unknown[]) {
  return new BaseError(`${functionName} reverted`, {
    cause: new ContractFunctionRevertedError({
      abi: GAME_HUB_KEEPER_ABI,
      functionName,
      data: encodeErrorResult({ abi: GAME_HUB_KEEPER_ABI, errorName, args } as never)
    })
  });
}

/** What viem reports when the node halts the call out of gas (geth: -32000 "out of gas"). */
function outOfGas() {
  return new ContractFunctionExecutionError(
    new CallExecutionError(
      new InvalidInputRpcError(
        new RpcRequestError({
          body: { method: "eth_call" },
          error: { code: -32000, message: "out of gas" },
          url: "http://rpc.invalid"
        })
      ),
      {}
    ),
    { abi: GAME_HUB_KEEPER_ABI, functionName: "finalize", args: [1n] }
  );
}

function log(eventName: string, args: Record<string, unknown>, data: Hex) {
  return {
    address: hub,
    topics: encodeEventTopics({ abi: GAME_HUB_KEEPER_ABI, eventName, args } as never),
    data
  };
}

type FakeBet = { state: number; request: number; vrfRequestedAt: bigint };

/**
 * GameHub and VRFHub as far as the keeper sees them. A bet in `unbookable` fails settlement with the
 * keeper's 3.05M finalize gas; one in `settlesInVoid` succeeds only with voidBet's 10M attempt.
 */
function fakeChain() {
  const chain = {
    clock: T0 + 3_600n,
    block: 1_000n,
    cohortEnd: 0n,
    bets: new Map<bigint, FakeBet>(),
    unbookable: new Set<bigint>(),
    settlesInVoid: new Set<bigint>(),
    /** Settlement needs more than the 3.05M finalize gas, so only voidBet's attempt settles it. */
    outOfGas: new Set<bigint>(),
    blockTimestamps: new Map<bigint, bigint>(),
    gasTooLow: false,
    journal: [] as string[],
    receipts: new Map<Hex, { blockNumber: bigint; transactionHash: Hex; logs: unknown[] }>(),
    /** When set, a voidBet receipt resolves only after the test releases it. */
    holdReceipts: false,
    held: [] as Array<() => void>
  };
  const eligibleAt = (bet: FakeBet) =>
    bet.vrfRequestedAt + (bet.vrfRequestedAt <= chain.cohortEnd ? DAY : WEEK);
  const settle = (betId: bigint, txHash: Hex) => {
    const bet = chain.bets.get(betId)!;
    bet.state = 4;
    bet.request = 3;
    return [
      log(
        "BetFinalized",
        { positionId: betId },
        encodeAbiParameters(
          Array.from({ length: 4 }, () => ({ type: "uint256" as const })),
          [0n, 0n, 0n, 0n]
        )
      )
    ].map((entry, logIndex) => ({ ...entry, logIndex, transactionHash: txHash }));
  };
  mock.client = {
    getBlockNumber: vi.fn(async () => chain.block),
    getBlock: vi.fn(async (query?: { blockNumber?: bigint }) =>
      query?.blockNumber != null
        ? {
            number: query.blockNumber,
            timestamp: chain.blockTimestamps.get(query.blockNumber) ?? chain.clock
          }
        : { number: chain.block, timestamp: chain.clock }
    ),
    getLogs: vi.fn(async () => []),
    getContractEvents: vi.fn(async () => []),
    readContract: vi.fn(
      async ({ functionName, args }: { functionName: string; args?: bigint[] }) => {
        const constants: Record<string, bigint> = {
          VOID_DELAY: DAY,
          PUBLIC_VOID_DELAY: WEEK,
          VOID_SETTLEMENT_GAS: 10_000_000n,
          VOID_RESERVE_GAS: 600_000n,
          VOID_CALL_OVERHEAD: 5_000n
        };
        if (functionName in constants) return constants[functionName];
        if (functionName === "voidCohortEnd") return chain.cohortEnd;
        if (functionName === "getBetReferralPayees") return [zero, zero];
        const betId = args![0]!;
        const bet = chain.bets.get(betId)!;
        if (functionName === "getRequest") return { bank, hub, betId, state: bet.request };
        if (functionName === "getBetTerminal")
          return {
            state: bet.state,
            payoutGross: 0n,
            payoutNet: 0n,
            feeOnPayout: 0n,
            protocolFeeAccrual: 0n,
            refundAmount: 0n
          };
        return {
          betId,
          requestId: betId,
          state: bet.state,
          bank,
          asset,
          player,
          gameId,
          stake: STAKE,
          placedAt: bet.vrfRequestedAt,
          refundDeadline: bet.vrfRequestedAt + DAY,
          vrfRequestedAt: bet.vrfRequestedAt,
          randomHash: `0x${"cd".repeat(32)}`
        };
      }
    ),
    simulateContract: vi.fn(
      async ({
        functionName,
        args,
        gas
      }: {
        functionName: string;
        args: bigint[];
        gas: bigint;
      }) => {
        const betId = args[0]!;
        const bet = chain.bets.get(betId)!;
        if (functionName === "finalize") {
          if (bet.state === 4 || bet.state === 6)
            throw revert("finalize", "BadState", [betId, bet.state, 3]);
          if (chain.outOfGas.has(betId)) throw outOfGas();
          if (chain.unbookable.has(betId) || chain.settlesInVoid.has(betId))
            throw revert("finalize", "SafeERC20FailedOperation", [asset]);
          return { result: undefined };
        }
        if (functionName !== "voidBet") throw new Error(`unexpected simulation ${functionName}`);
        if (chain.clock < eligibleAt(bet))
          throw revert("voidBet", "VoidNotEligible", [betId, chain.clock, eligibleAt(bet)]);
        if (chain.gasTooLow || gas < 10_605_000n)
          throw revert("voidBet", "VoidGasTooLow", [gas, 10_605_000n]);
        return { result: !chain.settlesInVoid.has(betId) && !chain.outOfGas.has(betId) };
      }
    ),
    writeContract: vi.fn(
      async ({ functionName, args }: { functionName: string; args: bigint[] }) => {
        const betId = args[0]!;
        const txHash = `0x${(chain.receipts.size + 1).toString(16).padStart(64, "0")}` as Hex;
        chain.journal.push(`${functionName} ${betId}`);
        chain.block += 1n;
        let logs: unknown[];
        if (
          functionName === "finalize" ||
          chain.settlesInVoid.has(betId) ||
          chain.outOfGas.has(betId)
        )
          logs = settle(betId, txHash);
        else {
          const bet = chain.bets.get(betId)!;
          bet.state = 6;
          bet.request = 5;
          logs = [
            log(
              "BetVoided",
              { positionId: betId, caller: keeper },
              encodeAbiParameters([{ type: "uint256" }, { type: "bytes32" }], [STAKE, errorPrefix])
            )
          ].map((entry, logIndex) => ({ ...entry, logIndex, transactionHash: txHash }));
        }
        chain.receipts.set(txHash, { blockNumber: chain.block, transactionHash: txHash, logs });
        return txHash;
      }
    ),
    waitForTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => {
      if (chain.holdReceipts) await new Promise<void>((resolve) => chain.held.push(resolve));
      chain.journal.push(`receipt ${hash.slice(-1)}`);
      const receipt = chain.receipts.get(hash)!;
      return { status: "success", ...receipt };
    }),
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => chain.receipts.get(hash))
  };
  return chain;
}

describe("void executor", () => {
  let runtime: KeeperRuntime | undefined;
  let chain: ReturnType<typeof fakeChain>;
  let logger: KeeperLogger;
  const voidCalls = (method: "simulateContract" | "writeContract") =>
    vi
      .mocked(mock.client[method] as (q: { functionName: string }) => unknown)
      .mock.calls.map(([query]) => query as { functionName: string; args: bigint[]; gas: bigint })
      .filter((query) => query.functionName === "voidBet");
  const start = async (overrides: Partial<KeeperConfig> = {}) => {
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    runtime = createKeeperRuntime({ config: { ...config, ...overrides }, logger });
    await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
  };
  const enqueue = (...betIds: bigint[]) => {
    for (const betId of betIds)
      runtime!.enqueue({ source: "manual", betId, receivedAt: Date.now() });
  };
  const unbookable = (betId: bigint, vrfRequestedAt = T0, state = 3, request = 2) => {
    chain.bets.set(betId, { state, request, vrfRequestedAt });
    chain.unbookable.add(betId);
  };

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

  it("never calls voidBet before eligibility, rechecks settlement meanwhile, and voids at eligibleAt", async () => {
    unbookable(1n);
    await start();
    enqueue(1n);
    await vi.advanceTimersByTimeAsync(500);
    expect(voidCalls("simulateContract")).toHaveLength(0);
    expect(runtime!.health.snapshot()).toMatchObject({
      status: "running",
      voids: {
        candidateCount: 1,
        candidates: [
          {
            betId: "1",
            bank,
            vrfRequestedAt: T0.toString(),
            eligibleAt: (T0 + WEEK).toString(),
            eligible: false,
            reason: expect.stringContaining("SafeERC20FailedOperation")
          }
        ]
      }
    });
    expect(runtime!.queue.has(1n)).toBe(true);
    const finalizeSimulations = () =>
      vi
        .mocked(mock.client.simulateContract as (q: { functionName: string }) => unknown)
        .mock.calls.filter(
          ([query]) => (query as { functionName: string }).functionName === "finalize"
        ).length;
    expect(finalizeSimulations()).toBe(1);
    // A minute later the settlement is tried again.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(finalizeSimulations()).toBe(2);

    // Ten seconds before the 7-day limit the next check is scheduled exactly at it.
    chain.clock = T0 + WEEK - 10n;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(voidCalls("simulateContract")).toHaveLength(0);
    chain.clock = T0 + WEEK;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(voidCalls("simulateContract")).toHaveLength(1);
    expect(voidCalls("writeContract")).toEqual([
      expect.objectContaining({ functionName: "voidBet", args: [1n], gas: 11_000_000n })
    ]);
    expect(voidCalls("simulateContract")[0]).toMatchObject({ gas: 11_000_000n });
    expect(runtime!.health.snapshot()).toMatchObject({
      status: "running",
      voids: {
        attempts: 1,
        voided: 1,
        settled: 0,
        failed: 0,
        candidateCount: 0,
        lastOutcome: {
          betId: "1",
          outcome: "voided",
          txHash: `0x${"1".padStart(64, "0")}`,
          settlementErrorPrefix: errorPrefix
        }
      }
    });
    expect(logger.info).toHaveBeenCalledWith(
      "casino.void.mined",
      expect.objectContaining({ betId: "1", outcome: "voided" })
    );
    // The queued bet is reconciled as terminal right away.
    await vi.advanceTimersByTimeAsync(500);
    expect(runtime!.queue.has(1n)).toBe(false);
    expect(await mock.store!.getBet({ chainId: 8453, gameHub: hub, betId: 1n })).toMatchObject({
      state: "voided",
      stake: STAKE.toString(),
      refundAmount: STAKE.toString(),
      payout: "0",
      payoutGross: "0",
      voidedTxHash: `0x${"1".padStart(64, "0")}`,
      voidCaller: keeper.toLowerCase(),
      voidSettlementErrorPrefix: errorPrefix,
      lastEventName: "BetVoided"
    });
  });

  it("attempts every eligible bet one at a time, oldest VRF request first, each after the previous receipt", async () => {
    unbookable(1n, T0 + 200n);
    unbookable(2n, T0);
    unbookable(3n, T0 + 100n);
    await start();
    enqueue(1n, 2n, 3n);
    await vi.advanceTimersByTimeAsync(500);
    expect(runtime!.health.snapshot().voids?.candidates.map((item) => item.betId)).toEqual([
      "2",
      "3",
      "1"
    ]);
    // A void window over the whole cohort makes all three eligible at once.
    chain.cohortEnd = T0 + 3_600n;
    chain.clock = T0 + DAY + 300n;
    chain.holdReceipts = true;
    await vi.advanceTimersByTimeAsync(60_000);
    for (let i = 0; i < 3; ++i) {
      expect(chain.held).toHaveLength(1);
      chain.held.shift()!();
      await vi.advanceTimersByTimeAsync(0);
    }
    await vi.advanceTimersByTimeAsync(1_000);
    expect(chain.journal).toEqual([
      "voidBet 2",
      "receipt 1",
      "voidBet 3",
      "receipt 2",
      "voidBet 1",
      "receipt 3"
    ]);
    expect(runtime!.health.snapshot().voids).toMatchObject({
      attempts: 3,
      voided: 3,
      candidateCount: 0
    });
  });

  it("reads a settlement inside voidBet from the receipt", async () => {
    chain.bets.set(4n, { state: 3, request: 2, vrfRequestedAt: T0 });
    chain.settlesInVoid.add(4n);
    chain.clock = T0 + WEEK;
    await start();
    enqueue(4n);
    await vi.advanceTimersByTimeAsync(500);
    expect(chain.journal).toEqual(["voidBet 4", "receipt 1"]);
    expect(runtime!.health.snapshot().voids).toMatchObject({
      attempts: 1,
      voided: 0,
      settled: 1,
      lastOutcome: { betId: "4", outcome: "settled" }
    });
    expect(await mock.store!.getBet({ chainId: 8453, gameHub: hub, betId: 4n })).toMatchObject({
      state: "finalized",
      lastEventName: "BetFinalized"
    });
  });

  it("voids a PendingVRF bet whose canonical request was received", async () => {
    unbookable(5n, T0, 2, 2);
    chain.clock = T0 + WEEK;
    await start();
    enqueue(5n);
    await vi.advanceTimersByTimeAsync(500);
    expect(chain.journal).toEqual(["voidBet 5", "receipt 1"]);
    expect(chain.bets.get(5n)?.state).toBe(6);
  });

  it("keeps finalizing first: a bet whose settlement works is finalized, never voided", async () => {
    chain.bets.set(6n, { state: 3, request: 2, vrfRequestedAt: T0 });
    chain.clock = T0 + 2n * WEEK;
    await start();
    enqueue(6n);
    await vi.advanceTimersByTimeAsync(500);
    expect(chain.journal).toEqual(["finalize 6", "receipt 1"]);
    expect(voidCalls("simulateContract")).toHaveLength(0);
  });

  it("keeps a transport failure of the finalize simulation a finalize failure, not a void candidate", async () => {
    unbookable(7n);
    chain.clock = T0 + WEEK;
    const simulate = mock.client.simulateContract as (query: unknown) => Promise<unknown>;
    mock.client.simulateContract = vi.fn(async (query: { functionName: string }) => {
      if (query.functionName === "finalize")
        throw new HttpRequestError({ body: {}, status: 503, url: "https://rpc.invalid/key" });
      return simulate(query);
    });
    await start();
    enqueue(7n);
    await vi.advanceTimersByTimeAsync(500);
    expect(runtime!.health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["finalize"],
      voids: { candidateCount: 0 }
    });
    expect(chain.journal).toEqual([]);
  });

  it("treats VoidGasTooLow as a configuration error and sends nothing", async () => {
    unbookable(8n);
    chain.clock = T0 + WEEK;
    chain.gasTooLow = true;
    await start();
    enqueue(8n);
    await vi.advanceTimersByTimeAsync(500);
    expect(chain.journal).toEqual([]);
    expect(runtime!.health.snapshot()).toMatchObject({
      status: "degraded",
      // Seven days unbooked also raises the unbooked-result alert.
      degradedBy: expect.arrayContaining(["void", "unbookedResult"]),
      voids: {
        failed: 1,
        configurationError: expect.stringContaining("KEEPER_VOID_GAS_LIMIT=11000000"),
        lastOutcome: { betId: "8", outcome: "configurationError" }
      }
    });
    expect(logger.error).toHaveBeenCalledWith(
      "casino.void.configuration_error",
      expect.objectContaining({ betId: "8" })
    );
  });

  it("refuses to start with a gas limit below the GameHub floor", async () => {
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    runtime = createKeeperRuntime({ config: { ...config, voidGasLimit: 10_754_999n }, logger });
    await expect(runtime.start()).rejects.toThrow(
      /KEEPER_VOID_GAS_LIMIT=10754999 must be at least 10755000/
    );
  });

  it("starts while the GameHub constants are unreadable and checks them before the first void", async () => {
    const read = mock.client.readContract as (query: { functionName: string }) => Promise<unknown>;
    let unavailable = true;
    mock.client.readContract = vi.fn(async (query: { functionName: string }) => {
      if (unavailable && query.functionName.startsWith("VOID_")) throw new Error("RPC unavailable");
      return read(query);
    });
    await start();
    expect(logger.warn).toHaveBeenCalledWith(
      "casino.void.parameters_unavailable",
      expect.objectContaining({ error: "Error: RPC unavailable" })
    );
    unavailable = false;
    unbookable(9n);
    chain.clock = T0 + WEEK;
    enqueue(9n);
    await vi.advanceTimersByTimeAsync(500);
    expect(chain.journal).toEqual(["voidBet 9", "receipt 1"]);
  });

  it("alerts an unbooked result more than one hour after it was received", async () => {
    unbookable(10n);
    chain.blockTimestamps.set(900n, T0 + 600n);
    chain.clock = T0 + 600n + 3_000n;
    await start();
    runtime!.enqueue({
      source: "vrfHub",
      betId: 10n,
      resultBlockNumber: 900n,
      receivedAt: Date.now()
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(runtime!.health.snapshot()).toMatchObject({
      status: "running",
      voids: {
        oldestUnbooked: {
          betId: "10",
          receivedAt: (T0 + 600n).toString(),
          receivedFrom: "result",
          ageSeconds: "3000",
          eligibleAt: (T0 + WEEK).toString()
        }
      }
    });
    chain.clock = T0 + 600n + 3_601n;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runtime!.health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["unbookedResult"],
      voids: { oldestUnbooked: { betId: "10", ageSeconds: "3601" } }
    });
    // The asset recovers: the bet settles normally and the alert clears.
    chain.unbookable.delete(10n);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(chain.journal).toEqual(["finalize 10", "receipt 1"]);
    expect(runtime!.health.snapshot()).toMatchObject({ status: "running", degradedBy: undefined });
    expect(runtime!.health.snapshot().voids?.oldestUnbooked).toBeUndefined();
  });

  it("dates a result seen through no event by its VRF request, which can only overstate the age", async () => {
    unbookable(11n);
    chain.clock = T0 + 3_601n;
    await start();
    enqueue(11n);
    await vi.advanceTimersByTimeAsync(500);
    expect(runtime!.health.snapshot()).toMatchObject({
      status: "degraded",
      degradedBy: ["unbookedResult"],
      voids: {
        oldestUnbooked: { betId: "11", receivedFrom: "request", receivedAt: T0.toString() }
      }
    });
  });

  it("voids nothing after a start until lifecycle recovery reaches the head it saw first", async () => {
    unbookable(12n);
    chain.clock = T0 + WEEK;
    await start({ startBlock: 950n, casinoRecoveryStartBlock: 950n, scanMaxChunksPerPass: 1 });
    enqueue(12n);
    await vi.advanceTimersByTimeAsync(500);
    expect(runtime!.health.snapshot().voids).toMatchObject({
      startupRecoveryComplete: false,
      candidates: [{ betId: "12", eligible: true }]
    });
    expect(voidCalls("simulateContract")).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledWith(
      "casino.void.waiting_for_startup_recovery",
      expect.objectContaining({ startupHead: "1000" })
    );
    // One 10-block chunk per lifecycle pass, a pass a minute: blocks 950 to 1000 take five more.
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(voidCalls("simulateContract")).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runtime!.health.snapshot().voids?.startupRecoveryComplete).toBe(true);
    expect(chain.journal).toEqual(["voidBet 12", "receipt 1"]);
  });

  it("settles inside voidBet a bet whose settlement ran out of the finalize gas", async () => {
    chain.bets.set(13n, { state: 3, request: 2, vrfRequestedAt: T0 });
    chain.outOfGas.add(13n);
    chain.clock = T0 + 3_600n;
    await start();
    enqueue(13n);
    await vi.advanceTimersByTimeAsync(500);
    expect(runtime!.health.snapshot().voids?.candidates).toMatchObject([
      { betId: "13", eligible: false, reason: expect.stringContaining("out of gas") }
    ]);
    expect(chain.journal).toEqual([]);
    chain.clock = T0 + WEEK;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(chain.journal).toEqual(["voidBet 13", "receipt 1"]);
    expect(runtime!.health.snapshot().voids).toMatchObject({
      settled: 1,
      voided: 0,
      lastOutcome: { betId: "13", outcome: "settled" }
    });
    expect(chain.bets.get(13n)?.state).toBe(4);
  });
});
