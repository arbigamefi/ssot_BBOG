import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const state = {
  account: null as string | null
};
const openConnectModal = vi.fn();

vi.mock("../../../ssot/sdk", () => ({
  useSSOTSDK: () => ({
    sdk: state.account ? { account: state.account } : null
  })
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next-intl", async () => {
  const messages = (await import("../../../i18n/locales/en/common.json")).default as Record<
    string,
    unknown
  >;

  function resolveMessage(key: string) {
    return key.split(".").reduce<unknown>((value, part) => {
      if (value && typeof value === "object" && part in value) {
        return (value as Record<string, unknown>)[part];
      }
      return undefined;
    }, messages);
  }

  function translate(key: string, values?: Record<string, string | number>) {
    const message = resolveMessage(key);
    if (typeof message !== "string") return key;
    return Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      message
    );
  }

  return {
    useTranslations: () => translate
  };
});

vi.mock("../../../app-shell/WalletButton", () => ({
  useConnectModal: () => ({ openConnectModal })
}));

import { AffiliatePageClient } from "./pageClient";

describe("AffiliatePageClient", () => {
  afterEach(() => {
    cleanup();
    state.account = null;
    openConnectModal.mockClear();
  });

  it("does not share a non-referral room link before a wallet is connected", () => {
    render(<AffiliatePageClient />);

    expect(screen.getByText("Connect a wallet to generate your referral link.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Share link" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    expect(openConnectModal).toHaveBeenCalledTimes(1);
  });

  it("generates and shares a wallet-native referral link", () => {
    state.account = "0x1111111111111111111111111111111111111111";

    render(<AffiliatePageClient />);

    const referralLink =
      "http://localhost:3000/casino/dice?ref=0x1111111111111111111111111111111111111111";
    expect(screen.getByTitle(referralLink)).toBeDefined();
    expect((screen.getByRole("button", { name: "Share link" }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });
});
