import { describe, expect, it, vi } from "vitest";

import { formatTokenBalance, pickKenoStrobeSpots } from "./hooks";

describe("game room hooks helpers", () => {
  it("formats bigint token balances with the selected asset symbol", () => {
    expect(formatTokenBalance(123456789n, 6, "USDC")).toBe("123.45 USDC");
    expect(formatTokenBalance(1000000000000000000n, 18, "WETH")).toBe("1 WETH");
  });

  it("picks unique keno strobe spots in the contract range", () => {
    const random = vi.spyOn(Math, "random");
    random
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.3);

    const spots = pickKenoStrobeSpots(4);

    expect(spots).toEqual([1, 2, 4, 5]);
    expect(new Set(spots).size).toBe(spots.length);
    expect(spots.every((spot) => spot >= 1 && spot <= 15)).toBe(true);
    random.mockRestore();
  });
});
