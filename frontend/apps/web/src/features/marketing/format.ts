import { formatUnits } from "../betting/model/units";

export function formatTokenAmount(value: bigint | undefined, decimals: number, symbol?: string) {
  if (value == null) return "Syncing";
  const raw = formatUnits(value, decimals);
  const [intPart = "0", fracPart = ""] = raw.split(".");
  const cleanedFrac = fracPart.slice(0, 2).replace(/0+$/, "");
  const amount = `${BigInt(intPart || "0").toLocaleString("en-US")}${cleanedFrac ? `.${cleanedFrac}` : ""}`;
  return symbol ? `${amount} ${symbol}` : amount;
}

export function shortDigest(value?: string) {
  if (!value) return "Pending";
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export function shortAddress(value?: string) {
  if (!value) return "Wallet pending";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function timeAgo(value?: number) {
  if (!value) return "just now";
  const diffMs = Math.max(0, Date.now() - value);
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 15) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
