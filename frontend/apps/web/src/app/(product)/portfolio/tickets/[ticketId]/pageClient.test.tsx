import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

const zeroAddress = `0x${"0".repeat(40)}`;

function createSportsHubMock() {
  return {
    getTicket: vi.fn().mockResolvedValue({
      ticketId: 12n,
      positionId: 34n,
      marketId: 7n,
      eventId: 97n,
      poolId: 2,
      outcomeId: 2,
      player: "0x1111111111111111111111111111111111111111",
      stake: 10_000_000n,
      payout: 55_000_000n,
      reserved: 55_000_000n,
      oddsSnapshotHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      rulebookHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      acceptedAt: 1_800_000_100,
      state: "held"
    }),
    getMarket: vi.fn().mockResolvedValue({
      marketId: 7n,
      eventId: 97n,
      poolId: 2,
      outcomeCount: 3,
      startsAt: 1_800_010_000,
      lockTime: 1_800_009_000,
      resultFinalitySeconds: 604_800,
      version: 1n,
      marketKey: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      rulebookHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      state: "open"
    }),
    getResult: vi.fn().mockResolvedValue({
      marketId: 7n,
      eventId: 97n,
      poolId: 2,
      winningOutcomeId: 2,
      marketVersion: 1n,
      resultPayloadHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      resultSourceHash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      evidenceHash: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      rulebookHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      reporterSetHash: "0x9999999999999999999999999999999999999999999999999999999999999999",
      reporterThreshold: 1,
      reporterCount: 1,
      proposer: "0x2222222222222222222222222222222222222222",
      observedAt: 1_800_010_000,
      proposedAt: 1_800_010_100,
      finalizesAt: 1_800_614_900,
      challenged: false,
      challengeReasonHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      challenger: zeroAddress,
      challengedAt: 0,
      challengeDecision: "none",
      arbitrationDecisionHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      arbitrator: zeroAddress,
      arbitratedAt: 0
    })
  };
}

const state = {
  release: {
    chainId: 84532,
    releaseDigest: "0x7ad0f2cb1a996251325c00441b125ca5276c5bf70f011577222ce588cae1349f",
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
  chainId: 84532,
  sdk: { sportsHub: createSportsHubMock() }
};

vi.mock("../../../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    chainId: state.chainId,
    release: state.release
  })
}));

vi.mock("../../../../../ssot/sdk", () => ({
  useSSOTSDK: () => ({ sdk: state.sdk, ready: Boolean(state.sdk) })
}));

vi.mock("../../../../../components/PageTransition", () => ({
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
  useSearchParams: () => new URLSearchParams("tx=0xabc123")
}));

vi.mock("../../../../../features/sportsbook/use-provider-odds", () => ({
  useSportsbookProviderOdds: () => ({
    data: {
      schemaVersion: "sportsbook.provider-odds.v1",
      provider: {
        name: "the-odds-api",
        sportKey: "soccer_fifa_world_cup",
        providerEventId: "event-7",
        bookmakerKey: "betmgm",
        bookmakerTitle: "BetMGM"
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
    },
    isLoading: false,
    error: null
  })
}));

vi.mock("next-intl", async () => {
  const messages = (await import("../../../../../i18n/locales/en/common.json")).default as Record<
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
    function t(key: string, values?: Record<string, string | number | bigint>) {
      const full = scope ? `${scope}.${key}` : key;
      const resolved = resolveMessage(full);
      let message = typeof resolved === "string" ? resolved : full;
      for (const [name, value] of Object.entries(values ?? {})) {
        message = message.replace(`{${name}}`, String(value));
      }
      return message;
    }
    return t;
  }
  return {
    useTranslations: (scope?: string) => translate(scope),
    useLocale: () => "en"
  };
});

import { SportsTicketDetailPageClient } from "./pageClient";

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("SportsTicketDetailPageClient", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    state.sdk = { sportsHub: createSportsHubMock() };
  });

  it("renders a SportsHub ticket as a player-readable receipt", async () => {
    renderWithQueryClient(<SportsTicketDetailPageClient ticketId="12" />);

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe(
      "South Africa @ Mexico"
    );
    expect(screen.getByText("SportsHub ticket #12")).toBeDefined();
    expect(screen.getByText("South Africa")).toBeDefined();
    expect(screen.getByText("Accepted price 5.50")).toBeDefined();
    expect(screen.getByText("10 USDC")).toBeDefined();
    expect(screen.getByText("55 USDC")).toBeDefined();
    expect(screen.getByText("Winner: South Africa")).toBeDefined();
    expect(screen.getByText("0xabc123")).toBeDefined();
    expect(state.sdk.sportsHub.getTicket).toHaveBeenCalledWith(12n);
    expect(state.sdk.sportsHub.getMarket).toHaveBeenCalledWith(7n);
  });

  it("rejects malformed ticket ids without a SportsHub read", () => {
    renderWithQueryClient(<SportsTicketDetailPageClient ticketId="abc" />);

    expect(screen.getByText("Invalid ticket id")).toBeDefined();
    expect(state.sdk.sportsHub.getTicket).not.toHaveBeenCalled();
  });
});
