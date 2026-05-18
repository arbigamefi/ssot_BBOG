import { decodeAbiParameters, encodeAbiParameters, type Hex } from "viem";

const PlinkoAbi = [{ name: "risk", type: "uint8" }] as const;

export type PlinkoRisk = "low" | "medium" | "high";

export const PLINKO_RISK_TO_ID: Record<PlinkoRisk, 0 | 1 | 2> = {
  low: 0,
  medium: 1,
  high: 2
};

export const PLINKO_ID_TO_RISK: Record<0 | 1 | 2, PlinkoRisk> = {
  0: "low",
  1: "medium",
  2: "high"
};

export function encodePlinkoParams(risk: PlinkoRisk | 0 | 1 | 2): Hex {
  const riskId = typeof risk === "string" ? PLINKO_RISK_TO_ID[risk] : risk;
  if (!Number.isInteger(riskId) || riskId < 0 || riskId > 2) {
    throw new Error(`risk out of Plinko range: ${risk}`);
  }
  return encodeAbiParameters(PlinkoAbi, [riskId]);
}

export function decodePlinkoParams(encoded: Hex): { risk: PlinkoRisk; riskId: 0 | 1 | 2 } {
  const [riskRaw] = decodeAbiParameters(PlinkoAbi, encoded) as unknown as [bigint | number];
  const riskId = Number(riskRaw);
  if (riskId !== 0 && riskId !== 1 && riskId !== 2) {
    throw new Error(`Decoded Plinko risk invalid: ${riskRaw.toString()}`);
  }
  return { risk: PLINKO_ID_TO_RISK[riskId], riskId };
}
