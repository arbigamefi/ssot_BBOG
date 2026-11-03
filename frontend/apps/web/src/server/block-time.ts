import type { PublicClient } from "viem";

/** Base's fastest block rate (Denim): stepping back this many blocks per second reaches at least that far. */
const MAX_BLOCKS_PER_SECOND = 5n;

export type BlockStamp = { number: bigint; timestamp: bigint };

/**
 * The last block at or before `timestamp`, no lower than `low`, or `low - 1n` when even `low` is later. Block
 * timestamps never decrease and Base can give several blocks one second. The search steps back from `high` by the
 * blocks five a second would make in the difference, doubling until a block is old enough, then steps forward from
 * it by doubling until a block is too late, and bisects between the two. At five blocks a second the first step
 * lands next to the answer, so any timestamp, recent or days old, costs a few block reads.
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
  // Bisecting from `early` to the head would cost a read per halving of the whole distance; a short range is
  // bisected directly.
  for (let forward = MAX_BLOCKS_PER_SECOND; forward * 8n < late - early; forward *= 2n) {
    const probe = early + forward;
    if ((await timeOf(probe)) > timestamp) {
      late = probe;
      break;
    }
    early = probe;
  }
  while (late - early > 1n) {
    const middle = (early + late) / 2n;
    if ((await timeOf(middle)) <= timestamp) early = middle;
    else late = middle;
  }
  return early;
}
