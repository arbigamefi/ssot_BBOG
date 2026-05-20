import { describe, expect, it } from "vitest";

import {
  EUROPEAN_WHEEL_ORDER,
  RED_NUMBER_SET,
  kenoWinChance,
  mapBetState,
  shortHex,
  toGameMeta
} from "./model";

describe("game room model", () => {
  it("normalizes release game metadata", () => {
    expect(
      toGameMeta({
        gameId: "0xabc",
        slug: "dice",
        label: "Dice",
        module: "0xdef"
      })
    ).toEqual({
      gameId: "0xabc",
      slug: "dice",
      label: "Dice",
      module: "0xdef"
    });
  });

  it("maps indexer bet states to UI statuses", () => {
    expect(mapBetState()).toBe("pending");
    expect(mapBetState("won")).toBe("won");
    expect(mapBetState("lost")).toBe("lost");
    expect(mapBetState("finalized")).toBe("settled");
    expect(mapBetState("refunded")).toBe("cancelled");
    expect(mapBetState("placed")).toBe("pending");
  });

  it("formats short hex values", () => {
    expect(shortHex()).toBe("—");
    expect(shortHex("0x1234567890abcdef")).toBe("0x1234…cdef");
  });

  it("computes Keno visible win chance", () => {
    expect(kenoWinChance(0)).toBe(0);
    expect(kenoWinChance(1)).toBeGreaterThan(0);
    expect(kenoWinChance(5)).toBeGreaterThan(kenoWinChance(1));
  });

  it("exposes European roulette facts", () => {
    expect(EUROPEAN_WHEEL_ORDER).toHaveLength(37);
    expect(EUROPEAN_WHEEL_ORDER[0]).toBe(0);
    expect(RED_NUMBER_SET.has(1)).toBe(true);
    expect(RED_NUMBER_SET.has(2)).toBe(false);
  });
});
