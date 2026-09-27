import { describe, expect, it } from "vitest";

import { buildReceiptPath } from "./receipt-path";

describe("receipt paths", () => {
  it("names the GameHub that issued the bet", () => {
    const path = buildReceiptPath({
      betId: 290n,
      chainId: 84532,
      gameHub: "0xAbCdEf0000000000000000000000000000000001"
    });

    expect(path).toBe("/casino/receipt/84532/290?hub=0xabcdef0000000000000000000000000000000001");
  });

  it("falls back to the active release when the hub is unknown", () => {
    expect(buildReceiptPath({ betId: "290", chainId: 84532 })).toBe("/casino/receipt/84532/290");
  });
});
