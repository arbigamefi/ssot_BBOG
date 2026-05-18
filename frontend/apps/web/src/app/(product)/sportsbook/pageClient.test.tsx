import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const zeroHash = `0x${"0".repeat(64)}`;
const zeroAddress = `0x${"0".repeat(40)}`;

function createSportsHubMock() {
  return {
    getNextMarketId: vi.fn().mockResolvedValue(8n),
    getNextTicketId: vi.fn().mockResolvedValue(13n),
    getMarket: vi.fn().mockImplementation(async (marketId: bigint) => ({
      marketId,
      eventId: 90n + marketId,
      poolId: 2,
      outcomeCount: 3,
      startsAt: 1_800_000_000,
      lockTime: 1_800_003_600,
      resultFinalitySeconds: 604_800,
      version: 1n,
      marketKey: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      rulebookHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      state: marketId === 7n ? "open" : "locked"
    })),
    getResult: vi.fn().mockImplementation(async (marketId: bigint) => ({
      marketId,
      eventId: 90n + marketId,
      poolId: 2,
      winningOutcomeId: 1,
      marketVersion: 1n,
      resultPayloadHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      resultSourceHash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      evidenceHash: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      rulebookHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      reporterSetHash: "0x9999999999999999999999999999999999999999999999999999999999999999",
      reporterThreshold: 1,
      reporterCount: 1,
      proposer: "0x1111111111111111111111111111111111111111",
      observedAt: 1_800_010_000,
      proposedAt: 1_800_010_100,
      finalizesAt: 1_800_614_900,
      challenged: false,
      challengeReasonHash: zeroHash,
      challenger: zeroAddress,
      challengedAt: 0,
      challengeDecision: "none",
      arbitrationDecisionHash: zeroHash,
      arbitrator: zeroAddress,
      arbitratedAt: 0
    })),
    getMarketReserved: vi.fn().mockResolvedValue(2_000_000n),
    createMarket: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    openMarket: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    suspendMarket: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    lockMarket: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    voidMarket: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    proposeResult: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    finalizeResult: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    settleTicket: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    settleTickets: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    refundTicket: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    refundTickets: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    voidTicket: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    voidTickets: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    getTicket: vi.fn().mockResolvedValue({
      ticketId: 12n,
      positionId: 34n,
      marketId: 7n,
      eventId: 99n,
      poolId: 2,
      outcomeId: 1,
      player: "0x1111111111111111111111111111111111111111",
      stake: 1_000_000n,
      payout: 1_800_000n,
      reserved: 1_800_000n,
      oddsSnapshotHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      rulebookHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      acceptedAt: 1_800_000_100,
      state: "held"
    })
  };
}

const state = {
  release: {
    chainId: 84532,
    name: "Base Sepolia",
    releaseDigest: "0x7ad0f2cb1a996251325c00441b125ca5276c5bf70f011577222ce588cae1349f",
    contracts: {
      gameHub: "0x1111111111111111111111111111111111111111",
      vrfHub: "0x2222222222222222222222222222222222222222",
      poolRegistry: "0x3333333333333333333333333333333333333333",
      sportsHub: "0x2db4ba326c2c3e5830b0da10f0c52b4097f9fa4b",
      sportsRiskEngine: "0xb9c3647cb5daf23dea8335b7d91c7aa5f6bc2579"
    },
    assets: [],
    games: {},
    sports: {
      enabled: true,
      sportsHub: "0x2db4ba326c2c3e5830b0da10f0c52b4097f9fa4b",
      riskEngine: "0xb9c3647cb5daf23dea8335b7d91c7aa5f6bc2579",
      oddsSignerSetHash: "0x3181e36dda893c31b3108b977ad21a8814ac18776e5e26ba89833f47e5058cbb",
      resultReporterSetHash: "0x4d6c357ad9229b0489a1a9e49e78f2cd2c07d4fae7e24b969e9416c9fa540dd7",
      resultReporterThreshold: "1",
      resultChallengeTimeoutSeconds: "604800",
      resultChallenger: "0x6ee473ce7aa56bda640bd7560604e1699fd9d013",
      resultArbitrator: "0x7033114a50115fdbca684dea0734a502ba2f7bd8",
      maxStake: "10000000",
      maxPayout: "20000000",
      maxMarketReserved: "100000000",
      maxOutcomeReserved: "50000000",
      maxEventReserved: "150000000"
    },
    pools: [
      {
        poolId: 2,
        domainId: 2,
        domain: "Sports",
        active: true,
        asset: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
        bank: "0x3686664d8d92feab8c4c9ac0baaeb07c8bddbc85",
        symbol: "",
        decimals: 18,
        sportsRisk: {
          maxStake: "10000000",
          maxPayout: "20000000",
          maxMarketReserved: "100000000",
          maxOutcomeReserved: "50000000",
          maxEventReserved: "150000000",
          riskHash: "0x0707ba776912152fe0028608c2b31e2ac864f24ed79351eaa10ea012303793e6"
        }
      }
    ]
  } as any,
  readOnlyReason: null as string | null,
  sportsbook: {
    enabled: false,
    frontendEnabled: false,
    hasSportsRelease: true,
    enablementFlag: "NEXT_PUBLIC_SPORTSBOOK_ENABLED",
    disabledReason: "NEXT_PUBLIC_SPORTSBOOK_ENABLED is not true."
  } as any,
  sdk: {
    sportsHub: createSportsHubMock()
  } as any
};

vi.mock("../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    release: state.release,
    readOnlyReason: state.readOnlyReason,
    sportsbook: state.sportsbook
  })
}));

