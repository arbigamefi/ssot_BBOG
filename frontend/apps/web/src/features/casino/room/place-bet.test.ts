import { decodeDiceParams, decodeStakeSpec } from "@ssot/ssot/encoding";
import { describe, expect, it } from "vitest";

import type { GameMeta } from "./model";
import { buildGamePlaceBetInput, findCasinoPool, findUSDCAsset } from "./place-bet";

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
  it("finds the canonical USDC asset", () => {
    expect(findUSDCAsset(release.assets)?.address).toBe(
      "0x3333333333333333333333333333333333333333"
    );
  });

  it("finds the active casino pool", () => {
    expect(findCasinoPool(release.pools)?.poolId).toBe(1);
  });

  it("builds a typed PlaceBetInput with encoded params and stake spec", () => {
    const result = buildGamePlaceBetInput({
      release,
      game,
      betAmount: 25,
      betCount: 3,
      stopGain: 50,
      stopLoss: 10,
      diceTarget: 55,
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: []
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.input.chainId).toBe(84532);
    expect(result.input.poolId).toBe(1);
    expect(result.input.betCount).toBe(3);
    expect(result.input.stake).toBe(75_000_000n);
    expect(decodeDiceParams(result.input.params)).toEqual({ cap: 55 });
    expect(decodeStakeSpec(result.input.stakeSpec)).toEqual({
      amountPerRoll: 25_000_000n,
      betCount: 3,
      stopGain: 50_000_000n,
      stopLoss: 10_000_000n
    });
  });

  it("returns selection validation from game param encoding", () => {
    const result = buildGamePlaceBetInput({
      release,
      game: { ...game, slug: "roulette", label: "Roulette" },
      betAmount: 10,
      betCount: 1,
      stopGain: 0,
      stopLoss: 0,
      diceTarget: 50,
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: []
    });

    expect(result).toEqual({
      ok: false,
      message: "Please select at least one number or bet type on the Roulette board."
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
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: []
    });

    expect(result).toEqual({
      ok: false,
      message: "No active casino pool is available in the current release."
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
      coinSide: "HEADS",
      rouletteSpots: [],
      kenoSpots: [],
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
