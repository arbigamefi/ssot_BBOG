import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

const state = {
  release: null as any,
  readOnlyReason: null as string | null,
  chainId: 84532,
  bets: [] as any[],
  betsLoading: false,
  betsError: null as Error | null,
  indexerStatus: { lastSyncedBlock: 321, lagBlocks: 4 },
  account: null as string | null
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("../../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    release: state.release,
    readOnlyReason: state.readOnlyReason,
    chainId: state.chainId
  })
}));

vi.mock("../../../../features/betting/useBetsByGame", () => ({
  useBetsByGame: () => ({
    data: state.bets,
    isLoading: state.betsLoading,
    error: state.betsError
  })
}));

vi.mock("../../../../features/ops/useIndexer", () => ({
  useIndexer: () => ({
    indexerStatus: state.indexerStatus
  })
}));

vi.mock("../../../../ssot/sdk", () => ({
  useSSOTSDK: () => ({
    sdk: state.account ? { account: state.account } : null
  })
}));

vi.mock("../../../../ssot/runtime", () => ({
  useSSOTRuntime: () => ({
    db: null
  })
}));

vi.mock("../../../../app-shell/WalletButton", () => ({
  useConnectModal: () => ({
    openConnectModal: vi.fn()
  })
}));

vi.mock("../../../../components/Placeholder", () => ({
  Placeholder: ({ title, description }: any) => (
    <div data-testid="placeholder">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}));

vi.mock("../../../../components/ConnectWalletPrompt", () => ({
  ConnectWalletPrompt: ({ action }: any) => <div data-testid="connect-wallet-prompt">{action}</div>
}));

vi.mock("../../../../components/PageTransition", () => ({
  PageTransition: ({ children }: any) => <div>{children}</div>
}));

vi.mock("@ssot/ui", () => ({
  AuditTabs: ({ children }: any) => <div>{children}</div>,
  AuditTableHeader: ({ children }: any) => <div>{children}</div>,
  AuditTableRow: ({ children }: any) => <div>{children}</div>,
  AuditTableCell: ({ children }: any) => <div>{children}</div>,
  Button: ({ children, asChild }: any) =>
    asChild ? children : <button type="button">{children}</button>,
  Card: ({ children }: any) => <section>{children}</section>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CopyButton: ({ value }: any) => <button type="button">{value}</button>,
  DataTable: ({ columns, data, onRowClick, loading, emptyMessage }: any) => {
    if (loading) return <div>Loading…</div>;
    if (!data.length) return <div>{emptyMessage}</div>;
    return (
      <div data-testid="data-table">
        {data.map((row: any, index: number) => (
          <div
            key={row.id ?? row.player ?? index}
            data-testid={`row-${index}`}
            role="button"
            tabIndex={0}
            onClick={() => onRowClick?.(row, index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onRowClick?.(row, index);
            }}
          >
            {columns.map((column: any) => (
              <div key={column.key}>{column.render(row, index)}</div>
            ))}
          </div>
        ))}
      </div>
    );
  },
  ErrorCallout: ({ title, message }: any) => (
    <div data-testid="error-callout">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  ),
  RoomStrip: ({ title }: any) => <div>{title}</div>,
  StatusBadge: ({ label, status }: any) => <span>{label ?? status}</span>,
  TabBar: ({ tabs, activeKey, onTabChange }: any) => (
    <div data-testid="tab-bar">
      {tabs.map((tab: any) => (
        <button
          key={tab.key}
          type="button"
          data-active={tab.key === activeKey}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  ),
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

import { GamePageClient } from "./pageClient";

const MOCK_RELEASE = {
  name: "Base Sepolia",
  releaseDigest: "0xdeadbeefcafefeed",
  contracts: {
    hub: "0x1234567890abcdef1234567890abcdef12345678"
  },
  assets: [
    {
      symbol: "USDC",
      decimals: 6,
      address: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
      bank: "0x49b9dc94d98c3d78224ca37abf05ec09af7c50ff"
    }
  ],
  gamesMeta: [
    {
      gameId: "0x8d8e6987fb3617c00abdd68d6c1f7eac28b7f9f96b25367e9b65dacaa0914a8b",
      slug: "dice",
      label: "Dice",
      module: "0x8fb66ccc25d07b252d282be646d24444c062c667",
      paramsEncoding: "abi.encode(uint8 cap)"
    },
    {
      gameId: "0x2d2e6987fb3617c00abdd68d6c1f7eac28b7f9f96b25367e9b65dacaa0914aaa",
      slug: "roulette",
      label: "Roulette",
      module: "0x1111111111111111111111111111111111111111",
      paramsEncoding: "abi.encode(uint8 kind, uint40 payload)"
    }
  ]
};

const MOCK_BETS = [
  {
    id: "84532:1",
    betId: "1",
    state: "placed",
    player: "0x1111111111111111111111111111111111111111",
    updatedAt: Date.now() - 60_000,
    lastTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
];

describe("GamePageClient", () => {
  afterEach(() => {
    cleanup();
    state.release = null;
    state.readOnlyReason = null;
    state.bets = [];
    state.betsLoading = false;
    state.betsError = null;
    state.indexerStatus = { lastSyncedBlock: 321, lagBlocks: 4 };
    state.account = null;
  });

  it("shows placeholder when release is unavailable", () => {
    state.release = null;
    state.readOnlyReason = "No release";
    render(<GamePageClient slug="dice" />);
    expect(screen.getByTestId("placeholder")).toBeDefined();
    expect(screen.getByText("No release")).toBeDefined();
  });

  it("renders release-driven game room and recent bets", () => {
    state.release = MOCK_RELEASE;
    state.bets = MOCK_BETS;

    render(<GamePageClient slug="dice" />);

    expect(screen.getByText("Precision Dice")).toBeDefined();
    expect(screen.getByText("Live SSOT Module")).toBeDefined();
    expect(screen.getByText("Wallet Balance")).toBeDefined();
    expect(screen.getByText("Bet Amount")).toBeDefined();
  });

  it("renders roulette as a standard European table room", () => {
    state.release = MOCK_RELEASE;

    render(<GamePageClient slug="roulette" />);

    expect(screen.getByText("European Roulette")).toBeDefined();
    expect(screen.getByText("Wallet Balance")).toBeDefined();
    expect(screen.getByText("Bet Amount")).toBeDefined();
  });

  it("renders coin toss as a compat room shell", () => {
    state.release = {
      ...MOCK_RELEASE,
      gamesMeta: [
        ...MOCK_RELEASE.gamesMeta,
        {
          gameId: "0x3333333333333333333333333333333333333333333333333333333333333333",
          slug: "coin-toss",
          label: "Coin Toss",
          module: "0x3333333333333333333333333333333333333333",
          paramsEncoding: "abi.encode(bool isHeads)"
        }
      ]
    };

    render(<GamePageClient slug="coin-toss" />);

    expect(screen.getByText("Coin Toss")).toBeDefined();
    expect(screen.getByText("Wallet Balance")).toBeDefined();
    expect(screen.getByText("Bet Amount")).toBeDefined();
  });

  it("shows placeholder when slug is not present in release", () => {
    state.release = MOCK_RELEASE;
    render(<GamePageClient slug="keno" />);
    expect(screen.getByTestId("placeholder")).toBeDefined();
    expect(screen.getByText("Game not found.")).toBeDefined();
  });
});
