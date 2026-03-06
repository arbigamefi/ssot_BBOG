import { decodeAbiParameters, encodeAbiParameters, type Hex } from "viem";

const KenoAbi = [{ name: "mask", type: "uint40" }] as const;
const MAX_UINT40 = (1n << 40n) - 1n;

export function encodeKenoParams(mask: bigint): Hex {
  if (mask < 0n || mask > MAX_UINT40) throw new Error(`mask out of uint40 range: ${mask}`);
  return encodeAbiParameters(KenoAbi, [mask as unknown as number]);
}

export function decodeKenoParams(encoded: Hex): { mask: bigint } {
  // viem may return `number` for small uint types; normalize to bigint for
  // canonical, lossless internal representation.
  const [maskRaw] = decodeAbiParameters(KenoAbi, encoded) as unknown as [bigint | number];
  return { mask: BigInt(maskRaw) };
}
