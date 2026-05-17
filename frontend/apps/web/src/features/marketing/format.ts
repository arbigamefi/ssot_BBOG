import { formatUnits } from "../betting/model/units";

export function formatTokenAmount(
  value: bigint | undefined,
  decimals: number,
  symbol?: string,
  locale = "en-US",
  pendingLabel = "Syncing"
) {
  if (value == null) return pendingLabel;
  const raw = formatUnits(value, decimals);
  const [intPart = "0", fracPart = ""] = raw.split(".");
  const cleanedFrac = fracPart.slice(0, 2).replace(/0+$/, "");
  const amount = `${BigInt(intPart || "0").toLocaleString(locale)}${cleanedFrac ? `.${cleanedFrac}` : ""}`;
  return symbol ? `${amount} ${symbol}` : amount;
}

export function shortDigest(value?: string, pendingLabel = "Pending") {
  if (!value) return pendingLabel;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export function shortAddress(value?: string, pendingLabel = "Wallet pending") {
  if (!value) return pendingLabel;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export type TimeAgoLabels = {
  now: string;
  seconds: (count: number) => string;
  minutes: (count: number) => string;
  hours: (count: number) => string;
  days: (count: number) => string;
};

const DEFAULT_TIME_AGO_LABELS: TimeAgoLabels = {
  now: "just now",
  seconds: (count) => `${count}s ago`,
  minutes: (count) => `${count}m ago`,
  hours: (count) => `${count}h ago`,
  days: (count) => `${count}d ago`
};

export function timeAgo(value?: number, labels = DEFAULT_TIME_AGO_LABELS) {
  if (!value) return labels.now;
  const diffMs = Math.max(0, Date.now() - value);
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 15) return labels.now;
  if (diffSeconds < 60) return labels.seconds(diffSeconds);
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return labels.minutes(diffMinutes);
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return labels.hours(diffHours);
  return labels.days(Math.floor(diffHours / 24));
}
