import { describe, expect, it, vi } from "vitest";
import type { Address, PublicClient } from "viem";
import { createPayableClaimer, type PayableClaim } from "./payables.js";
import { KeeperHealthReporter } from "./health.js";
import type { KeeperConfig } from "./types.js";

const bank = "0x0000000000000000000000000000000000000001" as const;
const alice = "0x00000000000000000000000000000000000000a1" as Address;
const bob = "0x00000000000000000000000000000000000000b0" as Address;
const hash = `0x${"ab".repeat(32)}` as const;

function fixture(chunkSize = 1_000n, maxChunks = 5) {
  const state = {
    head: 100n,
    events: [] as { blockNumber: bigint; player: Address; removed?: boolean }[],
    owed: new Map<string, bigint>(),
    refuse: new Set<string>(),
    finalizedOwed: new Map<string, bigint>(),
    finalizedHead: undefined as bigint | undefined,
    clock: 0
  };
  const getContractEvents = vi.fn(
    async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) =>
      state.events
        .filter((event) => event.blockNumber >= fromBlock && event.blockNumber <= toBlock)
        .map((event) => ({ removed: event.removed ?? false, args: { player: event.player } }))
  );
  const client = {
    getBlock: vi.fn(async (args?: { blockTag?: string }) => ({
      number: args?.blockTag === "finalized" ? (state.finalizedHead ?? state.head) : state.head
    })),
    readContract: vi.fn(
      async ({ args, blockNumber }: { args: readonly [Address]; blockNumber?: bigint }) =>
        (state.finalizedHead != null && blockNumber === state.finalizedHead
          ? state.finalizedOwed
          : state.owed
        ).get(args[0].toLowerCase()) ?? 0n
    ),
    getContractEvents
  } as unknown as PublicClient;
  const claim = vi.fn<PayableClaim>(async (_bank: Address, player: Address) => {
    if (state.refuse.has(player.toLowerCase())) return { status: "refused", reason: "blocked" };
    state.owed.set(player.toLowerCase(), 0n);
    return { status: "success" as const, txHash: hash, blockNumber: ++state.head };
  });
  const claimer = createPayableClaimer({
    bank,
    origin: 10n,
    chunkSize,
    maxChunks,
    now: () => state.clock
  });
  return { state, client, claim, claimer, getContractEvents };
}

describe("player payable claims", () => {
  it("claims only players with a positive on-chain balance, once", async () => {
    const f = fixture();
    f.state.events.push({ blockNumber: 20n, player: alice }, { blockNumber: 30n, player: bob });
    f.state.owed.set(alice, 5n);
    const health = await f.claimer.run(f.client, f.claim);
    expect(f.claim).toHaveBeenCalledTimes(1);
    expect(f.claim).toHaveBeenCalledWith(bank, alice);
    expect(health).toEqual({
      bank,
      scannedThrough: "100",
      finalizedBlock: "100",
      headBlock: "100",
      caughtUp: true,
      pending: 0,
      error: undefined
    });

    await f.claimer.run(f.client, f.claim);
    expect(f.claim).toHaveBeenCalledTimes(1);
  });

  it("keeps a refused claim owed and retries it with backoff instead of every pass", async () => {
    const f = fixture();
    f.state.events.push({ blockNumber: 20n, player: alice });
    f.state.owed.set(alice, 5n);
    f.state.refuse.add(alice);
    const first = await f.claimer.run(f.client, f.claim);
    expect(first.pending).toBe(1);
    expect(first.error).toContain("blocked");
    expect(first.claimError).toBeUndefined();

    f.state.clock = 60_000;
    const backedOff = await f.claimer.run(f.client, f.claim);
    expect(backedOff.error).toBe(first.error);
    expect(backedOff.claimError).toBeUndefined();
    expect(f.claim).toHaveBeenCalledTimes(1);

    f.state.refuse.clear();
    f.state.clock = 5 * 60_000;
    const done = await f.claimer.run(f.client, f.claim);
    expect(f.claim).toHaveBeenCalledTimes(2);
    expect(done.pending).toBe(0);
    expect(f.state.owed.get(alice)).toBe(0n);
  });

  it("waits for finality before discovering replacements and ignores removed logs", async () => {
    const f = fixture();
    f.state.finalizedHead = 76n;
    await f.claimer.run(f.client, f.claim);
    // Replaced unfinalized events cannot fall behind the finalized discovery cursor.
    f.state.events.push(
      { blockNumber: 90n, player: bob },
      { blockNumber: 95n, player: alice, removed: true }
    );
    f.state.owed.set(bob, 7n);
    f.state.owed.set(alice, 3n);
    f.state.head = 110n;
    f.state.finalizedHead = 100n;
    await f.claimer.run(f.client, f.claim);
    expect(f.getContractEvents.mock.calls.at(-1)?.[0]).toMatchObject({
      fromBlock: 77n,
      toBlock: 100n
    });
    expect(f.claim).toHaveBeenCalledTimes(1);
    expect(f.claim).toHaveBeenCalledWith(bank, bob);
  });

  it("reports missing discovery origin instead of scanning from genesis", async () => {
    const claimer = createPayableClaimer({ bank, chunkSize: 1_000n, maxChunks: 5 });
    const f = fixture();
    const health = await claimer.run(f.client, f.claim);
    expect(health.error).toBe("Payable discovery requires the release origin block");
    expect(f.getContractEvents).not.toHaveBeenCalled();
  });
});

