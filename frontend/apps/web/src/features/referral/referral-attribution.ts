import type { Address } from "@ssot/ssot/sdk";

import { normalizeReferralAddress } from "./referral-link";

export const REFERRAL_ATTRIBUTION_STORAGE_KEY = "arbigamefi.referral-attribution.v1";

const ATTRIBUTION_VERSION = 1;
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type StoredReferralAttribution = {
  version: typeof ATTRIBUTION_VERSION;
  referrer: Address;
  capturedAt: number;
  expiresAt: number;
  source: "url";
};

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function isFreshAttribution(
  value: StoredReferralAttribution | undefined,
  now = Date.now()
): value is StoredReferralAttribution {
  return Boolean(value && value.expiresAt > now);
}

export function readReferralAttribution({
  now = Date.now(),
  storage = getBrowserStorage()
}: {
  now?: number;
  storage?: Pick<Storage, "getItem" | "removeItem">;
} = {}): StoredReferralAttribution | undefined {
  if (!storage) return undefined;

  try {
    const raw = storage.getItem(REFERRAL_ATTRIBUTION_STORAGE_KEY);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as Partial<StoredReferralAttribution>;
    const referrer = normalizeReferralAddress(parsed.referrer);
    if (
      parsed.version !== ATTRIBUTION_VERSION ||
      !referrer ||
      typeof parsed.expiresAt !== "number"
    ) {
      storage.removeItem(REFERRAL_ATTRIBUTION_STORAGE_KEY);
      return undefined;
    }

    const value: StoredReferralAttribution = {
      version: ATTRIBUTION_VERSION,
      referrer,
      capturedAt: typeof parsed.capturedAt === "number" ? parsed.capturedAt : now,
      expiresAt: parsed.expiresAt,
      source: "url"
    };

    if (!isFreshAttribution(value, now)) {
      storage.removeItem(REFERRAL_ATTRIBUTION_STORAGE_KEY);
      return undefined;
    }

    return value;
  } catch {
    return undefined;
  }
}

export function captureReferralAttribution({
  account,
  now = Date.now(),
  referrer,
  storage = getBrowserStorage()
}: {
  account?: string | null;
  now?: number;
  referrer: string | null | undefined;
  storage?: Pick<Storage, "getItem" | "removeItem" | "setItem">;
}): StoredReferralAttribution | undefined {
  if (!storage) return undefined;

  const existing = readReferralAttribution({ now, storage });
  if (existing) return existing;

  const normalizedReferrer = normalizeReferralAddress(referrer, account);
  if (!normalizedReferrer) return undefined;

  const value: StoredReferralAttribution = {
    version: ATTRIBUTION_VERSION,
    referrer: normalizedReferrer,
    capturedAt: now,
    expiresAt: now + ATTRIBUTION_TTL_MS,
    source: "url"
  };

  try {
    storage.setItem(REFERRAL_ATTRIBUTION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    return undefined;
  }

  return value;
}

export function resolveReferralAffiliate({
  account,
  now = Date.now(),
  referrer,
  storage = getBrowserStorage()
}: {
  account?: string | null;
  now?: number;
  referrer?: string | null;
  storage?: Pick<Storage, "getItem" | "removeItem" | "setItem">;
}) {
  const stored = captureReferralAttribution({ account, now, referrer, storage });
  return normalizeReferralAddress(stored?.referrer ?? referrer, account);
}
