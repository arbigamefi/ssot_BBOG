import type { Address } from "@ssot/ssot/sdk";
import { createPublicClient, getAddress, http } from "viem";

function createChain(chainId: number, rpcUrl: string) {
  return {
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Native", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } }
  } as const;
}

export function createProviderLedgerPublicClient(chainId: number, rpcUrl: string) {
  return createPublicClient({
    chain: createChain(chainId, rpcUrl),
    transport: http(rpcUrl)
  });
}

export function normalizeProviderLedgerAddress(value: string, label: string): Address {
  try {
    return getAddress(value) as Address;
  } catch {
    throw new Error(`${label} must be a valid address.`);
  }
}
