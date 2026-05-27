import { embeddedChainIds } from "@ssot/ssot/release";

export type AppChainEnvironment = "mainnet" | "testnet";

export type AppChain = {
  id: number;
  name: string;
  shortName: string;
  environment: AppChainEnvironment;
  explorerUrl: string;
};

const CHAIN_METADATA: Record<number, AppChain> = {
  8453: {
    id: 8453,
    name: "Base Mainnet",
    shortName: "Base",
    environment: "mainnet",
    explorerUrl: "https://basescan.org"
  },
  84532: {
    id: 84532,
    name: "Base Sepolia",
    shortName: "Base Sepolia",
    environment: "testnet",
    explorerUrl: "https://sepolia.basescan.org"
  }
};

function compareChains(a: AppChain, b: AppChain) {
  if (a.environment !== b.environment) {
    return a.environment === "mainnet" ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

export function getAppChain(chainId: number) {
  return CHAIN_METADATA[chainId];
}

export function getSupportedAppChains() {
  return embeddedChainIds
    .map((chainId) => CHAIN_METADATA[chainId])
    .filter((chain): chain is AppChain => Boolean(chain))
    .sort(compareChains);
}

export function isSupportedAppChain(chainId: number) {
  return getSupportedAppChains().some((chain) => chain.id === chainId);
}

export function resolveDefaultAppChainId(rawChainId?: string | number) {
  const supported = getSupportedAppChains();
  const parsed = Number(rawChainId);
  if (Number.isInteger(parsed) && supported.some((chain) => chain.id === parsed)) {
    return parsed;
  }
  return (
    supported.find((chain) => chain.environment === "mainnet")?.id ?? supported[0]?.id ?? 84532
  );
}
