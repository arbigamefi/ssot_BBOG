import { describe, expect, it } from "vitest";

import { buildReceiptSharePath, buildReceiptShareVersion } from "./result-overlay";
import type { CasinoTerminalRoundResult } from "./resolution";

const settledRound: CasinoTerminalRoundResult = {
  kind: "settled",
  betId: 290n,
  requestId: 12345n,
  randomHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  player: "0xc8ec9920d573893e888db5d30b2b3b3824b1b684",
  stake: 1_000_000n,
  settlement: {
    payoutNet: 1_980_000n
  }
};

describe("receipt share helpers", () => {
  it("uses the terminal transaction hash when one is available", () => {
    const version = buildReceiptShareVersion({
      result: settledRound,
      txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    });

    expect(version).toBe(
      "settled:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    );
  });

  it("does not leak undefined into the public receipt URL when terminal tx hash is absent", () => {
    const version = buildReceiptShareVersion({ result: settledRound, txHash: undefined });
    const path = buildReceiptSharePath({
      betId: settledRound.betId,
      chainId: 84532,
      version
    });

    expect(version).toBe(
      "settled:bet:290:request:12345:random:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(path).toContain("/casino/receipt/290?chainId=84532&v=settled");
    expect(path).not.toContain("undefined");
  });

  it("adds a compact preview hint for social crawlers", () => {
    const path = buildReceiptSharePath({
      betId: settledRound.betId,
      chainId: 84532,
      preview: {
        amount: "+0.98 USDC",
        game: "dice",
        kind: "won"
      },
      version: "settled:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    });
    const url = new URL(path, "https://app.example");

    expect(url.searchParams.get("rt")).toBe("won");
    expect(url.searchParams.get("ra")).toBe("+0.98 USDC");
    expect(url.searchParams.get("rg")).toBe("dice");
  });

  it("omits invalid cache-buster values instead of serializing them", () => {
    expect(
      buildReceiptSharePath({
        betId: 290n,
        chainId: 84532,
        version: "settled:undefined"
      })
    ).toBe("/casino/receipt/290?chainId=84532");
  });
});
