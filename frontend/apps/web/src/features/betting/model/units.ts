/**
 * Minimal, dependency-free units helpers.
 *
 * IMPORTANT: Feature layer must not import viem just for parseUnits/formatUnits.
 */

export function parseDecimalToUnits(input: string, decimals: number): bigint {
  const s = input.trim();
  if (s === "") throw new Error("amount is required");
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error("invalid number format");
  const [intPart = "", fracRaw = ""] = s.split(".");
  const negative = intPart.startsWith("-");
  const intDigits = negative ? intPart.slice(1) : intPart;
  if (intDigits === "") throw new Error("invalid number format");

  if (fracRaw.length > decimals) {
    throw new Error(`too many decimal places (max ${decimals})`);
  }

  const fracDigits = fracRaw.padEnd(decimals, "0");
  const baseStr = `${intDigits}${fracDigits}`.replace(/^0+/, "") || "0";
  let units = BigInt(baseStr);
  if (negative) units = -units;
  return units;
}

export function formatUnits(value: bigint, decimals: number): string {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const i = v / base;
  const f = v % base;
  if (decimals === 0) return `${neg ? "-" : ""}${i.toString()}`;
  const frac = f.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${i.toString()}${frac ? "." + frac : ""}`;
}

export function parseBigIntFromInput(input: string): bigint {
  const s = input.trim();
  if (s === "") throw new Error("value is required");
  if (s.startsWith("0x") || s.startsWith("0X")) return BigInt(s);
  if (!/^-?\d+$/.test(s)) throw new Error("invalid integer format");
  return BigInt(s);
}

export function clampNumber(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
