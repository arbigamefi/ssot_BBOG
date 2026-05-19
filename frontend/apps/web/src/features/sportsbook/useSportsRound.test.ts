import { describe, expect, it } from "vitest";
import type { SportsTicketRow } from "@ssot/bet-index";

import { deriveSportsRoundState } from "./useSportsRound";

function ticket(state: SportsTicketRow["state"]): SportsTicketRow {
  return {
    chainId: 84532,
    id: "84532:sports:9",
    lastEventName: state === "held" ? "TicketPlaced" : "TicketSettled",
    lastTxHash: "0xabc",
    state,
    ticketId: "9",
    updatedAt: 1,
    updatedBlock: 1
  } as SportsTicketRow;
}

describe("deriveSportsRoundState", () => {
  it("maps placement stages to player-facing round stages", () => {
    expect(deriveSportsRoundState({ slipState: "fetchingOdds" }).kind).toBe("quoting");
    expect(deriveSportsRoundState({ slipState: "planning" }).kind).toBe("planning");
    expect(deriveSportsRoundState({ slipState: "signing" }).kind).toBe("signing");
    expect(deriveSportsRoundState({ slipState: "mining" }).kind).toBe("mining");
  });

  it("tracks a mined receipt before the index catches up", () => {
    const state = deriveSportsRoundState({
      receipt: { ticketId: 9n, txHash: "0xabc" },
      slipState: "placed"
    });
    expect(state).toMatchObject({ kind: "tracking", ticketId: "9", txHash: "0xabc" });
  });

  it("uses indexed terminal states when available", () => {
    expect(deriveSportsRoundState({ slipState: "placed", ticket: ticket("settled") }).kind).toBe(
      "settled"
    );
    expect(deriveSportsRoundState({ slipState: "placed", ticket: ticket("refunded") }).kind).toBe(
      "refunded"
    );
    expect(deriveSportsRoundState({ slipState: "placed", ticket: ticket("voided") }).kind).toBe(
      "voided"
    );
  });
});
