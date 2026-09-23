import { describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import { createMemoryBetIndexStore, type BetIndexEvent } from "./index.js";
import { enrichFinalizedBetEvents } from "./terminal-refund.js";

const terminal = {
  state: 4,
  payoutGross: 200_000n,
  payoutNet: 196_000n,
  feeOnPayout: 4_000n,
  protocolFeeAccrual: 2_000n,
  refundAmount: 100_000n
};
const event: BetIndexEvent = {
  chainId: 84532,
  gameHub: "0x0000000000000000000000000000000000000001",
  blockNumber: 10n,
  txHash: `0x${"aa".repeat(32)}`,
  logIndex: 1,
  eventName: "BetFinalized",
  args: {
    positionId: 9n,
    payoutGross: terminal.payoutGross,
    payoutNet: terminal.payoutNet,
    feeOnPayout: terminal.feeOnPayout,
    protocolFeeAccrual: terminal.protocolFeeAccrual
  }
};
const clientWith = (readContract: ReturnType<typeof vi.fn>) =>
  ({ readContract }) as unknown as Pick<PublicClient, "readContract">;

describe("settled refund enrichment", () => {
  it.each([0n, 100_000n])(
    "persists refund %s separately and preserves it on raw replay",
    async (refundAmount) => {
      const read = vi.fn().mockResolvedValue({ ...terminal, refundAmount });
      const enriched = await enrichFinalizedBetEvents(clientWith(read), [event]);
      expect(read).toHaveBeenCalledWith(
        expect.objectContaining({
          address: event.gameHub,
          functionName: "getBetTerminal",
          args: [9n]
        })
      );
      expect(event.args.refundAmount).toBeUndefined();
      const store = createMemoryBetIndexStore();
      await store.writeGameHubEvents(enriched);
      await store.writeGameHubEvents([event, ...enriched, event]);
      expect(await store.getBet({ chainId: 84532, betId: 9 })).toMatchObject({
        state: "finalized",
        payout: "196000",
        refundAmount: refundAmount.toString()
      });
    }
  );

  it.each([
    { ...terminal, state: 3 },
    { ...terminal, refundAmount: undefined },
    { ...terminal, payoutNet: 195_000n },
    { ...terminal, payoutGross: 0n },
    { ...terminal, feeOnPayout: 0n },
    { ...terminal, protocolFeeAccrual: 0n }
  ])("rejects incomplete or mismatched authority %#", async (receipt) => {
    await expect(
      enrichFinalizedBetEvents(clientWith(vi.fn().mockResolvedValue(receipt)), [event])
    ).rejects.toThrow(/terminal/);
  });

  it("propagates unavailable authority instead of assuming zero", async () => {
    await expect(
      enrichFinalizedBetEvents(
        clientWith(vi.fn().mockRejectedValue(new Error("RPC unavailable"))),
        [event]
      )
    ).rejects.toThrow("RPC unavailable");
  });

  it("does not add a second refund to a BetRefunded event", async () => {
    const read = vi.fn();
    const refunded = {
      ...event,
      eventName: "BetRefunded" as const,
      args: { positionId: 9n, refundAmount: 200_000n }
    };
    const events = await enrichFinalizedBetEvents(clientWith(read), [refunded]);
    expect(read).not.toHaveBeenCalled();
    const store = createMemoryBetIndexStore();
    await store.writeGameHubEvents(events);
    expect(await store.getBet({ chainId: 84532, betId: 9 })).toMatchObject({
      state: "refunded",
      payout: "200000",
      refundAmount: "200000"
    });
  });
});
