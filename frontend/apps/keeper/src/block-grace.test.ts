import { describe, expect, it } from "vitest";
import { UnknownBlockGrace, UNKNOWN_BLOCK_GRACE_MS } from "./block-grace.js";

describe("UnknownBlockGrace", () => {
  it("holds an unknown-block run for five consecutive minutes and reports other failures at once", () => {
    let now = 0;
    const grace = new UnknownBlockGrace(() => now);
    const unknownBlock = new Error("header not found");
    expect(grace.report("pool", unknownBlock)).toBe(false);
    expect(grace.since("pool")).toBe(0);
    now = UNKNOWN_BLOCK_GRACE_MS - 1;
    expect(grace.report("pool", unknownBlock)).toBe(false);
    now = UNKNOWN_BLOCK_GRACE_MS;
    expect(grace.report("pool", unknownBlock)).toBe(true);
    // A success ends the run; the next unknown block starts a new one.
    grace.succeed("pool");
    expect(grace.since("pool")).toBeUndefined();
    expect(grace.report("pool", unknownBlock)).toBe(false);
    expect(grace.report("pool", new Error("execution reverted"))).toBe(true);
    expect(grace.since("pool")).toBeUndefined();
    // Runs are separate per key.
    expect(grace.report("governance", unknownBlock)).toBe(false);
  });
});
