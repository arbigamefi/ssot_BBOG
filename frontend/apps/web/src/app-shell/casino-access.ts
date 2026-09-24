import { getAppChain } from "./chain-registry";

/** Website availability only. Contract pause state is a separate control. */
export function isCasinoRiskInEnabledForChain(chainId: number) {
  const chain = getAppChain(chainId);
  if (!chain) return false;
  return (
    chain.environment === "testnet" || process.env.NEXT_PUBLIC_CASINO_RISK_IN_ENABLED === "true"
  );
}
