import { decodeAbiParameters, encodeAbiParameters, type Hex } from "viem";

const CoinTossAbi = [{ name: "face", type: "bool" }] as const;

export function encodeCoinTossParams(face: boolean): Hex {
  return encodeAbiParameters(CoinTossAbi, [face]);
}

export function decodeCoinTossParams(encoded: Hex): { face: boolean } {
  const [face] = decodeAbiParameters(CoinTossAbi, encoded) as unknown as [boolean];
  return { face };
}
