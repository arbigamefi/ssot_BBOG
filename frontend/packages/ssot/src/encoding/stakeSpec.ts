import { decodeAbiParameters, encodeAbiParameters, type Hex } from "viem";

export interface StakeSpec {
  amountPerRoll: bigint;
  betCount: number; // uint32
  stopGain: bigint;
  stopLoss: bigint;
}

const StakeSpecAbi = [
  { name: "amountPerRoll", type: "uint256" },
  { name: "betCount", type: "uint32" },
  { name: "stopGain", type: "uint256" },
  { name: "stopLoss", type: "uint256" }
] as const;

export function encodeStakeSpec(spec: StakeSpec): Hex {
  if (spec.betCount < 0 || spec.betCount > 0xffffffff) {
    throw new Error(`betCount out of uint32 range: ${spec.betCount}`);
  }
  return encodeAbiParameters(StakeSpecAbi, [spec.amountPerRoll, spec.betCount, spec.stopGain, spec.stopLoss]);
}

export function decodeStakeSpec(encoded: Hex): StakeSpec {
  const [amountPerRoll, betCountRaw, stopGain, stopLoss] = decodeAbiParameters(StakeSpecAbi, encoded) as unknown as [
    bigint,
    bigint,
    bigint,
    bigint
  ];
  const betCount = Number(betCountRaw);
  if (!Number.isSafeInteger(betCount) || betCount < 0) throw new Error(`Decoded betCount invalid: ${betCountRaw.toString()}`);
  return { amountPerRoll, betCount, stopGain, stopLoss };
}
