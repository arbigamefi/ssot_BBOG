import { describe, expect, it } from "vitest";
import { loadEmbeddedRelease } from "./loader";
import { ReleaseSchema } from "./schema";

const ADDRESS_1 = "0x1111111111111111111111111111111111111111";
const ADDRESS_2 = "0x2222222222222222222222222222222222222222";
const ADDRESS_3 = "0x3333333333333333333333333333333333333333";
const ADDRESS_4 = "0x4444444444444444444444444444444444444444";
const ADDRESS_5 = "0x5555555555555555555555555555555555555555";
const ADDRESS_6 = "0x6666666666666666666666666666666666666666";
const ADDRESS_7 = "0x7777777777777777777777777777777777777777";
const ADDRESS_8 = "0x8888888888888888888888888888888888888888";
const ADDRESS_9 = "0x9999999999999999999999999999999999999999";
const ADDRESS_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ADDRESS_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const GAME_ID = "0x8d8e6987fb3617c00abdd68d6c1f7eac28b7f9f96b25367e9b65dacaa0914a8b";
const HASH_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const HASH_C = "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

function v13ReleaseFixture() {
  return {
    chainId: 84532,
    name: "Base Sepolia",
    releaseDigest: "0xdeadbeefcafefeed",
    contracts: {
      gameHub: ADDRESS_1,
      settlementRouter: ADDRESS_2,
      poolRegistry: ADDRESS_3,
      sportsHub: ADDRESS_4,
      sportsRiskEngine: ADDRESS_5,
      vrfHub: ADDRESS_6,
      refRegistry: ADDRESS_7,
      refEngine: ADDRESS_8,
      adapter: ADDRESS_9
    },
    assets: [
      {
        symbol: "USDC",
        decimals: 6,
        address: ADDRESS_A,
        bank: ADDRESS_B
      }
    ],
    games: {
      [GAME_ID]: ADDRESS_8
    },
    gamesMeta: [
      {
        gameId: GAME_ID,
        slug: "dice",
        label: "Dice",
        module: ADDRESS_8,
        paramsEncoding: "abi.encode(uint8 cap)"
      }
    ],
    sports: {
      enabled: true,
      riskEngine: ADDRESS_5,
      sportsHub: ADDRESS_4,
      oddsSignerSetHash: HASH_A,
      resultReporterSetHash: HASH_B,
      resultReporterThreshold: "1",
      resultChallengeTimeoutSeconds: "604800",
      resultChallenger: ADDRESS_9,
      resultArbitrator: ADDRESS_A,
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
        asset: ADDRESS_A,
        bank: ADDRESS_B,
        symbol: "USDC",
        decimals: 6,
        sportsRisk: null
      },
      {
        poolId: 2,
        domainId: 2,
        domain: "Sports",
        active: true,
        asset: ADDRESS_A,
        bank: ADDRESS_7,
        symbol: "USDC",
        decimals: 6,
        sportsRisk: {
          maxStake: "1000000",
          maxPayout: "2000000",
          maxMarketReserved: "3000000",
          maxOutcomeReserved: "4000000",
          maxEventReserved: "5000000",
          riskHash: HASH_C
        }
      }
    ],
    meta: {
      blockNumber: 41462034,
      schemaVersion: 2,
      generatedAt: 1
    }
  };
}

describe("loadEmbeddedRelease", () => {
  it("returns ok:true for the embedded v1.3 chain-84532 release", () => {
    const result = loadEmbeddedRelease(84532);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");

    expect(result.release.chainId).toBe(84532);
    expect(result.release.meta?.schemaVersion).toBe(2);
    expect(result.release.contracts.gameHub).toMatch(/^0x[a-f0-9]{40}$/);
    expect(result.release.contracts.poolRegistry).toMatch(/^0x[a-f0-9]{40}$/);
    expect(result.release.contracts.sportsHub).toMatch(/^0x[a-f0-9]{40}$/);
    expect(result.release.assets.length).toBeGreaterThan(0);
    expect(result.release.gamesMeta.length).toBeGreaterThan(0);
    expect(result.release.pools.length).toBeGreaterThan(0);
  });

  it("returns error for unknown chainId", () => {
    const result = loadEmbeddedRelease(99999);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected error");
    expect(result.error).toContain("No embedded release for chainId=99999");
  });

  it("normalizes addresses to lowercase", () => {
    const result = loadEmbeddedRelease(84532);
    if (!result.ok) throw new Error("Expected ok");

    expect(result.release.contracts.gameHub).toBe(result.release.contracts.gameHub.toLowerCase());
    expect(result.release.contracts.poolRegistry).toBe(
      result.release.contracts.poolRegistry.toLowerCase()
    );
    for (const asset of result.release.assets) {
      expect(asset.address).toBe(asset.address.toLowerCase());
      expect(asset.bank).toBe(asset.bank.toLowerCase());
    }
  });

  it("does not warn about a usable real release", () => {
    const result = loadEmbeddedRelease(84532);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.release.isPlaceholder).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it("accepts only the v1.3 pool-aware release shape", () => {
    const parsed = ReleaseSchema.safeParse(v13ReleaseFixture());

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error(parsed.error.message);
    expect(parsed.data.sports.enabled).toBe(true);
    expect(parsed.data.contracts.sportsHub).toBe(ADDRESS_4);
    expect(parsed.data.pools[1]?.sportsRisk?.riskHash).toBe(HASH_C);
  });

  it("rejects the old hub-centric release shape", () => {
    const parsed = ReleaseSchema.safeParse({
      ...v13ReleaseFixture(),
      contracts: {
        hub: ADDRESS_1,
        vrfHub: ADDRESS_6,
        bankRegistry: ADDRESS_3
      },
      gamesMeta: undefined,
      sports: undefined,
      pools: undefined,
      meta: { schemaVersion: 1 }
    });

    expect(parsed.success).toBe(false);
  });
});
