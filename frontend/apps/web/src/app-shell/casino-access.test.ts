import { afterEach, describe, expect, it } from "vitest";

import { isLpDepositEnabledForChain } from "./casino-access";

const BASE_MAINNET = 8453;
const BASE_SEPOLIA = 84532;

describe("isLpDepositEnabledForChain", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_LP_DEPOSITS_ENABLED;
    delete process.env.NEXT_PUBLIC_CASINO_RISK_IN_ENABLED;
  });

  it("keeps mainnet deposits closed unless they are explicitly opened", () => {
    expect(isLpDepositEnabledForChain(BASE_MAINNET)).toBe(false);

    process.env.NEXT_PUBLIC_LP_DEPOSITS_ENABLED = "true";
    expect(isLpDepositEnabledForChain(BASE_MAINNET)).toBe(true);
  });

  // Under v1.5 the house edge is not an LP share. Opening mainnet bets is a
  // separate decision and must not quietly reopen deposits with it.
  it("does not reopen deposits when mainnet betting is opened", () => {
    process.env.NEXT_PUBLIC_CASINO_RISK_IN_ENABLED = "true";
    expect(isLpDepositEnabledForChain(BASE_MAINNET)).toBe(false);
  });

  it("leaves testnet deposits open and fails closed on unknown chains", () => {
    expect(isLpDepositEnabledForChain(BASE_SEPOLIA)).toBe(true);
    expect(isLpDepositEnabledForChain(999_999)).toBe(false);
  });
});
