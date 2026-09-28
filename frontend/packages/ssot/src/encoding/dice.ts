import { decodeAbiParameters, encodeAbiParameters, type Hex } from "viem";

const DiceAbi = [
  { name: "isOver", type: "bool" },
  { name: "target", type: "uint8" }
] as const;

export type DiceDirection = "under" | "over";

export function encodeDiceParams(input: { direction: DiceDirection; target: number }): Hex {
  const { direction, target } = input;
  if (!Number.isInteger(target) || target < 0 || target > 255) {
    throw new Error(`target out of uint8 range: ${target}`);
  }
  return encodeAbiParameters(DiceAbi, [direction === "over", target]);
}

export function decodeDiceParams(encoded: Hex): {
  direction: DiceDirection;
  target: number;
} {
  const [isOver, targetRaw] = decodeAbiParameters(DiceAbi, encoded) as unknown as [boolean, bigint];
  const target = Number(targetRaw);
  if (!Number.isSafeInteger(target) || target < 0 || target > 255) {
    throw new Error(`Decoded target invalid: ${targetRaw.toString()}`);
  }
  return { direction: isOver ? "over" : "under", target };
}
