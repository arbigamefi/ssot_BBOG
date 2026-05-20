import { decodeAbiParameters, encodeAbiParameters, type Hex } from "viem";

const BaccaratAbi = [{ name: "side", type: "uint8" }] as const;

export type BaccaratSide = "player" | "banker" | "tie";

export const BACCARAT_SIDE_TO_ID: Record<BaccaratSide, 0 | 1 | 2> = {
  player: 0,
  banker: 1,
  tie: 2
};

export const BACCARAT_ID_TO_SIDE: Record<0 | 1 | 2, BaccaratSide> = {
  0: "player",
  1: "banker",
  2: "tie"
};

export function encodeBaccaratParams(side: BaccaratSide | 0 | 1 | 2): Hex {
  const sideId = typeof side === "string" ? BACCARAT_SIDE_TO_ID[side] : side;
  if (!Number.isInteger(sideId) || sideId < 0 || sideId > 2) {
    throw new Error(`side out of Baccarat range: ${side}`);
  }
  return encodeAbiParameters(BaccaratAbi, [sideId]);
}

export function decodeBaccaratParams(encoded: Hex): {
  side: BaccaratSide;
  sideId: 0 | 1 | 2;
} {
  const [sideRaw] = decodeAbiParameters(BaccaratAbi, encoded) as unknown as [bigint | number];
  const sideId = Number(sideRaw);
  if (sideId !== 0 && sideId !== 1 && sideId !== 2) {
    throw new Error(`Decoded Baccarat side invalid: ${sideRaw.toString()}`);
  }
  return { side: BACCARAT_ID_TO_SIDE[sideId], sideId };
}
