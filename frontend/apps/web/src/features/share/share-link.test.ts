import { describe, expect, it } from "vitest";

import { buildShareIntentUrl, buildShareSummary, buildShareUrl } from "./share-link";

describe("share-link", () => {
  const referrer = "0x1111111111111111111111111111111111111111";

  it("adds referral attribution to absolute share URLs", () => {
    expect(buildShareUrl({ href: "https://app.arbigamefi.example/casino/dice", referrer })).toBe(
      "https://app.arbigamefi.example/casino/dice?ref=0x1111111111111111111111111111111111111111"
    );
  });

  it("replaces existing referral hints and keeps other query params", () => {
    expect(
      buildShareUrl({
        href: "https://app.arbigamefi.example/casino/dice?tab=proof&ref=0x2222222222222222222222222222222222222222",
        referrer
      })
    ).toBe(
      "https://app.arbigamefi.example/casino/dice?tab=proof&ref=0x1111111111111111111111111111111111111111"
    );
  });

  it("does not add malformed referral hints", () => {
    expect(buildShareUrl({ href: "/casino/dice", referrer: "not-an-address" })).toBe(
      "/casino/dice"
    );
  });

  it("builds short share summaries", () => {
    expect(buildShareSummary({ text: "Won +10 USDC", url: "https://app.example/r" })).toBe(
      "Won +10 USDC · https://app.example/r"
    );
  });

  it("builds social share intents", () => {
    const args = { text: "Won +10 USDC", url: "https://app.example/r?ref=0xabc" };

    expect(buildShareIntentUrl({ ...args, platform: "x" })).toContain(
      "https://twitter.com/intent/tweet"
    );
    expect(new URL(buildShareIntentUrl({ ...args, platform: "x" })).searchParams.get("url")).toBe(
      args.url
    );
    expect(buildShareIntentUrl({ ...args, platform: "telegram" })).toContain(
      "https://t.me/share/url"
    );
    expect(buildShareIntentUrl({ ...args, platform: "whatsapp" })).toContain("https://wa.me/");
  });
});
