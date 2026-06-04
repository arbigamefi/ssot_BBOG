import { describe, expect, it } from "vitest";

import { buildReceiptSharePath } from "./result-overlay";

describe("receipt share helpers", () => {
  it("builds a canonical receipt URL from bet id and chain id only", () => {
    const path = buildReceiptSharePath({
      betId: 290n,
      chainId: 84532
    });

    expect(path).toBe("/casino/receipt/84532/290");
  });
});
