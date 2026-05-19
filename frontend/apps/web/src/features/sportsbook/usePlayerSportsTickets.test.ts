import { describe, expect, it } from "vitest";
import type { SportsTicketRow } from "@ssot/bet-index";

import { mergeSportsTicketRows, playerSportsTicketsQueryKey } from "./usePlayerSportsTickets";

function row(ticketId: string, updatedBlock: number): SportsTicketRow {
  return {
    chainId: 84532,
    id: `84532:sports:${ticketId}`,
    lastEventName: "TicketPlaced",
    lastTxHash: "0xabc",
    state: "held",
    ticketId,
    updatedAt: updatedBlock,
    updatedBlock
  } as SportsTicketRow;
}

describe("sportsbook player ticket helpers", () => {
  it("uses one stable query key shape for player ticket caches", () => {
    expect(playerSportsTicketsQueryKey({ chainId: 84532, limit: 50, player: "0xabc" })).toEqual([
      "ssot",
      "sportsbook",
      "tickets",
      "player",
      { chainId: 84532, limit: 50, player: "0xabc" }
    ]);
  });

  it("upserts optimistic rows ahead of indexed rows", () => {
    const merged = mergeSportsTicketRows([row("1", 10)], row("2", Number.MAX_SAFE_INTEGER));
    expect(merged.map((item) => item.ticketId)).toEqual(["2", "1"]);
  });

  it("replaces an existing optimistic row with the same id", () => {
    const optimistic = row("2", Number.MAX_SAFE_INTEGER);
    const indexed = { ...row("2", 20), state: "settled" as const, payout: "100" };
    const merged = mergeSportsTicketRows([optimistic], indexed);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ ticketId: "2", state: "settled", payout: "100" });
  });
});
