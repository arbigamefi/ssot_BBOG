export function shortHex(value?: string) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatRawUnits(value?: string) {
  if (!value) return "—";
  try {
    return BigInt(value).toLocaleString("en-US");
  } catch {
    return value;
  }
}

export function formatCounter(value?: bigint) {
  return value === undefined ? "—" : value.toString();
}

const utcDateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC"
});

export function formatTimestamp(value?: number) {
  if (!value) return "—";
  return utcDateTimeFormatter.format(new Date(value * 1000));
}

export function formatDuration(value?: string) {
  if (!value) return "—";
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return value;
  const days = seconds / 86_400;
  if (Number.isInteger(days)) return `${days}d`;
  const hours = seconds / 3_600;
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${seconds}s`;
}

export function parseLookupId(value: string) {
  const normalized = value.trim();
  if (!/^[0-9]+$/.test(normalized)) return undefined;
  return BigInt(normalized);
}

export type LookupErrorKind = "marketNotFound" | "ticketNotFound" | "contractReverted" | "unknown";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function getLookupErrorKind(error: unknown): LookupErrorKind {
  if (!error) return "unknown";
  const message = getErrorMessage(error);
  if (message.includes("UnknownMarket")) return "marketNotFound";
  if (message.includes("UnknownTicket")) return "ticketNotFound";
  if (message.includes("Contract Call:") || message.includes("execution reverted")) {
    return "contractReverted";
  }
  return "unknown";
}

export function formatLookupError(error: unknown) {
  if (!error) return undefined;
  const message = getErrorMessage(error);
  if (message.includes("UnknownMarket")) return "Market not found on SportsHub.";
  if (message.includes("UnknownTicket")) return "Ticket not found on SportsHub.";
  const compact = message
    .replace(/^The contract function ".+?" reverted\. Error: /, "")
    .split(" Contract Call:")[0]
    ?.trim();
  return compact || message;
}
