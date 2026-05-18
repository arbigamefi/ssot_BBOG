import type { Address } from "@ssot/ssot/sdk";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function isZeroAddress(value: string | null | undefined) {
  return !value || value.toLowerCase() === ZERO_ADDRESS;
}

export function normalizeReferralAddress(
  value: string | null | undefined,
  account?: string | null
): Address | undefined {
  const normalized = value?.trim();
  if (!normalized || !ADDRESS_RE.test(normalized)) return undefined;
  if (normalized.toLowerCase() === ZERO_ADDRESS) return undefined;
  if (account && normalized.toLowerCase() === account.toLowerCase()) return undefined;
  return normalized as Address;
}

export function buildCasinoReferralLink({
  origin,
  referrer,
  gameSlug = "dice"
}: {
  origin: string;
  referrer: Address;
  gameSlug?: string;
}) {
  return `${origin}/casino/${gameSlug}?ref=${referrer}`;
}
