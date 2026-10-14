import type { PublicClient } from "viem";

/** Base's fastest block rate (Denim): stepping back this many blocks per second reaches at least that far. */
const MAX_BLOCKS_PER_SECOND = 5n;

export type BlockStamp = { number: bigint; timestamp: bigint };

/**
 * The last block at or before `timestamp`, no lower than `low`, or `low - 1n` when even `low` is later. Block
 * timestamps never decrease and Base can give several blocks one second. The search steps back from `high` by the
 * blocks five a second would make in the difference, doubling until a block is old enough, then bisects; a recent
 * timestamp therefore costs a few block reads at any block rate.
 */
export async function lastBlockAtOrBefore(
  client: Pick<PublicClient, "getBlock">,
  timestamp: bigint,
  high: BlockStamp,
  low: bigint
): Promise<bigint> {
  if (high.number < low) return low - 1n;
  if (high.timestamp <= timestamp) return high.number;
  const timeOf = async (blockNumber: bigint) => (await client.getBlock({ blockNumber })).timestamp;
  let late = high.number;
  let step = (high.timestamp - timestamp) * MAX_BLOCKS_PER_SECOND + MAX_BLOCKS_PER_SECOND;
  let early: bigint;
  for (;;) {
    const probe = late - step;
    if (probe <= low) {
      if ((await timeOf(low)) > timestamp) return low - 1n;
      early = low;
      break;
    }
    if ((await timeOf(probe)) <= timestamp) {
      early = probe;
      break;
    }
    late = probe;
    step *= 2n;
  }
  while (late - early > 1n) {
    const middle = (early + late) / 2n;
    if ((await timeOf(middle)) <= timestamp) early = middle;
    else late = middle;
  }
  return early;
}
