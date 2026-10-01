import { describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import { createPocketMonitor, readRedemptionBank, reconcileRedemptionBank } from "./redemption.js";

const bank = "0x0000000000000000000000000000000000000001" as const;
const hash = `0x${"ab".repeat(32)}` as const;
function fixture() {
  const state = {
    epoch: 1n,
    shares: 10n,
    cutoff: 1000n,
    holds: 3n,
    paused: false,
    time: 1601n,
    block: 10n
  };
  const getBlock = vi.fn(async () => ({ number: state.block, timestamp: state.time }));
  const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
    switch (functionName) {
      case "currentEpoch":
        return state.epoch;
      case "redeemBatch":
        return { cutoff: state.cutoff, priced: false, shares: state.shares };
      case "activeOpenHolds":
        return 0n;
      case "MAX_ACTIVE_HOLDS":
        return 128n;
      case "minStake":
        return 1_000_000n;
      case "openHolds":
        return state.holds;
      case "riskInPaused":
        return state.paused;
      default:
        throw new Error(`Unexpected read ${functionName}`);
    }
  });
  const deps = {
    publicClient: { getBlock, readContract } as unknown as PublicClient,
    activate: vi.fn(async () => {
      state.epoch++;
      state.shares = 0n;
      state.block++;
      return { status: "success" as const, txHash: hash };
    })
  };
  return { state, getBlock, readContract, deps };
}

describe("queued redemption reconciliation", () => {
  it("activates with old holds and verifies immediate pricing at a fresh numbered block", async () => {
    const f = fixture();
    expect(await reconcileRedemptionBank(bank, f.deps)).toMatchObject({
      bank,
      activeOpenHolds: "0",
      maxActiveHolds: "128",
      capacityHeadroom: "128"
    });
    expect(f.deps.activate).toHaveBeenCalledOnce();
    expect(
      f.readContract.mock.calls.map(([query]) => (query as { blockNumber?: bigint }).blockNumber)
    ).toEqual([10n, 10n, 10n, 10n, 10n, 10n, 10n, 11n, 11n, 11n, 11n, 11n]);
  });
  it.each(["paused", "early", "empty"])("skips a %s queue", async (kind) => {
    const f = fixture();
    if (kind === "paused") f.state.paused = true;
    if (kind === "early") f.state.time = 999n;
    if (kind === "empty") f.state.shares = 0n;
    await reconcileRedemptionBank(bank, f.deps);
    expect(f.deps.activate).not.toHaveBeenCalled();
  });
  it("activates at the exact cutoff", async () => {
    const f = fixture();
    f.state.time = 1000n;
    await reconcileRedemptionBank(bank, f.deps);
    expect(f.deps.activate).toHaveBeenCalledOnce();
  });
  it.each(["activated", "cancelled", "paused"])("accepts a concurrent %s race", async (race) => {
    const f = fixture();
    f.deps.activate.mockImplementation(async () => {
      if (race === "activated") f.state.epoch++;
      if (race === "cancelled") f.state.shares = 0n;
      if (race === "paused") f.state.paused = true;
      throw new Error("NoBatchDue");
    });
    expect((await reconcileRedemptionBank(bank, f.deps)).error).toBeUndefined();
  });
  it("reports an ineffective receipt", async () => {
    const f = fixture();
    f.deps.activate.mockResolvedValue({ status: "success", txHash: hash });
    expect((await reconcileRedemptionBank(bank, f.deps)).error).toContain("without advancing");
  });
  it("does not send when the Bank read fails", async () => {
    const f = fixture();
    f.readContract.mockRejectedValue(new Error("RPC unavailable"));
    expect((await reconcileRedemptionBank(bank, f.deps)).error).toContain("RPC unavailable");
    expect(f.deps.activate).not.toHaveBeenCalled();
  });
  it("refuses unnumbered reads without falling back to latest", async () => {
    const f = fixture();
    f.getBlock.mockResolvedValue({ number: null, timestamp: 1n } as never);
    await expect(readRedemptionBank(bank, f.deps.publicClient)).rejects.toThrow(
      "numbered chain block"
    );
    expect(f.readContract).not.toHaveBeenCalled();
  });
});

