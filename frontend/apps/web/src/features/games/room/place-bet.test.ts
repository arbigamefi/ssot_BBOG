import { decodeDiceParams, decodeStakeSpec } from "@ssot/ssot/encoding";
import { describe, expect, it } from "vitest";

import type { GameMeta } from "./model";
import { buildGamePlaceBetInput, findUSDCAsset } from "./place-bet";

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
  ]
};

describe("game room place bet builder", () => {
  it("finds the canonical USDC asset", () => {
    expect(findUSDCAsset(release.assets)?.address).toBe(
      "0x3333333333333333333333333333333333333333"
    );
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
    expect(result.input.asset).toBe("0x3333333333333333333333333333333333333333");
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

  it("keeps the existing zero-address fallback when release asset metadata is missing", () => {
    const result = buildGamePlaceBetInput({
      release: { chainId: 84532, assets: [] },
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

    expect(result.ok && result.input.asset).toBe("0x0000000000000000000000000000000000000000");
  });
});
