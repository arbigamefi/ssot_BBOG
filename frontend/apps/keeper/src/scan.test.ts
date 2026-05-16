import { describe, expect, it } from "vitest";
import { splitBlockRange } from "./scan.js";

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
});
