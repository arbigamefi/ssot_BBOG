import { describe, expect, it, vi } from "vitest";

import { lastBlockAtOrBefore } from "./block-time";

// Two-second blocks through 1,000, then five a second, as Base around Denim.
const DENIM = 1_000n;
const timestampOf = (n: bigint) => (n <= DENIM ? n * 2n : DENIM * 2n + (n - DENIM) / 5n);
const HEAD = 3_000n;

function chain() {
  const getBlock = vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({
    number: blockNumber,
    timestamp: timestampOf(blockNumber)
  }));
  return { getBlock, client: { getBlock } as any };
}

function linear(timestamp: bigint, low: bigint) {
  let found = low - 1n;
  for (let n = low; n <= HEAD; n += 1n) if (timestampOf(n) <= timestamp) found = n;
  return found;
}

describe("lastBlockAtOrBefore", () => {
  const head = { number: HEAD, timestamp: timestampOf(HEAD) };

  it("matches a linear search across the block-rate change, before the floor and at the head", async () => {
    for (const low of [0n, 400n, 1_200n])
      for (let timestamp = 0n; timestamp <= head.timestamp + 2n; timestamp += 7n)
        expect(await lastBlockAtOrBefore(chain().client, timestamp, head, low)).toBe(
          linear(timestamp, low)
        );
  });

  it("returns the last of the blocks that share a second", async () => {
    // Blocks 2,995 to 2,999 share second 2,399 at five a second.
    expect(await lastBlockAtOrBefore(chain().client, 2_399n, head, 0n)).toBe(2_999n);
  });

  it("reads few blocks for a recent second at five blocks a second", async () => {
    const c = chain();
    await lastBlockAtOrBefore(c.client, head.timestamp - 4n, head, 0n);
    expect(c.getBlock.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("reads nothing when the head is old enough or below the floor", async () => {
    const c = chain();
    expect(await lastBlockAtOrBefore(c.client, head.timestamp, head, 0n)).toBe(HEAD);
    expect(await lastBlockAtOrBefore(c.client, 0n, head, HEAD + 1n)).toBe(HEAD);
    expect(c.getBlock).not.toHaveBeenCalled();
  });
});
