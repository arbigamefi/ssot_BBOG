import { decodeAbiParameters, encodeAbiParameters, type Hex } from "viem";

const RouletteRawAbi = [{ name: "mask", type: "uint40" }] as const;
const RouletteTypedAbi = [
  { name: "kind", type: "uint8" },
  { name: "payload", type: "uint40" },
] as const;

const MAX_UINT40 = (1n << 40n) - 1n;
const MAX_NUMBER = 36;

export const ROULETTE_KIND = {
  bitmask: 0,
  straight: 1,
  split: 2,
  street: 3,
  corner: 4,
  sixLine: 5,
  dozen: 6,
  column: 7,
  red: 8,
  black: 9,
  odd: 10,
  even: 11,
  low: 12,
  high: 13,
} as const;

export type RouletteOutsideSelection =
  | { kind: "red" }
  | { kind: "black" }
  | { kind: "odd" }
  | { kind: "even" }
  | { kind: "low" }
  | { kind: "high" };

export type RouletteParamsInput =
  | { kind: "bitmask"; mask: bigint }
  | { kind: "straight"; number: number }
  | { kind: "split"; first: number; second: number }
  | { kind: "street"; start: number }
  | { kind: "corner"; start: number }
  | { kind: "sixLine"; start: number }
  | { kind: "dozen"; dozen: 1 | 2 | 3 }
  | { kind: "column"; column: 1 | 2 | 3 }
  | RouletteOutsideSelection;

function assertUint40(value: bigint, label: string) {
  if (value < 0n || value > MAX_UINT40) throw new Error(`${label} out of uint40 range`);
}

function assertNumber(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_NUMBER) {
    throw new Error(`${label} must be an integer between 0 and 36`);
  }
}

function encodeTyped(kind: number, payload: bigint): Hex {
  assertUint40(payload, "payload");
  return encodeAbiParameters(RouletteTypedAbi, [kind, payload as unknown as number]);
}

export function encodeRouletteParams(input: RouletteParamsInput | bigint): Hex {
  if (typeof input === "bigint") {
    assertUint40(input, "mask");
    return encodeAbiParameters(RouletteRawAbi, [input as unknown as number]);
  }

  switch (input.kind) {
    case "bitmask":
      assertUint40(input.mask, "mask");
      return encodeAbiParameters(RouletteRawAbi, [input.mask as unknown as number]);
    case "straight":
      assertNumber(input.number, "straight number");
      return encodeTyped(ROULETTE_KIND.straight, BigInt(input.number));
    case "split":
      assertNumber(input.first, "split first");
      assertNumber(input.second, "split second");
      if (input.first === input.second) throw new Error("split numbers must be different");
      return encodeTyped(ROULETTE_KIND.split, BigInt(input.first) | (BigInt(input.second) << 6n));
    case "street":
      if (!Number.isInteger(input.start) || input.start < 1 || input.start > 34 || (input.start - 1) % 3 !== 0) {
        throw new Error("street start must be 1,4,7,...,34");
      }
      return encodeTyped(ROULETTE_KIND.street, BigInt(input.start));
    case "corner":
      if (!Number.isInteger(input.start) || input.start < 1 || input.start > 32 || input.start % 3 === 0) {
        throw new Error("corner start must be a valid top-left table number");
      }
      return encodeTyped(ROULETTE_KIND.corner, BigInt(input.start));
    case "sixLine":
      if (!Number.isInteger(input.start) || input.start < 1 || input.start > 31 || (input.start - 1) % 3 !== 0) {
        throw new Error("six-line start must be 1,4,7,...,31");
      }
      return encodeTyped(ROULETTE_KIND.sixLine, BigInt(input.start));
    case "dozen":
      if (![1, 2, 3].includes(input.dozen)) throw new Error("dozen must be 1, 2, or 3");
      return encodeTyped(ROULETTE_KIND.dozen, BigInt(input.dozen));
    case "column":
      if (![1, 2, 3].includes(input.column)) throw new Error("column must be 1, 2, or 3");
      return encodeTyped(ROULETTE_KIND.column, BigInt(input.column));
    case "red":
    case "black":
    case "odd":
    case "even":
    case "low":
    case "high":
      return encodeTyped(ROULETTE_KIND[input.kind], 0n);
    default: {
      const exhaustive: never = input;
      throw new Error(`unsupported roulette params: ${String(exhaustive)}`);
    }
  }
}

export function decodeRouletteParams(encoded: Hex): RouletteParamsInput {
  const byteLength = (encoded.length - 2) / 2;
  if (byteLength === 32) {
    const [maskRaw] = decodeAbiParameters(RouletteRawAbi, encoded) as [bigint | number];
    return { kind: "bitmask", mask: BigInt(maskRaw) };
  }

  const [kindRaw, payloadRaw] = decodeAbiParameters(RouletteTypedAbi, encoded) as [number | bigint, number | bigint];
  const kind = Number(kindRaw);
  const payload = BigInt(payloadRaw);

  switch (kind) {
    case ROULETTE_KIND.bitmask:
      return { kind: "bitmask", mask: payload };
    case ROULETTE_KIND.straight:
      return { kind: "straight", number: Number(payload) };
    case ROULETTE_KIND.split:
      return {
        kind: "split",
        first: Number(payload & 0x3fn),
        second: Number((payload >> 6n) & 0x3fn),
      };
    case ROULETTE_KIND.street:
      return { kind: "street", start: Number(payload) };
    case ROULETTE_KIND.corner:
      return { kind: "corner", start: Number(payload) };
    case ROULETTE_KIND.sixLine:
      return { kind: "sixLine", start: Number(payload) };
    case ROULETTE_KIND.dozen:
      return { kind: "dozen", dozen: Number(payload) as 1 | 2 | 3 };
    case ROULETTE_KIND.column:
      return { kind: "column", column: Number(payload) as 1 | 2 | 3 };
    case ROULETTE_KIND.red:
      return { kind: "red" };
    case ROULETTE_KIND.black:
      return { kind: "black" };
    case ROULETTE_KIND.odd:
      return { kind: "odd" };
    case ROULETTE_KIND.even:
      return { kind: "even" };
    case ROULETTE_KIND.low:
      return { kind: "low" };
    case ROULETTE_KIND.high:
      return { kind: "high" };
    default:
      throw new Error(`unknown roulette kind: ${kind}`);
  }
}
