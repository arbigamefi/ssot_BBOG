import { afterEach, describe, expect, it } from "vitest";
import fixture from "../fixtures/release-v16.fixture.json";
import { embeddedChainIds, embeddedReleases } from "./embedded";
import { loadEmbeddedRelease } from "./loader";
import { ReleaseSchema } from "./schema";

afterEach(() => {
  delete embeddedReleases[31337];
});

describe("current release loading", () => {
  it("does not register local test metadata as an embedded deployment", () => {
    expect(embeddedChainIds).not.toContain(31337);
    expect(loadEmbeddedRelease(31337)).toEqual({
      ok: false,
      error: "No embedded release for chainId=31337"
    });
  });

  it("loads explicitly supplied test metadata with a placeholder warning", () => {
    embeddedReleases[31337] = fixture;
    const result = loadEmbeddedRelease(31337);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.release.meta?.releaseLock?.schema).toBe("SSOT_RELEASE_DIGEST_V16");
    expect(result.release.gamesMeta).toHaveLength(8);
    expect(result.warnings).toContain("Release snapshot is marked as placeholder");
  });

  it("normalizes addresses and rejects invalid pool metadata", () => {
    const mixedCase = "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD";
    const parsed = ReleaseSchema.parse({
      ...fixture,
      contracts: { ...fixture.contracts, gameHub: mixedCase }
    });
    expect(parsed.contracts.gameHub).toBe(mixedCase.toLowerCase());
    expect(
      ReleaseSchema.safeParse({ ...fixture, pools: [{ ...fixture.pools[0], decimals: 37 }] })
        .success
    ).toBe(false);
  });

  it("rejects a noncurrent lock and missing release identity", () => {
    expect(
      ReleaseSchema.safeParse({
        ...fixture,
        meta: { ...fixture.meta, releaseLock: { schema: "unsupported" } }
      }).success
    ).toBe(false);
    embeddedReleases[31337] = { ...fixture, meta: { schemaVersion: 2 } };
    expect(loadEmbeddedRelease(31337)).toEqual({
      ok: false,
      error: "Expected current v1.6 release metadata"
    });
  });
});
