import type { PublicClient } from "viem";

/** Base's fastest block rate so far (Denim): the conversion before a rate is measured counts more blocks, not fewer. */
const MAX_BLOCKS_PER_SECOND = 5;
/** Timestamps are whole seconds, so the rate is measured over at least this long. */
const RATE_WINDOW_SECONDS = 60n;
/** Blocks behind the first latest block whose timestamp gives a rate before a second read. */
const FIRST_SAMPLE_BLOCKS = 300n;

export type BlockHead = { number: bigint; timestamp: bigint };

export interface BlockClock {
  /** Reads the latest block and updates the measured rate. */
  latest(): Promise<BlockHead>;
  /** The blocks that cover `seconds` at the measured rate, rounded up. */
  blocks(seconds: number): number;
  /** Blocks a second over the last minute of latest blocks; undefined until measured. */
  readonly blocksPerSecond: number | undefined;
  /**
   * A block no later than `timestamp`, starting from an estimate: the estimate itself when it is old enough (one
   * read), otherwise the last such block, found by stepping back at five blocks a second, doubling, and bisecting.
   * Undefined when even `floor` is later. The measured rate alone can count too few blocks across a rate change.
   */
  atOrBefore(timestamp: bigint, estimate: bigint, floor: bigint): Promise<BlockHead | undefined>;
}

/**
 * Turns durations into block counts at the chain's own rate. Base made a block every two seconds before Denim and
 * makes five a second after it, so a count fixed in blocks would mean ten times less time.
 */
export function createBlockClock(publicClient: Pick<PublicClient, "getBlock">): BlockClock {
  const heads: BlockHead[] = [];
  let blocksPerSecond: number | undefined;

  return {
    async latest() {
      const block = await publicClient.getBlock();
      if (block.number == null) throw new Error("The latest block has no number");
      const head = { number: block.number, timestamp: block.timestamp };
      if (heads.length === 0) {
        const number = head.number > FIRST_SAMPLE_BLOCKS ? head.number - FIRST_SAMPLE_BLOCKS : 0n;
        const sample = await publicClient.getBlock({ blockNumber: number });
        heads.push({ number, timestamp: sample.timestamp });
      }
      heads.push(head);
      // Measure from the newest earlier head that is at least a window older.
      while (heads.length > 2 && head.timestamp - heads[1]!.timestamp >= RATE_WINDOW_SECONDS)
        heads.shift();
      const oldest = heads[0]!;
      if (head.timestamp > oldest.timestamp && head.number > oldest.number)
        blocksPerSecond =
          Number(head.number - oldest.number) / Number(head.timestamp - oldest.timestamp);
      return head;
    },
    blocks(seconds) {
      return Math.ceil(seconds * (blocksPerSecond ?? MAX_BLOCKS_PER_SECOND));
    },
    get blocksPerSecond() {
      return blocksPerSecond;
    },
    async atOrBefore(timestamp, estimate, floor) {
      const read = async (number: bigint): Promise<BlockHead> => ({
        number,
        timestamp: (await publicClient.getBlock({ blockNumber: number })).timestamp
      });
      let late = await read(estimate > floor ? estimate : floor);
      if (late.timestamp <= timestamp) return late;
      let step = (late.timestamp - timestamp + 1n) * BigInt(MAX_BLOCKS_PER_SECOND);
      let early: BlockHead;
      for (;;) {
        if (late.number - step <= floor) {
          const first = await read(floor);
          if (first.timestamp > timestamp) return undefined;
          early = first;
          break;
        }
        const probe = await read(late.number - step);
        if (probe.timestamp <= timestamp) {
          early = probe;
          break;
        }
        late = probe;
        step *= 2n;
      }
      while (late.number - early.number > 1n) {
        const middle = await read((early.number + late.number) / 2n);
        if (middle.timestamp <= timestamp) early = middle;
        else late = middle;
      }
      return early;
    }
  };
}
