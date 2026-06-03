import type { DomainError } from "@ssot/ssot";

import { getAppChain } from "../../app-shell/chain-registry";
import { formatUnits } from "../betting/model/units";

export function getExplorerBaseUrl(chainId: number) {
  return getAppChain(chainId)?.explorerUrl;
}

export function formatBps(value?: number) {
  return value == null ? "—" : `${value} bps`;
}

export function formatPctFromBps(value?: number) {
  return value == null ? "—" : `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}%`;
}

export function shortHex(value?: string) {
  if (!value) return "—";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatTokenAmount(
  value: bigint | undefined,
  decimals: number,
  symbol?: string,
  maxFractionDigits = 4
) {
  if (value == null) return "—";
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
