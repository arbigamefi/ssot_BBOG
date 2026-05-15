import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
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
      )
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
    pools: []
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
    release: state.release,
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
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
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

  it("does not call SportsHub for invalid market ids", () => {
    renderWithQueryClient(<SportsbookMarketDetailPageClient marketId="abc" />);

    expect(screen.getByText("Invalid market id")).toBeDefined();
    expect(state.sdk.sportsHub.getMarket).not.toHaveBeenCalled();
  });
});
