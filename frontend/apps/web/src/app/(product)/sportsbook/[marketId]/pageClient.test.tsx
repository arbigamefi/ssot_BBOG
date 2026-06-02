import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import type { SportsTicketRow } from "@ssot/bet-index";

const zeroAddress = `0x${"0".repeat(40)}`;
const usdcAddress = "0x0000000000000000000000000000000000000001";
const usdtAddress = "0x0000000000000000000000000000000000000002";

function createSportsHubMock() {
  return {
    getMarket: vi.fn().mockImplementation(async (marketId: bigint) => ({
      marketId,
      eventId: 90n + marketId,
      poolId: 2,
      outcomeCount: 3,
      // Future kickoff so the wall-clock summary lands in "scheduled".
      startsAt: Math.floor(Date.now() / 1000) + 7 * 86400,
      lockTime: Math.floor(Date.now() / 1000) + 7 * 86400 + 3600,
      resultFinalitySeconds: 604_800,
      version: 1n,
      marketKey: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      rulebookHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      state: "open"
    })),
    getResult: vi.fn().mockImplementation(async () => undefined),
    getMarketReserved: vi.fn().mockResolvedValue(2_000_000n),
    planPlaceTicket: vi.fn().mockResolvedValue({
      chainId: 84532,
      releaseDigest: "0x7ad0f2cb1a996251325c00441b125ca5276c5bf70f011577222ce588cae1349f",
      warnings: [],
      steps: [],
      payload: {},
      preview: {
        marketId: 7n,
        outcomeId: 2,
        stake: 10_000_000n,
        payout: 55_000_000n
      }
    }),
    executeTicketPlan: vi.fn().mockResolvedValue({
      ticketId: 99n,
      placeTicketTx: { ok: true, txHash: "0xabc123" }
    })
  };
}

const state: {
  release: unknown;
  readOnly: boolean;
  readOnlyReason: string | null;
  chainId: number;
  sportsbook: {
    enabled: boolean;
    frontendEnabled: boolean;
    hasSportsRelease: boolean;
    enablementFlag: string;
    disabledReason?: string;
  };
  sdk: { sportsHub: ReturnType<typeof createSportsHubMock>; account?: string } | undefined;
} = {
  release: {
    chainId: 84532,
    name: "Base Sepolia",
    releaseDigest: "0x7ad0f2cb1a996251325c00441b125ca5276c5bf70f011577222ce588cae1349f",
    contracts: { sportsHub: "0x2db4ba326c2c3e5830b0da10f0c52b4097f9fa4b" },
    sports: { enabled: true },
    pools: [
      {
        poolId: 2,
        domainId: 2,
        domain: "Sports",
        active: true,
        asset: zeroAddress,
        bank: zeroAddress,
        symbol: "USDC",
        decimals: 6
      }
    ]
  },
  readOnly: false,
  readOnlyReason: null,
  chainId: 84532,
  sportsbook: {
    enabled: false,
    frontendEnabled: false,
    hasSportsRelease: true,
    enablementFlag: "NEXT_PUBLIC_SPORTSBOOK_ENABLED",
    disabledReason: "NEXT_PUBLIC_SPORTSBOOK_ENABLED is not true."
  },
  sdk: { sportsHub: createSportsHubMock() }
};
let providerOddsMock:
  | {
      schemaVersion: "sportsbook.provider-odds.v1";
      provider: {
        name: "the-odds-api";
        sportKey: string;
        providerEventId: string;
        bookmakerKey?: string;
        bookmakerTitle?: string;
        marketLastUpdate?: string;
      };
      event: { homeTeam: string; awayTeam: string; commenceTime?: string };
      outcomes: Array<{
        outcomeId: number;
        side: "home" | "draw" | "away";
        name: string;
        decimalPrice: string;
      }>;
    }
  | undefined;
let searchParamsMock = new URLSearchParams();
let playerTicketsMock: {
  data: SportsTicketRow[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: ReturnType<typeof vi.fn>;
} = {
  data: [],
  error: null,
  isFetching: false,
  isLoading: false,
  refetch: vi.fn()
};

vi.mock("../../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    chainId: state.chainId,
    release: state.release,
    readOnly: state.readOnly,
    readOnlyReason: state.readOnlyReason,
    sportsbook: state.sportsbook
  })
}));

