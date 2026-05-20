import { decodeAbiParameters, encodeAbiParameters, type Hex } from "viem";

const SicBoAbi = [
  { name: "kind", type: "uint8" },
  { name: "value", type: "uint8" }
] as const;

export type SicBoKind =
  | "small"
  | "big"
  | "anyTriple"
  | "specificTriple"
  | "total"
  | "specificDouble"
  | "singleFace";

export const SIC_BO_KIND_TO_ID: Record<SicBoKind, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  small: 0,
  big: 1,
  anyTriple: 2,
  specificTriple: 3,
  total: 4,
  specificDouble: 5,
  singleFace: 6
};

export const SIC_BO_ID_TO_KIND: Record<0 | 1 | 2 | 3 | 4 | 5 | 6, SicBoKind> = {
  0: "small",
  1: "big",
  2: "anyTriple",
  3: "specificTriple",
  4: "total",
  5: "specificDouble",
  6: "singleFace"
};

export type SicBoParamsInput = {
  kind: SicBoKind | 0 | 1 | 2 | 3 | 4 | 5 | 6;
  value?: number;
};

export function encodeSicBoParams(input: SicBoParamsInput): Hex {
  const kindId = typeof input.kind === "string" ? SIC_BO_KIND_TO_ID[input.kind] : input.kind;
  const value = input.value ?? 0;
  assertSicBoParams(kindId, value);
  return encodeAbiParameters(SicBoAbi, [kindId, value]);
}

export function decodeSicBoParams(encoded: Hex): {
  kind: SicBoKind;
  kindId: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  value: number;
} {
  const [kindRaw, valueRaw] = decodeAbiParameters(SicBoAbi, encoded) as unknown as [
    bigint | number,
    bigint | number
  ];
  const kindId = Number(kindRaw);
  const value = Number(valueRaw);
  if (kindId < 0 || kindId > 6 || !Number.isInteger(kindId)) {
    throw new Error(`Decoded Sic Bo kind invalid: ${kindRaw.toString()}`);
  }
  assertSicBoParams(kindId as 0 | 1 | 2 | 3 | 4 | 5 | 6, value);
  return {
    kind: SIC_BO_ID_TO_KIND[kindId as 0 | 1 | 2 | 3 | 4 | 5 | 6],
    kindId: kindId as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    value
  };
}

function assertSicBoParams(kindId: 0 | 1 | 2 | 3 | 4 | 5 | 6, value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error(`Sic Bo value out of uint8 range: ${value}`);
  }
  if (kindId <= 2) {
    if (value !== 0) throw new Error(`Sic Bo kind ${kindId} requires value 0`);
    return;
  }
  if (kindId === 3 || kindId === 5 || kindId === 6) {
    if (value < 1 || value > 6) throw new Error(`Sic Bo face out of range: ${value}`);
    return;
  }
  if (kindId === 4) {
    if (value < 4 || value > 17) throw new Error(`Sic Bo total out of range: ${value}`);
    return;
  }
}
