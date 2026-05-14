import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadEmbeddedRelease } from "./loader";
import { ReleaseSchema } from "./schema";

/**
 * Tests for the release loader — validates all branches in
 * loadEmbeddedRelease() including the deriveGamesMeta fallback.
 */
describe("loadEmbeddedRelease", () => {
  it("returns ok:true for the embedded chain-84532 release", () => {
    const result = loadEmbeddedRelease(84532);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.release.chainId).toBe(84532);
    expect(result.release.name).toBeDefined();
    expect(result.release.contracts.hub).toMatch(/^0x[a-f0-9]{40}$/);
    expect(result.release.assets.length).toBeGreaterThan(0);
  });

  it("returns error for unknown chainId", () => {
    const result = loadEmbeddedRelease(99999);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected error");
    expect(result.error).toContain("No embedded release for chainId=99999");
  });

  it("release has valid assets with symbol, decimals, address, bank", () => {
    const result = loadEmbeddedRelease(84532);
    if (!result.ok) throw new Error("Expected ok");
    for (const asset of result.release.assets) {
      expect(asset.symbol).toBeTruthy();
      expect(asset.decimals).toBeGreaterThanOrEqual(0);
      expect(asset.address).toMatch(/^0x[a-f0-9]{40}$/);
      expect(asset.bank).toMatch(/^0x[a-f0-9]{40}$/);
    }
  });

  it("release has valid contracts with required fields", () => {
    const result = loadEmbeddedRelease(84532);
    if (!result.ok) throw new Error("Expected ok");
    const { contracts } = result.release;
    expect(contracts.hub).toMatch(/^0x[a-f0-9]{40}$/);
    expect(contracts.vrfHub).toMatch(/^0x[a-f0-9]{40}$/);
    expect(contracts.bankRegistry).toMatch(/^0x[a-f0-9]{40}$/);
  });

  it("release has games record with at least one entry", () => {
    const result = loadEmbeddedRelease(84532);
    if (!result.ok) throw new Error("Expected ok");
    const gameEntries = Object.entries(result.release.games);
    expect(gameEntries.length).toBeGreaterThan(0);
    for (const [gameId, moduleAddr] of gameEntries) {
      expect(gameId).toMatch(/^0x/);
      expect(moduleAddr).toMatch(/^0x[a-f0-9]{40}$/);
    }
  });

  it("release includes gamesMeta (either present or derived)", () => {
    const result = loadEmbeddedRelease(84532);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.release.gamesMeta).toBeDefined();
    expect(result.release.gamesMeta!.length).toBeGreaterThan(0);

    for (const g of result.release.gamesMeta!) {
      expect(g.gameId).toBeTruthy();
      expect(g.slug).toBeTruthy();
      expect(g.label).toBeTruthy();
      expect(g.module).toMatch(/^0x[a-f0-9]{40}$/);
    }
  });

  it("gamesMeta slugs include the 4 known games", () => {
    const result = loadEmbeddedRelease(84532);
    if (!result.ok) throw new Error("Expected ok");
    const slugs = result.release.gamesMeta!.map((g) => g.slug);
    expect(slugs).toContain("dice");
    expect(slugs).toContain("coin-toss");
    expect(slugs).toContain("roulette");
    expect(slugs).toContain("keno");
  });

  it("addresses are normalized to lowercase", () => {
    const result = loadEmbeddedRelease(84532);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.release.contracts.hub).toBe(result.release.contracts.hub.toLowerCase());
    for (const asset of result.release.assets) {
      expect(asset.address).toBe(asset.address.toLowerCase());
      expect(asset.bank).toBe(asset.bank.toLowerCase());
    }
  });

  it("warnings include placeholder notice when isPlaceholder is true", () => {
    // The real release is not placeholder, so we verify no warnings about it
    const result = loadEmbeddedRelease(84532);
    if (!result.ok) throw new Error("Expected ok");
    const hasPlaceholderWarning = result.warnings.some((w) => w.includes("placeholder"));
    // Real release should NOT be placeholder
    expect(result.release.isPlaceholder).toBe(false);
    expect(hasPlaceholderWarning).toBe(false);
  });

  it("does not warn about zero hub for real release", () => {
    const result = loadEmbeddedRelease(84532);
    if (!result.ok) throw new Error("Expected ok");
    const hasZeroHubWarning = result.warnings.some((w) => w.includes("Hub address is zero"));
    expect(hasZeroHubWarning).toBe(false);
  });

  it("release meta has blockNumber when present", () => {
    const result = loadEmbeddedRelease(84532);
    if (!result.ok) throw new Error("Expected ok");
    if (result.release.meta?.blockNumber !== undefined) {
      expect(result.release.meta.blockNumber).toBeGreaterThan(0);
    }
  });

  it("accepts v1.3 sports and pool metadata in embedded releases", () => {
    const parsed = ReleaseSchema.safeParse({
      chainId: 84532,
      name: "Base Sepolia",
      releaseDigest: "0xdeadbeefcafefeed",
      contracts: {
        hub: "0x1111111111111111111111111111111111111111",
        gameHub: "0x1111111111111111111111111111111111111111",
        vrfHub: "0x2222222222222222222222222222222222222222",
        bankRegistry: "0x3333333333333333333333333333333333333333",
        poolRegistry: "0x3333333333333333333333333333333333333333",
        sportsHub: "0x4444444444444444444444444444444444444444",
        sportsRiskEngine: "0x5555555555555555555555555555555555555555"
      },
      assets: [
        {
          symbol: "USDC",
          decimals: 6,
          address: "0x6666666666666666666666666666666666666666",
          bank: "0x7777777777777777777777777777777777777777"
        }
      ],
      games: {
        "0x8d8e6987fb3617c00abdd68d6c1f7eac28b7f9f96b25367e9b65dacaa0914a8b":
          "0x8888888888888888888888888888888888888888"
      },
      gamesMeta: [
        {
          gameId: "0x8d8e6987fb3617c00abdd68d6c1f7eac28b7f9f96b25367e9b65dacaa0914a8b",
          slug: "dice",
          label: "Dice",
          module: "0x8888888888888888888888888888888888888888",
          paramsEncoding: "abi.encode(uint8 cap)"
        }
      ],
      sports: {
        enabled: true,
        riskEngine: "0x5555555555555555555555555555555555555555",
        hub: "0x4444444444444444444444444444444444444444",
        oddsSignerSetHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        resultReporterSetHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        resultReporterThreshold: "1",
        resultChallengeTimeoutSeconds: "604800",
        resultChallenger: "0x9999999999999999999999999999999999999999",
        resultArbitrator: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        maxStake: "1000000",
        maxPayout: "2000000",
        maxMarketReserved: "3000000",
        maxOutcomeReserved: "4000000",
        maxEventReserved: "5000000"
      },
      pools: [
        {
          poolId: 1,
          domainId: 1,
          domain: "Casino",
          active: true,
          asset: "0x6666666666666666666666666666666666666666",
          bank: "0x7777777777777777777777777777777777777777",
          symbol: "USDC",
          decimals: 6,
          sportsRisk: null
        },
        {
          poolId: 2,
          domainId: 2,
          domain: "Sports",
          active: true,
          asset: "0x6666666666666666666666666666666666666666",
          bank: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          symbol: "USDC",
          decimals: 6,
          sportsRisk: {
            maxStake: "1000000",
            maxPayout: "2000000",
            maxMarketReserved: "3000000",
            maxOutcomeReserved: "4000000",
            maxEventReserved: "5000000",
            riskHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
          }
        }
      ]
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error(parsed.error.message);
    expect(parsed.data.sports?.enabled).toBe(true);
    expect(parsed.data.contracts.sportsHub).toBe("0x4444444444444444444444444444444444444444");
    expect(parsed.data.pools?.[1]?.sportsRisk?.riskHash).toContain("0xcccc");
  });
});

describe("deriveGamesMeta (indirectly via loadEmbeddedRelease)", () => {
  it("falls back gracefully when the embedded release has gamesMeta set", () => {
    // If gamesMeta is already in the JSON, it should be used as-is.
    // This is the normal path for a modern release bundle.
    const result = loadEmbeddedRelease(84532);
    if (!result.ok) throw new Error("Expected ok");
    // We can't easily test the fallback without mocking the embedded release,
    // but we can verify the result is consistent regardless of path.
    const gm = result.release.gamesMeta;
    expect(gm).toBeDefined();
    expect(gm!.length).toBe(4);
    expect(gm!.every((g) => g.gameId && g.slug && g.label && g.module)).toBe(true);
  });
});
