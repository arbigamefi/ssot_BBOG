import { afterEach, describe, expect, it, vi } from "vitest";
import { metaMaskWallet } from "@rainbow-me/rainbowkit/wallets";
import {
  browserWalletWhenAvailable,
  metaMaskWalletWithFallback,
  okxWalletWithFallback,
  rainbowWalletWithFallback,
  trustWalletWithFallback
} from "./wallet-connectors";

const options = { appName: "ArbiGameFi", projectId: "test-project" };
const uri = `wc:${"a".repeat(64)}@2?relay-protocol=irn&symKey=${"b".repeat(64)}`;

afterEach(() => vi.unstubAllGlobals());

describe("wallet app and installation handoffs", () => {
  it("only lists the generic browser provider when it is actually present", () => {
    vi.stubGlobal("ethereum", undefined);
    expect(browserWalletWhenAvailable(options).hidden?.()).toBe(true);
    vi.stubGlobal("ethereum", { request: vi.fn() });
    expect(browserWalletWhenAvailable(options).hidden?.()).toBe(false);
  });
  it("uses the MetaMask SDK universal link instead of an app-only scheme", () => {
    expect(metaMaskWallet.useDeeplink).toBe(false);
    vi.stubGlobal("navigator", { userAgent: "iPhone Mobile Safari" });
    expect(metaMaskWalletWithFallback(options).mobile?.getUri).toBeUndefined();
  });

  it.each(["iPhone Mobile Safari", "Android Mobile Chrome"])(
    "keeps pairing intact for %s",
    (userAgent) => {
      vi.stubGlobal("navigator", { userAgent });
      for (const [factory, host] of [
        [trustWalletWithFallback, "link.trustwallet.com"],
        [rainbowWalletWithFallback, "rnbwapp.com"],
        [okxWalletWithFallback, "www.okx.com"]
      ] as const) {
        const wallet = factory(options);
        const link = new URL(wallet.mobile!.getUri!(uri));
        expect(link.protocol).toBe("https:");
        expect(link.hostname).toBe(host);
        const pairingLink = link.searchParams.has("deeplink")
          ? new URL(link.searchParams.get("deeplink")!)
          : link;
        expect(pairingLink.searchParams.get("uri")).toBe(uri);
        expect(wallet.downloadUrls?.ios).toMatch(/^https:\/\//);
        expect(wallet.downloadUrls?.android).toMatch(/^https:\/\//);
      }
    }
  );

  it("does not redirect an injected wallet into another application", () => {
    vi.stubGlobal("navigator", { userAgent: "iPhone Mobile Safari" });
    vi.stubGlobal("ethereum", { isTrust: true, isRainbow: true });
    vi.stubGlobal("okxwallet", { isOkxWallet: true });
    expect(trustWalletWithFallback(options).mobile?.getUri).toBeUndefined();
    expect(rainbowWalletWithFallback(options).mobile?.getUri).toBeUndefined();
    expect(okxWalletWithFallback(options).mobile?.getUri).toBeUndefined();
  });
});
