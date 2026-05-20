import { decodeAbiParameters, encodeAbiParameters, type Hex } from "viem";

const SlotsAbi = [{ name: "profile", type: "uint8" }] as const;

export type SlotsProfile = "classic";

export const SLOTS_PROFILE_TO_ID: Record<SlotsProfile, 0> = {
  classic: 0
};

export const SLOTS_ID_TO_PROFILE: Record<0, SlotsProfile> = {
  0: "classic"
};

export function encodeSlotsParams(profile: SlotsProfile | 0 = "classic"): Hex {
  const profileId = typeof profile === "string" ? SLOTS_PROFILE_TO_ID[profile] : profile;
  if (profileId !== 0) {
    throw new Error(`profile out of Slots range: ${profile}`);
  }
  return encodeAbiParameters(SlotsAbi, [profileId]);
}

export function decodeSlotsParams(encoded: Hex): { profile: SlotsProfile; profileId: 0 } {
  const [profileRaw] = decodeAbiParameters(SlotsAbi, encoded) as unknown as [bigint | number];
  const profileId = Number(profileRaw);
  if (profileId !== 0) {
    throw new Error(`Decoded Slots profile invalid: ${profileRaw.toString()}`);
  }
  return { profile: SLOTS_ID_TO_PROFILE[profileId], profileId };
}