function pocketFixture({ count = 1, chunkSize = 10n, maxChunks = 2, pollLimit = 50 } = {}) {
  const state = {
    head: 120n,
    finalizedHead: 120n,
    time: 1601n,
    failEpoch: 0n,
    finalizedHolds: undefined as Map<bigint, bigint> | undefined
  };
  const events = Array.from({ length: count }, (_, i) => ({
    args: { batchId: BigInt(i + 1) },
    blockNumber: 100n,
    blockHash: hash,
    logIndex: i,
    removed: false
  }));
  const holds = new Map(events.map((log) => [log.args.batchId, 1n]));
  const getBlock = vi.fn(async (query?: { blockTag?: string }) => ({
    number: query?.blockTag === "finalized" ? state.finalizedHead : state.head,
    timestamp: state.time
  }));
  const getContractEvents = vi.fn(
    async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) =>
      events.filter((log) => log.blockNumber >= fromBlock && log.blockNumber <= toBlock)
  );
  const readContract = vi.fn(
    async ({
      functionName,
      args,
      blockNumber
    }: {
      functionName: string;
      args: readonly bigint[];
      blockNumber: bigint;
    }) => {
      const id = args[0]!;
      const observed = blockNumber <= state.finalizedHead ? (state.finalizedHolds ?? holds) : holds;
      if (id === state.failEpoch) throw new Error("pocket RPC failed");
      if (functionName === "redeemBatch")
        return { priced: observed.has(id), activatedAt: observed.has(id) ? 1000n : 0n };
      if (functionName === "recoveryEpoch")
        return {
          snapshotSupply: observed.has(id) ? 100n : 0n,
          remainingHolds: observed.get(id) ?? 0n,
          remainingReserve: (observed.get(id) ?? 0n) * 10n
        };
      throw new Error(`Unexpected ${functionName}`);
    }
  );
  const client = { getBlock, getContractEvents, readContract } as unknown as PublicClient;
  const makeMonitor = () =>
    createPocketMonitor({ bank, origin: 100n, chunkSize, maxChunks, pollLimit });
  return {
    state,
    events,
    holds,
    getBlock,
    getContractEvents,
    readContract,
    client,
    makeMonitor,
    monitor: makeMonitor()
  };
}

