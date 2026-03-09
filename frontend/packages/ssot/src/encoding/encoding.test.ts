import { describe, expect, it } from "vitest";

import { decodeStakeSpec, encodeStakeSpec } from "./stakeSpec";
import { decodeDiceParams, encodeDiceParams } from "./dice";
import { decodeCoinTossParams, encodeCoinTossParams } from "./cointoss";
import { decodeRouletteParams, encodeRouletteParams } from "./roulette";
import { decodeKenoParams, encodeKenoParams } from "./keno";

describe("encoding", () => {
  it("stakeSpec roundtrip", () => {
    const spec = { amountPerRoll: 123n, betCount: 7, stopGain: 456n, stopLoss: 789n };
    const hex = encodeStakeSpec(spec);
    const dec = decodeStakeSpec(hex);
    expect(dec).toEqual(spec);
  });

  it("dice roundtrip", () => {
    const hex = encodeDiceParams(42);
    expect(decodeDiceParams(hex)).toEqual({ cap: 42 });
  });

  it("cointoss roundtrip", () => {
    const hex = encodeCoinTossParams(true);
    expect(decodeCoinTossParams(hex)).toEqual({ face: true });
  });

  it("roulette roundtrip", () => {
    const hex = encodeRouletteParams({ kind: "straight", number: 17 });
    expect(decodeRouletteParams(hex)).toEqual({ kind: "straight", number: 17 });
  });

  it("roulette raw bitmask roundtrip", () => {
    const hex = encodeRouletteParams({ kind: "bitmask", mask: 0x12345n });
    expect(decodeRouletteParams(hex)).toEqual({ kind: "bitmask", mask: 0x12345n });
  });

  it("keno roundtrip", () => {
    const hex = encodeKenoParams(0xabcden);
    expect(decodeKenoParams(hex)).toEqual({ mask: 0xabcden });
  });
});
