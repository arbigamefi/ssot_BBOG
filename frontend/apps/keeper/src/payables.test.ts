import { describe, expect, it, vi } from "vitest";
import type { Address, PublicClient } from "viem";
import { createPayableClaimer } from "./payables.js";

const bank = "0x0000000000000000000000000000000000000001" as const;
const alice = "0x00000000000000000000000000000000000000a1" as Address;
const bob = "0x00000000000000000000000000000000000000b0" as Address;
const hash = `0x${"ab".repeat(32)}` as const;

function fixture() {
  const state = {
    head: 100n,
    events: [] as { blockNumber: bigint; player: Address; removed?: boolean }[],
    owed: new Map<string, bigint>(),
    refuse: new Set<string>(),
    clock: 0
  };
  const getContractEvents = vi.fn(
    async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) =>
      state.events
        .filter((event) => event.blockNumber >= fromBlock && event.blockNumber <= toBlock)
        .map((event) => ({ removed: event.removed ?? false, args: { player: event.player } }))
  );
  const client = {
    getBlock: vi.fn(async () => ({ number: state.head })),
    readContract: vi.fn(
      async ({ args }: { args: readonly [Address] }) => state.owed.get(args[0].toLowerCase()) ?? 0n
    ),
    getContractEvents
  } as unknown as PublicClient;
  const claim = vi.fn(async (_bank: Address, player: Address) => {
    if (state.refuse.has(player.toLowerCase())) throw new Error("blocked");
    state.owed.set(player.toLowerCase(), 0n);
    return { status: "success" as const, txHash: hash };
  });
  const claimer = createPayableClaimer({
    bank,
    origin: 10n,
    chunkSize: 1_000n,
    maxChunks: 5,
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

    f.state.clock = 60_000;
    await f.claimer.run(f.client, f.claim);
    expect(f.claim).toHaveBeenCalledTimes(1);

    f.state.refuse.clear();
    f.state.clock = 5 * 60_000;
    const done = await f.claimer.run(f.client, f.claim);
    expect(f.claim).toHaveBeenCalledTimes(2);
    expect(done.pending).toBe(0);
    expect(f.state.owed.get(alice)).toBe(0n);
  });

  it("rescans the reorg window and ignores removed logs", async () => {
    const f = fixture();
    await f.claimer.run(f.client, f.claim);
    // An event re-included inside the already scanned window is still found.
    f.state.events.push(
      { blockNumber: 90n, player: bob },
      { blockNumber: 95n, player: alice, removed: true }
    );
    f.state.owed.set(bob, 7n);
    f.state.owed.set(alice, 3n);
    f.state.head = 110n;
    await f.claimer.run(f.client, f.claim);
    expect(f.getContractEvents.mock.calls.at(-1)?.[0]).toMatchObject({
      fromBlock: 77n,
      toBlock: 110n
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
