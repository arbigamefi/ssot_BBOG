import { describe, expect, it } from "vitest";

import {
  captureReferralAttribution,
  readReferralAttribution,
  REFERRAL_ATTRIBUTION_STORAGE_KEY,
  resolveReferralAffiliate
} from "./referral-attribution";

function memoryStorage(seed?: Record<string, string>) {
  const data = new Map(Object.entries(seed ?? {}));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    removeItem: (key: string) => data.delete(key),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    }
  };
}

describe("referral attribution", () => {
  const first = "0x1111111111111111111111111111111111111111";
  const second = "0x2222222222222222222222222222222222222222";

  it("captures the first valid referral hint in local storage", () => {
    const storage = memoryStorage();

    const captured = captureReferralAttribution({ referrer: first, storage, now: 1_000 });

    expect(captured?.referrer).toBe(first);
    expect(readReferralAttribution({ storage, now: 1_001 })?.referrer).toBe(first);
  });

  it("keeps first-touch attribution instead of overwriting with a later link", () => {
    const storage = memoryStorage();

    captureReferralAttribution({ referrer: first, storage, now: 1_000 });
    captureReferralAttribution({ referrer: second, storage, now: 2_000 });

    expect(readReferralAttribution({ storage, now: 2_001 })?.referrer).toBe(first);
  });

  it("drops expired or malformed stored hints", () => {
    const storage = memoryStorage({
      [REFERRAL_ATTRIBUTION_STORAGE_KEY]: JSON.stringify({
        version: 1,
        referrer: first,
        capturedAt: 1_000,
        expiresAt: 1_001,
        source: "url"
      })
    });

    expect(readReferralAttribution({ storage, now: 2_000 })).toBeUndefined();
    expect(storage.getItem(REFERRAL_ATTRIBUTION_STORAGE_KEY)).toBeNull();
  });

  it("resolves stored attribution for a later bet and still rejects self-referrals", () => {
    const storage = memoryStorage();

    captureReferralAttribution({ referrer: first, storage, now: 1_000 });

    expect(resolveReferralAffiliate({ storage, now: 2_000 })).toBe(first);
    expect(resolveReferralAffiliate({ account: first, storage, now: 2_000 })).toBeUndefined();
  });
});
