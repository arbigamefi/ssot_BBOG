import { describe, expect, it, vi } from "vitest";
import {
  mapSportsMarketState,
  mapSportsTicketState,
  terminalizeSportsMarket,
  type SportsMarketRead,
  type SportsTicketRead
} from "./sports-terminalizer.js";

function market(state: SportsMarketRead["state"]): SportsMarketRead {
  return { marketId: 7n, state };
}

function ticket(ticketId: bigint, state: SportsTicketRead["state"] = "held"): SportsTicketRead {
  return { ticketId, state };
}

function deps(overrides: Partial<Parameters<typeof terminalizeSportsMarket>[1]> = {}) {
  return {
    findTicketIds: vi.fn(async () => [1n, 2n]),
    readMarket: vi.fn(async () => market("resolved")),
    readResult: vi.fn(async () => ({ challenged: false, finalizesAt: 1, marketId: 7n })),
    readTicket: vi.fn(async (ticketId: bigint) => ticket(ticketId)),
    simulateFinalizeResult: vi.fn(async () => undefined),
    simulateRefundTicket: vi.fn(async () => undefined),
    simulateSettleTicket: vi.fn(async () => undefined),
    waitReceipt: vi.fn(async () => ({ status: "success" as const })),
    writeFinalizeResult: vi.fn(async () => "0xfinalize" as `0x${string}`),
    writeRefundTicket: vi.fn(async () => "0xrefund" as `0x${string}`),
    writeSettleTicket: vi.fn(async () => "0xsettle" as `0x${string}`),
    ...overrides
  };
}

describe("sports terminalizer", () => {
  it("maps SportsHub enum states", () => {
    expect(mapSportsMarketState(5)).toBe("resultProposed");
    expect(mapSportsMarketState(7)).toBe("resolved");
    expect(mapSportsTicketState(1)).toBe("held");
    expect(mapSportsTicketState(4)).toBe("voided");
  });

  it("waits when result finality is still pending", async () => {
    const d = deps({
      now: vi.fn(() => 1_000),
      readMarket: vi.fn(async () => market("resultProposed")),
      readResult: vi.fn(async () => ({ challenged: false, finalizesAt: 2, marketId: 7n }))
    });

    const outcome = await terminalizeSportsMarket(7n, d);

    expect(outcome).toEqual({
      finalizesAt: 2,
      kind: "skipped",
      reason: "finality-pending",
      state: "resultProposed"
    });
    expect(d.writeFinalizeResult).not.toHaveBeenCalled();
    expect(d.writeSettleTicket).not.toHaveBeenCalled();
  });

  it("finalizes a mature result and settles held tickets", async () => {
    const d = deps({
      now: vi.fn().mockReturnValueOnce(2_000).mockReturnValue(2_250),
      readMarket: vi
        .fn()
        .mockResolvedValueOnce(market("resultProposed"))
        .mockResolvedValue(market("resolved"))
    });

    const outcome = await terminalizeSportsMarket(7n, d);

    expect(outcome).toEqual({
      finalizeTxHash: "0xfinalize",
      kind: "terminalized",
      latencyMs: 250,
      marketState: "resolved",
      refunded: 0,
      settled: 2,
      skipped: 0
    });
    expect(d.writeFinalizeResult).toHaveBeenCalledWith(7n);
    expect(d.writeSettleTicket).toHaveBeenCalledTimes(2);
  });

  it("refunds held tickets for voided markets and skips already terminal tickets", async () => {
    const d = deps({
      readMarket: vi.fn(async () => market("voided")),
      readTicket: vi
        .fn()
        .mockResolvedValueOnce(ticket(1n, "held"))
        .mockResolvedValueOnce(ticket(2n, "refunded"))
    });

    const outcome = await terminalizeSportsMarket(7n, d);

    expect(outcome).toMatchObject({
      kind: "terminalized",
      marketState: "voided",
      refunded: 1,
      settled: 0,
      skipped: 1
    });
    expect(d.writeRefundTicket).toHaveBeenCalledWith(1n);
    expect(d.writeRefundTicket).toHaveBeenCalledTimes(1);
  });

  it("retries rather than settling when ticket discovery fails", async () => {
    // Discovery that cannot prove it found every ticket must not hand back a
    // partial list: the market would be settled as complete and the tickets it
    // missed would stay held with no second attempt. A throw has to surface as
    // a retryable failure, and nothing may be written in the meantime.
    const d = deps({
      findTicketIds: vi.fn(async () => {
        throw new Error("sports ticket log discovery failed for market 7: range too wide");
      })
    });

    const outcome = await terminalizeSportsMarket(7n, d);

    expect(outcome).toMatchObject({ kind: "failed", retryable: true });
    expect(outcome).toHaveProperty("reason", expect.stringContaining("discovery failed"));
    expect(d.writeSettleTicket).not.toHaveBeenCalled();
    expect(d.writeRefundTicket).not.toHaveBeenCalled();
  });

  it("does not treat an empty ticket list as a failure", async () => {
    // The counterpart: a market that genuinely has no tickets is skipped, not
    // retried forever.
    const d = deps({ findTicketIds: vi.fn(async () => []) });

    const outcome = await terminalizeSportsMarket(7n, d);

    expect(outcome).toMatchObject({ kind: "skipped", reason: "no-tickets" });
  });
});
