import { getAppChain } from "./chain-registry";

/** Website availability only. Contract pause state is a separate control. */
export function isCasinoRiskInEnabledForChain(chainId: number) {
  const chain = getAppChain(chainId);
  if (!chain) return false;
  return (
    chain.environment === "testnet" || process.env.NEXT_PUBLIC_CASINO_RISK_IN_ENABLED === "true"
  );
}

/**
 * LP deposits have their own website switch. Under the v1.5 rules the house edge
 * accrues to protocol fees and referral rewards, not to LP shares, so mainnet
 * deposits stay closed until the pool terms change. Keeping this separate from the
 * betting switch means opening mainnet bets cannot quietly reopen deposits.
 *
 * Withdrawals are not gated here. Contract pause state is a separate control and,
 * when set, blocks withdrawals too.
 */
export function isLpDepositEnabledForChain(chainId: number) {
  const chain = getAppChain(chainId);
  if (!chain) return false;
  return chain.environment === "testnet" || process.env.NEXT_PUBLIC_LP_DEPOSITS_ENABLED === "true";
}
