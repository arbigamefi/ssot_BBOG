import { getAppChain } from "./chain-registry";

/** Website availability only. Contract pause state is a separate control. */
export function isCasinoRiskInEnabledForChain(chainId: number) {
  const chain = getAppChain(chainId);
  if (!chain) return false;
  return process.env.NEXT_PUBLIC_CASINO_RISK_IN_ENABLED === "true";
}

/** Website switch for LP deposits. Mature NFT withdrawals and debt claims use contract rules. */
export function isLpDepositEnabledForChain(chainId: number) {
  const chain = getAppChain(chainId);
  if (!chain) return false;
  return process.env.NEXT_PUBLIC_LP_DEPOSITS_ENABLED === "true";
}

export type CasinoAccess = "preview" | "testnet" | "live";

/** What the website offers on a chain: a preview until betting opens, then test play on a test chain or live play. */
export function getCasinoAccess(chainId: number): CasinoAccess {
  if (!isCasinoRiskInEnabledForChain(chainId)) return "preview";
  return getAppChain(chainId)?.environment === "testnet" ? "testnet" : "live";
}
