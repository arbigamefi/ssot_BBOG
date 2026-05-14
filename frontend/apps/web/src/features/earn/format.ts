import type { DomainError } from "@ssot/ssot";

import { formatUnits } from "../betting/model/units";

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

export function formatBps(value?: number) {
  return value == null ? "Pending" : `${value} bps`;
}

export function formatPctFromBps(value?: number) {
  return value == null ? "Pending" : `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}%`;
}

export function shortHex(value?: string) {
  if (!value) return "Pending";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatTokenAmount(
  value: bigint | undefined,
  decimals: number,
  symbol?: string,
  maxFractionDigits = 4
) {
  if (value == null) return "Pending";
  const raw = formatUnits(value, decimals);
  const negative = raw.startsWith("-");
  const normalized = negative ? raw.slice(1) : raw;
  const [intPart = "0", fracPart = ""] = normalized.split(".");
  const integer = BigInt(intPart || "0").toLocaleString("en-US");
  const fraction = fracPart.slice(0, maxFractionDigits).replace(/0+$/, "");
  const body = `${negative ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
  return symbol ? `${body} ${symbol}` : body;
}

export function serializeErrorDetails(error?: DomainError) {
  if (!error?.details) return undefined;
  return JSON.stringify(
    error.details,
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  );
}