vi.mock("../../../ssot/sdk", () => ({
  useSSOTSDK: () => ({
    sdk: state.sdk,
    ready: Boolean(state.sdk),
    readOnly: false
  })
}));

vi.mock("../../../components/PageTransition", () => ({
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
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

vi.mock("next-intl", async () => {
  const messages = (await import("../../../i18n/locales/en/common.json")).default as Record<
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

  function translate(key: string, values?: Record<string, string>) {
    const resolved = resolveMessage(key);
    let message = typeof resolved === "string" ? resolved : key;
    for (const [name, value] of Object.entries(values ?? {})) {
      message = message.replace(`{${name}}`, value);
    }
    return message;
  }

  return {
    useTranslations: () => translate
  };
});

import { SportsbookPageClient } from "./pageClient";

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("SportsbookPageClient", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    state.release = {
      ...state.release,
      sports: {
        ...state.release.sports,
        resultChallengeTimeoutSeconds: "604800"
      }
    };
    state.readOnlyReason = null;
    state.sportsbook = {
      enabled: false,
      frontendEnabled: false,
      hasSportsRelease: true,
      enablementFlag: "NEXT_PUBLIC_SPORTSBOOK_ENABLED",
      disabledReason: "NEXT_PUBLIC_SPORTSBOOK_ENABLED is not true."
    };
    state.sdk = {
      sportsHub: createSportsHubMock()
    };
  });

  it("renders a player-facing sportsbook overview without direct ticket placement", async () => {
    renderWithQueryClient(<SportsbookPageClient />);

    expect(screen.getByRole("heading", { name: "Sportsbook" })).toBeDefined();
    expect(screen.getAllByText("Preview mode").length).toBeGreaterThan(0);
    expect(screen.getByText("SportsHub present")).toBeDefined();
    expect(screen.getByText("Ticket placement")).toBeDefined();
    expect(
      screen.getByText(
        "Market reads are live, but public ticket placement is disabled for this build. You can still inspect the latest market and settlement rules."
      )
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Open latest market" })).toBeDefined();
    expect(await screen.findByText("8")).toBeDefined();
    expect(screen.getByText("13")).toBeDefined();
  });

  it("surfaces MVP market scope and Sports pool caps", () => {
    renderWithQueryClient(<SportsbookPageClient />);

    expect(screen.getByText("Football 1X2 ticket flow")).toBeDefined();
    expect(screen.getByText("Pre-match football 1X2")).toBeDefined();
    expect(screen.getByText("Pool 2")).toBeDefined();
    expect(screen.getAllByText("10,000,000").length).toBeGreaterThan(0);
    expect(screen.getByText("Read-only until ticketing is enabled")).toBeDefined();
  });

  it("renders recent SportsHub markets and loads one into the inspector", async () => {
    renderWithQueryClient(<SportsbookPageClient />);

    expect(screen.getByText("Available football markets")).toBeDefined();
    expect(await screen.findByText("Market 7")).toBeDefined();
    expect(screen.getByText("Event 97")).toBeDefined();
    expect(screen.getAllByRole("link", { name: "Open" })[0]?.getAttribute("href")).toBe(
      "/sportsbook/7"
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Load" })[0]!);

    expect((screen.getByLabelText("Market id") as HTMLInputElement).value).toBe("7");
    expect(await screen.findByText("open / pool 2")).toBeDefined();
    expect(state.sdk.sportsHub.getMarket).toHaveBeenCalledWith(7n);
  });

  it("points enabled ticket placement to market detail instead of the index page", () => {
    state.sportsbook = {
      enabled: true,
      frontendEnabled: true,
      hasSportsRelease: true,
      enablementFlag: "NEXT_PUBLIC_SPORTSBOOK_ENABLED"
    };

    renderWithQueryClient(<SportsbookPageClient />);

    expect(screen.getByText("Tickets enabled")).toBeDefined();
    expect(screen.getByText("Signed odds only")).toBeDefined();
    expect(screen.getByText("Canary tickets enabled")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Place ticket" })).toBeNull();
  });

  it("renders operator write controls locked until a wallet is connected", () => {
    renderWithQueryClient(<SportsbookPageClient />);

    expect(screen.getByText("Market and result administration")).toBeDefined();
    expect(screen.getByText("Wallet required")).toBeDefined();
    expect(
      (screen.getByRole("button", { name: "Create market" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("looks up SportsHub market and ticket records through the SDK", async () => {
    renderWithQueryClient(<SportsbookPageClient />);

    fireEvent.change(screen.getByLabelText("Market id"), { target: { value: "7" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Inspect" })[0]!);

    expect(await screen.findByText("open / pool 2")).toBeDefined();
    expect(screen.getAllByText("Market 7").length).toBeGreaterThan(0);
    expect(screen.getByText("Result proposed")).toBeDefined();
    expect(screen.getByText("2000000")).toBeDefined();
    expect(state.sdk.sportsHub.getMarket).toHaveBeenCalledWith(7n);
    expect(state.sdk.sportsHub.getResult).toHaveBeenCalledWith(7n);
    expect(state.sdk.sportsHub.getMarketReserved).toHaveBeenCalledWith(7n);

    fireEvent.change(screen.getByLabelText("Ticket id"), { target: { value: "12" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Inspect" })[1]!);

    expect(await screen.findByText("Ticket 12")).toBeDefined();
    expect(screen.getByText("held / market 7")).toBeDefined();
    expect(screen.getAllByText("1800000").length).toBeGreaterThan(0);
    expect(state.sdk.sportsHub.getTicket).toHaveBeenCalledWith(12n);
  });
});
