import { describe, expect, it } from "vitest";
import { isScanRangeOverBudget, isScanTruncated, splitBlockRange } from "./scan.js";

describe("splitBlockRange", () => {
  it("returns no ranges when the cursor has already caught up", () => {
    expect(splitBlockRange({ fromBlock: 12n, toBlock: 11n, chunkSize: 10n })).toEqual([]);
  });

  it("keeps small scans in a single range", () => {
    expect(splitBlockRange({ fromBlock: 10n, toBlock: 19n, chunkSize: 10n })).toEqual([
      { fromBlock: 10n, toBlock: 19n }
    ]);
  });

  it("splits larger scans into bounded provider-safe chunks", () => {
    expect(splitBlockRange({ fromBlock: 10n, toBlock: 31n, chunkSize: 10n })).toEqual([
      { fromBlock: 10n, toBlock: 19n },
      { fromBlock: 20n, toBlock: 29n },
      { fromBlock: 30n, toBlock: 31n }
    ]);
  });

  it("caps how many chunks one pass may produce", () => {
    expect(splitBlockRange({ fromBlock: 10n, toBlock: 99n, chunkSize: 10n, maxChunks: 2 })).toEqual(
      [
        { fromBlock: 10n, toBlock: 19n },
        { fromBlock: 20n, toBlock: 29n }
      ]
    );
  });

  it("resumes from where a capped pass stopped, so catch-up still completes", () => {
    const first = splitBlockRange({ fromBlock: 10n, toBlock: 49n, chunkSize: 10n, maxChunks: 2 });
    const resumeFrom = first[first.length - 1]!.toBlock + 1n;
    const second = splitBlockRange({
      fromBlock: resumeFrom,
      toBlock: 49n,
      chunkSize: 10n,
      maxChunks: 2
    });

    expect([...first, ...second]).toEqual(
      splitBlockRange({ fromBlock: 10n, toBlock: 49n, chunkSize: 10n })
    );
  });

  it("leaves scans under the cap untouched", () => {
    expect(
      splitBlockRange({ fromBlock: 10n, toBlock: 31n, chunkSize: 10n, maxChunks: 50 })
    ).toEqual(splitBlockRange({ fromBlock: 10n, toBlock: 31n, chunkSize: 10n }));
  });

  it("bounds a months-long backlog that would otherwise be one request per chunk", () => {
    // The production incident: a ~2.6M block gap at a 10-block chunk size
    // expanded into ~260k eth_getLogs calls in a single pass.
    const uncapped = splitBlockRange({ fromBlock: 1n, toBlock: 2_600_000n, chunkSize: 10n });
    const capped = splitBlockRange({
      fromBlock: 1n,
      toBlock: 2_600_000n,
      chunkSize: 10n,
      maxChunks: 200
    });

    expect(uncapped.length).toBe(260_000);
    expect(capped.length).toBe(200);
  });

  it("rejects a non-positive cap rather than scanning nothing forever", () => {
    expect(() =>
      splitBlockRange({ fromBlock: 10n, toBlock: 99n, chunkSize: 10n, maxChunks: 0 })
    ).toThrow(/maxChunks/);
  });
});

describe("isScanTruncated", () => {
  it("reports a capped pass that stopped short of the head", () => {
    const ranges = splitBlockRange({ fromBlock: 10n, toBlock: 99n, chunkSize: 10n, maxChunks: 2 });

    expect(isScanTruncated(ranges, 99n)).toBe(true);
  });

  it("stays quiet once the pass reaches the head", () => {
    const ranges = splitBlockRange({ fromBlock: 10n, toBlock: 39n, chunkSize: 10n, maxChunks: 50 });

    expect(isScanTruncated(ranges, 39n)).toBe(false);
  });

  it("treats an empty split as nothing to scan rather than a backlog", () => {
    expect(isScanTruncated([], 99n)).toBe(false);
  });

  it("stays quiet on an exactly-filled final chunk", () => {
    // Off-by-one guard: the last chunk ending exactly on the head is caught up.
    const ranges = splitBlockRange({ fromBlock: 10n, toBlock: 29n, chunkSize: 10n, maxChunks: 2 });

    expect(ranges[ranges.length - 1]).toEqual({ fromBlock: 20n, toBlock: 29n });
    expect(isScanTruncated(ranges, 29n)).toBe(false);
  });
});

describe("isScanRangeOverBudget", () => {
  it("allows a range at the budget", () => {
    expect(isScanRangeOverBudget({ fromBlock: 100n, toBlock: 1_100n, maxBlocks: 1_000n })).toBe(
      false
    );
  });

  it("refuses a range one block past the budget", () => {
    expect(isScanRangeOverBudget({ fromBlock: 100n, toBlock: 1_101n, maxBlocks: 1_000n })).toBe(
      true
    );
  });

  it("refuses the Base mainnet full-history rescan this guards against", () => {
    // Sports ticket discovery defaults its start to the release block. On Base
    // mainnet that is ~4.5M blocks back, and at a 10-block chunk size it would
    // be ~450k eth_getLogs per call, per market, retried up to 8 times.
    expect(
      isScanRangeOverBudget({
        fromBlock: 46_970_755n,
        toBlock: 51_526_000n,
        maxBlocks: 50_000n
      })
    ).toBe(true);
  });

  it("allows a freshly deployed release where the start is near the head", () => {
    expect(
      isScanRangeOverBudget({
        fromBlock: 51_500_000n,
        toBlock: 51_526_000n,
        maxBlocks: 50_000n
      })
    ).toBe(false);
  });

  it("treats a head behind the start as nothing to scan", () => {
    expect(isScanRangeOverBudget({ fromBlock: 200n, toBlock: 100n, maxBlocks: 10n })).toBe(false);
  });
});
