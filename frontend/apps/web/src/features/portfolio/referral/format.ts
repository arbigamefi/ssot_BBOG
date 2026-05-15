import type { DomainError } from "@ssot/ssot";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function isAddressLike(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function shortHex(value?: string | null) {
  if (!value) return "Pending";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function getExplorerBaseUrl(chainId: number) {
  switch (chainId) {
    case 84532:
      return "https://sepolia.basescan.org";
    case 8453:
      return "https://basescan.org";
    case 42161:
      return "https://arbiscan.io";
    case 421614:
      return "https://sepolia.arbiscan.io";
    default:
      return undefined;
  }
}

export function serializeErrorDetails(error?: DomainError) {
  if (!error?.details) return undefined;
  return JSON.stringify(
    error.details,
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  );
}
