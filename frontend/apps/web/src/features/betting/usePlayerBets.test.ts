import { describe, expect, it } from "vitest";
import type { BetRow } from "@ssot/ssot/indexer";

import { mergeBetRows } from "./usePlayerBets";

function row(overrides: Partial<BetRow>): BetRow {
  return {
    betId: "1",
    chainId: 84532,
    gameHub: "0x0000000000000000000000000000000000000001",
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

  it("matches index rows, whose ids name the hub, with cached rows of the active release", () => {
    const hub = "0x00000000000000000000000000000000000000A6";
    const rows = mergeBetRows(
      [
        row({
          betId: "7",
          gameHub: hub.toLowerCase() as BetRow["gameHub"],
          id: `84532:${hub.toLowerCase()}:7`,
          updatedBlock: 100
        })
      ],
      [
        row({
          betId: "7",
          gameHub: hub.toLowerCase() as BetRow["gameHub"],
          id: "84532:7",
          state: "finalized",
          updatedBlock: 102
        })
      ],
      10
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ betId: "7", state: "finalized" });
  });

  it("keeps the same bet id of two deployments apart", () => {
    const rows = mergeBetRows(
      [
        row({
          betId: "1",
          gameHub: "0x00000000000000000000000000000000000000a5",
          updatedBlock: 10
        }),
        row({ betId: "1", gameHub: "0x00000000000000000000000000000000000000a6", updatedBlock: 20 })
      ],
      [],
      10
    );

    expect(rows.map((item) => item.gameHub)).toEqual([
      "0x00000000000000000000000000000000000000a6",
      "0x00000000000000000000000000000000000000a5"
    ]);
  });
});
