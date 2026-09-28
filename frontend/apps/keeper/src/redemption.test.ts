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
    expect(await reconcileRedemptionBank(bank, f.deps)).toEqual({ bank });
    expect(f.deps.activate).toHaveBeenCalledOnce();
    expect(
      f.readContract.mock.calls.map(([query]) => (query as { blockNumber?: bigint }).blockNumber)
    ).toEqual([10n, 10n, 10n, 10n, 11n, 11n]);
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
  const state = { head: 120n, time: 1601n, failEpoch: 0n };
  const events = Array.from({ length: count }, (_, i) => ({
    args: { batchId: BigInt(i + 1) },
    blockNumber: 100n,
    blockHash: hash,
    logIndex: i,
    removed: false
  }));
  const holds = new Map(events.map((log) => [log.args.batchId, 1n]));
  const getBlock = vi.fn(async () => ({ number: state.head, timestamp: state.time }));
  const getContractEvents = vi.fn(
    async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) =>
      events.filter((log) => log.blockNumber >= fromBlock && log.blockNumber <= toBlock)
  );
  const readContract = vi.fn(
    async ({ functionName, args }: { functionName: string; args: readonly bigint[] }) => {
      const id = args[0]!;
      if (id === state.failEpoch) throw new Error("pocket RPC failed");
      if (functionName === "redeemBatch")
        return { priced: holds.has(id), activatedAt: holds.has(id) ? 1000n : 0n };
      if (functionName === "recoveryEpoch")
        return {
          snapshotSupply: holds.has(id) ? 100n : 0n,
          remainingHolds: holds.get(id) ?? 0n,
          remainingReserve: (holds.get(id) ?? 0n) * 10n
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
  it("progresses when the rewind is larger than one scan budget", async () => {
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
    for (let i = 0; i < 6; i++) await f.monitor.scan(f.client);
    expect(f.getContractEvents.mock.calls.at(-1)?.[0].toBlock).toBe(125n);
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
  it("removes orphan activations on an empty canonical overlap page", async () => {
    const f = pocketFixture({ maxChunks: 3 });
    await f.monitor.scan(f.client);
    f.events.length = 0;
    expect((await f.monitor.scan(f.client)).pockets).toEqual([]);
  });
  it("reopens an old pocket when its recent terminal transaction is reorged", async () => {
    const f = pocketFixture({ maxChunks: 3 });
    f.holds.set(1n, 0n);
    expect((await f.monitor.scan(f.client)).pockets[0]?.remainingHolds).toBe("0");
    // The activation is older than the overlap; retaining the recent terminal read is essential.
    f.state.head = 140n;
    await f.monitor.scan(f.client);
    f.holds.set(1n, 1n);
    f.state.head = 141n;
    expect((await f.monitor.scan(f.client)).pockets[0]?.remainingHolds).toBe("1");
  });
  it("a fresh nonexistent epoch invalidates discovery until the event is replayed", async () => {
    const f = pocketFixture({ maxChunks: 3 });
    await f.monitor.scan(f.client);
    f.holds.delete(1n);
    const result = await f.monitor.scan(f.client);
    expect(result.pockets).toEqual([]);
    expect(result.discovery).toMatchObject({
      caughtUp: false,
      error: expect.stringContaining("disappeared")
    });
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
});
