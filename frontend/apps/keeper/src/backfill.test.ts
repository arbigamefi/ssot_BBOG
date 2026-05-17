import { describe, expect, it } from "vitest";

import { resolveBackfillRange } from "./backfill.js";

describe("resolveBackfillRange", () => {
  it("uses confirmed latest block when no explicit toBlock is provided", () => {
    expect(
      resolveBackfillRange({
        confirmations: 2n,
        fromBlock: 100n,
        latestBlock: 150n
      })
    ).toEqual({ fromBlock: 100n, toBlock: 148n });
  });

  it("caps explicit toBlock at the confirmed latest block", () => {
    expect(
      resolveBackfillRange({
        confirmations: 3n,
        fromBlock: 100n,
        latestBlock: 150n,
        toBlock: 200n
      })
    ).toEqual({ fromBlock: 100n, toBlock: 147n });
  });

  it("rejects an empty block range", () => {
    expect(() =>
      resolveBackfillRange({
        confirmations: 0n,
        fromBlock: 200n,
        latestBlock: 150n
      })
    ).toThrow(/before BET_INDEX_FROM_BLOCK/);
  });
});
