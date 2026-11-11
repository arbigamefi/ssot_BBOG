import { parseDecimalToUnits } from "../../betting/model/units";

const DECIMAL_INPUT_PATTERN = /[^\d.]/g;

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

export function betAmountInputToNumber(input: string): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
}