vi.mock("../../../../ssot/sdk", () => ({
  useSSOTSDK: () => ({ sdk: state.sdk, ready: Boolean(state.sdk), readOnly: state.readOnly })
}));

vi.mock("../../../../components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock
}));

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

// The detail page calls useSportsbookProviderOdds; in the new player UI it
// gracefully renders fallback labels when odds aren't available.
vi.mock("../../../../features/sportsbook/use-provider-odds", () => ({
  useSportsbookProviderOdds: () => ({ data: providerOddsMock, isLoading: false, error: null })
}));

vi.mock("../../../../features/sportsbook/usePlayerSportsTickets", () => ({
  usePlayerSportsTickets: () => playerTicketsMock
}));

vi.mock("next-intl", async () => {
  const messages = (await import("../../../../i18n/locales/en/common.json")).default as Record<
    string,
    unknown
  >;
  function resolveMessage(key: string) {
    return key.split(".").reduce<unknown>((node, segment) => {
      if (node && typeof node === "object" && segment in node) {
        return (node as Record<string, unknown>)[segment];
      }
      return undefined;
    }, messages);
  }
  function translate(scope: string | undefined = "") {
    function t(key: string, values?: Record<string, string | number>) {
      const full = scope ? `${scope}.${key}` : key;
      const resolved = resolveMessage(full);
      let message = typeof resolved === "string" ? resolved : full;
      for (const [name, value] of Object.entries(values ?? {})) {
        message = message.replace(`{${name}}`, String(value));
      }
      return message;
    }
    (t as unknown as { has: (key: string) => boolean }).has = (key: string) => {
      const full = scope ? `${scope}.${key}` : key;
      return typeof resolveMessage(full) === "string";
    };
    return t;
  }
  return {
    useTranslations: (scope?: string) => translate(scope),
    useLocale: () => "en"
  };
});

import { SportsbookMarketDetailPageClient } from "./pageClient";

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function resetState() {
  state.release = {
    chainId: 84532,
    name: "Base Sepolia",
    releaseDigest: "0x7ad0f2cb1a996251325c00441b125ca5276c5bf70f011577222ce588cae1349f",
    contracts: { sportsHub: "0x2db4ba326c2c3e5830b0da10f0c52b4097f9fa4b" },
    sports: { enabled: true },
    pools: [
      {
        poolId: 2,
        domainId: 2,
        domain: "Sports",
        active: true,
        asset: zeroAddress,
        bank: zeroAddress,
        symbol: "USDC",
        decimals: 6
      }
    ]
  };
  state.sportsbook = {
    enabled: false,
    frontendEnabled: false,
    hasSportsRelease: true,
    enablementFlag: "NEXT_PUBLIC_SPORTSBOOK_ENABLED",
    disabledReason: "NEXT_PUBLIC_SPORTSBOOK_ENABLED is not true."
  };
  state.readOnly = false;
  state.readOnlyReason = null;
  state.sdk = { sportsHub: createSportsHubMock() };
  providerOddsMock = undefined;
  playerTicketsMock = {
    data: [],
    error: null,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn()
  };
  searchParamsMock = new URLSearchParams();
}

