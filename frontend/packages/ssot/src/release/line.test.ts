import { describe, expect, it } from "vitest";

import { getReleaseLine, lpsKeepHouseEdgeShare } from "./line";
import { loadEmbeddedRelease } from "./loader";

const withSchema = (schema?: string) => ({ meta: { releaseLock: { schema } } });

describe("release line", () => {
  it("reads the line from the signed release lock", () => {
    expect(getReleaseLine(withSchema("SSOT_RELEASE_DIGEST_V15"))).toBe("v1.5");
    expect(getReleaseLine(withSchema("SSOT_RELEASE_DIGEST_V16"))).toBe("v1.6");
    expect(lpsKeepHouseEdgeShare(withSchema("SSOT_RELEASE_DIGEST_V16"))).toBe(true);
    expect(lpsKeepHouseEdgeShare(withSchema("SSOT_RELEASE_DIGEST_V15"))).toBe(false);
  });

  it("knows no line for a retired or unsigned release", () => {
    expect(getReleaseLine(withSchema("SSOT_RELEASE_DIGEST_V14"))).toBeUndefined();
    expect(getReleaseLine({ meta: {} })).toBeUndefined();
    expect(getReleaseLine(undefined)).toBeUndefined();
  });

  it("keeps the lock schema when an embedded release is parsed", () => {
    for (const chainId of [8453, 84532]) {
      const result = loadEmbeddedRelease(chainId);
      if (!result.ok) throw new Error(result.error);
      expect(getReleaseLine(result.release)).toBeDefined();
    }
  });
});
