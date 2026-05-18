import { describe, expect, it } from "vitest";

import { buildCasinoReferralLink, normalizeReferralAddress } from "./referral-link";

describe("referral link helpers", () => {
  it("normalizes valid referral addresses and rejects unsafe hints", () => {
    const referrer = "0x1111111111111111111111111111111111111111";

    expect(normalizeReferralAddress(referrer)).toBe(referrer);
    expect(normalizeReferralAddress("0x0000000000000000000000000000000000000000")).toBeUndefined();
    expect(normalizeReferralAddress(referrer, referrer)).toBeUndefined();
    expect(normalizeReferralAddress("not-an-address")).toBeUndefined();
  });

  it("builds room referral links without adding routing compatibility aliases", () => {
    expect(
      buildCasinoReferralLink({
        origin: "https://app.arbigamefi.example",
        referrer: "0x1111111111111111111111111111111111111111",
        gameSlug: "dice"
      })
    ).toBe(
      "https://app.arbigamefi.example/casino/dice?ref=0x1111111111111111111111111111111111111111"
    );
  });
});