describe("SportsbookMarketDetailPageClient (player-facing)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    resetState();
  });

  it("renders the player detail header with a back link to the sportsbook", async () => {
    renderWithQueryClient(<SportsbookMarketDetailPageClient marketId="7" />);
    expect(await screen.findByRole("heading", { level: 1 })).toBeDefined();
    const backLinks = screen
      .getAllByRole("link")
      .filter((node) => node.getAttribute("href") === "/sportsbook");
    expect(backLinks.length).toBeGreaterThan(0);
    expect(state.sdk?.sportsHub.getMarket).toHaveBeenCalledWith(7n);
  });

  it("hides the old inspector / operator form (raw odds fields are gone)", async () => {
    renderWithQueryClient(<SportsbookMarketDetailPageClient marketId="7" />);
    await screen.findByRole("heading", { level: 1 });
    // None of the old raw form labels survive on the public page.
    expect(screen.queryByLabelText("Odds WAD")).toBeNull();
    expect(screen.queryByLabelText("Odds signature")).toBeNull();
    expect(screen.queryByLabelText("Max stake")).toBeNull();
    expect(screen.queryByLabelText("Max payout")).toBeNull();
    expect(screen.queryByLabelText("Provider event id")).toBeNull();
    expect(screen.queryByLabelText("Bookmaker key")).toBeNull();
    expect(screen.queryByText("Settle, refund, or void tickets")).toBeNull();
    expect(screen.queryByText("Chain odds proof")).toBeNull();
  });

  it("renders the bet slip with stake input + place button surface", async () => {
    state.sportsbook = {
      ...state.sportsbook,
      enabled: true,
      frontendEnabled: true,
      disabledReason: undefined
    };
    state.sdk = {
      sportsHub: createSportsHubMock(),
      account: "0x1111111111111111111111111111111111111111"
    };
    renderWithQueryClient(<SportsbookMarketDetailPageClient marketId="7" />);
    await screen.findByRole("heading", { level: 1 });
    // Bet slip is rendered: title + stake input + place button surface.
    expect(screen.getAllByText("Bet slip").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Stake (USDC)")).toBeDefined();
    const placeButton = screen
      .getAllByRole("button")
      .find((b) => b.textContent === "Place bet") as HTMLButtonElement;
    expect(placeButton).toBeDefined();
    expect(placeButton.disabled).toBe(true);
  });

  it("resolves the sportsbook stake asset from the pool asset address", async () => {
    state.release = {
      ...(state.release as Record<string, unknown>),
      assets: [
        { address: usdcAddress, symbol: "USDC", decimals: 6 },
        { address: usdtAddress, symbol: "USDT", decimals: 6 }
      ],
      pools: [
        {
          poolId: 2,
          domainId: 2,
          domain: "Sports",
          active: true,
          asset: usdtAddress,
          bank: zeroAddress
        }
      ]
    };
    state.sportsbook = {
      ...state.sportsbook,
      enabled: true,
      frontendEnabled: true,
      disabledReason: undefined
    };
    state.sdk = {
      sportsHub: createSportsHubMock(),
      account: "0x1111111111111111111111111111111111111111"
    };

    renderWithQueryClient(<SportsbookMarketDetailPageClient marketId="7" />);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByLabelText("Stake (USDT)")).toBeDefined();
  });

  it("shows connected player tickets for the current market", async () => {
    state.sportsbook = {
      ...state.sportsbook,
      enabled: true,
      frontendEnabled: true,
      disabledReason: undefined
    };
    state.sdk = {
      sportsHub: createSportsHubMock(),
      account: "0x1111111111111111111111111111111111111111"
    };
    providerOddsMock = {
      schemaVersion: "sportsbook.provider-odds.v1",
      provider: {
        name: "the-odds-api",
        sportKey: "soccer_fifa_world_cup",
        providerEventId: "event-7",
        bookmakerKey: "betmgm",
        bookmakerTitle: "BetMGM",
        marketLastUpdate: "2026-05-19T00:00:00.000Z"
      },
      event: {
        homeTeam: "Mexico",
        awayTeam: "South Africa",
        commenceTime: "2026-06-11T19:00:00.000Z"
      },
      outcomes: [
        { outcomeId: 0, side: "home", name: "Mexico", decimalPrice: "1.65" },
        { outcomeId: 1, side: "draw", name: "Draw", decimalPrice: "3.80" },
        { outcomeId: 2, side: "away", name: "South Africa", decimalPrice: "5.50" }
      ]
    };
    playerTicketsMock = {
      data: [
        {
          chainId: 84532,
          id: "84532:sports:12",
          lastEventName: "TicketPlaced",
          lastTxHash: "0xabc123",
          marketId: "7",
          outcomeId: 2,
          payout: "55000000",
          player: "0x1111111111111111111111111111111111111111",
          stake: "10000000",
          state: "held",
          ticketId: "12",
          updatedAt: Date.now(),
          updatedBlock: 41562000
        }
      ],
      error: null,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn()
    };

    renderWithQueryClient(<SportsbookMarketDetailPageClient marketId="7" />);

    expect(await screen.findByText("Your tickets")).toBeDefined();
    expect(screen.getByText("S#12")).toBeDefined();
    expect(screen.getAllByText("South Africa").length).toBeGreaterThan(0);
    expect(screen.getByText("10 USDC")).toBeDefined();
    expect(screen.getByText("55 USDC")).toBeDefined();
    const ticketLink = screen.getByRole("link", { name: /S#12/i });
    expect(ticketLink.getAttribute("href")).toBe("/portfolio/tickets/12");
  });

  it("preview mode keeps the slip visible but disabled with a helpful reason", async () => {
    renderWithQueryClient(<SportsbookMarketDetailPageClient marketId="7" />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByText("Bet slip").length).toBeGreaterThan(0);
    const placeButton = screen
      .getAllByRole("button")
      .find((b) => b.textContent === "Place bet") as HTMLButtonElement;
    expect(placeButton.disabled).toBe(true);
  });

  it("rejects invalid market id with a clean notice (no SDK call)", () => {
    renderWithQueryClient(<SportsbookMarketDetailPageClient marketId="abc" />);
    expect(screen.getByText("Invalid market id")).toBeDefined();
    expect(state.sdk?.sportsHub.getMarket).not.toHaveBeenCalled();
  });

  it("renders a danger notice when the market read fails", async () => {
    state.sdk = {
      sportsHub: {
        ...createSportsHubMock(),
        getMarket: vi.fn().mockRejectedValue(new Error("UnknownMarket"))
      }
    };
    renderWithQueryClient(<SportsbookMarketDetailPageClient marketId="1" />);
    expect(await screen.findByText("Could not load this market")).toBeDefined();
  });

  it("binds the signed odds request to the provider event and bookmaker visible to the player", async () => {
    state.sportsbook = {
      ...state.sportsbook,
      enabled: true,
      frontendEnabled: true,
      disabledReason: undefined
    };
    state.sdk = {
      sportsHub: createSportsHubMock(),
      account: "0x1111111111111111111111111111111111111111"
    };
    searchParamsMock = new URLSearchParams("outcome=2");
    providerOddsMock = {
      schemaVersion: "sportsbook.provider-odds.v1",
      provider: {
        name: "the-odds-api",
        sportKey: "soccer_fifa_world_cup",
        providerEventId: "event-7",
        bookmakerKey: "betmgm",
        bookmakerTitle: "BetMGM",
        marketLastUpdate: "2026-05-19T00:00:00.000Z"
      },
      event: {
        homeTeam: "Mexico",
        awayTeam: "South Africa",
        commenceTime: "2026-06-11T19:00:00.000Z"
      },
      outcomes: [
        { outcomeId: 0, side: "home", name: "Mexico", decimalPrice: "1.65" },
        { outcomeId: 1, side: "draw", name: "Draw", decimalPrice: "3.80" },
        { outcomeId: 2, side: "away", name: "South Africa", decimalPrice: "5.50" }
      ]
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: {
          providerEventId: "event-7",
          bookmakerKey: "betmgm",
          sportKey: "soccer_fifa_world_cup"
        },
        outcome: {
          name: "South Africa",
          decimalPrice: "5.50",
          oddsWad: "5500000000000000000"
        },
        payout: "55000000",
        odds: {
          oddsWad: "5500000000000000000",
          maxStake: "1000000000",
          maxPayout: "5500000000",
          expiresAt: "1770000000",
          nonce: "42",
          riskHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
        },
        signature: "0xdddd"
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<SportsbookMarketDetailPageClient marketId="7" />);

    expect(await screen.findByRole("heading", { level: 1 })).toBeDefined();
    expect(screen.getAllByText("South Africa").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Stake (USDC)"), { target: { value: "10" } });
    const placeButton = screen
      .getAllByRole("button")
      .find((b) => b.textContent === "Place bet") as HTMLButtonElement;
    await waitFor(() => expect(placeButton.disabled).toBe(false));
    fireEvent.click(placeButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody).toMatchObject({
      chainId: 84532,
      marketId: "7",
      outcomeId: 2,
      player: "0x1111111111111111111111111111111111111111",
      stake: "10000000",
      providerEventId: "event-7",
      bookmakerKey: "betmgm",
      sportKey: "soccer_fifa_world_cup"
    });
    await waitFor(() =>
      expect(state.sdk?.sportsHub.planPlaceTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          marketId: 7n,
          outcomeId: 2,
          stake: 10_000_000n
        })
      )
    );
    expect(await screen.findByText("Ticket S#99 is live")).toBeDefined();
    expect(screen.getByRole("link", { name: "Track ticket" }).getAttribute("href")).toBe(
      "/portfolio/tickets/99?tx=0xabc123"
    );
  });
});
