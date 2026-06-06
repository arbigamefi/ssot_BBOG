import { describe, expect, it } from "vitest";

import {
  computePoolFreeLiquidity,
  deriveGameRoomLimits,
  formatGameMaxPayout,
  formatHouseEdge
} from "./presentation";

describe("game room presentation helpers", () => {
  it("formats house edge fallbacks", () => {
    expect(formatHouseEdge(undefined, "roulette")).toBe("2.70%");
    expect(formatHouseEdge({ houseEdgeBps: 150 }, "dice")).toBe("1.50%");
  });

  it("formats release max payout or catalog fallback", () => {
    expect(
      formatGameMaxPayout({
        assetDecimals: 6,
        assetSymbol: "USDC",
        gameMeta: { maxPayout: "2500000000" },
        slug: "dice"
      })
    ).toBe("2,500 USDC");
    expect(
      formatGameMaxPayout({
        assetDecimals: 18,
        assetSymbol: "WETH",
        gameMeta: undefined,
        slug: "keno"
      })
    ).toBe("500,000 WETH");
  });

  it("derives free liquidity net of the risk reserve", () => {
    // totalAssets 1,000,000 (6dp) − reserved 100,000 − 10% reserve (100,000) = 800,000.
    expect(
      computePoolFreeLiquidity({
        totalAssets: 1_000_000_000_000n,
        totalReserved: 100_000_000_000n,
        minLiquidityBps: 1000
      })
    ).toBe(800_000_000_000n);
    expect(computePoolFreeLiquidity(undefined)).toBeUndefined();
    // Never returns negative.
    expect(computePoolFreeLiquidity({ totalAssets: 100n, totalReserved: 1_000n })).toBe(0n);
  });

  it("prefers riskReserveBps over the legacy minLiquidity alias for new-risk capacity", () => {
    expect(
      computePoolFreeLiquidity({
        totalAssets: 1_000_000_000_000n,
        totalReserved: 100_000_000_000n,
        minLiquidityBps: 1000,
        riskReserveBps: 2000
      })
    ).toBe(700_000_000_000n);
  });

  it("derives live max payout from full free liquidity and max bet for the odds", () => {
    // free liquidity 1,000 USDC; at 2x odds, max bet = 500 USDC.
    // The 90% threshold is only an SDK warning, not the Bank.holdBet solvency cap.
    const limits = deriveGameRoomLimits({
      freeLiquidity: 1_000_000_000n,
      multiplier: 2,
      assetDecimals: 6,
      assetSymbol: "USDC"
    });
    expect(limits.maxPayout).toBe("1,000 USDC");
    expect(limits.maxBet).toBe("500 USDC");
  });

  it("does not cap live room limits by asset-agnostic static game metadata", () => {
    const limits = deriveGameRoomLimits({
      freeLiquidity: 1_000_000_000n,
      multiplier: 10,
      assetDecimals: 6,
      assetSymbol: "USDC"
    });
    expect(limits.maxPayout).toBe("1,000 USDC");
    expect(limits.maxBet).toBe("100 USDC");
  });

  it("shows placeholders without a snapshot or without selectable odds", () => {
    expect(
      deriveGameRoomLimits({
        freeLiquidity: undefined,
        multiplier: 2,
        assetDecimals: 6,
        assetSymbol: "USDC"
      })
    ).toEqual({ maxBet: "—", maxPayout: "—" });

    const noOdds = deriveGameRoomLimits({
      freeLiquidity: 1_000_000_000n,
      multiplier: 0,
      assetDecimals: 6,
      assetSymbol: "USDC"
    });
    expect(noOdds.maxPayout).toBe("1,000 USDC");
    expect(noOdds.maxBet).toBe("—");
  });
});
