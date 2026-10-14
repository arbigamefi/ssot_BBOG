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

  describe("atOrBefore", () => {
    // Two-second blocks up to 10,000, then five a second.
    const denim = 10_000n;
    const stamp = (n: bigint) => (n <= denim ? n * 2n : denim * 2n + (n - denim) / 5n);
    const linear = (timestamp: bigint, high: bigint, floor: bigint) => {
      let found: bigint | undefined;
      for (let n = floor; n <= high; n += 1n) if (stamp(n) <= timestamp) found = n;
      return found;
    };

    it("takes an old enough estimate with one read", async () => {
      const c = chain(stamp, 10_400n);
      const clock = createBlockClock(c.client);
      expect(await clock.atOrBefore(stamp(10_400n) - 24n, 10_200n, 0n)).toEqual({
        number: 10_200n,
        timestamp: stamp(10_200n)
      });
      expect(c.getBlock).toHaveBeenCalledTimes(1);
    });

    it("finds the last old enough block when the estimate is too young, across the rate change", async () => {
      for (const head of [10_050n, 10_100n, 10_400n, 11_000n])
        for (const seconds of [0n, 3n, 24n, 48n, 200n]) {
          const timestamp = stamp(head) - seconds;
          const found = await createBlockClock(chain(stamp, head).client).atOrBefore(
            timestamp,
            head - 1n,
            0n
          );
          // The estimate itself is returned when old enough; otherwise the last block at or before the timestamp.
          const expected = stamp(head - 1n) <= timestamp ? head - 1n : linear(timestamp, head, 0n);
          expect(found?.number).toBe(expected);
          expect(found!.timestamp).toBeLessThanOrEqual(timestamp);
        }
    });

    it("returns nothing when even the floor is later", async () => {
      const clock = createBlockClock(chain(stamp, 10_400n).client);
      expect(await clock.atOrBefore(stamp(9_000n) - 1n, 9_500n, 9_000n)).toBeUndefined();
    });
  });
});
