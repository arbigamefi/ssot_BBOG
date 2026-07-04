import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const state = {
  account: null as string | null,
  affiliateStats: {
    data: undefined as
      | {
          source: "postgres" | "rpc-window";
          stats: { betCount: number; settledCount: number };
        }
      | undefined,
    isError: false,
    isLoading: false
  }
};
const openConnectModal = vi.hoisted(() => vi.fn());

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

vi.mock("../../../app-shell/wallet-connect-events", () => ({
  requestWalletConnect: openConnectModal
}));

vi.mock("../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({ chainId: 84532 })
}));

vi.mock("../../../features/betting/useAffiliateBets", () => ({
  useAffiliateBets: () => state.affiliateStats
}));

import { AffiliatePageClient } from "./pageClient";

describe("AffiliatePageClient", () => {
  afterEach(() => {
    cleanup();
    state.account = null;
    state.affiliateStats = {
      data: undefined,
      isError: false,
      isLoading: false
    };
    openConnectModal.mockClear();
  });

  it("does not share a non-referral room link before a wallet is connected", () => {
    render(<AffiliatePageClient />);

    expect(screen.getByText("Connect a wallet to generate your referral link.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Share link" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    expect(openConnectModal).toHaveBeenCalledTimes(1);
    expect(screen.getByText("The link is measurable.")).toBeDefined();
    expect(screen.getByText("Connect")).toBeDefined();
  });

  it("generates and shares a wallet-native referral link", () => {
    state.account = "0x1111111111111111111111111111111111111111";
    state.affiliateStats = {
      data: {
        source: "postgres",
        stats: { betCount: 12, settledCount: 10 }
      },
      isError: false,
      isLoading: false
    };

    render(<AffiliatePageClient />);

    const referralLink =
      "http://localhost:3000/casino/dice?ref=0x1111111111111111111111111111111111111111";
    expect(screen.getByTitle(referralLink)).toBeDefined();
    expect((screen.getByRole("button", { name: "Share link" }) as HTMLButtonElement).disabled).toBe(
      false
    );
    expect(screen.getByText("Active")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByTitle("postgres · chain 84532")).toBeDefined();
  });
});
