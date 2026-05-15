import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const zeroHash = `0x${"0".repeat(64)}`;
const zeroAddress = `0x${"0".repeat(40)}`;

function createSportsHubMock() {
  return {
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
      state: "open"
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
    getEventReserved: vi.fn().mockResolvedValue(4_000_000n),
    getPoolEventReserved: vi.fn().mockResolvedValue(3_500_000n),
    getMarketOutcomeReserved: vi
      .fn()
      .mockImplementation(async (_marketId: bigint, outcomeId: number) =>
        BigInt(100_000 + outcomeId)
      ),
    getTicket: vi.fn().mockResolvedValue({
      ticketId: 12n,
      positionId: 34n,
      marketId: 7n,
      eventId: 97n,
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
    }),
    settleTicket: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    settleTickets: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    refundTicket: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    refundTickets: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    voidTicket: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    voidTickets: vi.fn().mockResolvedValue({ ok: true, txHash: "0xabc123" }),
    planPlaceTicket: vi.fn().mockResolvedValue({
      chainId: 84532,
      releaseDigest: "0x7ad0f2cb1a996251325c00441b125ca5276c5bf70f011577222ce588cae1349f",
      warnings: [],
      steps: [],
      payload: {},
      preview: {
        allowance: 0n,
        needsApproval: false,
        asset: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
        bank: "0x3686664d8d92feab8c4c9ac0baaeb07c8bddbc85",
        marketState: "open",
        oddsTicketHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
      }
    }),
    executeTicketPlan: vi.fn().mockResolvedValue({
      placeTicketTx: { ok: true, txHash: "0xabc123" },
      ticketId: 99n
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
      riskEngine: "0xb9c3647cb5daf23dea8335b7d91c7aa5f6bc2579"
    },
    pools: [
      {
        poolId: 2,
        domainId: 2,
        domain: "Sports",
        active: true,
        asset: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
        bank: "0x3686664d8d92feab8c4c9ac0baaeb07c8bddbc85",
        symbol: "USDC",
        decimals: 6,
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

vi.mock("../../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    chainId: 84532,
    release: state.release,
    readOnly: false,
    readOnlyReason: state.readOnlyReason,
    sportsbook: state.sportsbook
  })
}));

vi.mock("../../../../ssot/sdk", () => ({
  useSSOTSDK: () => ({
    sdk: state.sdk,
    ready: Boolean(state.sdk),
    readOnly: false
  })
}));

vi.mock("../../../../components/PageTransition", () => ({
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

import { SportsbookMarketDetailPageClient } from "./pageClient";

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("SportsbookMarketDetailPageClient", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    state.release = {
      ...state.release,
      sports: {
        ...state.release.sports
      }
    };
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

  it("reads a SportsHub market detail and exposure records", async () => {
    renderWithQueryClient(<SportsbookMarketDetailPageClient marketId="7" />);

    expect(screen.getByRole("heading", { name: "Market 7" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to sportsbook" }).getAttribute("href")).toBe(
      "/sportsbook"
    );
    expect(await screen.findByText("open / pool 2")).toBeDefined();
    expect(screen.getByText("Result proposed")).toBeDefined();
    expect(screen.getByText("Pool-event reserved")).toBeDefined();
    expect(screen.getByText("3,500,000")).toBeDefined();
    expect(screen.getByText("Outcome 2")).toBeDefined();
    expect(screen.getByText("100,002")).toBeDefined();

    expect(state.sdk.sportsHub.getMarket).toHaveBeenCalledWith(7n);
    expect(state.sdk.sportsHub.getResult).toHaveBeenCalledWith(7n);
    expect(state.sdk.sportsHub.getMarketOutcomeReserved).toHaveBeenCalledWith(7n, 2);
  });

  it("inspects ticket terminalization state without requiring an operator wallet", async () => {
    renderWithQueryClient(<SportsbookMarketDetailPageClient marketId="7" />);

    expect(await screen.findByText("Settle, refund, or void tickets")).toBeDefined();
    fireEvent.change(screen.getByLabelText("Ticket ids"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Inspect ticket" }));

    expect(await screen.findByText("Ticket 12")).toBeDefined();
    expect(screen.getByText("held / market 7")).toBeDefined();
    expect((screen.getByRole("button", { name: "Settle" }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(state.sdk.sportsHub.getTicket).toHaveBeenCalledWith(12n);
  });

  it("plans signed odds ticket placement only after the sportsbook gate is enabled", async () => {
    state.sportsbook = {
      enabled: true,
      frontendEnabled: true,
      hasSportsRelease: true,
      enablementFlag: "NEXT_PUBLIC_SPORTSBOOK_ENABLED"
    };
    state.sdk = {
      account: "0x1111111111111111111111111111111111111111",
      sportsHub: createSportsHubMock()
    };
    renderWithQueryClient(<SportsbookMarketDetailPageClient marketId="7" />);

    expect(await screen.findByText("Signed odds ticket")).toBeDefined();
    fireEvent.change(screen.getByLabelText("Stake raw units"), { target: { value: "1000000" } });
    fireEvent.change(screen.getByLabelText("Odds WAD"), {
      target: { value: "2100000000000000000" }
    });
    fireEvent.change(screen.getByLabelText("Max stake"), { target: { value: "2000000" } });
    fireEvent.change(screen.getByLabelText("Max payout"), { target: { value: "4200000" } });
    fireEvent.change(screen.getByLabelText("Expires at"), { target: { value: "1900000000" } });
    fireEvent.change(screen.getByLabelText("Odds signature"), {
      target: { value: `0x${"11".repeat(65)}` }
    });
    fireEvent.click(screen.getByRole("button", { name: "Plan ticket" }));

    expect(await screen.findByText("Plan ready.")).toBeDefined();
    expect(state.sdk.sportsHub.planPlaceTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 84532,
        marketId: 7n,
        outcomeId: 0,
        stake: 1_000_000n,
        signature: `0x${"11".repeat(65)}`
      })
    );
  });

  it("does not call SportsHub for invalid market ids", () => {
    renderWithQueryClient(<SportsbookMarketDetailPageClient marketId="abc" />);

    expect(screen.getByText("Invalid market id")).toBeDefined();
    expect(state.sdk.sportsHub.getMarket).not.toHaveBeenCalled();
  });
});
