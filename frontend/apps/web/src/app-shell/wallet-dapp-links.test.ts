import { describe, expect, it } from "vitest";
import { getWalletDappHandoff } from "./wallet-dapp-links";

describe("wallet DApp destinations", () => {
  const current = "https://arbigamefi.com/casino/dice?ref=a%2Bb&chainId=8453#rules";
  const expected = "https://arbigamefi.com/casino/dice?ref=a%2Bb&chainId=84532#rules";
  it.each(["metaMask", "trust", "rainbow", "okx", "coinbase"])(
    "preserves page, encoded parameters, anchor and selected chain for %s",
    (id) => {
      const link = getWalletDappHandoff(id, current, 84532, true)!;
      let destination: string | null;
      if (id === "metaMask") destination = link.href.replace("metamask://dapp/", "https://");
      else {
        const parsed = new URL(link.href);
        destination = parsed.searchParams.get(
          id === "okx" ? "dappUrl" : id === "coinbase" ? "cb_url" : "url"
        );
      }
      expect(destination).toBe(expected);
      expect(link.href).not.toContain("symKey");
      expect(new URL(link.downloadHref).protocol).toBe("https:");
    }
  );
  it("does not redirect generic pairing or unknown wallets", () => {
    expect(getWalletDappHandoff("walletConnect", current, 8453, true)).toBeUndefined();
    expect(getWalletDappHandoff("unknown", current, 8453, true)).toBeUndefined();
  });
  it("rejects unsafe destination schemes and credentials", () => {
    for (const target of [
      "javascript:alert(1)",
      "http://example.com",
      "https://user:pass@example.com/"
    ] as const) {
      expect(getWalletDappHandoff("trust", target, 8453, true)).toBeUndefined();
    }
    expect(getWalletDappHandoff("trust", current, NaN, true)).toBeUndefined();
  });
  it("uses direct App routes and explicit installation links", () => {
    for (const [id, scheme] of [
      ["metaMask", "metamask:"],
      ["trust", "trust:"],
      ["rainbow", "rainbow:"],
      ["okx", "okx:"]
    ] as const) {
      expect(new URL(getWalletDappHandoff(id, current, 8453, true)!.href).protocol).toBe(scheme);
      expect(new URL(getWalletDappHandoff(id, current, 8453, false)!.downloadHref).hostname).toBe(
        "play.google.com"
      );
    }
  });
});
