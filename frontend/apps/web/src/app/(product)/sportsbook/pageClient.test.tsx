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

const sportsbookTranslations: Record<string, string> = {
  "nav.sportsbook": "Sportsbook",
  "sportsbook.index.noRelease.title": "No release loaded",
  "sportsbook.index.noRelease.description": "The embedded release snapshot is unavailable.",
  "sportsbook.index.noRelease.status": "Unavailable",
  "sportsbook.index.header.metadataEnabled": "Metadata enabled",
  "sportsbook.index.header.readOnlyPreview": "Read-only preview",
  "sportsbook.index.header.sportsHubPresent": "SportsHub present",
  "sportsbook.index.header.sportsHubMissing": "SportsHub missing",
  "sportsbook.index.header.title": "Sportsbook Control Room",
  "sportsbook.index.header.description":
    "Fixed-odds sports markets stay behind explicit launch controls. This entry exposes the deployed SportsHub surface, release risk caps, and the signed-odds ticket path when the frontend gate is enabled.",
  "sportsbook.index.riskCard.eyebrow": "Public risk-in",
  "sportsbook.index.riskCard.signedOddsOnly": "Signed odds only",
  "sportsbook.index.riskCard.locked": "Locked",
  "sportsbook.index.riskCard.description":
    "Open a market detail page and provide a signed odds snapshot before placement.",
  "sportsbook.index.riskCard.inspect": "Inspect market before placing",
  "sportsbook.index.details.release": "Release",
  "sportsbook.index.details.sportsHub": "SportsHub",
  "sportsbook.index.details.embeddedMetadataPresent": "Embedded metadata present",
  "sportsbook.index.details.notAvailable": "Not available",
  "sportsbook.index.details.riskEngine": "Risk engine",
  "sportsbook.index.details.riskEngineHelper": "Shared cap enforcement surface",
  "sportsbook.index.details.challengeWindow": "Challenge window",
  "sportsbook.index.details.challengeWindowHelper": "Result dispute timeout",
  "sportsbook.index.details.nextMarket": "Next market",
  "sportsbook.index.details.nextTicket": "Next ticket",
  "sportsbook.index.details.runtimeReadFailed": "SportsHub runtime read failed",
  "sportsbook.index.details.sdkRead": "Read through @ssot/ssot SDK",
  "sportsbook.index.release.eyebrow": "Sports release",
  "sportsbook.index.release.title": "Oracle and settlement surface",
  "sportsbook.index.release.description":
    "The active bundle exposes signed odds identity, result reporter quorum, and the bootstrap dispute roles needed by SportsHub settlement.",
  "sportsbook.index.release.oddsSignerSet": "Odds signer set",
  "sportsbook.index.release.resultReporterSet": "Result reporter set",
  "sportsbook.index.release.reporterThreshold": "Reporter threshold",
  "sportsbook.index.release.reporterThresholdHelper": "Minimum result reporters",
  "sportsbook.index.release.frontendFlag": "Frontend flag",
  "sportsbook.index.release.booleanTrue": "true",
  "sportsbook.index.release.booleanFalse": "false",
  "sportsbook.index.release.challenger": "Challenger",
  "sportsbook.index.release.arbitrator": "Arbitrator",
  "sportsbook.index.mvp.eyebrow": "MVP market",
  "sportsbook.index.mvp.title": "Football 1X2 readiness",
  "sportsbook.index.mvp.description":
    "The current provider path is scoped to pre-match fixed odds, signed snapshots, and explicit result evidence before any public launch decision.",
  "sportsbook.index.mvp.rows.marketType.label": "Market type",
  "sportsbook.index.mvp.rows.marketType.value": "Pre-match football 1X2",
  "sportsbook.index.mvp.rows.oddsSource.label": "Odds source",
  "sportsbook.index.mvp.rows.oddsSource.value": "The Odds API candidate",
  "sportsbook.index.mvp.rows.settlement.label": "Settlement",
  "sportsbook.index.mvp.rows.settlement.value": "Reporter result plus challenge window",
  "sportsbook.index.mvp.rows.launchState.label": "Launch state",
  "sportsbook.index.mvp.rows.launchState.value": "Phase 2 NO-GO for public risk-in",
  "sportsbook.index.caps.eyebrow": "Protocol caps",
  "sportsbook.index.caps.title": "Top-level SportsHub limits",
  "sportsbook.index.caps.description":
    "These raw-unit caps are copied from the embedded release and should stay aligned with the deployment bundle and ops approval memos.",
  "sportsbook.index.caps.riskTitle": "SportsHub global risk caps",
  "sportsbook.index.marketTape.eyebrow": "Market tape",
  "sportsbook.index.marketTape.title": "Recent SportsHub markets",
  "sportsbook.index.marketTape.description":
    "The frontend reads the latest on-chain SportsHub market ids directly through the v1.3 SDK. Ticket placement is only available from a market detail page after the signed-odds gate is satisfied.",
  "sportsbook.index.lookup.eyebrow": "On-chain lookup",
  "sportsbook.index.lookup.title": "Inspect SportsHub records",
  "sportsbook.index.lookup.description":
    "Lookup stays read-only and goes through the v1.3 SDK. Use market detail for the signed-odds ticket flow.",
  "sportsbook.index.lookup.marketId": "Market id",
  "sportsbook.index.lookup.ticketId": "Ticket id",
  "sportsbook.index.lookup.marketEmpty":
    "Enter a SportsHub market id to inspect state, result status, and reserved exposure.",
  "sportsbook.index.lookup.ticketEmpty":
    "Enter a SportsHub ticket id to inspect position, stake, payout, and ticket state.",
  "sportsbook.index.lookup.marketNumericError": "Enter a numeric market id.",
  "sportsbook.index.lookup.ticketNumericError": "Enter a numeric ticket id.",
  "sportsbook.index.operator.eyebrow": "Operator writes",
  "sportsbook.index.operator.title": "Market and result administration",
  "sportsbook.index.operator.description":
    "Governance and reporter actions are exposed as typed SDK calls for authorized wallets. Public ticket placement uses a separate signed-odds path and contract roles still enforce every write.",
  "sportsbook.index.operator.walletRoleRequired": "Wallet role must be authorized on SportsHub.",
  "sportsbook.index.bankroll.eyebrow": "Bankroll",
  "sportsbook.index.bankroll.title": "Sports pool isolation",
  "sportsbook.index.bankroll.description":
    "Sports liquidity is kept separate from casino game liquidity, so sportsbook exposure can be capped, paused, and monitored independently.",
  "sportsbook.index.bankroll.noPool": "No Sports pool metadata is available in this release.",
  "sportsbook.index.controls.eyebrow": "Controls",
  "sportsbook.index.controls.title": "Launch blockers remain explicit",
  "sportsbook.index.controls.description":
    "The page is intentionally operational: it keeps the SportsHub deployment visible while preserving the public-launch blockers tracked in the ops packet.",
  "sportsbook.index.controls.links.goNoGo": "Go/no-go packet",
  "sportsbook.index.controls.links.frontendAccess": "Frontend access policy",
  "sportsbook.index.controls.links.providerPolicy": "Provider policy",
  "sportsbook.components.na": "N/A",
  "sportsbook.components.lookup.inspect": "Inspect",
  "sportsbook.components.marketInspector.title": "Market {marketId}",
  "sportsbook.components.marketInspector.stateLine": "{state} / pool {poolId}",
  "sportsbook.components.marketInspector.resultStatus.none": "No result proposed",
  "sportsbook.components.marketInspector.resultStatus.proposed": "Result proposed",
  "sportsbook.components.marketInspector.rows.event": "Event",
  "sportsbook.components.marketInspector.rows.outcomeCount": "Outcome count",
  "sportsbook.components.marketInspector.rows.startsAt": "Starts at",
  "sportsbook.components.marketInspector.rows.locksAt": "Locks at",
  "sportsbook.components.marketInspector.rows.version": "Version",
  "sportsbook.components.marketInspector.rows.marketReserved": "Market reserved",
  "sportsbook.components.marketInspector.rows.marketKey": "Market key",
  "sportsbook.components.marketInspector.rows.rulebook": "Rulebook",
  "sportsbook.components.marketInspector.rows.result": "Result",
  "sportsbook.components.marketInspector.rows.winningOutcome": "Winning outcome",
  "sportsbook.components.ticketInspector.title": "Ticket {ticketId}",
  "sportsbook.components.ticketInspector.stateLine": "{state} / market {marketId}",
  "sportsbook.components.ticketInspector.rows.position": "Position",
  "sportsbook.components.ticketInspector.rows.event": "Event",
  "sportsbook.components.ticketInspector.rows.pool": "Pool",
  "sportsbook.components.ticketInspector.rows.outcome": "Outcome",
  "sportsbook.components.ticketInspector.rows.player": "Player",
  "sportsbook.components.ticketInspector.rows.stake": "Stake",
  "sportsbook.components.ticketInspector.rows.payout": "Payout",
  "sportsbook.components.ticketInspector.rows.reserved": "Reserved",
  "sportsbook.components.ticketInspector.rows.acceptedAt": "Accepted at",
  "sportsbook.components.ticketInspector.rows.oddsSnapshot": "Odds snapshot",
  "sportsbook.components.marketTape.loading": "Loading recent SportsHub markets...",
  "sportsbook.components.marketTape.empty":
    "No SportsHub markets have been created in this release yet.",
  "sportsbook.components.marketTape.columns.market": "Market",
  "sportsbook.components.marketTape.columns.starts": "Starts",
  "sportsbook.components.marketTape.columns.reserved": "Reserved",
  "sportsbook.components.marketTape.columns.result": "Result",
  "sportsbook.components.marketTape.columns.actions": "Actions",
  "sportsbook.components.marketTape.marketTitle": "Market {marketId}",
  "sportsbook.components.marketTape.event": "Event {eventId}",
  "sportsbook.components.marketTape.pool": "Pool {poolId}",
  "sportsbook.components.marketTape.outcomes": "{count} outcomes",
  "sportsbook.components.marketTape.locks": "Locks {time}",
  "sportsbook.components.marketTape.result.none": "No result",
  "sportsbook.components.marketTape.result.challenged": "Challenged",
  "sportsbook.components.marketTape.result.outcome": "Outcome {outcomeId}",
  "sportsbook.components.marketTape.actions.open": "Open",
  "sportsbook.components.marketTape.actions.load": "Load",
  "sportsbook.components.riskRows.maxStake": "Max stake",
  "sportsbook.components.riskRows.maxPayout": "Max payout",
  "sportsbook.components.riskRows.marketReserved": "Market reserved",
  "sportsbook.components.riskRows.outcomeReserved": "Outcome reserved",
  "sportsbook.components.riskRows.eventReserved": "Event reserved",
  "sportsbook.components.riskRows.riskHash": "Risk hash",
  "sportsbook.components.poolPanel.title": "Pool {poolId}",
  "sportsbook.components.poolPanel.domainLine": "{domain} / domain {domainId}",
  "sportsbook.components.poolPanel.defaultDomain": "Sports",
  "sportsbook.components.poolPanel.active": "Active",
  "sportsbook.components.poolPanel.paused": "Paused",
  "sportsbook.components.poolPanel.bank": "Bank",
  "sportsbook.components.poolPanel.asset": "Asset",
  "sportsbook.components.poolPanel.units": "Units",
  "sportsbook.components.poolPanel.rawUnits": "raw / {decimals} decimals",
  "sportsbook.components.poolPanel.riskTitle": "Pool risk caps"
};

