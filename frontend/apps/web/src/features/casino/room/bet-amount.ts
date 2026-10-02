import { formatUnits, parseDecimalToUnits } from "../../betting/model/units";

const DECIMAL_INPUT_PATTERN = /[^\d.]/g;

export function getMinBetAmountRaw(minTotalStake: bigint, betCount: number): bigint {
  if (minTotalStake <= 0n || !Number.isInteger(betCount) || betCount < 1 || betCount > 100)
    return 0n;
  const count = BigInt(betCount);
  return (minTotalStake + count - 1n) / count;
}

export function getMinBetAmountInput(decimals: number, minRaw: bigint): string {
  return formatBetAmountRaw(minRaw, decimals);
}

export function normalizeBetAmountInput(input: string, decimals: number): string {
  const precision = Math.max(0, decimals);
  const cleaned = input.replace(/,/g, ".").replace(DECIMAL_INPUT_PATTERN, "");
  const [wholeRaw = "", ...fractionParts] = cleaned.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  if (precision === 0) return whole;
  if (fractionParts.length === 0) return whole;
  const fraction = fractionParts.join("").slice(0, precision);
  return `${whole}.${fraction}`;
}

export function betAmountInputToRaw(input: string, decimals: number): bigint {
  const normalized = normalizeBetAmountInput(input, decimals);
  if (normalized === "" || normalized === "0" || normalized === "0.") return 0n;
  return parseDecimalToUnits(
    normalized.endsWith(".") ? normalized.slice(0, -1) : normalized,
    decimals
  );
}

export function formatBetAmountRaw(raw: bigint, decimals: number): string {
  return formatUnits(raw < 0n ? 0n : raw, decimals);
}

export function resolveBetMaxRaw(
  walletBalanceRaw: bigint | null | undefined,
  maxBetRaw?: bigint
): bigint | undefined {
  const candidates = [walletBalanceRaw, maxBetRaw].filter(
    (value): value is bigint => value != null && value >= 0n
  );
  if (candidates.length === 0) return undefined;
  return candidates.reduce((min, value) => (value < min ? value : min));
}

export function isBetAmountUnavailable(minRaw: bigint, maxRaw?: bigint): boolean {
  return minRaw <= 0n || (maxRaw != null && maxRaw < minRaw);
}

export function isBetAmountAboveMax(
  input: string,
  decimals: number,
  maxRaw: bigint | undefined,
  minRaw: bigint
): boolean {
  if (maxRaw == null || maxRaw < minRaw) return false;
  return betAmountInputToRaw(input, decimals) > maxRaw;
}

export function clampBetAmountInput(
  input: string,
  decimals: number,
  maxRaw: bigint | undefined,
  minRaw: bigint
): string {
  const normalized = normalizeBetAmountInput(input, decimals);
  // A missing pool read must never replace the entered stake with the wallet maximum.
  if (minRaw <= 0n) return normalized;
  if (isBetAmountUnavailable(minRaw, maxRaw)) return formatBetAmountRaw(maxRaw ?? 0n, decimals);
  const raw = betAmountInputToRaw(normalized, decimals);
  const capped = maxRaw == null ? raw : raw > maxRaw ? maxRaw : raw;
  return formatBetAmountRaw(capped < minRaw ? minRaw : capped, decimals);
}

export function scaleBetAmountInput({
  input,
  decimals,
  numerator,
  denominator = 1n,
  maxRaw,
  minRaw
}: {
  input: string;
  decimals: number;
  numerator: bigint;
  denominator?: bigint;
  maxRaw?: bigint;
  minRaw: bigint;
}): string {
  const raw = betAmountInputToRaw(input, decimals);
  const scaled = denominator === 0n ? raw : (raw * numerator) / denominator;
  return clampBetAmountInput(formatBetAmountRaw(scaled, decimals), decimals, maxRaw, minRaw);
}

export function multiplyBetAmountInput(input: string, betCount: number, decimals: number): string {
  const count = BigInt(Math.max(1, Math.floor(betCount)));
  return formatBetAmountRaw(betAmountInputToRaw(input, decimals) * count, decimals);
}

export function betAmountInputToNumber(input: string): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
}