describe("historical recovery pocket monitoring", () => {
  it("replays all historical activations on restart in bounded pages", async () => {
    const f = pocketFixture();
    const first = await f.monitor.scan(f.client);
    expect(first.discovery).toMatchObject({ scannedThrough: "119", caughtUp: false });
    expect(first.pockets).toMatchObject([{ epochId: "1", openedAt: "1000", ageSeconds: 601 }]);
    expect((await f.monitor.scan(f.client)).discovery.caughtUp).toBe(true);
    const restarted = f.makeMonitor();
    expect((await restarted.scan(f.client)).discovery.caughtUp).toBe(false);
    expect(f.getContractEvents.mock.calls.map(([q]) => q.fromBlock)).toEqual([
      100n,
      110n,
      120n,
      100n,
      110n
    ]);
    for (const [q] of f.readContract.mock.calls) expect(q).toMatchObject({ blockNumber: 120n });
  });
  it("progresses within a small finalized scan budget without rescanning completed pages", async () => {
    const f = pocketFixture({ chunkSize: 5n, maxChunks: 1 });
    for (let i = 0; i < 5; i++) await f.monitor.scan(f.client);
    expect(f.getContractEvents.mock.calls.map(([q]) => q.fromBlock)).toEqual([
      100n,
      105n,
      110n,
      115n,
      120n
    ]);
    f.state.head = 125n;
    f.state.finalizedHead = 125n;
    for (let i = 0; i < 6; i++) await f.monitor.scan(f.client);
    expect(f.getContractEvents.mock.calls.at(-1)?.[0].toBlock).toBe(125n);
    expect(f.getContractEvents).toHaveBeenCalledTimes(6);
  });
  it("retains unvisited failures and overdue pockets across bounded polls", async () => {
    const f = pocketFixture({ count: 3, maxChunks: 3, pollLimit: 1 });
    f.state.failEpoch = 1n;
    const first = await f.monitor.scan(f.client);
    expect(first.discovery.caughtUp).toBe(false);
    expect(first.pockets[0]?.error).toContain("RPC failed");
    f.state.failEpoch = 0n;
    const second = await f.monitor.scan(f.client);
    expect(second.pockets[0]?.error).toContain("RPC failed");
    expect(second.pockets[1]?.ageSeconds).toBe(601);
    f.state.time = 1700n;
    const third = await f.monitor.scan(f.client);
    expect(third.pockets[1]?.ageSeconds).toBe(700);
    expect(third.discovery.caughtUp).toBe(false);
    expect((await f.monitor.scan(f.client)).discovery.caughtUp).toBe(true);
  });
  it("never discovers an activation orphaned before finality", async () => {
    const f = pocketFixture({ maxChunks: 3 });
    f.state.finalizedHead = 99n;
    expect((await f.monitor.scan(f.client)).pockets).toEqual([]);
    expect(f.getContractEvents).not.toHaveBeenCalled();
    f.events.length = 0;
    f.state.finalizedHead = 120n;
    expect((await f.monitor.scan(f.client)).pockets).toEqual([]);
  });
  it("retains a pocket through an unfinalized terminal reorg and retires only finalized zero", async () => {
    const f = pocketFixture({ maxChunks: 3 });
    f.state.finalizedHead = 100n;
    f.state.finalizedHolds = new Map(f.holds);
    f.holds.set(1n, 0n);
    expect((await f.monitor.scan(f.client)).pockets[0]?.remainingHolds).toBe("1");
    f.state.head = 140n;
    await f.monitor.scan(f.client);
    f.holds.set(1n, 1n);
    f.state.head = 141n;
    expect((await f.monitor.scan(f.client)).pockets[0]?.remainingHolds).toBe("1");
    f.holds.set(1n, 0n);
    f.state.finalizedHead = 141n;
    f.state.finalizedHolds.set(1n, 0n);
    expect((await f.monitor.scan(f.client)).pockets).toEqual([]);
  });
  it("keeps a disappeared finalized epoch visible as an error", async () => {
    const f = pocketFixture({ maxChunks: 3 });
    await f.monitor.scan(f.client);
    f.holds.delete(1n);
    const result = await f.monitor.scan(f.client);
    expect(result.pockets).toMatchObject([
      { epochId: "1", error: expect.stringContaining("Finalized pocket activation disappeared") }
    ]);
    expect(f.getContractEvents).toHaveBeenCalledTimes(3);
  });
  it("reports missing discovery origin without any RPC or transaction", async () => {
    const f = pocketFixture();
    const monitor = createPocketMonitor({ bank, chunkSize: 10n, maxChunks: 2 });
    expect((await monitor.scan(f.client)).discovery).toMatchObject({
      caughtUp: false,
      error: expect.stringContaining("release origin")
    });
    expect(f.getContractEvents).not.toHaveBeenCalled();
  });

  it("discovers an in-window replacement behind the old overlap cursor once finalized", async () => {
    const f = pocketFixture({ count: 0, chunkSize: 10n, maxChunks: 1 });
    const monitor = createPocketMonitor({ bank, origin: 1n, chunkSize: 10n, maxChunks: 1 });
    f.state.head = 100n;
    f.state.finalizedHead = 76n;
    for (let i = 0; i < 10; ++i) await monitor.scan(f.client);
    f.state.head = 101n;
    f.state.finalizedHead = 77n;
    await monitor.scan(f.client);
    // Block 85 is replaced after the old bounded overlap read [77, 86]. It is not final yet.
    f.events.push({
      args: { batchId: 1n },
      blockNumber: 85n,
      blockHash: hash,
      logIndex: 0,
      removed: false
    });
    f.holds.set(1n, 1n);
    for (let i = 0; i < 25; ++i) {
      f.state.head += 9n;
      f.state.finalizedHead = f.state.head - 24n;
      const calls = f.getContractEvents.mock.calls.length;
      await monitor.scan(f.client);
      expect(f.getContractEvents.mock.calls.length - calls).toBeLessThanOrEqual(1);
      expect(f.getContractEvents.mock.calls.at(-1)?.[0].toBlock).toBeLessThanOrEqual(
        f.state.finalizedHead
      );
    }
    let actual;
    for (let i = 0; i < 100; ++i) actual = await monitor.scan(f.client);
    expect(actual!.discovery).toMatchObject({
      caughtUp: true,
      scannedThrough: "302",
      finalizedBlock: "302",
      headBlock: "326"
    });
    expect(actual!.pockets).toMatchObject([
      { epochId: "1", remainingHolds: "1", remainingReserve: "10", ageSeconds: 601 }
    ]);
  });

  it.each(["unavailable", "unnumbered", "regressed"])(
    "keeps %s finality actionable without losing known pockets",
    async (failure) => {
      const f = pocketFixture({ maxChunks: 3 });
      await f.monitor.scan(f.client);
      const queries = f.getContractEvents.mock.calls.length;
      if (failure === "regressed") f.state.finalizedHead = 119n;
      else
        f.getBlock.mockImplementation(async (query) => {
          if (query?.blockTag === "finalized") {
            if (failure === "unavailable") throw new Error("finalized RPC unavailable");
            return { number: null, timestamp: f.state.time } as never;
          }
          return { number: f.state.head, timestamp: f.state.time };
        });
      const actual = await f.monitor.scan(f.client);
      expect(actual.discovery).toMatchObject({
        caughtUp: false,
        error: expect.stringMatching(/finalized/)
      });
      expect(actual.pockets).toMatchObject([{ epochId: "1", remainingHolds: "1" }]);
      expect(f.getContractEvents).toHaveBeenCalledTimes(queries);
    }
  );
});
