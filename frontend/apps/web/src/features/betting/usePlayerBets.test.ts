import { describe, expect, it } from "vitest";
import type { BetRow } from "@ssot/ssot/indexer";

import { mergeBetRows } from "./usePlayerBets";

function row(overrides: Partial<BetRow>): BetRow {
  return {
    betId: "1",
    chainId: 84532,
    id: "84532:1",
    lastEventName: "BetPlaced",
    lastTxHash: "0xaaa",
    state: "placed",
    updatedAt: 1,
    updatedBlock: 10,
    ...overrides
  };
}

describe("mergeBetRows", () => {
  it("dedupes server and local rows while preferring the freshest local replay row", () => {
    const rows = mergeBetRows(
      [row({ betId: "7", id: "84532:7", state: "placed", updatedBlock: 100 })],
      [row({ betId: "7", id: "84532:7", state: "finalized", updatedBlock: 102 })],
      10
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ betId: "7", state: "finalized", updatedBlock: 102 });
  });

  it("sorts newest rows first and respects the limit", () => {
    const rows = mergeBetRows(
      [row({ betId: "1", id: "84532:1", updatedBlock: 10 })],
      [
        row({ betId: "3", id: "84532:3", updatedBlock: 12 }),
        row({ betId: "2", id: "84532:2", updatedBlock: 11 })
      ],
      2
    );

    expect(rows.map((item) => item.betId)).toEqual(["3", "2"]);
  });
});
