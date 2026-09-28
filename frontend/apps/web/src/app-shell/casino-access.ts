import { getAppChain } from "./chain-registry";

/** Website availability only. Contract pause state is a separate control. */
export function isCasinoRiskInEnabledForChain(chainId: number) {
  const chain = getAppChain(chainId);
  if (!chain) return false;
  return (
    chain.environment === "testnet" || process.env.NEXT_PUBLIC_CASINO_RISK_IN_ENABLED === "true"
  );
}

/** Website switch for LP deposits. Batch requests and claims use their own contract rules. */
export function isLpDepositEnabledForChain(chainId: number) {
  const chain = getAppChain(chainId);
  if (!chain) return false;
  return chain.environment === "testnet" || process.env.NEXT_PUBLIC_LP_DEPOSITS_ENABLED === "true";
}
