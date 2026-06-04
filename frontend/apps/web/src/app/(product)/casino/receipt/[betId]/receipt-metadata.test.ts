import { describe, expect, it } from "vitest";

import {
  getReceiptOgVersion,
  getReceiptPreviewHint,
  getReceiptVersionTerminalTxHash,
  normalizeReceiptOgVersion
} from "./receipt-metadata";

describe("receipt metadata versioning", () => {
  it("builds a terminal version from the indexed receipt row", () => {
    expect(
      getReceiptOgVersion({
        lastEventName: "BetFinalized",
        lastTxHash: "0xa76261431e46093f8669c400fe6bf0093ff41cf159edaefbed9d5257afca3ded",
        state: "finalized",
        updatedAt: 1780585416171
      })
    ).toBe(
      "finalized:0xa76261431e46093f8669c400fe6bf0093ff41cf159edaefbed9d5257afca3ded:BetFinalized:1780585416171"
    );
  });

  it("does not preserve broken undefined receipt versions", () => {
    expect(normalizeReceiptOgVersion("settled:undefined")).toBeUndefined();
    expect(getReceiptOgVersion(null, "settled:undefined")).toBe("pending");
  });

  it("preserves a valid incoming version while metadata waits for indexing", () => {
    expect(getReceiptOgVersion(null, "settled:bet:290:request:7057")).toBe(
      "settled:bet:290:request:7057"
    );
  });

  it("extracts a valid terminal transaction hash from a receipt version", () => {
    expect(
      getReceiptVersionTerminalTxHash(
        "finalized:0xa76261431e46093f8669c400fe6bf0093ff41cf159edaefbed9d5257afca3ded:BetFinalized:1780582922000"
      )
    ).toBe("0xa76261431e46093f8669c400fe6bf0093ff41cf159edaefbed9d5257afca3ded");
    expect(getReceiptVersionTerminalTxHash("settled:undefined")).toBeUndefined();
  });

  it("normalizes compact social preview hints", () => {
    expect(getReceiptPreviewHint({ amount: "-1.25 USDC", game: "baccarat", kind: "settled" }))
      .toMatchInlineSnapshot(`
        {
          "amount": "-1.25 USDC",
          "game": "baccarat",
          "kind": "settled",
        }
      `);
    expect(
      getReceiptPreviewHint({ amount: "undefined", game: "dice", kind: "won" })
    ).toBeUndefined();
    expect(
      getReceiptPreviewHint({ amount: "+1 USDC", game: "dice", kind: "pending" })
    ).toBeUndefined();
  });
});
