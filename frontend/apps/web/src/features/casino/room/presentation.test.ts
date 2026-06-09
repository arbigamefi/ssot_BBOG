import { describe, expect, it } from "vitest";

import {
  canPoolHoldBet,
  computePoolMaxStakeForReserve,
  computePoolFreeLiquidity,
  deriveGameRoomLimits,
  formatGameMaxPayout,
  formatHouseEdge,
  resolveHouseEdgeBps
} from "./presentation";

describe("game room presentation helpers", () => {
  it("formats house edge fallbacks", () => {
    expect(formatHouseEdge(undefined, "roulette")).toBe("2.70%");
    expect(formatHouseEdge({ houseEdgeBps: 150 }, "dice")).toBe("1.50%");
    expect(resolveHouseEdgeBps({ houseEdgeBps: 200 }, "dice")).toBe(200);
    expect(resolveHouseEdgeBps(undefined, "dice", { defaultHouseEdgeBps: 200 })).toBe(200);
    expect(formatHouseEdge(undefined, "coin-toss", { defaultHouseEdgeBps: 200 })).toBe("2.00%");
    expect(resolveHouseEdgeBps({ houseEdgeBps: 150 }, "dice", { defaultHouseEdgeBps: 200 })).toBe(
      150
    );
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
      reserveMultiplier: 2,
      assetDecimals: 6,
      assetSymbol: "USDC"
    });
    expect(limits.maxPayout).toBe("1,000 USDC");
    expect(limits.maxBet).toBe("500 USDC");
    expect(limits.maxBetState).toBe("value");
    expect(limits.maxPayoutState).toBe("value");
  });

  it("uses gross reserve multiplier rather than player-facing net multiplier for max bet", () => {
    const limits = deriveGameRoomLimits({
      freeLiquidity: 10_000_000n,
      reserveMultiplier: 2,
      assetDecimals: 6,
      assetSymbol: "USDC"
    });

    expect(limits.maxPayout).toBe("10 USDC");
    expect(limits.maxBet).toBe("5 USDC");
    expect(limits.maxBetRaw).toBe(5_000_000n);
  });

  it("derives max bet from the actual post-stake Bank solvency condition", () => {
    const snapshot = {
      totalAssets: 1_000_000_000n,
      totalReserved: 0n,
      riskReserveBps: 1000
    };

    const maxStake = computePoolMaxStakeForReserve({
      snapshot,
      reserveMultiplier: 2
    });

    expect(maxStake).toBe(818_181_819n);
    expect(
      canPoolHoldBet({
        snapshot,
        stake: maxStake!,
        requiredReserve: maxStake! * 2n
      })
    ).toBe(true);
    expect(
      canPoolHoldBet({
        snapshot,
        stake: maxStake! + 1n,
        requiredReserve: (maxStake! + 1n) * 2n
      })
    ).toBe(false);

    const limits = deriveGameRoomLimits({
      freeLiquidity: computePoolFreeLiquidity(snapshot),
      poolSnapshot: snapshot,
      reserveMultiplier: 2,
      assetDecimals: 6,
      assetSymbol: "USDC"
    });

    expect(limits.maxBetRaw).toBe(818_181_819n);
    expect(limits.maxBet).toBe("818.18 USDC");
    expect(limits.maxPayout).toBe("1,636 USDC");
  });

  it("does not cap live room limits by asset-agnostic static game metadata", () => {
    const limits = deriveGameRoomLimits({
      freeLiquidity: 1_000_000_000n,
      reserveMultiplier: 10,
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
        reserveMultiplier: 2,
        assetDecimals: 6,
        assetSymbol: "USDC"
      })
    ).toEqual({
      maxBet: "—",
      maxBetState: "pending-liquidity",
      maxPayout: "—",
      maxPayoutState: "pending-liquidity"
    });

    const noOdds = deriveGameRoomLimits({
      freeLiquidity: 1_000_000_000n,
      reserveMultiplier: 0,
      assetDecimals: 6,
      assetSymbol: "USDC"
    });
    expect(noOdds.maxPayout).toBe("1,000 USDC");
    expect(noOdds.maxBet).toBe("—");
    expect(noOdds.maxBetState).toBe("pending-selection");
    expect(noOdds.maxPayoutState).toBe("value");
  });

  it("keeps zero pool capacity as a distinct state for product copy", () => {
    const limits = deriveGameRoomLimits({
      freeLiquidity: 0n,
      reserveMultiplier: 2,
      assetDecimals: 6,
      assetSymbol: "USDC"
    });

    expect(limits.maxBet).toBe("0 USDC");
    expect(limits.maxBetState).toBe("no-capacity");
    expect(limits.maxPayout).toBe("0 USDC");
    expect(limits.maxPayoutState).toBe("no-capacity");
  });
});
