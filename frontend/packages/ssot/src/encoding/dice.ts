import { decodeAbiParameters, encodeAbiParameters, type Hex } from "viem";

const DiceAbi = [{ name: "cap", type: "uint8" }] as const;

export function encodeDiceParams(cap: number): Hex {
  if (!Number.isInteger(cap) || cap < 0 || cap > 255) throw new Error(`cap out of uint8 range: ${cap}`);
  return encodeAbiParameters(DiceAbi, [cap]);
}

export function decodeDiceParams(encoded: Hex): { cap: number } {
  const [capRaw] = decodeAbiParameters(DiceAbi, encoded) as unknown as [bigint];
  const cap = Number(capRaw);
  if (!Number.isSafeInteger(cap) || cap < 0 || cap > 255) throw new Error(`Decoded cap invalid: ${capRaw.toString()}`);
  return { cap };
}
