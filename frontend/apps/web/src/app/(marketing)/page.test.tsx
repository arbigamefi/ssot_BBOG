import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const state = {
  release: null as any,
  readOnly: false,
  readOnlyReason: null as string | null,
  sdk: null as any,
  ready: false,
  db: null as any,
  indexerStatus: null as any,
  bets: [] as any[],
  betsLoading: false,
  betCount: 0,
  assetOverviews: [] as any[],
  overviewLoading: false,
  overviewError: null as Error | null
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: any) => {
    if (Array.isArray(queryKey) && queryKey.includes("bet-count")) {
      return { data: state.betCount, isLoading: false, error: null };
    }
    if (Array.isArray(queryKey) && queryKey.includes("asset-overview")) {
      return {
        data: { assets: state.assetOverviews },
        isLoading: state.overviewLoading,
        error: state.overviewError
      };
    }
    return { data: undefined, isLoading: false, error: null };
  }
}));

vi.mock("../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    release: state.release,
    readOnly: state.readOnly,
    readOnlyReason: state.readOnlyReason
  })
}));

vi.mock("../../ssot/sdk", () => ({
  useSSOTSDK: () => ({
    sdk: state.sdk,
    ready: state.ready
  })
}));

vi.mock("../../ssot/runtime", () => ({
  useSSOTRuntime: () => ({
    db: state.db
  })
}));

vi.mock("../../features/ops/useIndexer", () => ({
  useIndexer: () => ({
    indexerStatus: state.indexerStatus
  })
}));

vi.mock("../../features/betting/useRecentBets", () => ({
  useRecentBets: () => ({
    data: state.bets,
    isLoading: state.betsLoading
  })
}));

vi.mock("../components/PageTransition", () => ({
  PageTransition: ({ children }: any) => <div>{children}</div>
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

vi.mock("next-intl", async () => {
  const messages = (await import("../../i18n/locales/en/common.json")).default as Record<
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
    const message = resolveMessage(`marketing.${key}`);
    if (typeof message !== "string") return key;
    return Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      message
    );
  }

  return {
    useLocale: () => "en",
    useTranslations: () => translate
  };
});

import HomePage from "./page";

describe("HomePage", () => {
  afterEach(() => {
    cleanup();
    state.release = null;
    state.readOnly = false;
    state.readOnlyReason = null;
    state.sdk = null;
    state.ready = false;
    state.db = null;
    state.indexerStatus = null;
    state.bets = [];
    state.betsLoading = false;
    state.betCount = 0;
    state.assetOverviews = [];
    state.overviewLoading = false;
    state.overviewError = null;
  });

  it("renders the product-first landing surface", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "Play on-chain. Get paid to your wallet." })
    ).toBeDefined();
    expect(screen.getByText("On-chain casino")).toBeDefined();
    expect(screen.getAllByText("Enter Casino").length).toBeGreaterThan(0);
    expect(screen.getByText("Game rooms. One wallet.")).toBeDefined();
    expect(screen.getByText("We can't rig the spin.")).toBeDefined();
    expect(screen.queryByText("Last few bets")).toBeNull();
    expect(screen.queryByText("Be the first.")).toBeNull();
  });

  it("renders live activity, reserve proof, and canonical room cards when release data exists", () => {
    state.release = {
      name: "Arbitrum",
      chainId: 42161,
      releaseDigest: "0xdeadbeefcafefeeddeadbeefcafefeed",
      contracts: { gameHub: "0x1234567890abcdef1234567890abcdef12345678" },
      games: {},
      assets: [
        { address: "0x01", bank: "0x02", symbol: "USDC", decimals: 6 },
        { address: "0x03", bank: "0x04", symbol: "WETH", decimals: 18 }
      ],
      pools: [
        {
          poolId: 1,
          domainId: 1,
          domain: "Casino",
          active: true,
          asset: "0x01",
          bank: "0x02",
          symbol: "USDC",
          decimals: 6
        },
        {
          poolId: 2,
          domainId: 1,
          domain: "Casino",
          active: true,
          asset: "0x03",
          bank: "0x04",
          symbol: "WETH",
          decimals: 18
        }
      ],
      gamesMeta: [
        { gameId: "0x01", slug: "dice", label: "Dice", paramsEncoding: "uint8" },
        { gameId: "0x02", slug: "keno", label: "Keno", paramsEncoding: "uint40" }
      ]
    };
    state.indexerStatus = {
      lagBlocks: 1,
      config: { confirmations: 3 },
      lastRunAt: Date.now() - 60_000
    };
    state.betCount = 12;
    state.bets = [
      {
        id: "bet-1",
        betId: "1",
        gameId: "0x01",
        asset: "0x03",
        stake: "1000000000000000000",
        payout: "1230000000000000000",
        state: "finalized",
        updatedAt: Date.now() - 60_000,
        updatedBlock: 123
      }
    ];
    state.assetOverviews = [
      {
        address: "0x01",
        bank: "0x02",
        symbol: "USDC",
        decimals: 6,
        totalAssets: 1_000_000n,
        totalReserved: 250_000n,
        turnover: 12_500_000n,
        protocolFee: 25_000n,
        freeLiquidity: 750_000n,
        updatedAtBlock: 123n
      },
      {
        address: "0x03",
        bank: "0x04",
        symbol: "WETH",
        decimals: 18,
        totalAssets: 3_000_000_000_000_000_000n,
        totalReserved: 1_000_000_000_000_000_000n,
        turnover: 6_000_000_000_000_000_000n,
        protocolFee: 50_000_000_000_000_000n,
        freeLiquidity: 2_000_000_000_000_000_000n,
        updatedAtBlock: 123n
      }
    ];

    render(<HomePage />);

    expect(screen.getAllByText("Free to pay out").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Total in the bank").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0.75 USDC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 USDC").length).toBeGreaterThan(0);
    expect(screen.queryByText("0.75 USDC / 2 WETH")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "WETH" }));
    expect(screen.getAllByText("2 WETH").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3 WETH").length).toBeGreaterThan(0);
    expect(screen.getByText("1.23 WETH")).toBeDefined();
    expect(screen.getAllByText("Dice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Keno").length).toBeGreaterThan(0);
    expect(screen.getByText("Last few bets")).toBeDefined();
    expect(screen.getByText("Check on-chain")).toBeDefined();
    expect(screen.getByText("Keno — pick 5, chase 500×.")).toBeDefined();
    expect(screen.getByText("Play Keno")).toBeDefined();

    const kenoLinks = screen
      .getAllByText("Keno")
      .map((node) => node.closest("a")?.getAttribute("href"));
    expect(kenoLinks).toContain("/casino/keno");
  });
});