function translateSportsbook(key: string, values?: Record<string, string>) {
  let message = sportsbookTranslations[key] ?? key;
  for (const [name, value] of Object.entries(values ?? {})) {
    message = message.replace(`{${name}}`, value);
  }
  return message;
}

vi.mock("next-intl", () => ({
  useTranslations: () => translateSportsbook
}));

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

  it("renders SportsHub metadata without direct ticket placement on the index page", async () => {
    renderWithQueryClient(<SportsbookPageClient />);

    expect(screen.getByRole("heading", { name: "Sportsbook Control Room" })).toBeDefined();
    expect(screen.getByText("Read-only preview")).toBeDefined();
    expect(screen.getByText("SportsHub present")).toBeDefined();
    expect(screen.getAllByText("0x2db4...fa4b").length).toBeGreaterThan(0);
    expect(screen.getByText("NEXT_PUBLIC_SPORTSBOOK_ENABLED is not true.")).toBeDefined();
    expect(screen.getByText("Locked")).toBeDefined();
    expect(screen.getByRole("link", { name: "Inspect market before placing" })).toBeDefined();
    expect(await screen.findByText("8")).toBeDefined();
    expect(screen.getByText("13")).toBeDefined();
  });

  it("surfaces MVP market scope and Sports pool caps", () => {
    renderWithQueryClient(<SportsbookPageClient />);

    expect(screen.getByText("Football 1X2 readiness")).toBeDefined();
    expect(screen.getByText("Pre-match football 1X2")).toBeDefined();
    expect(screen.getByText("Pool 2")).toBeDefined();
    expect(screen.getAllByText("10,000,000").length).toBeGreaterThan(0);
    expect(screen.getByText("Phase 2 NO-GO for public risk-in")).toBeDefined();
  });

  it("renders recent SportsHub markets and loads one into the inspector", async () => {
    renderWithQueryClient(<SportsbookPageClient />);

    expect(screen.getByText("Recent SportsHub markets")).toBeDefined();
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

    expect(screen.getByText("Metadata enabled")).toBeDefined();
    expect(screen.getByText("Signed odds only")).toBeDefined();
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
