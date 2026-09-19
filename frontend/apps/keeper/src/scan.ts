export type BlockRange = {
  fromBlock: bigint;
  toBlock: bigint;
};

export function splitBlockRange({
  fromBlock,
  toBlock,
  chunkSize,
  maxChunks
}: {
  fromBlock: bigint;
  toBlock: bigint;
  chunkSize: bigint;
  /**
   * Cap on how many chunks a single call may produce. A cursor that has fallen
   * far behind otherwise expands into one provider request per chunk with no
   * upper bound — a two-month gap at a 10-block chunk size is ~750k `eth_getLogs`
   * calls, which is how a provider quota gets consumed in a day.
   *
   * Only pass this where the caller advances its cursor per chunk, so the next
   * pass resumes where this one stopped. Callers that rescan a fixed range from
   * the start every time must stay uncapped or they would silently return
   * partial results.
   */
  maxChunks?: number;
}): BlockRange[] {
  if (chunkSize <= 0n) throw new Error("chunkSize must be greater than zero");
  if (maxChunks != null && maxChunks <= 0) throw new Error("maxChunks must be greater than zero");
  if (toBlock < fromBlock) return [];

  const ranges: BlockRange[] = [];
  let cursor = fromBlock;
  while (cursor <= toBlock) {
    if (maxChunks != null && ranges.length >= maxChunks) break;
    const chunkEnd = cursor + chunkSize - 1n;
    const boundedEnd = chunkEnd < toBlock ? chunkEnd : toBlock;
    ranges.push({ fromBlock: cursor, toBlock: boundedEnd });
    cursor = boundedEnd + 1n;
  }
  return ranges;
}

/**
 * Whether a capped split stopped short of the head, meaning the cursor will
 * resume next pass. An empty split is not truncated: there was nothing to scan.
 */
export function isScanTruncated(ranges: BlockRange[], toBlock: bigint): boolean {
  const last = ranges[ranges.length - 1];
  return last != null && last.toBlock < toBlock;
}
