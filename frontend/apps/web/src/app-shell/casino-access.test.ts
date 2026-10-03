import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isCasinoRiskInEnabledForChain, isLpDepositEnabledForChain } from "./casino-access";

const BASE_MAINNET = 8453;
const BASE_SEPOLIA = 84532;

describe("casino website availability", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_LP_DEPOSITS_ENABLED", undefined);
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe.each([BASE_MAINNET, BASE_SEPOLIA])("chain %i", (chainId) => {
    it.each([undefined, "false", "1", "TRUE", ""])(
      "keeps betting and deposits closed for a non-explicit flag %s",
      (flag) => {
        vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", flag);
        vi.stubEnv("NEXT_PUBLIC_LP_DEPOSITS_ENABLED", flag);
        expect(isCasinoRiskInEnabledForChain(chainId)).toBe(false);
        expect(isLpDepositEnabledForChain(chainId)).toBe(false);
      }
    );

    it("opens betting independently from LP deposits", () => {
      vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "true");
      expect(isCasinoRiskInEnabledForChain(chainId)).toBe(true);
      expect(isLpDepositEnabledForChain(chainId)).toBe(false);
    });

    it("opens LP deposits independently from betting", () => {
      vi.stubEnv("NEXT_PUBLIC_LP_DEPOSITS_ENABLED", "true");
      expect(isLpDepositEnabledForChain(chainId)).toBe(true);
      expect(isCasinoRiskInEnabledForChain(chainId)).toBe(false);
    });

    it("opens both only when both flags are explicitly true", () => {
      vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "true");
      vi.stubEnv("NEXT_PUBLIC_LP_DEPOSITS_ENABLED", "true");
      expect(isCasinoRiskInEnabledForChain(chainId)).toBe(true);
      expect(isLpDepositEnabledForChain(chainId)).toBe(true);
    });
  });

  it("fails closed on unknown chains even when both flags are true", () => {
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_LP_DEPOSITS_ENABLED", "true");
    expect(isCasinoRiskInEnabledForChain(999_999)).toBe(false);
    expect(isLpDepositEnabledForChain(999_999)).toBe(false);
  });
});
