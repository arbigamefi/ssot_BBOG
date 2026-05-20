import { formatUnits } from "../../betting/model/units";

export function shortHex(value?: string | null, pendingLabel = "—") {
  if (!value) return pendingLabel;
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatAmount(
  value: bigint | undefined,
  decimals: number,
  symbol?: string,
  pendingLabel = "—"
) {
  if (value == null) return pendingLabel;
  const raw = formatUnits(value, decimals);
  const negative = raw.startsWith("-");
  const normalized = negative ? raw.slice(1) : raw;
  const [intPart = "0", fracPart = ""] = normalized.split(".");
  const integer = BigInt(intPart || "0").toLocaleString("en-US");
  const fraction = fracPart.slice(0, 4).replace(/0+$/, "");
  const body = `${negative ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
  return symbol ? `${body} ${symbol}` : body;
}

export function formatAllowance(
  value: bigint,
  decimals: number,
  unlimitedLabel = "∞",
  pendingLabel = "—"
) {
  return value > 1_000_000_000_000_000_000n
    ? unlimitedLabel
    : formatAmount(value, decimals, undefined, pendingLabel);
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

export function mapJournalStatus(status: string) {
  switch (status) {
    case "submitted":
      return "submitting";
    case "mined":
      return "mined";
    case "failed":
    case "timeout":
      return "failed";
    default:
      return "idle";
  }
}
