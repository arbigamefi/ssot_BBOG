import { describe, it, expect } from "vitest";
import {
  getGameEncoder,
  requireGameEncoder,
  registeredGameSlugs,
} from "./registry";

describe("GameEncoderRegistry", () => {
  it("has all 4 known game slugs registered", () => {
    const slugs = registeredGameSlugs();
    expect(slugs).toContain("dice");
    expect(slugs).toContain("coin-toss");
    expect(slugs).toContain("roulette");
    expect(slugs).toContain("keno");
    expect(slugs.length).toBe(4);
  });

  it("getGameEncoder returns undefined for unknown slug", () => {
    expect(getGameEncoder("unknown-game")).toBeUndefined();
  });

  it("requireGameEncoder throws for unknown slug", () => {
    expect(() => requireGameEncoder("unknown-game")).toThrowError(
      'No encoder registered for game slug: "unknown-game"'
    );
  });

  describe("dice encoder", () => {
    it("encodes and decodes roundtrip", () => {
      const enc = requireGameEncoder("dice");
      const hex = enc.encode({ cap: 42 });
      const decoded = enc.decode(hex);
      expect(decoded.cap).toBe(42);
    });

    it("has correct defaults", () => {
      const enc = requireGameEncoder("dice");
      expect(enc.defaultParams.cap).toBe(50);
    });

    it("has correct label", () => {
      expect(requireGameEncoder("dice").label).toBe("Dice");
    });
  });

  describe("coin-toss encoder", () => {
    it("encodes and decodes roundtrip (heads)", () => {
      const enc = requireGameEncoder("coin-toss");
      const hex = enc.encode({ face: true });
      const decoded = enc.decode(hex);
      expect(decoded.face).toBe(true);
    });

    it("encodes and decodes roundtrip (tails)", () => {
      const enc = requireGameEncoder("coin-toss");
      const hex = enc.encode({ face: false });
      const decoded = enc.decode(hex);
      expect(decoded.face).toBe(false);
    });

    it("has correct defaults", () => {
      const enc = requireGameEncoder("coin-toss");
      expect(enc.defaultParams.face).toBe(true);
    });
  });

  describe("roulette encoder", () => {
    it("encodes and decodes roundtrip", () => {
      const enc = requireGameEncoder("roulette");
      const hex = enc.encode({ mask: 0x12345n });
      const decoded = enc.decode(hex);
      expect(decoded.mask).toBe(0x12345n);
    });

    it("has correct defaults", () => {
      const enc = requireGameEncoder("roulette");
      expect(enc.defaultParams.mask).toBe(0x12345n);
    });
  });

  describe("keno encoder", () => {
    it("encodes and decodes roundtrip", () => {
      const enc = requireGameEncoder("keno");
      const hex = enc.encode({ mask: 0xabcden });
      const decoded = enc.decode(hex);
      expect(decoded.mask).toBe(0xabcden);
    });

    it("has correct defaults", () => {
      const enc = requireGameEncoder("keno");
      expect(enc.defaultParams.mask).toBe(0xabcden);
    });
  });

  it("all encoders produce valid hex strings", () => {
    for (const slug of registeredGameSlugs()) {
      const enc = requireGameEncoder(slug);
      const hex = enc.encode(enc.defaultParams);
      expect(hex).toMatch(/^0x[a-f0-9]+$/);
    }
  });

  it("all encoders roundtrip with their defaults", () => {
    for (const slug of registeredGameSlugs()) {
      const enc = requireGameEncoder(slug);
      const hex = enc.encode(enc.defaultParams);
      const decoded = enc.decode(hex);
      // Should be a non-null object
      expect(decoded).toBeDefined();
      expect(typeof decoded).toBe("object");
    }
  });
});