describe("payable recovery boundaries", () => {
  it("advances even when a pass is smaller than the reorg overlap", async () => {
    const f = fixture(10n, 1);
    f.state.events.push({ blockNumber: 50n, player: alice });
    f.state.owed.set(alice, 5n);
    for (let i = 0; i < 12; ++i) await f.claimer.run(f.client, f.claim);
    expect(f.claim).toHaveBeenCalledWith(bank, alice);
    expect(f.getContractEvents.mock.calls.some(([r]) => r.toBlock >= 100n)).toBe(true);
  });

  it("rechecks old debt until the zero balance is finalized, including after a claim reorg", async () => {
    const f = fixture();
    f.state.events.push({ blockNumber: 20n, player: alice });
    f.state.owed.set(alice, 5n);
    f.state.finalizedHead = 90n;
    f.state.finalizedOwed.set(alice, 5n);
    await f.claimer.run(f.client, f.claim);
    expect(f.claim).toHaveBeenCalledTimes(1);
    f.state.owed.set(alice, 5n); // The claim block was orphaned; creation is outside the overlap.
    f.state.head = 102n;
    await f.claimer.run(f.client, f.claim);
    expect(f.claim).toHaveBeenCalledTimes(2);
    f.state.finalizedHead = f.state.head;
    f.state.finalizedOwed.set(alice, 0n);
    await f.claimer.run(f.client, f.claim);
    const reads = vi.mocked(f.client.readContract).mock.calls.length;
    await f.claimer.run(f.client, f.claim);
    expect(vi.mocked(f.client.readContract).mock.calls.length).toBe(reads);
  });

  it("retains an externally paid balance until finality too", async () => {
    const f = fixture();
    f.state.events.push({ blockNumber: 20n, player: alice });
    f.state.finalizedHead = 90n;
    f.state.finalizedOwed.set(alice, 5n);
    await f.claimer.run(f.client, f.claim);
    f.state.owed.set(alice, 5n);
    await f.claimer.run(f.client, f.claim);
    expect(f.claim).toHaveBeenCalledTimes(1);
  });

  it("does not let finality watchers starve later players", async () => {
    const f = fixture();
    f.state.finalizedHead = 90n;
    for (let i = 1; i <= 21; ++i) {
      const player = `0x${i.toString(16).padStart(40, "0")}` as Address;
      f.state.events.push({ blockNumber: 20n, player });
      f.state.owed.set(player, 5n);
      f.state.finalizedOwed.set(player, 5n);
    }
    await f.claimer.run(f.client, f.claim);
    await f.claimer.run(f.client, f.claim);
    expect(f.claim).toHaveBeenCalledTimes(21);
  });
});

it("does not retire a new debt based on a zero finalized before its creation", async () => {
  const f = fixture();
  f.state.finalizedHead = 50n;
  f.state.events.push({ blockNumber: 80n, player: alice });
  f.state.owed.set(alice, 5n);
  await f.claimer.run(f.client, f.claim);
  expect(f.claim).not.toHaveBeenCalled();
  f.state.finalizedHead = 80n;
  f.state.finalizedOwed.set(alice, 5n);
  await f.claimer.run(f.client, f.claim);
  f.state.owed.set(alice, 5n); // Claim reorg while the finalized creation still owes the debt.
  f.state.head = 102n;
  await f.claimer.run(f.client, f.claim);
  expect(f.claim).toHaveBeenCalledTimes(2);
});

