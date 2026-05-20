"use client";

const SPORTS_ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /OddsExpired/i,
    message: "This price expired. Refresh the market and place the ticket again."
  },
  {
    pattern: /MarketLocked|MarketNotOpen|BadMarketState/i,
    message: "This market is no longer accepting tickets."
  },
  {
    pattern: /RiskCapExceeded|cap exceeded|exposure/i,
    message: "This ticket exceeds the current risk limit. Try a smaller stake."
  },
  {
    pattern: /InsufficientAllowance/i,
    message: "Token allowance is too low. Approve spending and retry."
  },
  {
    pattern: /insufficient funds|transfer amount exceeds balance|ERC20InsufficientBalance/i,
    message: "Your wallet balance is too low for this stake."
  },
  {
    pattern: /user rejected|UserRejected|rejected request|denied transaction/i,
    message: "The wallet request was rejected."
  },
  {
    pattern: /network changed|chain.*mismatch|wrong chain/i,
    message: "The wallet or RPC network changed. Switch back to the supported chain and retry."
  }
];

export function toSportsbookPlayerError(error: unknown): string {
  const raw = extractErrorMessage(error);
  for (const entry of SPORTS_ERROR_PATTERNS) {
    if (entry.pattern.test(raw)) return entry.message;
  }
  if (!raw || raw === "[object Object]") return "Ticket placement failed. Refresh and retry.";
  return scrubRawContractNoise(raw);
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error ?? "");
}

function scrubRawContractNoise(raw: string): string {
  const firstLine = raw.split("\n")[0]?.trim();
  if (!firstLine) return "Ticket placement failed. Refresh and retry.";
  return firstLine.replace(/\s*Contract Call:.*/i, "").trim();
}
