export type BlockRange = {
  fromBlock: bigint;
  toBlock: bigint;
};

export function splitBlockRange({
  fromBlock,
  toBlock,
  chunkSize
}: {
  fromBlock: bigint;
  toBlock: bigint;
  chunkSize: bigint;
}): BlockRange[] {
  if (chunkSize <= 0n) throw new Error("chunkSize must be greater than zero");
  if (toBlock < fromBlock) return [];

  const ranges: BlockRange[] = [];
  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const chunkEnd = cursor + chunkSize - 1n;
    const boundedEnd = chunkEnd < toBlock ? chunkEnd : toBlock;
    ranges.push({ fromBlock: cursor, toBlock: boundedEnd });
    cursor = boundedEnd + 1n;
  }
  return ranges;
}