it("eventually claims a replacement behind a bounded scan cursor while the head moves", async () => {
  const f = fixture(10n, 1);
  const claimer = createPayableClaimer({ bank, origin: 1n, chunkSize: 10n, maxChunks: 1 });
  f.state.finalizedHead = 76n;
  for (let i = 0; i < 10; ++i) await claimer.run(f.client, f.claim);
  f.state.head = 101n;
  f.state.finalizedHead = 77n;
  await claimer.run(f.client, f.claim);
  // Replace block 85 after the old overlap scanner passed it: a 16-block reorg.
  f.state.events.push({ blockNumber: 85n, player: alice });
  f.state.owed.set(alice, 5n);
  for (let i = 0; i < 25; ++i) {
    f.state.head += 9n;
    f.state.finalizedHead = f.state.head - 24n;
    await claimer.run(f.client, f.claim);
  }
  let state;
  for (let i = 0; i < 100; ++i) state = await claimer.run(f.client, f.claim);
  expect(state).toMatchObject({ caughtUp: true, pending: 0 });
  expect(f.claim).toHaveBeenCalledWith(bank, alice);
  expect(f.state.owed.get(alice)).toBe(0n);
});

it.each([
  "RPC send unavailable",
  "insufficient funds for gas",
  "receipt timed out",
  "SafeERC20FailedOperation"
])("keeps an actionable %s failure visible throughout backoff until recovery", async (message) => {
  const f = fixture();
  f.state.events.push({ blockNumber: 20n, player: alice });
  f.state.owed.set(alice, 5n);
  f.claim.mockRejectedValueOnce(new Error(message));
  const health = new KeeperHealthReporter({
    config: {
      pollIntervalMs: 15_000,
      bankProviderLedgerPools: [],
      chainId: 84532,
      role: "primary",
      gameHub: bank,
      vrfHub: bank
    } as unknown as KeeperConfig,
    keeper: bank
  });
  await health.recordRunning(100n, 0);
  const first = await f.claimer.run(f.client, f.claim);
  await health.recordPayables([first], 0);
  expect(health.snapshot()).toMatchObject({ status: "degraded", degradedBy: ["payables"] });
  expect(first.error).toContain(message);
  f.state.clock = 60_000;
  const backedOff = await f.claimer.run(f.client, f.claim);
  await health.recordPayables([backedOff], 0);
  expect(backedOff.error).toBe(first.error);
  expect(health.snapshot().status).toBe("degraded");
  expect(f.claim).toHaveBeenCalledTimes(1);
  f.state.clock = 5 * 60_000;
  const recovered = await f.claimer.run(f.client, f.claim);
  await health.recordPayables([recovered], 0);
  expect(recovered.error).toBeUndefined();
  expect(health.snapshot().status).toBe("running");
  expect(f.state.owed.get(alice)).toBe(0n);
});

describe("finalized payable discovery", () => {
  it("reports progress against an unchanged finalized target while latest keeps moving", async () => {
    const f = fixture(10n, 1);
    f.state.finalizedHead = 30n;
    f.state.events.push({ blockNumber: 40n, player: alice });
    f.state.owed.set(alice, 5n);
    expect(await f.claimer.run(f.client, f.claim)).toMatchObject({
      scannedThrough: "19",
      finalizedBlock: "30",
      headBlock: "100",
      caughtUp: false
    });
    f.state.head = 200n;
    expect(await f.claimer.run(f.client, f.claim)).toMatchObject({
      scannedThrough: "29",
      caughtUp: false
    });
    expect(await f.claimer.run(f.client, f.claim)).toMatchObject({
      scannedThrough: "30",
      caughtUp: true
    });
    const scans = f.getContractEvents.mock.calls.length;
    f.state.head = 300n;
    expect(await f.claimer.run(f.client, f.claim)).toMatchObject({
      finalizedBlock: "30",
      headBlock: "300",
      caughtUp: true
    });
    expect(f.getContractEvents).toHaveBeenCalledTimes(scans);
    expect(f.claim).not.toHaveBeenCalled();
    f.state.finalizedHead = 40n;
    await f.claimer.run(f.client, f.claim);
    expect(f.claim).toHaveBeenCalledWith(bank, alice);
  });

  it.each(["missing number", "unsupported tag"])(
    "fails closed when finality has %s",
    async (failure) => {
      const f = fixture();
      await f.claimer.run(f.client, f.claim);
      const scans = f.getContractEvents.mock.calls.length;
      f.client.getBlock = vi.fn(async (args?: { blockTag?: string }) => {
        if (args?.blockTag === "finalized") {
          if (failure === "unsupported tag") throw new Error("finalized tag unavailable");
          return { number: null };
        }
        return { number: f.state.head };
      }) as unknown as typeof f.client.getBlock;
      expect(await f.claimer.run(f.client, f.claim)).toMatchObject({
        caughtUp: false,
        readError: expect.stringContaining("finalized")
      });
      expect(f.getContractEvents).toHaveBeenCalledTimes(scans);
    }
  );

  it("keeps a finalized height regression unhealthy until the provider recovers", async () => {
    const f = fixture();
    f.state.finalizedHead = 90n;
    await f.claimer.run(f.client, f.claim);
    f.state.finalizedHead = 80n;
    for (let i = 0; i < 2; ++i) {
      expect(await f.claimer.run(f.client, f.claim)).toMatchObject({
        caughtUp: false,
        scannedThrough: "90",
        finalizedBlock: "80",
        readError: "Error: Payable finalized block regressed from 90 to 80"
      });
    }
    expect(f.getContractEvents).toHaveBeenCalledTimes(1);
    f.state.finalizedHead = 90n;
    expect(await f.claimer.run(f.client, f.claim)).toMatchObject({ caughtUp: true });
  });

  it("does not checkpoint a failed finalized log page", async () => {
    const f = fixture(10n, 1);
    f.getContractEvents.mockRejectedValueOnce(new Error("logs unavailable"));
    expect(await f.claimer.run(f.client, f.claim)).toMatchObject({
      scannedThrough: "9",
      caughtUp: false
    });
    await f.claimer.run(f.client, f.claim);
    expect(f.getContractEvents.mock.calls.map(([query]) => query.fromBlock)).toEqual([10n, 10n]);
  });
});

