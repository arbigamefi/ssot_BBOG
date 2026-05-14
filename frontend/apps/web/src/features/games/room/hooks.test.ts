import { describe, expect, it, vi } from "vitest";

import { formatTokenBalance, pickKenoStrobeSpots } from "./hooks";

describe("game room hooks helpers", () => {
  it("formats bigint token balances with fixed USDC precision", () => {
    expect(formatTokenBalance(123456789n, 6)).toBe("123.46 USDC");
    expect(formatTokenBalance(1000000n, 6)).toBe("1.00 USDC");
  });

  it("picks unique keno strobe spots in the contract range", () => {
    const random = vi.spyOn(Math, "random");
    random
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.3);

    const spots = pickKenoStrobeSpots(4);

    expect(spots).toEqual([1, 5, 9, 13]);
    expect(new Set(spots).size).toBe(spots.length);
    expect(spots.every((spot) => spot >= 1 && spot <= 40)).toBe(true);
    random.mockRestore();
  });
});
