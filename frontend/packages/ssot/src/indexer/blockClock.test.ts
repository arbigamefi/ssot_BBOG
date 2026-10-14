import { describe, expect, it, vi } from "vitest";
import { createBlockClock } from "./blockClock";

/** A chain whose block `n` has timestamp `timestampOf(n)`, its head at `state.head`. */
function chain(timestampOf: (n: bigint) => bigint, head: bigint) {
  const state = { head };
  const getBlock = vi.fn(async (args?: { blockNumber?: bigint }) => {
    const number = args?.blockNumber ?? state.head;
    return { number, timestamp: timestampOf(number) };
  });
  return { state, getBlock, client: { getBlock } as any };
}

describe("block clock", () => {
  it("measures five blocks a second after Denim from one sample behind the first head", async () => {
    const c = chain((n) => n / 5n, 10_000n);
    const clock = createBlockClock(c.client);
    expect(await clock.latest()).toEqual({ number: 10_000n, timestamp: 2_000n });
    expect(c.getBlock).toHaveBeenCalledWith({ blockNumber: 9_700n });
    expect(clock.blocksPerSecond).toBe(5);
    expect(clock.blocks(24)).toBe(120);
  });

  it("measures one block every two seconds before Denim", async () => {
    const clock = createBlockClock(chain((n) => n * 2n, 10_000n).client);
    await clock.latest();
    expect(clock.blocksPerSecond).toBe(0.5);
    expect(clock.blocks(24)).toBe(12);
    expect(clock.blocks(25)).toBe(13);
  });

  it("follows a rate change within a minute of heads and samples only once", async () => {
    // Two-second blocks up to 10,000, then five a second.
    const denim = 10_000n;
    const c = chain((n) => (n <= denim ? n * 2n : denim * 2n + (n - denim) / 5n), denim);
    const clock = createBlockClock(c.client);
    await clock.latest();
    expect(clock.blocksPerSecond).toBe(0.5);
    for (let second = 10n; second <= 80n; second += 10n) {
      c.state.head = denim + second * 5n;
      await clock.latest();
    }
    expect(clock.blocksPerSecond).toBe(5);
    expect(c.getBlock).toHaveBeenCalledTimes(1 + 9);
  });

  it("counts at five blocks a second until a rate is measured", async () => {
    const clock = createBlockClock(chain(() => 1_000n, 400n).client);
    await clock.latest();
    expect(clock.blocksPerSecond).toBeUndefined();
    expect(clock.blocks(24)).toBe(120);
  });

  it("rejects a latest block without a number", async () => {
    const clock = createBlockClock({ getBlock: vi.fn(async () => ({ timestamp: 1n })) } as any);
    await expect(clock.latest()).rejects.toThrow("The latest block has no number");
  });
});