describe("payable failure reconciliation", () => {
  it("preserves a read failure when the next bounded pass has not rechecked that player", async () => {
    const f = fixture();
    f.state.finalizedHead = 90n;
    const failingPlayer = `0x${(20).toString(16).padStart(40, "0")}` as Address;
    let recovered = false;
    for (let i = 1; i <= 21; ++i) {
      f.state.events.push({
        blockNumber: 20n,
        player: `0x${i.toString(16).padStart(40, "0")}` as Address
      });
    }
    f.client.readContract = vi.fn(async ({ args }: { args: readonly [Address] }) => {
      if (args[0] === failingPlayer && !recovered) throw new Error("balance read unavailable");
      return 0n;
    }) as unknown as typeof f.client.readContract;
    const first = await f.claimer.run(f.client, f.claim);
    expect(first.readError).toContain("balance read unavailable");
    expect((await f.claimer.run(f.client, f.claim)).readError).toBe(first.readError);
    recovered = true;
    expect((await f.claimer.run(f.client, f.claim)).readError).toBeUndefined();
  });

  it("retains a delivery failure when the next simulation refuses, and clears after an external payment", async () => {
    const f = fixture();
    f.state.events.push({ blockNumber: 20n, player: alice });
    f.state.owed.set(alice, 5n);
    f.claim.mockRejectedValueOnce(new Error("receipt unavailable"));
    const first = await f.claimer.run(f.client, f.claim);
    f.state.clock = 5 * 60_000;
    f.state.refuse.add(alice);
    expect(await f.claimer.run(f.client, f.claim)).toMatchObject({ claimError: first.claimError });
    f.state.owed.set(alice, 0n);
    f.state.clock = 15 * 60_000;
    const cleared = await f.claimer.run(f.client, f.claim);
    expect(cleared.error).toBeUndefined();
    expect(cleared.claimError).toBeUndefined();
    expect(cleared.pending).toBe(0);
    expect(f.claim).toHaveBeenCalledTimes(2);
  });

  it("keeps receipt reverts actionable during backoff", async () => {
    const f = fixture();
    f.state.events.push({ blockNumber: 20n, player: alice });
    f.state.owed.set(alice, 5n);
    f.claim.mockResolvedValueOnce({ status: "reverted", txHash: hash, blockNumber: 101n });
    const first = await f.claimer.run(f.client, f.claim);
    expect(first.claimError).toContain("transaction reverted");
    expect((await f.claimer.run(f.client, f.claim)).claimError).toBe(first.claimError);
  });

  it("does not let a successful claim for another player erase an unresolved delivery failure", async () => {
    const f = fixture();
    f.state.events.push({ blockNumber: 20n, player: alice }, { blockNumber: 30n, player: bob });
    f.state.owed.set(alice, 5n);
    f.state.owed.set(bob, 7n);
    f.claim.mockRejectedValueOnce(new Error("send unavailable"));
    const first = await f.claimer.run(f.client, f.claim);
    expect(first.claimError).toContain(alice);
    expect(f.state.owed.get(bob)).toBe(0n);
    expect((await f.claimer.run(f.client, f.claim)).claimError).toBe(first.claimError);
  });
});
