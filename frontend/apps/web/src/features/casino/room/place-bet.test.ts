import { decodeDiceParams, decodeStakeSpec } from "@ssot/ssot/encoding";
import { describe, expect, it } from "vitest";

import type { GameMeta } from "./model";
import { buildGamePlaceBetInput, findCasinoPool } from "./place-bet";

const game: GameMeta = {
  gameId: "0x1111111111111111111111111111111111111111",
  slug: "dice",
  label: "Dice",
  module: "0x2222222222222222222222222222222222222222"
};

const release = {
  chainId: 84532,
  assets: [
    {
      symbol: "USDC",
      address: "0x3333333333333333333333333333333333333333",
      decimals: 6
    }
  ],
  pools: [
    {
      poolId: 1,
      domain: "Casino",
      domainId: 1,
      active: true,
      asset: "0x3333333333333333333333333333333333333333",
      bank: "0x4444444444444444444444444444444444444444",
      symbol: "USDC",
      decimals: 6
    }
  ]
};

describe("game room place bet builder", () => {
  it("finds the active casino pool", () => {
    expect(findCasinoPool(release.pools)?.poolId).toBe(1);
  });

  it("builds a typed PlaceBetInput with encoded params and stake spec", () => {
    const affiliate = "0x5555555555555555555555555555555555555555";
    const result = buildGamePlaceBetInput({
      release,
      game,
      betAmount: 25,
      betCount: 3,
      stopGain: 50,
      stopLoss: 10,
      diceTarget: 55,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [],
      plinkoRisk: "medium",
      affiliate
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.input.chainId).toBe(84532);
    expect(result.input.poolId).toBe(1);
    expect(result.input.affiliate).toBe(affiliate);
    expect(result.input.betCount).toBe(3);
    expect(result.input.stake).toBe(75_000_000n);
    expect(decodeDiceParams(result.input.params)).toEqual({
      cap: 55,
      direction: "under",
      target: 55
    });
    expect(decodeStakeSpec(result.input.stakeSpec)).toEqual({
      amountPerRoll: 25_000_000n,
      betCount: 3,
      stopGain: 50_000_000n,
      stopLoss: 10_000_000n
    });
  });

  it("keeps cent-level casino stakes when building contract units", () => {
    const result = buildGamePlaceBetInput({
      release,
      game,
      betAmount: 0.01,
      betCount: 2,
      stopGain: 0.02,
      stopLoss: 0.01,
      diceTarget: 55,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [],
      plinkoRisk: "medium"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.input.stake).toBe(20_000n);
    expect(decodeStakeSpec(result.input.stakeSpec)).toEqual({
      amountPerRoll: 10_000n,
      betCount: 2,
      stopGain: 20_000n,
      stopLoss: 10_000n
    });
  });

  it("uses the selected casino pool decimals instead of assuming USDC", () => {
    const wethRelease = {
      chainId: 84532,
      assets: [
        {
          symbol: "USDC",
          address: "0x3333333333333333333333333333333333333333",
          decimals: 6
        },
        {
          symbol: "WETH",
          address: "0x6666666666666666666666666666666666666666",
          decimals: 18
        }
      ],
      pools: [
        {
          poolId: 9,
          domain: "Casino",
          domainId: 1,
          active: true,
          asset: "0x6666666666666666666666666666666666666666",
          bank: "0x7777777777777777777777777777777777777777",
          symbol: "WETH",
          decimals: 18
        }
      ]
    };
    const result = buildGamePlaceBetInput({
      release: wethRelease,
      game,
      betAmount: 0.01,
      betCount: 2,
      stopGain: 0.02,
      stopLoss: 0.01,
      diceTarget: 55,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [],
      plinkoRisk: "medium"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.input.poolId).toBe(9);
    expect(result.input.stake).toBe(20_000_000_000_000_000n);
    expect(decodeStakeSpec(result.input.stakeSpec)).toEqual({
      amountPerRoll: 10_000_000_000_000_000n,
      betCount: 2,
      stopGain: 20_000_000_000_000_000n,
      stopLoss: 10_000_000_000_000_000n
    });
  });

  const multiPoolRelease = {
    chainId: 84532,
    assets: [
      { symbol: "USDC", address: "0x3333333333333333333333333333333333333333", decimals: 6 },
      { symbol: "WETH", address: "0x6666666666666666666666666666666666666666", decimals: 18 }
    ],
    pools: [
      {
        poolId: 1,
        domain: "Casino",
        domainId: 1,
        active: true,
        asset: "0x3333333333333333333333333333333333333333",
        bank: "0x4444444444444444444444444444444444444444",
        symbol: "USDC",
        decimals: 6
      },
      {
        poolId: 9,
        domain: "Casino",
        domainId: 1,
        active: true,
        asset: "0x6666666666666666666666666666666666666666",
        bank: "0x7777777777777777777777777777777777777777",
        symbol: "WETH",
        decimals: 18
      }
    ]
  };

  it("places into the explicitly selected pool when poolId is provided", () => {
    const result = buildGamePlaceBetInput({
      release: multiPoolRelease,
      game,
      betAmount: 0.01,
      betCount: 1,
      stopGain: 0,
      stopLoss: 0,
      diceTarget: 50,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [],
      plinkoRisk: "medium",
      poolId: 9
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Selected the 18-decimal WETH pool, not the first (USDC) pool.
    expect(result.input.poolId).toBe(9);
    expect(result.input.stake).toBe(10_000_000_000_000_000n);
  });

  it("falls back to the default casino pool for an unknown poolId", () => {
    const result = buildGamePlaceBetInput({
      release: multiPoolRelease,
      game,
      betAmount: 1,
      betCount: 1,
      stopGain: 0,
      stopLoss: 0,
      diceTarget: 50,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [],
      plinkoRisk: "medium",
      poolId: 999
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.poolId).toBe(1); // default (first) casino pool
  });

  it("returns neutral selection validation when UI copy is not provided", () => {
    const result = buildGamePlaceBetInput({
      release,
      game: { ...game, slug: "roulette", label: "Roulette" },
      betAmount: 10,
      betCount: 1,
      stopGain: 0,
      stopLoss: 0,
      diceTarget: 50,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [],
      plinkoRisk: "medium"
    });

    expect(result).toEqual({
      ok: false,
      message: "—"
    });
  });

  it("rejects planning when no casino pool is available", () => {
    const result = buildGamePlaceBetInput({
      release: { chainId: 84532, assets: [], pools: [] },
      game,
      betAmount: 10,
      betCount: 1,
      stopGain: 0,
      stopLoss: 0,
      diceTarget: 50,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [],
      plinkoRisk: "medium"
    });

    expect(result).toEqual({
      ok: false,
      message: "—"
    });
  });

  it("allows UI layers to provide localized pool errors", () => {
    const result = buildGamePlaceBetInput({
      release: { chainId: 84532, assets: [], pools: [] },
      game,
      betAmount: 10,
      betCount: 1,
      stopGain: 0,
      stopLoss: 0,
      diceTarget: 50,
      diceDirection: "under",
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [],
      plinkoRisk: "medium",
      messages: {
        noActiveCasinoPool: "当前 release 中没有可用的赌场资金池。"
      }
    });

    expect(result).toEqual({
      ok: false,
      message: "当前 release 中没有可用的赌场资金池。"
    });
  });
});
