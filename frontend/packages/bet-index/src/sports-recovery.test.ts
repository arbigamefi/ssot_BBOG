import { describe, expect, it } from "vitest";
import { createMemorySportsRecoveryStore } from "./sports-recovery.js";

const scope = { chainId: 8453, sportsHub: "0x0000000000000000000000000000000000000001" as const };
const otherHub = { ...scope, sportsHub: "0x0000000000000000000000000000000000000002" as const };
const otherChain = { ...scope, chainId: 84532 };

describe("sports recovery persistence contract", () => {
  it("isolates market work and ticket history by both chain and hub", async () => {
    const store = createMemorySportsRecoveryStore();
    for (const [i, target] of [scope, otherHub, otherChain].entries()) {
      await store.enqueue({ ...target, marketId: 7n, requiredBlock: BigInt(i), availableAt: 0 });
      await store.writeTickets(target, [{ marketId: 7n, ticketId: BigInt(i + 1) }]);
    }
    expect((await store.due(scope, 0, 10)).map((work) => work.requiredBlock)).toEqual([0n]);
    expect(await store.ticketPage(scope, 7n, 0n, 10)).toEqual([1n]);
    expect(await store.ticketPage(otherHub, 7n, 0n, 10)).toEqual([2n]);
    expect(await store.ticketPage(otherChain, 7n, 0n, 10)).toEqual([3n]);
  });

  it("ignores a stale acknowledgement after another worker or new event updates the market", async () => {
    const store = createMemorySportsRecoveryStore();
    await store.enqueue({ ...scope, marketId: 7n, requiredBlock: 10n, availableAt: 0 });
    const [old] = await store.due(scope, 0, 1);
    await store.enqueue({ ...scope, marketId: 7n, requiredBlock: 20n, availableAt: 0 });
    await store.checkpoint(old!, { complete: true, ticketCursor: 1n, availableAt: 0, attempts: 0 });
    expect((await store.due(scope, 0, 1))[0]?.requiredBlock).toBe(20n);
  });

  it("does not let an acknowledgement for deleted work delete a newly created job", async () => {
    const store = createMemorySportsRecoveryStore();
    const input = { ...scope, marketId: 7n, requiredBlock: 10n, availableAt: 0 };
    await store.enqueue(input);
    const [old] = await store.due(scope, 0, 1);
    const complete = { complete: true, ticketCursor: 1n, availableAt: 0, attempts: 0 };
    await store.checkpoint(old!, complete);
    await store.enqueue(input);
    await store.checkpoint(old!, complete);
    expect(await store.due(scope, 0, 1)).toHaveLength(1);
  });

  it("paginates numerically and replays TicketPlaced batches without duplicate IDs", async () => {
    const store = createMemorySportsRecoveryStore();
    const tickets = [10n, 2n, 1n, 2n ** 255n].map((ticketId) => ({ marketId: 7n, ticketId }));
    await store.writeTickets(scope, tickets);
    await store.writeTickets(scope, tickets);
    expect(await store.ticketPage(scope, 7n, 0n, 2)).toEqual([1n, 2n]);
    expect(await store.ticketPage(scope, 7n, 2n, 2)).toEqual([10n, 2n ** 255n]);
  });

  it("resets pagination only when widening coverage, never for duplicate events or an older worker", async () => {
    const store = createMemorySportsRecoveryStore();
    const input = {
      ...scope,
      marketId: 7n,
      requiredBlock: 200n,
      availableAt: 0,
      coverageStartBlock: 100n
    };
    await store.enqueue(input);
    const [first] = await store.due(scope, 0, 1);
    await store.checkpoint(first!, { ticketCursor: 200n, availableAt: 0, attempts: 0 });
    await store.enqueue(input);
    expect((await store.due(scope, 0, 1))[0]?.ticketCursor).toBe(200n);
    await store.enqueue({ ...input, coverageStartBlock: 50n });
    expect((await store.due(scope, 0, 1))[0]?.ticketCursor).toBe(0n);
    await store.enqueue(input);
    expect((await store.due(scope, 0, 1))[0]?.coverageStartBlock).toBe(50n);
  });
});
