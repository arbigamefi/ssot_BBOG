import { describe, expect, it } from "vitest";
import type { SSOTRelease } from "@ssot/ssot/release";

import { resolveSportsbookAccess } from "./ReleaseProvider";

const BASE_RELEASE: SSOTRelease = {
  chainId: 84532,
  name: "Base Sepolia",
  releaseDigest: "0xdeadbeefcafefeed",
  isPlaceholder: false,
  contracts: {
    gameHub: "0x1111111111111111111111111111111111111111",
    settlementRouter: "0x2222222222222222222222222222222222222222",
    poolRegistry: "0x3333333333333333333333333333333333333333",
    sportsHub: "0x6666666666666666666666666666666666666666",
    sportsRiskEngine: "0x7777777777777777777777777777777777777777",
    vrfHub: "0x8888888888888888888888888888888888888888",
    refRegistry: "0x9999999999999999999999999999999999999999",
    refEngine: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    adapter: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  },
  assets: [
    {
      symbol: "USDC",
      decimals: 6,
      address: "0x4444444444444444444444444444444444444444",
      bank: "0x5555555555555555555555555555555555555555"
    }
  ],
  games: {},
  gamesMeta: [
    {
      gameId: "0x8d8e6987fb3617c00abdd68d6c1f7eac28b7f9f96b25367e9b65dacaa0914a8b",
      slug: "dice",
      label: "Dice",
      module: "0xcccccccccccccccccccccccccccccccccccccccc"
    }
  ],
  sports: {
    enabled: false,
    riskEngine: "0x7777777777777777777777777777777777777777",
    sportsHub: "0x6666666666666666666666666666666666666666",
    oddsSignerSetHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    resultReporterSetHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    resultReporterThreshold: "1",
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
      asset: "0x4444444444444444444444444444444444444444",
      bank: "0x5555555555555555555555555555555555555555",
      symbol: "USDC",
      decimals: 6,
      sportsRisk: null
    }
  ]
};

describe("resolveSportsbookAccess", () => {
  it("keeps sportsbook entry disabled by default", () => {
    const access = resolveSportsbookAccess(
      {
        ...BASE_RELEASE,
        contracts: {
          ...BASE_RELEASE.contracts,
          sportsHub: "0x6666666666666666666666666666666666666666"
        },
        sports: {
          enabled: true,
          sportsHub: "0x6666666666666666666666666666666666666666",
          riskEngine: "0x7777777777777777777777777777777777777777",
          oddsSignerSetHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          resultReporterSetHash:
            "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          resultReporterThreshold: "1",
          resultChallengeTimeoutSeconds: "604800",
          resultChallenger: "0x8888888888888888888888888888888888888888",
          resultArbitrator: "0x9999999999999999999999999999999999999999",
          maxStake: "1000000",
          maxPayout: "2000000",
          maxMarketReserved: "3000000",
          maxOutcomeReserved: "4000000",
          maxEventReserved: "5000000"
        }
      },
      undefined
    );

    expect(access.enabled).toBe(false);
    expect(access.frontendEnabled).toBe(false);
    expect(access.hasSportsRelease).toBe(true);
    expect(access.disabledReason).toContain("NEXT_PUBLIC_SPORTSBOOK_ENABLED");
  });

  it("requires enabled SportsHub metadata even when the frontend flag is true", () => {
    const access = resolveSportsbookAccess(BASE_RELEASE, "true");

    expect(access.enabled).toBe(false);
    expect(access.frontendEnabled).toBe(true);
    expect(access.hasSportsRelease).toBe(false);
    expect(access.disabledReason).toContain("SportsHub metadata");
  });

  it("enables sportsbook entry only when both the flag and release metadata are present", () => {
    const access = resolveSportsbookAccess(
      {
        ...BASE_RELEASE,
        sports: {
          enabled: true,
          sportsHub: "0x6666666666666666666666666666666666666666",
          riskEngine: "0x7777777777777777777777777777777777777777",
          oddsSignerSetHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          resultReporterSetHash:
            "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          resultReporterThreshold: "1",
          maxStake: "1000000",
          maxPayout: "2000000",
          maxMarketReserved: "3000000",
          maxOutcomeReserved: "4000000",
          maxEventReserved: "5000000"
        }
      },
      "true"
    );

    expect(access.enabled).toBe(true);
    expect(access.frontendEnabled).toBe(true);
    expect(access.hasSportsRelease).toBe(true);
    expect(access.disabledReason).toBeUndefined();
  });
});
